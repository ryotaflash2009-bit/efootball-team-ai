import {
  AUTO_UPDATE_CONTRACT_VERSION,
  UPDATE_TABLE_CONTRACTS,
  canonicalizeJsonbValue,
  canonicalizeTextArray,
  compareCanonicalStrings,
  normalizeTimestamp,
  rowIdentity,
  sha256Hex,
} from "./update-contract";
import { computeRecordChecksum } from "./diff";
import { MANAGER_SOURCE_COLUMNS, type ManagerRowRejection, type ManagerSourceRow } from "./source-managers";
import type { SourceAttemptRecord, SourceId } from "./source-transport";
import { WORLD_PAGE_SIZE, WORLD_SOURCE_COLUMNS, type WorldRowRejection, type WorldSourceRow } from "./source-world";

/**
 * 自動更新 Phase B: source snapshot と StagingDataset の契約。
 *
 * SourceSnapshot = 1回の取得結果(page記録・正規化済みrow・rejected・completeness)。
 * StagingDataset = diff(Phase C)へ渡す、identity順に並んだupstream由来列だけのrow集合と
 *                  そのchecksum。Productionへは何も書き込まない。
 *
 * completenessが"complete"かつscopeが"full"でない限り、removed(tombstone候補)の検出は許可しない
 * (取得漏れ・pagination途中停止を「upstreamから消えた」と誤判定しないため)。
 */

export type SnapshotTable = "world_player_cards" | "managers";
export type SnapshotScope = "full" | "incremental";

export interface SnapshotPageRecord {
  readonly page: number;
  readonly recordCount: number;
  readonly contentHash: string;
  readonly bodyBytes: number;
  readonly totalCount: number | null;
  readonly totalPages: number | null;
  readonly hasNext: boolean | null;
}

export interface SnapshotCompleteness {
  readonly status: "complete" | "incomplete";
  readonly reasons: readonly string[];
  readonly expectedRecordCount: number | null;
  readonly receivedRecordCount: number;
  readonly uniqueIdentityCount: number;
  readonly identicalDuplicateCount: number;
  readonly conflictingDuplicateIdentities: readonly string[];
  readonly rejectedCount: number;
  readonly rejectedWithoutIdentityCount: number;
}

type SourceRow = WorldSourceRow | ManagerSourceRow;
type Rejection = WorldRowRejection | ManagerRowRejection;

export interface SourceSnapshot {
  readonly contractVersion: string;
  readonly table: SnapshotTable;
  readonly sourceId: SourceId;
  readonly scope: SnapshotScope;
  readonly fetchedAt: string;
  readonly pages: readonly SnapshotPageRecord[];
  /** page content hashを取得順に結合したSHA-256。 */
  readonly rawContentHash: string;
  readonly attempts: readonly SourceAttemptRecord[];
  /** identityのUTF-8バイト順に並べたrow(同一内容の重複は1件にまとめる)。 */
  readonly rows: readonly SourceRow[];
  readonly rejected: readonly Rejection[];
  readonly completeness: SnapshotCompleteness;
  readonly removalDetectionAllowed: boolean;
}

export const SOURCE_COLUMNS_BY_TABLE: Readonly<Record<SnapshotTable, readonly string[]>> = Object.freeze({
  world_player_cards: WORLD_SOURCE_COLUMNS,
  managers: MANAGER_SOURCE_COLUMNS,
});

const SOURCE_ID_BY_TABLE: Readonly<Record<SnapshotTable, SourceId>> = Object.freeze({
  world_player_cards: "efootball-world",
  managers: "managers-json",
});

/**
 * source rowをchecksum用に正規化する。列はsource列だけを要求し(fetched_atはvolatileとして除外)、
 * 型ごとの正規化はPhase Aの契約(jsonb key順・text[]順序保持・UTC ms timestamp)と同じ。
 */
export function canonicalizeSourceRow(table: SnapshotTable, row: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const contract = UPDATE_TABLE_CONTRACTS[table];
  const columns = SOURCE_COLUMNS_BY_TABLE[table];
  const allowed = new Set([...columns, "fetched_at"]);
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) throw new Error(`${table}のsource rowに想定外の列がある: ${key}(blocked)`);
  }
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (!(col in row) || row[col] === undefined) throw new Error(`${table}.${col}がsource rowに無い(blocked)`);
    const value = row[col];
    const label = `${table}.${col}`;
    if (value === null) out[col] = null;
    else if (contract.jsonbColumns.includes(col)) out[col] = canonicalizeJsonbValue(value, label);
    else if (contract.textArrayColumns.includes(col)) out[col] = canonicalizeTextArray(value, label);
    else if (contract.timestampColumns.includes(col)) out[col] = normalizeTimestamp(value, label);
    else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") out[col] = canonicalizeJsonbValue(value, label);
    else throw new Error(`${label}が想定外の型(blocked)`);
  }
  return out;
}

export function computeSourceRowChecksum(table: SnapshotTable, row: Readonly<Record<string, unknown>>): string {
  return computeRecordChecksum(canonicalizeSourceRow(table, row));
}

interface DedupResult {
  rows: SourceRow[];
  identicalDuplicates: number;
  conflicting: string[];
}

function dedupeRows(table: SnapshotTable, rows: readonly SourceRow[]): DedupResult {
  const byId = new Map<string, { row: SourceRow; checksum: string }>();
  let identical = 0;
  const conflicting = new Set<string>();
  for (const row of rows) {
    const id = rowIdentity(table, row);
    const checksum = computeSourceRowChecksum(table, row);
    const prev = byId.get(id);
    if (!prev) byId.set(id, { row, checksum });
    else if (prev.checksum === checksum) identical++;
    else conflicting.add(id);
  }
  const ids = [...byId.keys()].sort(compareCanonicalStrings);
  return { rows: ids.map((id) => byId.get(id)!.row), identicalDuplicates: identical, conflicting: [...conflicting].sort(compareCanonicalStrings) };
}

/** World full scanのpagination完全性(1..Nの連続・totalPages/totalCount一致・途中の短いpage無し・最終pageのhasNext=false)。 */
export function assessWorldPaginationCompleteness(pages: readonly SnapshotPageRecord[], pageSize = WORLD_PAGE_SIZE): { reasons: string[]; expected: number | null } {
  const reasons: string[] = [];
  if (pages.length === 0) return { reasons: ["pageを1件も取得していない"], expected: null };
  pages.forEach((p, i) => {
    if (p.page !== i + 1) reasons.push(`page番号が連続していない(${i + 1}番目がpage ${p.page})`);
  });
  const first = pages[0];
  const totalPages = first.totalPages;
  const totalCount = first.totalCount;
  if (totalPages == null) reasons.push("totalPagesが不明");
  else if (pages.length !== totalPages) reasons.push(`取得page数(${pages.length})がtotalPages(${totalPages})と一致しない`);
  for (const p of pages) {
    if (p.totalPages !== totalPages || p.totalCount !== totalCount) reasons.push(`page ${p.page}でtotalPages/totalCountが変化した(取得中の更新の可能性)`);
  }
  pages.slice(0, -1).forEach((p) => {
    if (p.recordCount !== pageSize) reasons.push(`最終page以外のpage ${p.page}が${pageSize}件ではない(${p.recordCount}件)`);
  });
  const last = pages[pages.length - 1];
  if (last.hasNext === true) reasons.push("最終pageのhasNextがtrue");
  if (last.recordCount === 0 && pages.length > 1) reasons.push("最終pageが空");
  const received = pages.reduce((s, p) => s + p.recordCount, 0);
  if (totalCount == null) reasons.push("totalCountが不明");
  else if (received !== totalCount) reasons.push(`受信件数(${received})がtotalCount(${totalCount})と一致しない`);
  return { reasons, expected: totalCount };
}

export interface BuildSnapshotInput {
  readonly table: SnapshotTable;
  readonly scope: SnapshotScope;
  readonly fetchedAt: string;
  readonly pages: readonly SnapshotPageRecord[];
  readonly attempts: readonly SourceAttemptRecord[];
  readonly rows: readonly SourceRow[];
  readonly rejected: readonly Rejection[];
  /** World full scanでの1 pageの件数(既定はrequestのsize=500。fixture検証用に小さくできる)。 */
  readonly expectedPageSize?: number;
}

export function buildSourceSnapshot(input: BuildSnapshotInput): SourceSnapshot {
  const fetchedAt = normalizeTimestamp(input.fetchedAt, "snapshot.fetchedAt");
  const dedup = dedupeRows(input.table, input.rows);
  const received = input.pages.reduce((s, p) => s + p.recordCount, 0);
  const reasons: string[] = [];
  let expected: number | null = null;
  if (input.table === "world_player_cards") {
    if (input.scope === "full") {
      const r = assessWorldPaginationCompleteness(input.pages, input.expectedPageSize ?? WORLD_PAGE_SIZE);
      reasons.push(...r.reasons);
      expected = r.expected;
    } else if (input.pages.length === 0) reasons.push("pageを1件も取得していない");
  } else {
    if (input.scope !== "full") reasons.push("managers.jsonはfull scopeだけを扱う");
    if (input.pages.length !== 1) reasons.push("managers.jsonは1文書だけを扱う");
    if (received === 0) reasons.push("managers.jsonが空");
    expected = input.pages[0]?.recordCount ?? null;
  }
  if (received !== input.rows.length + input.rejected.length) reasons.push("受信件数と正規化結果(rows+rejected)の件数が一致しない");
  if (dedup.conflicting.length > 0) reasons.push(`同じidentityで内容の異なるrowがある(${dedup.conflicting.length}件)`);
  const rejectedWithoutIdentity = input.rejected.filter((r) => r.identity == null).length;
  const completeness: SnapshotCompleteness = Object.freeze({
    status: reasons.length === 0 ? "complete" : "incomplete",
    reasons: Object.freeze(reasons),
    expectedRecordCount: expected,
    receivedRecordCount: received,
    uniqueIdentityCount: dedup.rows.length,
    identicalDuplicateCount: dedup.identicalDuplicates,
    conflictingDuplicateIdentities: Object.freeze(dedup.conflicting),
    rejectedCount: input.rejected.length,
    rejectedWithoutIdentityCount: rejectedWithoutIdentity,
  });
  const removalDetectionAllowed = input.scope === "full" && completeness.status === "complete" && rejectedWithoutIdentity === 0;
  return Object.freeze({
    contractVersion: AUTO_UPDATE_CONTRACT_VERSION,
    table: input.table,
    sourceId: SOURCE_ID_BY_TABLE[input.table],
    scope: input.scope,
    fetchedAt,
    pages: Object.freeze([...input.pages]),
    rawContentHash: sha256Hex(JSON.stringify(input.pages.map((p) => [p.page, p.contentHash]))),
    attempts: Object.freeze([...input.attempts]),
    rows: Object.freeze(dedup.rows),
    rejected: Object.freeze([...input.rejected]),
    completeness,
    removalDetectionAllowed,
  });
}

export interface StagingDataset {
  readonly contractVersion: string;
  readonly table: SnapshotTable;
  readonly sourceId: SourceId;
  readonly scope: SnapshotScope;
  readonly fetchedAt: string;
  readonly rowCount: number;
  readonly identities: readonly string[];
  readonly rows: readonly SourceRow[];
  /** 各rowのsource checksumをidentity順に結合したSHA-256(fetched_atは含まない)。 */
  readonly sourceChecksum: string;
  readonly rawContentHash: string;
  readonly removalDetectionAllowed: boolean;
  /** 形式不正でrejectしたが、identityは分かるもの(Phase Cでinvalidとして扱い、removedと誤判定しない)。 */
  readonly rejectedIdentities: readonly string[];
  /** 形式不正でidentityも分からない件数(Phase Cでinvalidとして数える)。 */
  readonly rejectedWithoutIdentityCount: number;
}

/**
 * snapshotからStagingDatasetを作る。full scopeで不完全なsnapshot、または内容の異なる重複identityが
 * あるsnapshotはblocked(部分的なdatasetをdiffへ渡さない)。
 */
export function buildStagingDataset(snapshot: SourceSnapshot): StagingDataset {
  if (snapshot.completeness.conflictingDuplicateIdentities.length > 0) {
    throw new Error("同じidentityで内容の異なるrowがあるためStagingDatasetを作れない(blocked)");
  }
  if (snapshot.scope === "full" && snapshot.completeness.status !== "complete") {
    throw new Error(`full scopeのsnapshotが不完全なためStagingDatasetを作れない(blocked): ${snapshot.completeness.reasons.join(" / ")}`);
  }
  const entries = snapshot.rows.map((r) => ({ identity: rowIdentity(snapshot.table, r), checksum: computeSourceRowChecksum(snapshot.table, r) }));
  const rejectedIdentities = [...new Set(snapshot.rejected.map((r) => r.identity).filter((v): v is string => v != null))].sort(compareCanonicalStrings);
  return Object.freeze({
    contractVersion: snapshot.contractVersion,
    table: snapshot.table,
    sourceId: snapshot.sourceId,
    scope: snapshot.scope,
    fetchedAt: snapshot.fetchedAt,
    rowCount: entries.length,
    identities: Object.freeze(entries.map((e) => e.identity)),
    rows: snapshot.rows,
    sourceChecksum: sha256Hex(JSON.stringify(entries.map((e) => [e.identity, e.checksum]))),
    rawContentHash: snapshot.rawContentHash,
    removalDetectionAllowed: snapshot.removalDetectionAllowed,
    rejectedIdentities: Object.freeze(rejectedIdentities),
    rejectedWithoutIdentityCount: snapshot.completeness.rejectedWithoutIdentityCount,
  });
}

/** Evidence用の要約(rowの内容・upstream本文を含まない)。 */
export function summarizeSnapshot(snapshot: SourceSnapshot): Record<string, unknown> {
  return {
    contractVersion: snapshot.contractVersion,
    table: snapshot.table,
    sourceId: snapshot.sourceId,
    scope: snapshot.scope,
    fetchedAt: snapshot.fetchedAt,
    pageCount: snapshot.pages.length,
    requestAttempts: snapshot.attempts.length,
    rawContentHash: snapshot.rawContentHash.slice(0, 12),
    completeness: snapshot.completeness.status,
    completenessReasons: [...snapshot.completeness.reasons],
    receivedRecordCount: snapshot.completeness.receivedRecordCount,
    uniqueIdentityCount: snapshot.completeness.uniqueIdentityCount,
    rejectedCount: snapshot.completeness.rejectedCount,
    removalDetectionAllowed: snapshot.removalDetectionAllowed,
  };
}
