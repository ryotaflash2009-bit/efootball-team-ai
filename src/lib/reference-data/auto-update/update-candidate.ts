import { SOURCE_COLUMNS_BY_TABLE, canonicalizeSourceRow, type StagingDataset } from "./source-snapshot";
import { detectSensitiveSignals } from "./source-transport";
import type { UpdateBatchState } from "./update-batch-state";
import {
  UPDATE_TABLE_CONTRACTS,
  canonicalizeJsonbValue,
  canonicalizeTextArray,
  computeUpdateIdempotencyKey,
  computeUpdateTotalChecksum,
  normalizeTargetTableSet,
  rowIdentity,
  type ReferenceTable,
} from "./update-contract";
import type { UpdateDiffPlan, DiffTable } from "./update-diff";
import { evaluateUpdatePolicy, maxSeverity, type PolicyFinding, type PolicyResult, type TablePolicyCounts, type UpdatePolicyInput } from "./update-policy";

/**
 * 自動更新 Phase D: diff計画をPhase AのPolicyへ接続し、更新候補(UpdateCandidate)を作る。
 *
 * - Policyの入力はdiff report・StagingDataset・前回状態(baseline・適用済みsource checksum・
 *   前回のupstream更新時刻・直前apply時刻)だけから決定的に作る。Productionへは接続しない。
 * - 計画がblocked、または候補rowに認証情報/個人情報の兆候がある場合はhard_block。
 * - preserve列(World ai_styles・appearance)の現在値とupstream値の差は自動適用しない。
 *   件数をwarningとして可視化し、人がreviewで判断する(Phase Dの決定、文書6章)。
 * - Policyの結果からbatch stateの次状態(policy_blocked / awaiting_review)を決める。
 *   passでも自動applyはしない(awaiting_review→backup_requestedは人の承認が必要)。
 */

export const UPDATER_VERSION = "auto-update-phase-d-1";

export interface CandidateHistory {
  /** 前回の有効なdry run/適用のpayload bytes。初回はnull(manual review)。 */
  readonly baselinePayloadBytes: number | null;
  /** 既に適用済みのsource checksum(同じsourceの再適用を防ぐ)。 */
  readonly appliedSourceChecksums: readonly string[];
  /** 前回同期で見たWorldの最新appearance.updatedAt(UTC ISO)。 */
  readonly previousWorldMaxUpdatedAt: string | null;
  readonly lastAppliedAt: string | null;
  /** 人がreviewで承認済みのremoved件数(table別)。 */
  readonly approvedRemovalCounts?: Readonly<Partial<Record<DiffTable, number>>>;
}

export interface BuildCandidateInput {
  readonly plans: readonly UpdateDiffPlan[];
  readonly stagings: readonly StagingDataset[];
  /** preserve列のdrift計算に使う現在行(plan作成時と同じ入力)。 */
  readonly currentRows: Readonly<Partial<Record<DiffTable, readonly Readonly<Record<string, unknown>>[]>>>;
  readonly history: CandidateHistory;
  readonly now: string;
  /**
   * World upstream時刻の検査結果(analyzeSourceTimestampsの判定)と初回World適用の明示。
   * 未指定なら従来どおり(Stage 1・dry runの呼び出しは変わらない)。
   */
  readonly policySignals?: {
    readonly sourceTimestampFuture?: boolean;
    readonly massIdenticalSourceTimestamps?: boolean;
    readonly firstWorldApply?: boolean;
  };
}

export interface UpdateCandidate {
  readonly targetTables: readonly ReferenceTable[];
  /** table別source checksumを契約順に結合したSHA-256。 */
  readonly sourceChecksum: string;
  readonly idempotencyKey: string;
  readonly payloadBytes: number;
  readonly policyInput: UpdatePolicyInput;
  readonly policy: PolicyResult;
  readonly preservedColumnDrift: Readonly<Partial<Record<DiffTable, Readonly<Record<string, number>>>>>;
  readonly nextState: Extract<UpdateBatchState, "policy_blocked" | "awaiting_review">;
}

function planCounts(plan: UpdateDiffPlan, approved: number): TablePolicyCounts {
  const r = plan.report;
  return {
    beforeCount: r.beforeCount,
    afterCount: r.afterCount,
    addedCount: r.addedCount,
    changedCount: r.changedCount,
    removedCount: r.removedCount,
    resurrectedCount: r.resurrectedCount,
    duplicateCount: r.duplicateCount,
    invalidCount: r.invalidCount,
    schemaDriftCount: r.schemaDriftCount,
    sourceMissingCount: r.sourceMissingCount,
    approvedRemovalCount: approved,
    // card_ratingだけが変わった更新(上流で頻繁に再計算される値)。更新対象・checksumには含めたまま、件数を別に数える。
    cardRatingOnlyChangedCount: plan.table === "world_player_cards" ? countCardRatingOnlyUpdates(plan) : 0,
  };
}

/** 変更列がcard_ratingだけの更新件数(値は見ない)。 */
export function countCardRatingOnlyUpdates(plan: UpdateDiffPlan): number {
  return plan.updates.filter((u) => u.changedFields.length === 1 && u.changedFields[0] === "card_rating").length;
}

/** payload size: source rowを正規化したJSONのUTF-8 byte数の合計(upstreamの整形に依存しない)。 */
export function computeCandidatePayloadBytes(stagings: readonly StagingDataset[]): number {
  let total = 0;
  for (const s of stagings) for (const row of s.rows) total += Buffer.byteLength(JSON.stringify(canonicalizeSourceRow(s.table, row)), "utf8");
  return total;
}

function worldMaxUpdatedAt(stagings: readonly StagingDataset[]): string | null {
  let max: string | null = null;
  for (const s of stagings) {
    if (s.table !== "world_player_cards") continue;
    for (const row of s.rows) {
      const v = (row as Readonly<Record<string, unknown>>).appearance_updated_at;
      if (typeof v === "string" && (max == null || v > max)) max = v;
    }
  }
  return max;
}

function canonicalValue(table: DiffTable, col: string, value: unknown): string {
  if (value == null) return "null";
  const c = UPDATE_TABLE_CONTRACTS[table];
  if (c.jsonbColumns.includes(col)) return JSON.stringify(canonicalizeJsonbValue(value));
  if (c.textArrayColumns.includes(col)) return JSON.stringify(canonicalizeTextArray(value));
  return JSON.stringify(value);
}

/** 既存行について、upstream値と異なるpreserve列の件数(列別)。新規行は対象外。 */
export function countPreservedColumnDrift(
  table: DiffTable,
  currentRows: readonly Readonly<Record<string, unknown>>[],
  staging: StagingDataset,
): Record<string, number> {
  const preserved = UPDATE_TABLE_CONTRACTS[table].preserveOnUpdateColumns.filter((c) => SOURCE_COLUMNS_BY_TABLE[table].includes(c));
  const out: Record<string, number> = Object.fromEntries(preserved.map((c) => [c, 0]));
  if (preserved.length === 0) return out;
  const current = new Map<string, Readonly<Record<string, unknown>>>();
  for (const row of currentRows) {
    try {
      current.set(rowIdentity(table, row), row);
    } catch {
      /* 不正な現在行はdiff計画側でblockedになる */
    }
  }
  for (const src of staging.rows) {
    const cur = current.get(rowIdentity(table, src));
    if (!cur) continue;
    for (const col of preserved) if (canonicalValue(table, col, cur[col]) !== canonicalValue(table, col, (src as Readonly<Record<string, unknown>>)[col])) out[col]++;
  }
  return out;
}

function containsSensitiveSignals(stagings: readonly StagingDataset[]): boolean {
  return stagings.some((s) => s.rows.some((row) => detectSensitiveSignals(JSON.stringify(row)).length > 0));
}

export function buildUpdateCandidate(input: BuildCandidateInput): UpdateCandidate {
  const { plans, stagings, history } = input;
  if (plans.length === 0) throw new Error("diff計画が無い(blocked)");
  const planTables = plans.map((p) => p.table);
  if (new Set(planTables).size !== planTables.length) throw new Error("同じtableのdiff計画が複数ある(blocked)");
  const stagingByTable = new Map(stagings.map((s) => [s.table, s]));
  for (const t of planTables) if (!stagingByTable.has(t)) throw new Error(`${t}のStagingDatasetが無い(blocked)`);
  const targetTables = normalizeTargetTableSet(planTables);

  const tableChecksums: Partial<Record<ReferenceTable, string>> = {};
  for (const t of planTables) tableChecksums[t] = stagingByTable.get(t)!.sourceChecksum;
  const sourceChecksum = computeUpdateTotalChecksum(tableChecksums);
  const idempotencyKey = computeUpdateIdempotencyKey({ sourceChecksum, targetTables, updaterVersion: UPDATER_VERSION });
  const usedStagings = planTables.map((t) => stagingByTable.get(t)!);
  const payloadBytes = computeCandidatePayloadBytes(usedStagings);

  const maxUpdated = worldMaxUpdatedAt(usedStagings);
  const tables: UpdatePolicyInput["tables"] = {};
  for (const p of plans) {
    (tables as Record<string, TablePolicyCounts>)[p.table] = planCounts(p, history.approvedRemovalCounts?.[p.table] ?? 0);
  }
  const policyInput: UpdatePolicyInput = {
    sourceFetchFailed: false,
    sourceParseFailed: false,
    checksumGenerationFailed: false,
    unexpectedTableCount: 0,
    userOrAuthDataDetected: containsSensitiveSignals(usedStagings),
    identityReuseConflictCount: 0,
    sourceTimestampRegression: history.previousWorldMaxUpdatedAt != null && maxUpdated != null && maxUpdated < history.previousWorldMaxUpdatedAt,
    sourceChecksumAlreadyApplied: history.appliedSourceChecksums.includes(sourceChecksum),
    physicalDeleteAttempted: false,
    frozenTableMutationCount: 0,
    existingImportBatchMutationCount: 0,
    tables,
    baseline: history.baselinePayloadBytes == null ? null : { payloadBytes: history.baselinePayloadBytes },
    payloadBytes,
    lastAppliedAt: history.lastAppliedAt,
    now: input.now,
    sourceTimestampFuture: input.policySignals?.sourceTimestampFuture === true,
    massIdenticalSourceTimestamps: input.policySignals?.massIdenticalSourceTimestamps === true,
    firstWorldApply: input.policySignals?.firstWorldApply === true,
  };

  const base = evaluateUpdatePolicy(policyInput);
  const findings: PolicyFinding[] = [...base.findings];
  for (const p of plans) {
    if (p.blockingReasons.length > 0) findings.push({ severity: "hard_block", code: "diff_plan_blocked", table: p.table, message: "diff計画がblockedになっている" });
    if (p.removalDetection === "skipped" && p.table === "world_player_cards") {
      findings.push({ severity: "warning", code: "removal_detection_skipped", table: p.table, message: "removed検出を行っていない(incrementalまたは識別不能なreject)" });
    }
  }
  const preservedColumnDrift: Partial<Record<DiffTable, Record<string, number>>> = {};
  for (const t of planTables) {
    const drift = countPreservedColumnDrift(t, input.currentRows[t] ?? [], stagingByTable.get(t)!);
    preservedColumnDrift[t] = drift;
    const total = Object.values(drift).reduce((a, b) => a + b, 0);
    if (total > 0) findings.push({ severity: "warning", code: "preserved_column_drift", table: t, message: "保持列にupstreamとの差がある(自動適用しない)" });
  }
  const severity = findings.reduce((acc, f) => maxSeverity(acc, f.severity), base.severity);
  const policy: PolicyResult = { severity, findings };

  return Object.freeze({
    targetTables,
    sourceChecksum,
    idempotencyKey,
    payloadBytes,
    policyInput,
    policy,
    preservedColumnDrift,
    nextState: severity === "hard_block" ? "policy_blocked" : "awaiting_review",
  });
}

/** Evidence用の要約(finding codeと件数・checksumの短縮だけ。rowの値は含めない)。 */
export function summarizeUpdateCandidate(c: UpdateCandidate): Record<string, unknown> {
  return {
    targetTables: [...c.targetTables],
    sourceChecksum: c.sourceChecksum.slice(0, 12),
    idempotencyKey: c.idempotencyKey.slice(0, 12),
    payloadBytes: c.payloadBytes,
    severity: c.policy.severity,
    findings: c.policy.findings.map((f) => ({ severity: f.severity, code: f.code, table: f.table ?? null })),
    preservedColumnDrift: c.preservedColumnDrift,
    nextState: c.nextState,
  };
}
