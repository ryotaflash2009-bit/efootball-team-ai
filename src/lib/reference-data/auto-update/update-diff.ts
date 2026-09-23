import { SOURCE_COLUMNS_BY_TABLE, type SnapshotTable, type StagingDataset } from "./source-snapshot";
import {
  MAX_SAMPLE_IDENTIFIERS,
  UPDATE_TABLE_CONTRACTS,
  canonicalizeUpdateRow,
  compareCanonicalStrings,
  computeUpdateRowChecksum,
  computeUpdateTableChecksum,
  rowIdentity,
  sha256Hex,
  validateUpdateDiffReport,
  type UpdateDiffReport,
} from "./update-contract";

/**
 * 自動更新 Phase C: 決定的なdiff。
 *
 * 入力は「現在のProduction形の行(Backup・dry run用fixture等から得る。Phase CはProductionへ接続しない)」と
 * Phase BのStagingDataset。出力はUpdateDiffReport(Phase A契約)と、後続のdry run/applyが使う計画
 * (insert・update・removed候補・resurrected)。同じ入力からは、入力順序に関係なく同じ出力になる。
 *
 * 規則:
 *   - updateはProductionの現在行にsource列を重ねる。契約のpreserveOnUpdateColumns
 *     (World: ai_styles・appearance、managers: internal_manager_id・insert時のみの列)は現在値を保持する。
 *     eFHUB由来のlocally computed列(efhub_card_id・efhub_conflicts)はsource rowに無いため現在値のまま。
 *   - 比較はPhase Aの正規化(volatile列を除く)でのrow checksum。
 *   - removedは、StagingDatasetがremoved検出を許可している場合だけ数え、形式不正でrejectした
 *     identityはremovedにしない(invalidとして数える)。removedは物理削除ではなくtombstone候補。
 *   - tombstone済みidentityの再出現はresurrected(addedやchangedとして自動適用しない)。
 *   - 現在行の重複identity・契約外の列・欠落列・不正値は計画をblockedにする。
 */

export type DiffTable = SnapshotTable;

export interface ComputeUpdateDiffInput {
  readonly table: DiffTable;
  /** 現在のProduction形の行(契約のproductionColumns。volatile列は無くてもよい)。 */
  readonly currentRows: readonly Readonly<Record<string, unknown>>[];
  readonly staging: StagingDataset;
  /** 過去にtombstoneしたidentity(未実装の間は空)。 */
  readonly tombstonedIdentities?: readonly string[];
}

export interface PlannedRow {
  readonly identity: string;
  readonly row: Readonly<Record<string, unknown>>;
  readonly rowChecksum: string;
}

export interface PlannedUpdate extends PlannedRow {
  readonly changedFields: readonly string[];
}

export interface UpdateDiffPlan {
  readonly table: DiffTable;
  readonly report: UpdateDiffReport;
  readonly inserts: readonly PlannedRow[];
  readonly updates: readonly PlannedUpdate[];
  readonly removedCandidates: readonly string[];
  readonly resurrected: readonly PlannedRow[];
  readonly removalDetection: "performed" | "skipped";
  /** 空でなければ計画全体がblocked(apply・dry runへ進めない)。 */
  readonly blockingReasons: readonly string[];
  /** 計画内容(identity・row checksum・変更列・removed)のSHA-256。同じ入力なら同じ値。 */
  readonly planChecksum: string;
}

const MANAGER_INSERT_NULL_COLUMNS = ["name_ja", "team_name", "nationality", "age", "manager_rating", "coaching_affinity", "formation"] as const;

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareCanonicalStrings);
}

function isSchemaDriftMessage(message: string): boolean {
  return /契約外の列|欠落している|schema drift/.test(message);
}

/** 既存行へsource列を重ねる(preserveOnUpdateColumnsは現在値を保持)。 */
export function mergeSourceIntoCurrent(table: DiffTable, current: Readonly<Record<string, unknown>>, source: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const preserve = new Set(UPDATE_TABLE_CONTRACTS[table].preserveOnUpdateColumns);
  const out: Record<string, unknown> = { ...current };
  for (const col of SOURCE_COLUMNS_BY_TABLE[table]) if (!preserve.has(col)) out[col] = source[col];
  out.fetched_at = source.fetched_at;
  return out;
}

/** 新規行を作る(source列+DDL既定値。volatile列のうちdataset_version等はapply時に設定する)。 */
export function buildInsertRow(table: DiffTable, source: Readonly<Record<string, unknown>>, internalManagerId?: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of SOURCE_COLUMNS_BY_TABLE[table]) out[col] = source[col];
  out.fetched_at = source.fetched_at;
  if (table === "world_player_cards") {
    out.efhub_card_id = null;
    out.efhub_conflicts = [];
  } else {
    if (internalManagerId == null || !Number.isInteger(internalManagerId) || internalManagerId < 1) throw new Error("新規managerのinternal_manager_idが不正(blocked)");
    out.internal_manager_id = internalManagerId;
    for (const col of MANAGER_INSERT_NULL_COLUMNS) out[col] = null;
  }
  return out;
}

function changedColumns(table: DiffTable, before: Readonly<Record<string, unknown>>, after: Readonly<Record<string, unknown>>): string[] {
  const a = canonicalizeUpdateRow(table, before);
  const b = canonicalizeUpdateRow(table, after);
  return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

export function computeUpdateDiff(input: ComputeUpdateDiffInput): UpdateDiffPlan {
  const { table, staging } = input;
  if (staging.table !== table) throw new Error("StagingDatasetのtableが一致しない(blocked)");
  const blocking: string[] = [];
  let schemaDrift = 0;
  let invalid = staging.rejectedIdentities.length + staging.rejectedWithoutIdentityCount;

  // 1. 現在行の検証(identity・契約列・値)。
  const current = new Map<string, Readonly<Record<string, unknown>>>();
  const currentDuplicates = new Set<string>();
  for (const row of input.currentRows) {
    let id: string;
    try {
      id = rowIdentity(table, row);
      canonicalizeUpdateRow(table, row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isSchemaDriftMessage(msg)) schemaDrift++;
      else invalid++;
      blocking.push(`現在行が契約を満たさない: ${msg}`);
      continue;
    }
    if (current.has(id)) currentDuplicates.add(id);
    current.set(id, row);
  }
  if (currentDuplicates.size > 0) blocking.push(`現在行に重複identityがある(${currentDuplicates.size}件)`);
  // upstream側でrejectした行(invalid)は計画をblockedにせず、Phase Dのpolicyで判定する。

  // 2. sourceとの比較。
  const tombstoned = new Set(input.tombstonedIdentities ?? []);
  const sourceById = new Map<string, Readonly<Record<string, unknown>>>();
  for (const row of staging.rows) sourceById.set(rowIdentity(table, row), row);
  const sourceIds = sortedUnique(sourceById.keys());

  let nextManagerId = 1;
  if (table === "managers") {
    for (const row of current.values()) {
      const v = row.internal_manager_id;
      if (typeof v === "number" && Number.isInteger(v) && v >= nextManagerId) nextManagerId = v + 1;
    }
  }

  const inserts: PlannedRow[] = [];
  const updates: PlannedUpdate[] = [];
  const resurrected: PlannedRow[] = [];
  let unchanged = 0;
  for (const id of sourceIds) {
    const source = sourceById.get(id)!;
    const existing = current.get(id);
    const candidate = existing ? mergeSourceIntoCurrent(table, existing, source) : buildInsertRow(table, source, table === "managers" ? nextManagerId++ : undefined);
    const rowChecksum = computeUpdateRowChecksum(table, candidate);
    if (tombstoned.has(id)) {
      resurrected.push({ identity: id, row: candidate, rowChecksum });
    } else if (!existing) {
      inserts.push({ identity: id, row: candidate, rowChecksum });
    } else if (rowChecksum !== computeUpdateRowChecksum(table, existing)) {
      updates.push({ identity: id, row: candidate, rowChecksum, changedFields: changedColumns(table, existing, candidate) });
    } else {
      unchanged++;
    }
  }

  // 3. removed候補(許可されている場合だけ。rejectしたidentityはinvalid扱いでremovedにしない)。
  const rejected = new Set(staging.rejectedIdentities);
  const removedCandidates = staging.removalDetectionAllowed
    ? sortedUnique([...current.keys()].filter((id) => !sourceById.has(id) && !rejected.has(id) && !tombstoned.has(id)))
    : [];

  // 4. checksum(before=現在行、after=計画適用後。removedは物理削除しないのでafterにも残る)。
  const after = new Map(current);
  for (const u of updates) after.set(u.identity, u.row);
  for (const r of [...inserts, ...resurrected]) after.set(r.identity, r.row);
  const beforeChecksum = computeUpdateTableChecksum(table, [...current.values()]);
  const afterChecksum = computeUpdateTableChecksum(table, [...after.values()]);
  const sourceMetadataChecksum = sha256Hex(
    JSON.stringify([staging.contractVersion, table, staging.scope, staging.sourceChecksum, staging.rawContentHash, staging.removalDetectionAllowed]),
  );

  const samples = [
    ...inserts.map((r) => r.identity),
    ...updates.map((r) => r.identity),
    ...removedCandidates,
    ...resurrected.map((r) => r.identity),
  ].slice(0, MAX_SAMPLE_IDENTIFIERS);

  const report: UpdateDiffReport = {
    table,
    beforeCount: current.size,
    afterCount: after.size,
    addedCount: inserts.length,
    changedCount: updates.length,
    removedCount: removedCandidates.length,
    unchangedCount: unchanged,
    resurrectedCount: resurrected.length,
    duplicateCount: currentDuplicates.size,
    invalidCount: invalid,
    schemaDriftCount: schemaDrift,
    sourceMissingCount: 0,
    beforeChecksum,
    afterChecksum,
    sourceMetadataChecksum,
    sampleIdentifiers: samples,
    changedFieldNames: sortedUnique(updates.flatMap((u) => u.changedFields)),
  };
  const reportProblems = validateUpdateDiffReport(report);
  if (reportProblems.length > 0) blocking.push(...reportProblems.map((p) => `diff reportが契約違反: ${p}`));

  const planChecksum = sha256Hex(
    JSON.stringify({
      table,
      inserts: inserts.map((r) => [r.identity, r.rowChecksum]),
      updates: updates.map((r) => [r.identity, r.rowChecksum, r.changedFields]),
      removed: removedCandidates,
      resurrected: resurrected.map((r) => [r.identity, r.rowChecksum]),
      beforeChecksum,
      afterChecksum,
    }),
  );

  return Object.freeze({
    table,
    report: Object.freeze(report),
    inserts: Object.freeze(inserts),
    updates: Object.freeze(updates),
    removedCandidates: Object.freeze(removedCandidates),
    resurrected: Object.freeze(resurrected),
    removalDetection: staging.removalDetectionAllowed ? "performed" : "skipped",
    blockingReasons: Object.freeze(blocking),
    planChecksum,
  });
}
