import { createHash } from "node:crypto";
import { buildStagingDataset, summarizeSnapshot, type SourceSnapshot, type StagingDataset } from "./source-snapshot";
import { fetchSourceWithRetry, isSourceFetchError, type SourceTransport } from "./source-transport";
import { WORLD_STAT_KEYS, WorldSourceParseError, buildWorldSearchRequest, normalizeWorldPlayerRecord, parseWorldSearchPage, toWorldSourceRow } from "./source-world";
import { collectManagersSnapshot, collectWorldFullSnapshot, collectWorldIncrementalSnapshot, runIsolatedDryRunApply, type DryRunPgClient } from "./update-dry-run";
import { computeUpdateDiff, type DiffTable, type UpdateDiffPlan } from "./update-diff";
import { buildUpdateCandidate, summarizeUpdateCandidate, type CandidateHistory, type UpdateCandidate } from "./update-candidate";
import { buildIsolatedReferenceSchemaDdl, type RepositoryReferenceSql } from "./isolated-reference-schema";
import { applyUndoPlan, applyUpdatePlans } from "./update-apply";
import { UPDATE_TABLE_CONTRACTS, computeUpdateTableChecksum, rowIdentity } from "./update-contract";
import type { ApplyPrerequisites } from "./update-policy";
import { UPDATER_ROLE_NAME } from "./updater-role";

/**
 * 自動更新 Stage 1: upstream読み取り検証の手順(transport・現在行・PostgreSQL clientは呼び出し側が渡す)。
 *
 *   probe: eFootball Worldのpage 1だけを取得し、実schema(項目名)・pagination情報・上限内かを確認する。
 *   full : Worldのfull scan(page・件数上限付き) + managers.json 1回 → snapshot → diff → policy。
 * 結果は値・本文を含まない要約だけにする(選手名・監督名・upstreamの本文は出さない)。
 */

export const STAGE1_LIMITS = Object.freeze({ worldMaxPages: 30, worldMaxRecords: 15_000, managersMaxRecords: 500 });

/** normalizeWorldPlayerRecordが読む項目。page 1の実データにこれらが存在するかを確認する。 */
const WORLD_EXPECTED_KEYS = Object.freeze([
  "id", "name", "nameJp", "type", "position", "nationality", "region", "league", "team", "overallRating", "maxOverall",
  "maximumLevel", "rating", "playingStyle", "playingStyleDef", "foot", "age", "height", "weight", "imageUrl", "mobileImageUrl",
  "boost1", "boost2", "skills", "aiStyles", "appearance", ...WORLD_STAT_KEYS,
]);
const WORLD_REQUIRED_KEYS = Object.freeze(["id", "name"]);

function histogram(values: readonly string[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const v of values) h[v] = (h[v] ?? 0) + 1;
  return Object.fromEntries(Object.entries(h).sort(([a], [b]) => (a < b ? -1 : 1)));
}

export interface WorldSchemaReport {
  readonly recordCount: number;
  readonly totalCount: number | null;
  readonly totalPages: number | null;
  readonly pageSize: number | null;
  readonly hasNext: boolean | null;
  /** 期待項目のうち、1件以上に存在した割合(0〜1)。 */
  readonly expectedKeyPresence: Readonly<Record<string, number>>;
  readonly missingRequiredKeys: readonly string[];
  readonly unexpectedKeys: readonly string[];
  readonly acceptedCount: number;
  readonly rejectedReasons: Readonly<Record<string, number>>;
  readonly withinLimits: boolean;
  readonly schemaDrift: boolean;
}

export function analyzeWorldPage(bodyText: string, fetchedAt: string): WorldSchemaReport {
  const page = parseWorldSearchPage(bodyText);
  const records = page.players.filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && !Array.isArray(p));
  const presence: Record<string, number> = {};
  for (const k of WORLD_EXPECTED_KEYS) presence[k] = records.length === 0 ? 0 : records.filter((r) => k in r || (k === "id" && "playerId" in r)).length / records.length;
  const seen = new Set<string>();
  for (const r of records) for (const k of Object.keys(r)) seen.add(k);
  const known = new Set<string>([...WORLD_EXPECTED_KEYS, "playerId", "likesCount", "viewCount", "averageRating", "totalRatings"]);
  const reasons: string[] = [];
  let accepted = 0;
  for (const r of records) {
    const res = toWorldSourceRow(normalizeWorldPlayerRecord(r), fetchedAt);
    if (res.ok) accepted++;
    else reasons.push(...res.rejection.reasons);
  }
  const missingRequired = WORLD_REQUIRED_KEYS.filter((k) => (presence[k] ?? 0) < 1);
  return {
    recordCount: page.players.length,
    totalCount: page.totalCount,
    totalPages: page.totalPages,
    pageSize: page.pageSize,
    hasNext: page.hasNext,
    expectedKeyPresence: presence,
    missingRequiredKeys: missingRequired,
    unexpectedKeys: [...seen].filter((k) => !known.has(k)).sort(),
    acceptedCount: accepted,
    rejectedReasons: histogram(reasons),
    withinLimits: (page.totalPages ?? Infinity) <= STAGE1_LIMITS.worldMaxPages && (page.totalCount ?? Infinity) <= STAGE1_LIMITS.worldMaxRecords,
    schemaDrift: records.length !== page.players.length || missingRequired.length > 0 || records.length === 0,
  };
}

export type Stage1ProbeResult =
  | { readonly ok: true; readonly report: WorldSchemaReport }
  | { readonly ok: false; readonly stage: "source_fetch" | "parse"; readonly code: string };

export async function runWorldProbe(transport: SourceTransport, fetchedAt: string, sleep?: (ms: number) => Promise<void>): Promise<Stage1ProbeResult> {
  try {
    const r = await fetchSourceWithRetry(transport, buildWorldSearchRequest(1, "CREATED_AT"), { sleep });
    return { ok: true, report: analyzeWorldPage(r.response.bodyText, fetchedAt) };
  } catch (err) {
    if (isSourceFetchError(err)) return { ok: false, stage: "source_fetch", code: err.code };
    if (err instanceof WorldSourceParseError) return { ok: false, stage: "parse", code: err.reason };
    throw err;
  }
}

export interface Stage1FullInput {
  readonly transport: SourceTransport;
  readonly currentRows: Readonly<Record<DiffTable, readonly Readonly<Record<string, unknown>>[]>>;
  readonly history: CandidateHistory;
  readonly fetchedAt: string;
  readonly now: string;
  readonly sleep?: (ms: number) => Promise<void>;
  /**
   * full: World全件(完全性・removed検出あり、page上限内でのみ可能)。
   * incremental: UPDATED_AT降順の差分取得(page上限まで。removed検出なし・不完全をcomplete扱いしない)。
   */
  readonly worldMode?: "full" | "incremental" | "skip";
}

export interface Stage1FullResult {
  readonly worldMode?: "full" | "incremental" | "skip";
  readonly worldIncrementalDecision?: string | null;
  readonly stoppedAt: string | null;
  readonly failure: { readonly table: DiffTable; readonly stage: string; readonly code: string } | null;
  readonly snapshots: readonly SourceSnapshot[];
  readonly stagings: readonly StagingDataset[];
  readonly plans: readonly UpdateDiffPlan[];
  readonly candidate: UpdateCandidate | null;
  readonly duplicateIdentities: Readonly<Record<DiffTable, number>>;
}

export async function runStage1Full(input: Stage1FullInput): Promise<Stage1FullResult> {
  const empty = { worldMode: input.worldMode ?? "full", snapshots: [], stagings: [], plans: [], candidate: null, duplicateIdentities: { world_player_cards: 0, managers: 0 } };
  const worldMode = input.worldMode ?? "full";
  let decision: string | null = null;
  let world;
  if (worldMode === "skip") {
    world = null;
  } else if (worldMode === "incremental") {
    const known = new Map<string, string | null>();
    let prevMax: string | null = null;
    for (const r of input.currentRows.world_player_cards) {
      const u = typeof r.appearance_updated_at === "string" ? new Date(r.appearance_updated_at).toISOString() : null;
      known.set(String(r.world_card_id), u);
      if (u && (prevMax == null || u > prevMax)) prevMax = u;
    }
    const inc = await collectWorldIncrementalSnapshot(input.transport, known, { previousMaxUpdatedAt: prevMax, previousFirstPageHash: null, maxPages: STAGE1_LIMITS.worldMaxPages }, { fetchedAt: input.fetchedAt, sleep: input.sleep });
    world = inc.ok ? { ok: true as const, snapshot: inc.snapshot } : inc;
    decision = inc.ok ? inc.decision : null;
  } else {
    world = await collectWorldFullSnapshot(input.transport, {
      fetchedAt: input.fetchedAt,
      sleep: input.sleep,
      maxPages: STAGE1_LIMITS.worldMaxPages,
      maxRecords: STAGE1_LIMITS.worldMaxRecords,
    });
  }
  if (world && !world.ok) return { ...empty, stoppedAt: "world_fetch", failure: { table: "world_player_cards", stage: world.failure.stage, code: world.failure.code } };
  const managers = await collectManagersSnapshot(input.transport, { fetchedAt: input.fetchedAt, sleep: input.sleep });
  if (!managers.ok) return { ...empty, snapshots: world ? [world.snapshot] : [], stoppedAt: "managers_fetch", failure: { table: "managers", stage: managers.failure.stage, code: managers.failure.code } };
  const snapshots = world ? [world.snapshot, managers.snapshot] : [managers.snapshot];
  const duplicateIdentities = {
    world_player_cards: world ? world.snapshot.completeness.conflictingDuplicateIdentities.length : 0,
    managers: managers.snapshot.completeness.conflictingDuplicateIdentities.length,
  };
  if (managers.snapshot.completeness.receivedRecordCount > STAGE1_LIMITS.managersMaxRecords) {
    return { ...empty, snapshots, duplicateIdentities, stoppedAt: "managers_limit", failure: { table: "managers", stage: "source_fetch", code: "cap_exceeded" } };
  }
  const stagings: StagingDataset[] = [];
  for (const s of snapshots) {
    try {
      stagings.push(buildStagingDataset(s));
    } catch {
      const code = s.completeness.conflictingDuplicateIdentities.length > 0 ? "duplicate_identity" : "source_incomplete";
      return { ...empty, snapshots, duplicateIdentities, stoppedAt: "normalize", failure: { table: s.table, stage: "normalize", code } };
    }
  }
  const plans = stagings.map((s) => computeUpdateDiff({ table: s.table, currentRows: input.currentRows[s.table], staging: s }));
  const candidate = buildUpdateCandidate({ plans, stagings, currentRows: input.currentRows, history: input.history, now: input.now });
  return { worldMode, worldIncrementalDecision: decision, stoppedAt: null, failure: null, snapshots, stagings, plans, candidate, duplicateIdentities };
}

/** Evidence用の要約(値・名前・本文なし)。 */
export function summarizeStage1Full(r: Stage1FullResult): Record<string, unknown> {
  return {
    worldMode: r.worldMode ?? "full",
    worldIncrementalDecision: r.worldIncrementalDecision ?? null,
    stoppedAt: r.stoppedAt,
    failure: r.failure,
    snapshots: r.snapshots.map(summarizeSnapshot),
    rejectedReasons: Object.fromEntries(r.snapshots.map((s) => [s.table, histogram(s.rejected.flatMap((x) => [...x.reasons]))])),
    duplicateIdentities: r.duplicateIdentities,
    diffReports: r.plans.map((p) => ({
      table: p.report.table,
      beforeCount: p.report.beforeCount,
      afterCount: p.report.afterCount,
      addedCount: p.report.addedCount,
      changedCount: p.report.changedCount,
      removedCount: p.report.removedCount,
      unchangedCount: p.report.unchangedCount,
      resurrectedCount: p.report.resurrectedCount,
      duplicateCount: p.report.duplicateCount,
      invalidCount: p.report.invalidCount,
      schemaDriftCount: p.report.schemaDriftCount,
      changedFieldFrequency: histogram(p.updates.flatMap((u) => [...u.changedFields])),
      removalDetection: p.removalDetection,
      blocked: p.blockingReasons.length > 0,
      blockingReasonCount: p.blockingReasons.length,
      beforeChecksum: p.report.beforeChecksum.slice(0, 12),
      afterChecksum: p.report.afterChecksum.slice(0, 12),
      planChecksum: p.planChecksum.slice(0, 12),
    })),
    candidate: r.candidate ? summarizeUpdateCandidate(r.candidate) : null,
  };
}

// ---------------------------------------------------------------------------
// 隔離PostgreSQLでのdry runとrollback simulation(使い捨てDBだけ)
// ---------------------------------------------------------------------------

export const STAGE1_DRY_RUN_SCHEMA = "reference_data_stage1_dry_run";
export const STAGE1_ROLLBACK_SCHEMA = "reference_data_stage1_rollback_test";

export interface Stage1IsolatedSql {
  readonly reference: RepositoryReferenceSql;
  readonly createUpdaterRole: string;
  readonly updaterPolicies: string;
  readonly rollbackUpdaterRole: string;
}

const toSchema = (sql: string, schema: string) => sql.replace(/\breference_data\b(?!_)/g, schema);

async function createIsolatedSchema(client: DryRunPgClient, schema: string, sql: Stage1IsolatedSql, forceRls: boolean): Promise<void> {
  await client.query(`drop schema if exists ${schema} cascade`);
  await client.query(buildIsolatedReferenceSchemaDdl(schema, sql.reference));
  if (forceRls) {
    for (const t of ["world_player_cards", "managers", "import_batches"]) {
      await client.query(`alter table ${schema}.${t} enable row level security`);
      await client.query(`alter table ${schema}.${t} force row level security`);
    }
  }
}

async function seedCurrentRows(client: DryRunPgClient, schema: string, table: DiffTable, rows: readonly Readonly<Record<string, unknown>>[]): Promise<void> {
  const contract = UPDATE_TABLE_CONTRACTS[table];
  const cols = contract.productionColumns.filter((c) => c !== "created_at" && c !== "updated_at");
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const values: unknown[] = [];
    const tuples = part.map((row, j) => {
      const ph = cols.map((c, k) => {
        const v = c === "dataset_version" ? (row[c] ?? "sqlite-derived-current-state") : (row[c] ?? null);
        values.push(v != null && contract.jsonbColumns.includes(c) ? JSON.stringify(v) : v instanceof Date ? v.toISOString() : v);
        return `$${j * cols.length + k + 1}`;
      });
      return `(${ph.join(",")})`;
    });
    await client.query(`insert into ${schema}.${table} (${cols.join(",")}) values ${tuples.join(",")}`, values);
  }
}

function simulationPrerequisites(sourceChecksum: string, now: Date): ApplyPrerequisites {
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  return {
    sourceFetched: true, sourceChecksum, sourceChecksumAlreadyApplied: false, schemaValidated: true, diffGenerated: true,
    hardBlockCount: 0, manualReviewResolved: true,
    backup: { runId: "0", category: "pre-apply", conclusion: "success", restoreVerified: true, storageVerified: true, rowCounts: { world_player_cards: 1, managers: 1, player_card_analysis: 1, import_batches: 1 }, completedAt: at(40) },
    dryRun: { verified: true, startedAt: at(30), completedAt: at(20), shadowComparisonPassed: true },
    approval: { present: true, approvedAt: at(10), expiresAt: at(-60), boundSourceChecksum: sourceChecksum, boundCommitSha: "0".repeat(40) },
    applyCommitSha: "0".repeat(40), candidateIsLatest: true, superseded: false, concurrencyLockAcquired: true, duplicateBatchExists: false,
    rollbackPlanPrepared: true, updaterRoleVerified: true, productionPreflightPassed: true, now: now.toISOString(),
  };
}

export interface Stage1IsolatedResult {
  readonly dryRun: { readonly verified: boolean; readonly tables: readonly unknown[]; readonly problemCount: number };
  readonly rollbackSimulation: {
    readonly performed: boolean;
    readonly note: string;
    readonly applyOk: boolean;
    readonly applyCode: string | null;
    readonly undo: readonly { table: DiffTable; ok: boolean; restored: number; insertedRemaining: number; restoredMatchesBefore: boolean }[];
  };
}

/**
 * 使い捨てPostgreSQL(呼び出し側がlocalhost・テスト専用DBだけへ接続したclient)で、
 * (1) Phase Eの隔離dry run、(2) 実executor + updater roleでのapply → undoのrollback simulationを行う。
 * (2)の前提条件は使い捨てDB専用の模擬値であり、Productionの承認・Backupを意味しない。
 */
export async function runStage1IsolatedValidation(
  client: DryRunPgClient,
  plans: readonly UpdateDiffPlan[],
  stagings: readonly StagingDataset[],
  candidate: UpdateCandidate,
  currentRows: Readonly<Record<DiffTable, readonly Readonly<Record<string, unknown>>[]>>,
  sql: Stage1IsolatedSql,
  now: Date,
): Promise<Stage1IsolatedResult> {
  await createIsolatedSchema(client, STAGE1_DRY_RUN_SCHEMA, sql, false);
  const dry = await runIsolatedDryRunApply(client, STAGE1_DRY_RUN_SCHEMA, plans, stagings, currentRows);
  await client.query(`drop schema if exists ${STAGE1_DRY_RUN_SCHEMA} cascade`);

  const undoResults: Stage1IsolatedResult["rollbackSimulation"]["undo"][number][] = [];
  if (plans.some((p) => p.blockingReasons.length > 0)) {
    return { dryRun: { verified: dry.verified, tables: dry.tables, problemCount: dry.problems.length }, rollbackSimulation: { performed: false, note: "計画がblockedのため実施しない", applyOk: false, applyCode: null, undo: [] } };
  }
  const exists = await client.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME]);
  if (exists.rows[0]?.e === true) throw new Error("使い捨てDBにreference_data_updaterが既に存在する(再利用しない)");
  await createIsolatedSchema(client, STAGE1_ROLLBACK_SCHEMA, sql, true);
  let roleCreated = false;
  try {
    for (const p of plans) await seedCurrentRows(client, STAGE1_ROLLBACK_SCHEMA, p.table, currentRows[p.table]);
    await client.query(toSchema(sql.createUpdaterRole, STAGE1_ROLLBACK_SCHEMA));
    roleCreated = true;
    await client.query(toSchema(sql.updaterPolicies, STAGE1_ROLLBACK_SCHEMA));
    // removedはapplyで何もしない(tombstone候補の記録だけ)ため、simulationでは除外して実executorへ渡す。
    const simPlans = plans.map((p) => ({ ...p, removedCandidates: [], resurrected: [] }));
    await client.query(`set role ${UPDATER_ROLE_NAME}`);
    let applyOk = false;
    let applyCode: string | null = null;
    try {
      const applied = await applyUpdatePlans(client, {
        schema: STAGE1_ROLLBACK_SCHEMA,
        plans: simPlans,
        candidate,
        prerequisites: simulationPrerequisites(candidate.sourceChecksum, now),
        datasetVersion: "stage1-simulation",
        approvedBy: "simulation",
        sourceRowCounts: Object.fromEntries(stagings.map((s) => [s.table, s.rowCount])),
      });
      applyOk = applied.ok;
      applyCode = applied.ok ? null : applied.code;
      if (applied.ok) {
        for (const u of applied.undo) {
          const r = await applyUndoPlan(client, STAGE1_ROLLBACK_SCHEMA, u);
          await client.query("reset role");
          const rows = (await client.query(`select * from ${STAGE1_ROLLBACK_SCHEMA}.${u.table}`)).rows;
          await client.query(`set role ${UPDATER_ROLE_NAME}`);
          const inserted = new Set(u.insertedIdentities);
          const kept = rows.filter((row) => !inserted.has(rowIdentity(u.table, row)));
          undoResults.push({
            table: u.table,
            ok: r.ok,
            restored: r.ok ? r.restored : 0,
            insertedRemaining: rows.length - kept.length,
            restoredMatchesBefore: computeUpdateTableChecksum(u.table, kept) === u.beforeChecksum,
          });
        }
      }
    } finally {
      await client.query("reset role");
    }
    return {
      dryRun: { verified: dry.verified, tables: dry.tables, problemCount: dry.problems.length },
      rollbackSimulation: { performed: true, note: "使い捨てDB専用の模擬前提条件で実executor・undoを実行(Productionの承認・Backupではない)", applyOk, applyCode, undo: undoResults },
    };
  } finally {
    if (roleCreated) await client.query(toSchema(sql.rollbackUpdaterRole, STAGE1_ROLLBACK_SCHEMA)).catch(() => undefined);
    await client.query(`drop schema if exists ${STAGE1_ROLLBACK_SCHEMA} cascade`);
  }
}

/** 取得内容の同一性確認用(本文ではなくhashだけをEvidenceへ残す)。 */
export function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
