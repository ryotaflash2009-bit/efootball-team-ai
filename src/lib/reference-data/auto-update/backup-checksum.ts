import { createHash } from "node:crypto";
import { computeRecordChecksum } from "./diff";

/**
 * Backup用の決定的checksum計算。
 *
 * `computeRecordChecksum`(`diff.ts`、Promotion検証で既に実証済み)をそのまま再利用する。
 * 決定性の根拠:
 *   - 列順序: `computeRecordChecksum`が列名をソートしてからJSON化するため、列の取得順序に
 *     依存しない。
 *   - JSONB内部のキー順序: PostgreSQLのjsonb型自体が正規化された内部表現を持つため、
 *     同一内容であれば読み出しのたびに同じキー順で返る(Promotionのshadow comparisonで
 *     既に確認済みの前提をそのまま踏襲する)。
 *   - text[]の順序: 配列の要素順序はそのまま保持する契約(要素を並べ替えない)。
 *   - timestamp: ISO 8601文字列として比較する(タイムゾーン付き)。
 *   - nullと欠損の区別: 呼び出し側(`backup-orchestrator.ts`)が`BackupTableSpec.columns`の
 *     全列を必ず埋めてから渡す契約とし、欠損列は明示的に`null`として扱う(undefinedを
 *     JSON.stringifyすると省略されてしまうため、区別を保つにはnull統一が必須)。
 *   - `updated_at`: Backupは「取得時点のテーブル全体の正確な複製」を目的とするため、
 *     Promotionのbefore-snapshot(`computeBeforeStateChecksum`)とは異なり、
 *     `updated_at`を除外しない(除外するとPromotion/初回投入時刻の違いを検出できなくなる)。
 */
export function computeBackupRowChecksum(fields: Readonly<Record<string, unknown>>): string {
  return computeRecordChecksum(fields);
}

/** 1テーブル分の全行から、テーブル単位のchecksumを計算する(行順序に依存しないよう、id順でソートしてから結合する)。 */
export function computeBackupTableChecksum(rows: readonly { id: string; fields: Readonly<Record<string, unknown>> }[]): string {
  const perRow = rows
    .map((r) => ({ id: r.id, checksum: computeBackupRowChecksum(r.fields) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(perRow)).digest("hex");
}

/** 複数テーブルのchecksumから、Backup全体のtotal checksumを計算する(テーブル名でソートしてから結合する)。 */
export function computeBackupTotalChecksum(tableChecksums: Readonly<Record<string, string>>): string {
  const sorted = Object.entries(tableChecksums).sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export interface BackupSourceMetadataEntry {
  tableName: string;
  /** そのテーブルの行に実際に含まれる(source, dataset_version)の組の集合(重複除去・ソート済み)。 */
  sourceDatasetPairs: readonly { source: string; datasetVersion: string }[];
}

/**
 * 各テーブルの行が実際に持つ`source`・`dataset_version`列の値から導出する「由来情報」のchecksum。
 * 別テーブルとして`source_metadata`を新設せず、対象4テーブルいずれも既に`source`・
 * `dataset_version`列を持つ(実`reference_data`の設計どおり)ことを利用して、Backup対象の
 * 行データだけから決定的に計算できるようにしている。Restore後にこのchecksumが再一致すれば、
 * 由来情報も含めて正しく複製できたことを確認できる。
 */
export function computeSourceMetadataChecksum(entries: readonly BackupSourceMetadataEntry[]): string {
  const sorted = [...entries]
    .map((e) => ({
      tableName: e.tableName,
      sourceDatasetPairs: [...e.sourceDatasetPairs].sort(
        (a, b) => a.source.localeCompare(b.source) || a.datasetVersion.localeCompare(b.datasetVersion),
      ),
    }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

/** ダンプ済みの行配列から、そのテーブルの(source, dataset_version)の重複除去済み集合を導出する。 */
export function deriveSourceDatasetPairs(rows: readonly Readonly<Record<string, unknown>>[]): { source: string; datasetVersion: string }[] {
  const seen = new Map<string, { source: string; datasetVersion: string }>();
  for (const row of rows) {
    const source = typeof row.source === "string" ? row.source : "";
    const datasetVersion = typeof row.dataset_version === "string" ? row.dataset_version : "";
    if (source === "" && datasetVersion === "") continue;
    // JSON.stringifyの配列表現をキーにする(区切り文字の衝突回避に生の制御文字を使わない)。
    seen.set(JSON.stringify([source, datasetVersion]), { source, datasetVersion });
  }
  return [...seen.values()];
}
