import { buildSourceSnapshot, buildStagingDataset, summarizeSnapshot, type SnapshotPageRecord, type SourceSnapshot, type StagingDataset } from "./source-snapshot";
import { SOURCE_ENDPOINTS, fetchSourceWithRetry, isSourceFetchError, type SourceAttemptRecord, type SourceTransport } from "./source-transport";
import {
  WORLD_INCREMENTAL_DEFAULT_MAX_PAGES,
  WorldSourceParseError,
  buildWorldSearchRequest,
  evaluateWorldIncrementalPage,
  normalizeWorldPlayerRecord,
  parseWorldSearchPage,
  toWorldSourceRow,
  type WorldRowRejection,
  type WorldSourceRow,
} from "./source-world";
import { ManagersSourceParseError, buildManagersRequest, parseManagersDocument, toManagerSourceRow, type ManagerRowRejection, type ManagerSourceRow } from "./source-managers";
import { assertIsolatedSchemaName } from "./isolated-reference-schema";
import { validateStateHistory, type UpdateBatchState } from "./update-batch-state";
import { UPDATE_TABLE_CONTRACTS, computeUpdateTableChecksum } from "./update-contract";
import { computeUpdateDiff, type DiffTable, type UpdateDiffPlan } from "./update-diff";
import { buildUpdateCandidate, summarizeUpdateCandidate, type CandidateHistory, type UpdateCandidate } from "./update-candidate";

/**
 * 自動更新 Phase E: 隔離dry run。
 *
 * 1. 検出pipeline(runDetectionPipeline): transport → snapshot → StagingDataset → diff計画 → 更新候補。
 *    transportはPhase Bのもの(記録済みfixture・無効)だけで、現在行は呼び出し側が渡す
 *    (fixture、または後続Stageで隔離RestoreしたBackup)。Productionへは接続しない。
 *    状態はdetected→source_fetched→normalized→diff_generated→(policy_blocked|awaiting_review)。
 * 2. 隔離apply(runIsolatedDryRunApply): 隔離schemaへ現在行を投入し、計画を1 transactionで適用し、
 *    読み戻したtable checksumが計画のafterChecksumと一致し、再diffが空であることを確かめる。
 *    schema名はassertIsolatedSchemaNameで隔離用に限定する。
 */

export type SourceStageFailure = {
  readonly stage: "source_fetch" | "parse";
  readonly table: DiffTable;
  readonly code: string;
  readonly attempts: readonly SourceAttemptRecord[];
};

export type SnapshotCollection = { readonly ok: true; readonly snapshot: SourceSnapshot } | { readonly ok: false; readonly failure: SourceStageFailure };

export interface CollectOptions {
  readonly fetchedAt: string;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => Date;
  /** World full scanのpage上限・件数上限(page 1のtotalPages/totalCountで超過を検知したら以降を取得しない)。 */
  readonly maxPages?: number;
  readonly maxRecords?: number;
}

/** full scanの安全上限(page数)。既存全件同期は約27 page。 */
export const WORLD_FULL_SCAN_MAX_PAGES = 60;

function failureFrom(table: DiffTable, err: unknown, attempts: readonly SourceAttemptRecord[]): SourceStageFailure {
  if (isSourceFetchError(err)) return { stage: "source_fetch", table, code: err.code, attempts: [...attempts, ...err.attempts] };
  if (err instanceof WorldSourceParseError || err instanceof ManagersSourceParseError) return { stage: "parse", table, code: err.reason, attempts };
  throw err;
}

async function paced(opts: CollectOptions, pageIndex: number): Promise<void> {
  if (pageIndex > 0 && opts.sleep) await opts.sleep(SOURCE_ENDPOINTS["efootball-world"].minIntervalMs);
}

/** World full scan(CREATED_AT降順、page 1からtotalPagesまで)。途中の失敗は部分snapshotにせずfailureを返す。 */
export async function collectWorldFullSnapshot(transport: SourceTransport, opts: CollectOptions): Promise<SnapshotCollection> {
  const pages: SnapshotPageRecord[] = [];
  const attempts: SourceAttemptRecord[] = [];
  const rows: WorldSourceRow[] = [];
  const rejected: WorldRowRejection[] = [];
  let expectedPageSize: number | undefined;
  const pageCap = Math.min(opts.maxPages ?? WORLD_FULL_SCAN_MAX_PAGES, WORLD_FULL_SCAN_MAX_PAGES);
  for (let page = 1; page <= pageCap; page++) {
    try {
      await paced(opts, page - 1);
      const r = await fetchSourceWithRetry(transport, buildWorldSearchRequest(page, "CREATED_AT"), { sleep: opts.sleep, now: opts.now });
      attempts.push(...r.attempts);
      const parsed = parseWorldSearchPage(r.response.bodyText);
      if (page === 1 && parsed.pageSize != null) expectedPageSize = parsed.pageSize;
      if (page === 1 && ((parsed.totalPages != null && parsed.totalPages > pageCap) || (opts.maxRecords != null && parsed.totalCount != null && parsed.totalCount > opts.maxRecords))) {
        return { ok: false, failure: { stage: "source_fetch", table: "world_player_cards", code: "cap_exceeded", attempts } };
      }
      pages.push({ page, recordCount: parsed.players.length, contentHash: parsed.contentHash, bodyBytes: parsed.bodyBytes, totalCount: parsed.totalCount, totalPages: parsed.totalPages, hasNext: parsed.hasNext });
      for (const p of parsed.players) {
        const res = toWorldSourceRow(normalizeWorldPlayerRecord(p), opts.fetchedAt);
        if (res.ok) rows.push(res.row);
        else rejected.push(res.rejection);
      }
      const done = parsed.totalPages != null ? page >= parsed.totalPages : parsed.hasNext === false || parsed.players.length === 0;
      if (done) break;
    } catch (err) {
      return { ok: false, failure: failureFrom("world_player_cards", err, attempts) };
    }
  }
  return { ok: true, snapshot: buildSourceSnapshot({ table: "world_player_cards", scope: "full", fetchedAt: opts.fetchedAt, pages, attempts, rows, rejected, expectedPageSize }) };
}

export interface WorldIncrementalState {
  readonly previousMaxUpdatedAt: string | null;
  readonly previousFirstPageHash: string | null;
  readonly maxPages?: number;
}

export type IncrementalCollection =
  | { readonly ok: true; readonly snapshot: SourceSnapshot; readonly decision: string; readonly firstPageHash: string | null; readonly maxUpdatedAtSeen: string | null }
  | { readonly ok: false; readonly failure: SourceStageFailure };

/** World incremental(UPDATED_AT降順・既存incremental syncと同じ停止規則)。removed検出はしない。 */
export async function collectWorldIncrementalSnapshot(
  transport: SourceTransport,
  known: ReadonlyMap<string, string | null>,
  state: WorldIncrementalState,
  opts: CollectOptions,
): Promise<IncrementalCollection> {
  const ctx = { previousMaxUpdatedAt: state.previousMaxUpdatedAt, previousFirstPageHash: state.previousFirstPageHash, knownUpdatedAt: known, maxPages: state.maxPages ?? WORLD_INCREMENTAL_DEFAULT_MAX_PAGES };
  const pages: SnapshotPageRecord[] = [];
  const attempts: SourceAttemptRecord[] = [];
  const rows: WorldSourceRow[] = [];
  const rejected: WorldRowRejection[] = [];
  let maxSeen: string | null = null;
  let firstPageHash: string | null = null;
  let decision = "continue";
  for (let page = 1; decision === "continue"; page++) {
    try {
      await paced(opts, page - 1);
      const r = await fetchSourceWithRetry(transport, buildWorldSearchRequest(page, "UPDATED_AT"), { sleep: opts.sleep, now: opts.now, stage: "update_detection" });
      attempts.push(...r.attempts);
      const parsed = parseWorldSearchPage(r.response.bodyText);
      if (page === 1) firstPageHash = parsed.contentHash;
      const pageRows: WorldSourceRow[] = [];
      for (const p of parsed.players) {
        const res = toWorldSourceRow(normalizeWorldPlayerRecord(p), opts.fetchedAt);
        if (res.ok) pageRows.push(res.row);
        else rejected.push(res.rejection);
      }
      const evaluation = evaluateWorldIncrementalPage(ctx, page, parsed, pageRows, maxSeen);
      decision = evaluation.decision;
      if (decision === "blocked_sort_contract") return { ok: false, failure: { stage: "parse", table: "world_player_cards", code: "sort_contract_violation", attempts } };
      maxSeen = evaluation.maxUpdatedAtSeen;
      pages.push({ page, recordCount: parsed.players.length, contentHash: parsed.contentHash, bodyBytes: parsed.bodyBytes, totalCount: parsed.totalCount, totalPages: parsed.totalPages, hasNext: parsed.hasNext });
      rows.push(...pageRows);
    } catch (err) {
      return { ok: false, failure: failureFrom("world_player_cards", err, attempts) };
    }
  }
  const snapshot = buildSourceSnapshot({ table: "world_player_cards", scope: "incremental", fetchedAt: opts.fetchedAt, pages, attempts, rows, rejected });
  return { ok: true, snapshot, decision, firstPageHash, maxUpdatedAtSeen: maxSeen };
}

export async function collectManagersSnapshot(transport: SourceTransport, opts: CollectOptions): Promise<SnapshotCollection> {
  try {
    const r = await fetchSourceWithRetry(transport, buildManagersRequest(), { sleep: opts.sleep, now: opts.now });
    const doc = parseManagersDocument(r.response.bodyText);
    const rows: ManagerSourceRow[] = [];
    const rejected: ManagerRowRejection[] = [];
    for (const m of doc.managers) {
      const res = toManagerSourceRow(m, opts.fetchedAt);
      if (res.ok) rows.push(res.row);
      else rejected.push(res.rejection);
    }
    return {
      ok: true,
      snapshot: buildSourceSnapshot({
        table: "managers", scope: "full", fetchedAt: opts.fetchedAt, attempts: r.attempts, rows, rejected,
        pages: [{ page: 1, recordCount: doc.managers.length, contentHash: doc.contentHash, bodyBytes: doc.bodyBytes, totalCount: null, totalPages: null, hasNext: null }],
      }),
    };
  } catch (err) {
    return { ok: false, failure: failureFrom("managers", err, []) };
  }
}

// ---------------------------------------------------------------------------
// Detection pipeline
// ---------------------------------------------------------------------------

export interface DetectionPipelineInput {
  readonly transport: SourceTransport;
  readonly tables: readonly DiffTable[];
  readonly currentRows: Readonly<Partial<Record<DiffTable, readonly Readonly<Record<string, unknown>>[]>>>;
  readonly history: CandidateHistory;
  readonly fetchedAt: string;
  readonly now: string;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface DetectionPipelineResult {
  readonly stateHistory: readonly UpdateBatchState[];
  readonly failure: SourceStageFailure | { readonly stage: "normalize"; readonly table: DiffTable; readonly code: string } | null;
  readonly snapshots: readonly SourceSnapshot[];
  readonly stagings: readonly StagingDataset[];
  readonly plans: readonly UpdateDiffPlan[];
  readonly candidate: UpdateCandidate | null;
}

/** 検出pipelineを1回実行する(full scope)。失敗した段階でstateを進めずに止める。 */
export async function runDetectionPipeline(input: DetectionPipelineInput): Promise<DetectionPipelineResult> {
  const tables = [...new Set(input.tables)];
  if (tables.length === 0) throw new Error("対象tableが無い(blocked)");
  const states: UpdateBatchState[] = ["detected"];
  const snapshots: SourceSnapshot[] = [];
  const opts: CollectOptions = { fetchedAt: input.fetchedAt, sleep: input.sleep };
  const stop = (failure: DetectionPipelineResult["failure"]): DetectionPipelineResult => ({ stateHistory: states, failure, snapshots, stagings: [], plans: [], candidate: null });

  for (const t of tables) {
    const c = t === "world_player_cards" ? await collectWorldFullSnapshot(input.transport, opts) : await collectManagersSnapshot(input.transport, opts);
    if (!c.ok) return stop(c.failure);
    snapshots.push(c.snapshot);
  }
  states.push("source_fetched");

  const stagings: StagingDataset[] = [];
  for (const s of snapshots) {
    try {
      stagings.push(buildStagingDataset(s));
    } catch {
      return stop({ stage: "normalize", table: s.table, code: s.completeness.status === "complete" ? "conflicting_duplicates" : "source_incomplete" });
    }
  }
  states.push("normalized");

  const plans = stagings.map((s) => computeUpdateDiff({ table: s.table, currentRows: input.currentRows[s.table] ?? [], staging: s }));
  states.push("diff_generated");
  const candidate = buildUpdateCandidate({ plans, stagings, currentRows: input.currentRows, history: input.history, now: input.now });
  states.push(candidate.nextState);
  const problems = validateStateHistory(states);
  if (problems.length > 0) throw new Error(`状態履歴が不正: ${problems.join(" / ")}`);
  return { stateHistory: states, failure: null, snapshots, stagings, plans, candidate };
}

/** Evidence用の要約(値・本文を含まない)。 */
export function summarizeDetection(result: DetectionPipelineResult): Record<string, unknown> {
  return {
    stateHistory: [...result.stateHistory],
    failure: result.failure ? { stage: result.failure.stage, table: result.failure.table, code: result.failure.code } : null,
    snapshots: result.snapshots.map(summarizeSnapshot),
    reports: result.plans.map((p) => ({ ...p.report, sampleIdentifiers: p.report.sampleIdentifiers.length, blocked: p.blockingReasons.length > 0, planChecksum: p.planChecksum.slice(0, 12) })),
    candidate: result.candidate ? summarizeUpdateCandidate(result.candidate) : null,
  };
}

// ---------------------------------------------------------------------------
// Isolated dry-run apply
// ---------------------------------------------------------------------------

/** node-postgresのClientと互換の最小interface($n placeholder、jsonbはobjectで返る)。 */
export interface DryRunPgClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface IsolatedTableResult {
  readonly table: DiffTable;
  readonly inserted: number;
  readonly updated: number;
  readonly expectedAfterChecksum: string;
  readonly observedAfterChecksum: string;
  readonly rediffChanges: number;
}

export interface IsolatedDryRunResult {
  readonly verified: boolean;
  readonly schema: string;
  readonly tables: readonly IsolatedTableResult[];
  readonly problems: readonly string[];
}

const DRY_RUN_DATASET_VERSION = "dry-run";

function writableColumns(table: DiffTable): string[] {
  return UPDATE_TABLE_CONTRACTS[table].productionColumns.filter((c) => c !== "created_at" && c !== "updated_at");
}

function toParam(table: DiffTable, col: string, row: Readonly<Record<string, unknown>>): unknown {
  if (col === "dataset_version") return row.dataset_version ?? DRY_RUN_DATASET_VERSION;
  if (col === "import_batch_id") return row.import_batch_id ?? null;
  const v = row[col];
  if (v instanceof Date) return v.toISOString();
  return UPDATE_TABLE_CONTRACTS[table].jsonbColumns.includes(col) && v != null ? JSON.stringify(v) : v;
}

async function insertRow(client: DryRunPgClient, schema: string, table: DiffTable, row: Readonly<Record<string, unknown>>): Promise<void> {
  const cols = writableColumns(table);
  await client.query(`insert into ${schema}.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, cols.map((c) => toParam(table, c, row)));
}

async function updateRow(client: DryRunPgClient, schema: string, table: DiffTable, row: Readonly<Record<string, unknown>>): Promise<void> {
  const pk = UPDATE_TABLE_CONTRACTS[table].primaryKeyColumn;
  const cols = writableColumns(table).filter((c) => c !== pk);
  const r = await client.query(
    `update ${schema}.${table} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(",")} where ${pk} = $${cols.length + 1} returning ${pk}`,
    [...cols.map((c) => toParam(table, c, row)), row[pk]],
  );
  if (r.rows.length !== 1) throw new Error(`${table}のupdate対象が1行ではない(blocked)`);
}

/**
 * 隔離schema(既に空のtableが作られている前提)へ現在行を投入し、計画を適用して検証する。
 * 適用は1 transactionで行い、検証に失敗してもcommitする(隔離schemaは使い捨て)。
 * 呼び出し側は隔離DBだけを渡すこと(schema名はassertIsolatedSchemaNameで強制)。
 */
export async function runIsolatedDryRunApply(
  client: DryRunPgClient,
  schema: string,
  plans: readonly UpdateDiffPlan[],
  stagings: readonly StagingDataset[],
  currentRows: Readonly<Partial<Record<DiffTable, readonly Readonly<Record<string, unknown>>[]>>>,
): Promise<IsolatedDryRunResult> {
  assertIsolatedSchemaName(schema);
  const problems: string[] = [];
  for (const p of plans) if (p.blockingReasons.length > 0) problems.push(`${p.table}: 計画がblockedのため適用しない`);
  const stagingByTable = new Map(stagings.map((s) => [s.table, s]));
  for (const p of plans) if (!stagingByTable.has(p.table)) problems.push(`${p.table}: StagingDatasetが無い`);
  if (problems.length > 0) return { verified: false, schema, tables: [], problems };

  const results: IsolatedTableResult[] = [];
  await client.query("begin");
  try {
    for (const p of plans) {
      const existing = await client.query(`select count(*)::int as n from ${schema}.${p.table}`);
      if (Number(existing.rows[0]?.n) !== 0) throw new Error(`${schema}.${p.table}が空ではない(blocked)`);
      for (const row of currentRows[p.table] ?? []) await insertRow(client, schema, p.table, row);
      for (const r of p.inserts) await insertRow(client, schema, p.table, r.row);
      for (const u of p.updates) await updateRow(client, schema, p.table, u.row);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    return { verified: false, schema, tables: [], problems: [`隔離適用に失敗: ${err instanceof Error ? err.message : String(err)}`] };
  }

  for (const p of plans) {
    const back = (await client.query(`select * from ${schema}.${p.table}`)).rows;
    const observed = computeUpdateTableChecksum(p.table, back);
    const rediff = computeUpdateDiff({ table: p.table, currentRows: back, staging: stagingByTable.get(p.table)! });
    const rediffChanges = rediff.inserts.length + rediff.updates.length + rediff.resurrected.length;
    results.push({ table: p.table, inserted: p.inserts.length, updated: p.updates.length, expectedAfterChecksum: p.report.afterChecksum, observedAfterChecksum: observed, rediffChanges });
    if (observed !== p.report.afterChecksum) problems.push(`${p.table}: 適用後checksumが計画と一致しない`);
    if (rediffChanges !== 0) problems.push(`${p.table}: 適用後の再diffが空ではない`);
  }
  return { verified: problems.length === 0, schema, tables: results, problems };
}
