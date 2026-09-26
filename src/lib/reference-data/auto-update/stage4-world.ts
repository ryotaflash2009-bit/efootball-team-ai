import { createHash } from "node:crypto";
import { buildStagingDataset, type StagingDataset } from "./source-snapshot";
import { createRecordedFixtureTransport, SOURCE_ENDPOINTS, sourceRequestKey, type SourceRequest, type SourceResponse, type SourceTransport } from "./source-transport";
import { analyzeSourceTimestamps, type SourceTimestampReport } from "./stage1-verification";
import { applyUndoPlan, applyUpdatePlans, PRODUCTION_REFERENCE_SCHEMA, type ApplyPgClient, type UndoPlan } from "./update-apply";
import { buildUpdateCandidate, countCardRatingOnlyUpdates, type UpdateCandidate } from "./update-candidate";
import { computeUpdateTableChecksum, rowIdentity } from "./update-contract";
import { computeUpdateDiff, type UpdateDiffPlan } from "./update-diff";
import { collectWorldFullSnapshot, runIsolatedDryRunApply } from "./update-dry-run";
import { evaluateApplyPrerequisites, type ApplyPrerequisites } from "./update-policy";
import { UPDATER_ROLE_NAME } from "./updater-role";
import { runUpdaterPreflight } from "./production-apply-preflight";
import {
  APPLY_WORKFLOW_PATH,
  Stage4Stop,
  checkRun,
  cols,
  createSchema,
  evaluateBackupBinding,
  priorApplications,
  seedRows,
  simulationPrerequisites,
  stage4WorldRunTitle,
  targetSchema,
  toIso,
  toSchema,
  type DryRunRecord,
  type Stage4Client,
  type Stage4IsolatedSql,
  type Stage4Mode,
  type WorkflowRunFacts,
} from "./stage4-managers";

/**
 * World専用のProduction更新リハーサル(本人方針2026-09-24)。managersのStage 4と同じ段階・bindingで、対象だけが違う:
 *   plan     : updater preflight + Productionのworld_player_cards・import_batchesを読み取り専用で取得 → World全件を1回取得 →
 *              candidate・diff・policy(card_ratingだけの変更は別集計、appearanceは既存値を保持、時刻の検査)
 *   dry-run  : 新しいpre-apply Backupとplanへbinding → Production再読込(stale検出) → 隔離PostgreSQLでdry run・executor・undo
 *   apply    : 全bindingを再検証 → executorで1 transaction → post-apply検証(managers・analysisへの影響なしを含む)
 *   verify   : post-apply検証だけを読み取り専用で再実行
 *
 * 絶対条件: 対象はworld_player_cards(+監査のimport_batches)だけ。removedが1件でもあれば停止(物理削除なし)。
 * 自動retry・自動rollback・自動undoなし。要約には行の値を出さない(件数・列名・checksum・finding codeだけ)。
 */

export const WORLD_TABLE = "world_player_cards" as const;
export const WORLD_CONFIRM: Readonly<Record<Stage4Mode, string>> = Object.freeze({
  plan: "plan-world",
  "dry-run": "dry-run-world",
  apply: "apply-world-to-production",
  verify: "verify-world",
});
/** World全件取得と適用規模の上限(2026-09-23の完全取得: 443 page・13,286件・29MB、差分6,156件)。 */
export const WORLD_LIMITS = Object.freeze({ maxPages: 460, maxRecords: 14_000, maxRequests: 462, maxTotalBytes: 40 * 1024 * 1024, maxChanges: 8_000 });
export const WORLD_MAX_IDENTITIES_IN_SUMMARY = 10;
export const WORLD_DRY_RUN_SCHEMA = "reference_data_stage4w_dry_run";
export const WORLD_ROLLBACK_SCHEMA = "reference_data_stage4w_rollback_test";
const APPROVAL_TTL_MINUTES = 60;
const SHA256_RE = /^[0-9a-f]{64}$/;
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

// ---------------------------------------------------------------------------
// upstream: World全件を1回取得して応答を記録し、以降は記録を再生する
// ---------------------------------------------------------------------------

export interface RecordedWorldPage {
  readonly page: number;
  readonly requestBody: string;
  readonly status: number;
  readonly contentType: string;
  readonly bodyText: string;
}

const pageOf = (body: string | null): number => {
  try {
    const p = (JSON.parse(body ?? "{}") as { page?: unknown }).page;
    return typeof p === "number" && Number.isInteger(p) ? p : -1;
  } catch {
    return -1;
  }
};

/** World全件を1回取得する(再試行はendpointの既定・transportの上限まで)。完全なsnapshotでなければ停止。 */
export async function fetchWorldFullOnce(transport: SourceTransport, fetchedAt: string, sleep: (ms: number) => Promise<void>): Promise<RecordedWorldPage[]> {
  const byKey = new Map<string, RecordedWorldPage>();
  const recording: SourceTransport = {
    kind: transport.kind,
    async request(req: SourceRequest): Promise<SourceResponse> {
      const res = await transport.request(req);
      // 再試行した場合は最後の応答が正(失敗応答はcollect側が停止または再試行する)。
      byKey.set(sourceRequestKey(req), { page: pageOf(req.body), requestBody: req.body ?? "", status: res.status, contentType: res.headers["content-type"] ?? "", bodyText: res.bodyText });
      return res;
    },
  };
  const c = await collectWorldFullSnapshot(recording, { fetchedAt, sleep, maxPages: WORLD_LIMITS.maxPages, maxRecords: WORLD_LIMITS.maxRecords, stopOnDuplicateIdentity: true });
  if (!c.ok) throw new Stage4Stop(`source_${c.failure.code}`);
  if (c.snapshot.completeness.status !== "complete") throw new Stage4Stop("source_incomplete");
  return [...byKey.values()].sort((a, b) => a.page - b.page);
}

function replayTransport(pages: readonly RecordedWorldPage[]): SourceTransport {
  return createRecordedFixtureTransport(
    pages.map((p) => ({
      request: { method: "POST" as const, url: SOURCE_ENDPOINTS["efootball-world"].url, body: p.requestBody },
      responses: [{ status: p.status, headers: { "content-type": p.contentType }, bodyText: p.bodyText }],
    })),
  );
}

/** 記録した本文から、timezone判定用の元の appearance.updatedAt 文字列を取り出す(値は要約へ出さない)。 */
function rawUpdatedAtValues(pages: readonly RecordedWorldPage[]): (string | null)[] {
  const out: (string | null)[] = [];
  for (const p of pages) {
    try {
      const players = (JSON.parse(p.bodyText) as { players?: unknown[] }).players ?? [];
      for (const pl of players) {
        const u = (pl as { appearance?: { updatedAt?: unknown } })?.appearance?.updatedAt;
        out.push(typeof u === "string" ? u : null);
      }
    } catch {
      /* collectが既にschema_driftで停止している */
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Production現在状態(updater・読み取り専用transaction)
// ---------------------------------------------------------------------------

export interface WorldProductionState {
  readonly world: readonly Record<string, unknown>[];
  readonly importBatches: readonly Record<string, unknown>[];
  readonly counts: { readonly world_player_cards: number; readonly managers: number; readonly import_batches: number };
  /** managersが変わっていないことの確認用(集計値だけ)。 */
  readonly managersMaxUpdatedAt: string | null;
  /** 逆行検出の基準(Productionのappearance_updated_at最大値)。 */
  readonly worldMaxAppearanceUpdatedAt: string | null;
}

export async function readWorldProductionState(
  client: Stage4Client,
  schema: string = PRODUCTION_REFERENCE_SCHEMA,
  /** 読み取りを許可するrole(既定はupdater。Planは読み取り専用roleを渡す)。 */
  allowedRoles: readonly string[] = [UPDATER_ROLE_NAME],
): Promise<WorldProductionState> {
  const s = targetSchema(schema);
  const who = await client.query("select current_user::text as u, current_setting('transaction_read_only') as ro");
  if (!allowedRoles.includes(String(who.rows[0]?.u))) throw new Stage4Stop("wrong_role");
  if (who.rows[0]?.ro !== "on") throw new Stage4Stop("not_read_only");
  const world = (await client.query(`select ${cols("world_player_cards")} from ${s}.world_player_cards`)).rows;
  const importBatches = (await client.query(`select ${cols("import_batches")} from ${s}.import_batches`)).rows;
  const agg = (
    await client.query(
      `select (select count(*) from ${s}.world_player_cards)::int as w, (select max(appearance_updated_at) from ${s}.world_player_cards) as wmax,
              (select count(*) from ${s}.managers)::int as m, (select max(updated_at) from ${s}.managers) as mmax,
              (select count(*) from ${s}.import_batches)::int as b`,
    )
  ).rows[0];
  const counts = { world_player_cards: Number(agg?.w), managers: Number(agg?.m), import_batches: Number(agg?.b) };
  if (counts.world_player_cards !== world.length || counts.import_batches !== importBatches.length) throw new Stage4Stop("inconsistent_read");
  return { world, importBatches, counts, managersMaxUpdatedAt: toIso(agg?.mmax), worldMaxAppearanceUpdatedAt: toIso(agg?.wmax) };
}

/** 自動更新でWorldを適用した記録(監査batch)が既にあるか。無ければ初回適用(manual review必須)。 */
export function isFirstWorldApply(importBatches: readonly Readonly<Record<string, unknown>>[]): boolean {
  return !importBatches.some((r) => r.target_table === WORLD_TABLE && r.status === "verified" && typeof r.notes === "string" && r.notes.startsWith("auto-update "));
}

// ---------------------------------------------------------------------------
// candidate・diff・policy
// ---------------------------------------------------------------------------

export interface WorldCandidateBuild {
  readonly staging: StagingDataset;
  readonly plan: UpdateDiffPlan;
  readonly candidate: UpdateCandidate;
  readonly receivedRecordCount: number;
  readonly pageCount: number;
  readonly timestamps: SourceTimestampReport;
  readonly cardRatingOnlyChangedCount: number;
}

export async function buildWorldCandidate(pages: readonly RecordedWorldPage[], fetchedAt: string, state: WorldProductionState, now: string): Promise<WorldCandidateBuild> {
  const c = await collectWorldFullSnapshot(replayTransport(pages), { fetchedAt, sleep: async () => undefined, maxPages: WORLD_LIMITS.maxPages, maxRecords: WORLD_LIMITS.maxRecords, stopOnDuplicateIdentity: true });
  if (!c.ok) throw new Stage4Stop(`source_${c.failure.code}`);
  if (c.snapshot.completeness.status !== "complete") throw new Stage4Stop("source_incomplete");
  if (c.snapshot.completeness.conflictingDuplicateIdentities.length > 0) throw new Stage4Stop("duplicate_identity");
  let staging: StagingDataset;
  try {
    staging = buildStagingDataset(c.snapshot);
  } catch {
    throw new Stage4Stop("source_incomplete");
  }
  const plan = computeUpdateDiff({ table: WORLD_TABLE, currentRows: state.world, staging });
  const normalized = staging.rows.map((r) => {
    const v = (r as Readonly<Record<string, unknown>>).appearance_updated_at;
    return typeof v === "string" ? v : null;
  });
  const timestamps = analyzeSourceTimestamps(normalized, rawUpdatedAtValues(pages), fetchedAt, state.worldMaxAppearanceUpdatedAt);
  const candidate = buildUpdateCandidate({
    plans: [plan],
    stagings: [staging],
    currentRows: { world_player_cards: state.world },
    history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: state.worldMaxAppearanceUpdatedAt, lastAppliedAt: null },
    now,
    policySignals: {
      sourceTimestampFuture: timestamps.futureCount > 0,
      massIdenticalSourceTimestamps: timestamps.findings.includes("mass_identical_timestamps"),
      firstWorldApply: isFirstWorldApply(state.importBatches),
    },
  });
  return { staging, plan, candidate, receivedRecordCount: c.snapshot.completeness.receivedRecordCount, pageCount: pages.length, timestamps, cardRatingOnlyChangedCount: countCardRatingOnlyUpdates(plan) };
}

export interface WorldPlanEvaluation {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly manualReviewCodes: readonly string[];
}

export function evaluateWorldPlan(b: WorldCandidateBuild): WorldPlanEvaluation {
  const problems: string[] = [];
  const { plan, candidate } = b;
  if (plan.table !== WORLD_TABLE || JSON.stringify(candidate.targetTables) !== JSON.stringify([WORLD_TABLE])) problems.push("unexpected_target_tables");
  if (plan.blockingReasons.length > 0) problems.push("plan_blocked");
  if (plan.report.duplicateCount > 0) problems.push("duplicate_identity");
  if (plan.report.invalidCount > 0) problems.push("invalid_source_records");
  if (plan.removedCandidates.length > 0 || plan.report.removedCount > 0) problems.push("removal_not_allowed");
  if (plan.resurrected.length > 0) problems.push("resurrection_not_supported");
  for (const f of candidate.policy.findings) if (f.severity === "hard_block") problems.push(`policy_hard_block:${f.code}`);
  const changes = plan.inserts.length + plan.updates.length;
  if (changes === 0) problems.push("no_changes");
  if (changes > WORLD_LIMITS.maxChanges) problems.push("rehearsal_scope_exceeded");
  const manualReviewCodes = [...new Set(candidate.policy.findings.filter((f) => f.severity === "manual_review").map((f) => f.code))].sort();
  return { ok: problems.length === 0, problems, manualReviewCodes };
}

/** 要約(行の値なし。identityは上限付き、時刻は範囲と件数だけ)。 */
export function summarizeWorldPlan(b: WorldCandidateBuild, e: WorldPlanEvaluation): Record<string, unknown> {
  const r = b.plan.report;
  const hist: Record<string, number> = {};
  for (const u of b.plan.updates) for (const f of u.changedFields) hist[f] = (hist[f] ?? 0) + 1;
  const t = b.timestamps;
  return {
    targetTables: [...b.candidate.targetTables],
    pageCount: b.pageCount,
    receivedRecordCount: b.receivedRecordCount,
    beforeCount: r.beforeCount,
    afterCount: r.afterCount,
    addedCount: r.addedCount,
    changedCount: r.changedCount,
    cardRatingOnlyChangedCount: b.cardRatingOnlyChangedCount,
    structuralChangedCount: r.changedCount - b.cardRatingOnlyChangedCount,
    removedCount: r.removedCount,
    unchangedCount: r.unchangedCount,
    duplicateCount: r.duplicateCount,
    invalidCount: r.invalidCount,
    changedFieldFrequency: hist,
    addedIdentities: b.plan.inserts.slice(0, WORLD_MAX_IDENTITIES_IN_SUMMARY).map((x) => x.identity),
    addedIdentitiesTruncated: b.plan.inserts.length > WORLD_MAX_IDENTITIES_IN_SUMMARY,
    sourceChecksum: b.candidate.sourceChecksum,
    idempotencyKey: b.candidate.idempotencyKey,
    planChecksum: b.plan.planChecksum,
    beforeChecksum: r.beforeChecksum,
    afterChecksum: r.afterChecksum,
    sourceTimestamps: {
      total: t.total, withTimestamp: t.withTimestamp, rawWithoutTimezone: t.rawWithoutTimezone, rawWithTimezone: t.rawWithTimezone,
      interpretation: "naive values interpreted as UTC (provisional; semantic time zone unresolved)",
      min: t.min, max: t.max, futureCount: t.futureCount, regression: t.regression, mostCommonCount: t.mostCommonCount, mostCommonShare: t.mostCommonShare, findings: [...t.findings],
    },
    policySeverity: b.candidate.policy.severity,
    findings: b.candidate.policy.findings.map((f) => ({ severity: f.severity, code: f.code })),
    manualReviewCodes: [...e.manualReviewCodes],
    preservedColumnDrift: b.candidate.preservedColumnDrift,
    planProblems: [...e.problems],
  };
}

// ---------------------------------------------------------------------------
// source bundle(plan runのartifact。World全pageの応答本文 = 公開されている上流データ)
// ---------------------------------------------------------------------------

export const WORLD_BUNDLE_SCHEMA = "stage4-world-source-bundle/v1";

export interface WorldSourceBundle {
  readonly schema: typeof WORLD_BUNDLE_SCHEMA;
  readonly fetchedAt: string;
  readonly pages: readonly RecordedWorldPage[];
  readonly bodiesSha256: string;
  readonly sourceChecksum: string;
  readonly planChecksum: string;
  readonly beforeChecksum: string;
  readonly productionCountsAtPlan: WorldProductionState["counts"];
  /** Planが読んだProduction状態スナップショット(別artifact)のsha256。Dry runはこれと照合してから使う。 */
  readonly stateSha256?: string;
}

const bodiesDigest = (pages: readonly RecordedWorldPage[]) => sha256(pages.map((p) => `${p.page}:${sha256(p.bodyText)}`).join("\n"));

export function buildWorldBundle(pages: readonly RecordedWorldPage[], fetchedAt: string, b: WorldCandidateBuild, counts: WorldProductionState["counts"], stateSha256?: string): WorldSourceBundle {
  return { schema: WORLD_BUNDLE_SCHEMA, fetchedAt, pages, bodiesSha256: bodiesDigest(pages), sourceChecksum: b.candidate.sourceChecksum, planChecksum: b.plan.planChecksum, beforeChecksum: b.plan.report.beforeChecksum, productionCountsAtPlan: counts, ...(stateSha256 ? { stateSha256 } : {}) };
}

export function parseWorldBundle(text: string): WorldSourceBundle {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Stage4Stop("bundle_not_json");
  }
  if (d.schema !== WORLD_BUNDLE_SCHEMA || typeof d.fetchedAt !== "string" || Number.isNaN(Date.parse(d.fetchedAt)) || !Array.isArray(d.pages) || d.pages.length === 0) throw new Stage4Stop("bundle_shape");
  for (const p of d.pages as Record<string, unknown>[]) {
    if (typeof p?.page !== "number" || typeof p.requestBody !== "string" || typeof p.status !== "number" || typeof p.contentType !== "string" || typeof p.bodyText !== "string") throw new Stage4Stop("bundle_shape");
  }
  for (const k of ["bodiesSha256", "sourceChecksum", "planChecksum", "beforeChecksum"]) if (typeof d[k] !== "string" || !SHA256_RE.test(d[k] as string)) throw new Stage4Stop("bundle_shape");
  if (d.stateSha256 !== undefined && (typeof d.stateSha256 !== "string" || !SHA256_RE.test(d.stateSha256))) throw new Stage4Stop("bundle_shape");
  if (bodiesDigest(d.pages as RecordedWorldPage[]) !== d.bodiesSha256) throw new Stage4Stop("bundle_body_hash_mismatch");
  return d as unknown as WorldSourceBundle;
}

// ---------------------------------------------------------------------------
// post-apply検証(読み取り専用transactionの中で呼ぶ)
// ---------------------------------------------------------------------------

export interface WorldPostApplyExpectation {
  readonly schema: string;
  readonly batchId: string;
  readonly planChecksum: string;
  readonly afterChecksum: string;
  readonly insertedIdentities: readonly string[];
  readonly before: Pick<WorldProductionState, "counts" | "managersMaxUpdatedAt">;
}

export async function verifyWorldPostApply(client: Stage4Client, e: WorldPostApplyExpectation): Promise<{ ok: boolean; problems: string[]; facts: Record<string, unknown> }> {
  const s = targetSchema(e.schema);
  const problems: string[] = [];
  const world = (await client.query(`select ${cols("world_player_cards")} from ${s}.world_player_cards`)).rows;
  if (computeUpdateTableChecksum(WORLD_TABLE, world) !== e.afterChecksum) problems.push("world_checksum_mismatch");
  if (world.length !== e.before.counts.world_player_cards + e.insertedIdentities.length) problems.push("world_count_unexpected");
  const ids = new Set(world.map((r) => rowIdentity(WORLD_TABLE, r)));
  if (e.insertedIdentities.some((i) => !ids.has(i))) problems.push("inserted_identity_missing");
  const batch = (await client.query(`select status, payload_hash, target_table from ${s}.import_batches where batch_id = $1`, [e.batchId])).rows;
  if (batch.length !== 1 || batch[0].status !== "verified" || batch[0].payload_hash !== e.planChecksum || batch[0].target_table !== WORLD_TABLE) problems.push("audit_batch_not_verified");
  const agg = (
    await client.query(
      `select (select count(*) from ${s}.import_batches)::int as b, (select count(*) from ${s}.managers)::int as m, (select max(updated_at) from ${s}.managers) as mmax`,
    )
  ).rows[0];
  if (Number(agg?.b) !== e.before.counts.import_batches + 1) problems.push("import_batches_count_unexpected");
  if (Number(agg?.m) !== e.before.counts.managers || toIso(agg?.mmax) !== e.before.managersMaxUpdatedAt) problems.push("managers_changed");
  return {
    ok: problems.length === 0,
    problems,
    facts: { worldCount: world.length, importBatchesCount: Number(agg?.b), managersCount: Number(agg?.m), auditBatchStatus: batch[0]?.status ?? null },
  };
}

// ---------------------------------------------------------------------------
// 隔離PostgreSQLでのdry run・executor・post-apply検証・undoの模擬(使い捨てDBだけ)
// ---------------------------------------------------------------------------

export interface WorldIsolatedResult {
  readonly verified: boolean;
  readonly problems: readonly string[];
  readonly dryRun: { readonly verified: boolean; readonly worldBefore: number; readonly worldAfter: number; readonly observedAfterChecksumMatches: boolean; readonly rediffChanges: number };
  readonly executor: { readonly applyOk: boolean; readonly applyCode: string | null; readonly auditBatchVerified: boolean; readonly postVerifyOk: boolean; readonly postVerifyProblems: readonly string[] };
  readonly undo: { readonly ok: boolean; readonly restored: number; readonly insertedRemaining: number; readonly existingRowsMatchBefore: boolean };
}

export async function runWorldIsolatedValidation(client: Stage4Client, b: WorldCandidateBuild, state: WorldProductionState, sql: Stage4IsolatedSql, now: Date): Promise<WorldIsolatedResult> {
  const problems: string[] = [];
  const expectedAfter = state.world.length + b.plan.inserts.length;

  await createSchema(client, WORLD_DRY_RUN_SCHEMA, sql, false);
  let dryRun: WorldIsolatedResult["dryRun"];
  try {
    await seedRows(client, WORLD_DRY_RUN_SCHEMA, "import_batches", state.importBatches, []);
    const dry = await runIsolatedDryRunApply(client, WORLD_DRY_RUN_SCHEMA, [b.plan], [b.staging], { world_player_cards: state.world });
    const n = Number((await client.query(`select count(*)::int as n from ${WORLD_DRY_RUN_SCHEMA}.world_player_cards`)).rows[0]?.n);
    const t = dry.tables[0];
    dryRun = { verified: dry.verified && n === expectedAfter, worldBefore: state.world.length, worldAfter: n, observedAfterChecksumMatches: !!t && t.observedAfterChecksum === t.expectedAfterChecksum, rediffChanges: t?.rediffChanges ?? -1 };
    if (!dryRun.verified) problems.push("dry_run_not_verified");
  } finally {
    await client.query(`drop schema if exists ${WORLD_DRY_RUN_SCHEMA} cascade`);
  }

  const exists = await client.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME]);
  if (exists.rows[0]?.e === true) throw new Stage4Stop("isolated_db_updater_role_exists");
  await createSchema(client, WORLD_ROLLBACK_SCHEMA, sql, true);
  let roleCreated = false;
  let executor: WorldIsolatedResult["executor"] = { applyOk: false, applyCode: null, auditBatchVerified: false, postVerifyOk: false, postVerifyProblems: [] };
  let undo: WorldIsolatedResult["undo"] = { ok: false, restored: 0, insertedRemaining: 0, existingRowsMatchBefore: false };
  try {
    await seedRows(client, WORLD_ROLLBACK_SCHEMA, "import_batches", state.importBatches, []);
    await seedRows(client, WORLD_ROLLBACK_SCHEMA, "world_player_cards", state.world, ["created_at", "updated_at"]);
    await client.query(toSchema(sql.createUpdaterRole, WORLD_ROLLBACK_SCHEMA));
    roleCreated = true;
    await client.query(toSchema(sql.updaterPolicies, WORLD_ROLLBACK_SCHEMA));
    const simAgg = (
      await client.query(
        `select (select count(*) from ${WORLD_ROLLBACK_SCHEMA}.world_player_cards)::int as w, (select count(*) from ${WORLD_ROLLBACK_SCHEMA}.managers)::int as m,
                (select max(updated_at) from ${WORLD_ROLLBACK_SCHEMA}.managers) as mmax, (select count(*) from ${WORLD_ROLLBACK_SCHEMA}.import_batches)::int as b`,
      )
    ).rows[0];
    const simBefore = { counts: { world_player_cards: Number(simAgg?.w), managers: Number(simAgg?.m), import_batches: Number(simAgg?.b) }, managersMaxUpdatedAt: toIso(simAgg?.mmax) };
    await client.query(`set role ${UPDATER_ROLE_NAME}`);
    try {
      const applied = await applyUpdatePlans(client as ApplyPgClient, {
        schema: WORLD_ROLLBACK_SCHEMA,
        plans: [b.plan],
        candidate: b.candidate,
        prerequisites: simulationPrerequisites(b.candidate.sourceChecksum, now),
        datasetVersion: "stage4w-simulation",
        approvedBy: "simulation",
        sourceRowCounts: { world_player_cards: b.staging.rowCount },
      });
      if (applied.ok) {
        await client.query("begin read only");
        let post;
        try {
          post = await verifyWorldPostApply(client, {
            schema: WORLD_ROLLBACK_SCHEMA,
            batchId: applied.tables[0].batchId,
            planChecksum: b.plan.planChecksum,
            afterChecksum: b.plan.report.afterChecksum,
            insertedIdentities: b.plan.inserts.map((r) => r.identity),
            before: simBefore,
          });
        } finally {
          await client.query("rollback");
        }
        executor = { applyOk: true, applyCode: null, auditBatchVerified: !post.problems.includes("audit_batch_not_verified"), postVerifyOk: post.ok, postVerifyProblems: post.problems };
        const u = applied.undo[0];
        const r = await applyUndoPlan(client as ApplyPgClient, WORLD_ROLLBACK_SCHEMA, u);
        const rows = (await client.query(`select ${cols("world_player_cards")} from ${WORLD_ROLLBACK_SCHEMA}.world_player_cards`)).rows;
        const inserted = new Set(u.insertedIdentities);
        const kept = rows.filter((row) => !inserted.has(rowIdentity(WORLD_TABLE, row)));
        undo = { ok: r.ok, restored: r.ok ? r.restored : 0, insertedRemaining: rows.length - kept.length, existingRowsMatchBefore: computeUpdateTableChecksum(WORLD_TABLE, kept) === u.beforeChecksum };
      } else {
        executor = { ...executor, applyCode: applied.code };
      }
    } finally {
      await client.query("reset role");
    }
  } finally {
    if (roleCreated) await client.query(toSchema(sql.rollbackUpdaterRole, WORLD_ROLLBACK_SCHEMA)).catch(() => undefined);
    await client.query(`drop schema if exists ${WORLD_ROLLBACK_SCHEMA} cascade`);
  }
  if (!executor.applyOk) problems.push(`executor_simulation_failed:${executor.applyCode ?? "unknown"}`);
  if (executor.applyOk && !executor.postVerifyOk) problems.push("post_verify_simulation_failed");
  if (executor.applyOk && (!undo.ok || !undo.existingRowsMatchBefore || undo.insertedRemaining !== b.plan.inserts.length)) problems.push("undo_simulation_failed");
  return { verified: problems.length === 0, problems, dryRun, executor, undo };
}

// ---------------------------------------------------------------------------
// apply(Production 1回)
// ---------------------------------------------------------------------------

export interface WorldApplyInput {
  readonly schema: string;
  readonly bundle: WorldSourceBundle;
  readonly boundSourceChecksum: string;
  readonly boundPlanChecksum: string;
  readonly acknowledgedManualReview: string;
  readonly planRunId: string;
  readonly planFacts: WorkflowRunFacts;
  readonly newerPlanRunCount: number;
  readonly backupRunId: string;
  readonly backupFacts: WorkflowRunFacts;
  readonly backupSummaryText: string;
  readonly dryRunRunId: string;
  readonly dryRunFacts: WorkflowRunFacts;
  readonly dryRun: DryRunRecord;
  readonly applyCommitSha: string;
  readonly approvedBy: string;
  readonly now: string;
}

export type WorldApplyResult =
  | { readonly status: "not_applied"; readonly stage: string; readonly problems: readonly string[]; readonly plan?: Record<string, unknown> }
  | {
      readonly status: "applied_verified" | "rollback_required";
      readonly batchId: string;
      readonly inserted: number;
      readonly updated: number;
      readonly postVerify: { ok: boolean; problems: string[]; facts: Record<string, unknown> };
      readonly expectation: WorldPostApplyExpectation;
      readonly undo: UndoPlan;
      readonly plan: Record<string, unknown>;
    };

export async function runWorldApply(client: Stage4Client, input: WorldApplyInput): Promise<WorldApplyResult> {
  const schema = targetSchema(input.schema);
  const stop = (stage: string, problems: readonly string[], plan?: Record<string, unknown>): WorldApplyResult => ({ status: "not_applied", stage, problems, plan });

  await client.query("begin read only");
  let preflightOk = false;
  let state: WorldProductionState;
  try {
    const pre = await runUpdaterPreflight(client, schema);
    if (!pre.ok) return stop("preflight", pre.problems);
    preflightOk = true;
    state = await readWorldProductionState(client, schema);
  } catch (err) {
    return stop("read", [err instanceof Stage4Stop ? err.code : "read_failed"]);
  } finally {
    await client.query("rollback").catch(() => undefined);
  }

  let b: WorldCandidateBuild;
  try {
    b = await buildWorldCandidate(input.bundle.pages, input.bundle.fetchedAt, state, input.now);
  } catch (err) {
    return stop("candidate", [err instanceof Stage4Stop ? err.code : "candidate_failed"]);
  }
  const e = evaluateWorldPlan(b);
  const planSummary = summarizeWorldPlan(b, e);
  const problems: string[] = [...e.problems];
  if (b.candidate.sourceChecksum !== input.bundle.sourceChecksum) problems.push("candidate_differs_from_plan_run");
  if (!SHA256_RE.test(input.boundSourceChecksum) || b.candidate.sourceChecksum !== input.boundSourceChecksum) problems.push("source_checksum_not_bound");
  if (!SHA256_RE.test(input.boundPlanChecksum) || b.plan.planChecksum !== input.boundPlanChecksum) problems.push("stale_plan");
  if (input.bundle.planChecksum !== input.boundPlanChecksum) problems.push("plan_run_checksum_mismatch");
  const ack = e.manualReviewCodes.length === 0 ? "none" : e.manualReviewCodes.join(",");
  if (input.acknowledgedManualReview !== ack) problems.push("manual_review_not_acknowledged");
  problems.push(...checkRun(input.planFacts, { id: input.planRunId, path: APPLY_WORKFLOW_PATH, title: stage4WorldRunTitle("plan"), commitSha: input.applyCommitSha }, "plan"));
  if (input.newerPlanRunCount !== 0) problems.push("candidate_not_latest");
  problems.push(...checkRun(input.dryRunFacts, { id: input.dryRunRunId, path: APPLY_WORKFLOW_PATH, title: stage4WorldRunTitle("dry-run"), commitSha: input.applyCommitSha }, "dry_run"));
  const d = input.dryRun;
  if (!d.verified) problems.push("dry_run_not_verified");
  if (d.planRunId !== input.planRunId || d.backupRunId !== input.backupRunId) problems.push("dry_run_not_bound_to_runs");
  if (d.sourceChecksum !== input.boundSourceChecksum || d.planChecksum !== input.boundPlanChecksum || d.beforeChecksum !== b.plan.report.beforeChecksum) problems.push("dry_run_not_bound_to_plan");
  const backup = evaluateBackupBinding({ runId: input.backupRunId, facts: input.backupFacts, summaryText: input.backupSummaryText, productionCounts: state.counts, now: input.now });
  problems.push(...backup.problems);
  if (Date.parse(input.backupFacts.createdAt) < Date.parse(input.planFacts.updatedAt)) problems.push("backup_not_after_plan");

  const prior = priorApplications(state.importBatches, b.plan.planChecksum, b.candidate.idempotencyKey);
  const prerequisites: ApplyPrerequisites = {
    sourceFetched: true,
    sourceChecksum: b.candidate.sourceChecksum,
    sourceChecksumAlreadyApplied: prior.sourceAlreadyApplied,
    schemaValidated: true,
    diffGenerated: true,
    hardBlockCount: b.candidate.policy.findings.filter((f) => f.severity === "hard_block").length,
    manualReviewResolved: !problems.includes("manual_review_not_acknowledged"),
    backup: backup.backup,
    dryRun: { verified: d.verified, startedAt: d.startedAt, completedAt: d.completedAt, shadowComparisonPassed: d.verified },
    approval: {
      present: true,
      approvedAt: input.now,
      expiresAt: new Date(Date.parse(input.now) + APPROVAL_TTL_MINUTES * 60_000).toISOString(),
      boundSourceChecksum: input.boundSourceChecksum,
      boundCommitSha: input.planFacts.headSha,
    },
    applyCommitSha: input.applyCommitSha,
    candidateIsLatest: input.newerPlanRunCount === 0,
    superseded: input.newerPlanRunCount !== 0,
    concurrencyLockAcquired: true,
    duplicateBatchExists: prior.duplicateBatch,
    rollbackPlanPrepared: d.verified,
    updaterRoleVerified: preflightOk,
    productionPreflightPassed: preflightOk,
    now: input.now,
  };
  problems.push(...evaluateApplyPrerequisites(prerequisites).failures);
  if (problems.length > 0) return stop("binding", [...new Set(problems)], planSummary);

  const applied = await applyUpdatePlans(client as ApplyPgClient, {
    schema,
    plans: [b.plan],
    candidate: b.candidate,
    prerequisites,
    datasetVersion: `stage4-world-${input.now.slice(0, 10)}`,
    approvedBy: input.approvedBy,
    sourceRowCounts: { world_player_cards: b.staging.rowCount },
  });
  if (!applied.ok) return stop("apply", [applied.code, ...applied.failures.map(String).filter((f) => /^[a-z_:]+$/.test(f))], planSummary);

  const t = applied.tables[0];
  const expectation: WorldPostApplyExpectation = {
    schema,
    batchId: t.batchId,
    planChecksum: b.plan.planChecksum,
    afterChecksum: b.plan.report.afterChecksum,
    insertedIdentities: b.plan.inserts.map((r) => r.identity),
    before: { counts: state.counts, managersMaxUpdatedAt: state.managersMaxUpdatedAt },
  };
  await client.query("begin read only");
  let post: { ok: boolean; problems: string[]; facts: Record<string, unknown> };
  try {
    post = await verifyWorldPostApply(client, expectation);
    const pre = await runUpdaterPreflight(client, schema);
    if (!pre.ok) post = { ...post, ok: false, problems: [...post.problems, ...pre.problems.map((p) => `preflight_after_apply:${p}`)] };
  } catch {
    post = { ok: false, problems: ["post_verify_query_failed"], facts: {} };
  } finally {
    await client.query("rollback").catch(() => undefined);
  }
  return { status: post.ok ? "applied_verified" : "rollback_required", batchId: t.batchId, inserted: t.inserted, updated: t.updated, postVerify: post, expectation, undo: applied.undo[0], plan: planSummary };
}
