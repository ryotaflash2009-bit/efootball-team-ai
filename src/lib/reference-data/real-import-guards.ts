import { PUBLIC_REFERENCE_TABLES, ADMIN_ONLY_TABLES } from "../testing/reference-data-sql-audit";

/**
 * 実Supabaseへの参照データ初回投入(`scripts/migration/pg-real-import.mjs`)を安全にするための
 * 純関数群(判定ロジック・秘密情報マスキング・SQL文組み立て)。
 *
 * ここには実際のネットワーク接続・DB接続は一切含まない。テストダブル(モック)だけで
 * 全ロジックを検証できるようにするための分離。
 */

export const EXPECTED_COUNTS = {
  world_player_cards: 13009,
  managers: 66,
  player_card_analysis: 19,
} as const;

/** `reference_data`スキーマ内で書込みが許可されるテーブルの許可リスト(スキーマ名は常に固定接頭辞)。 */
export const ALLOWED_TARGET_TABLES: readonly string[] = [...PUBLIC_REFERENCE_TABLES, ...ADMIN_ONLY_TABLES];
export const REFERENCE_SCHEMA = "reference_data";

export function assertAllowedTable(table: string): void {
  if (!ALLOWED_TARGET_TABLES.includes(table)) {
    throw new Error(`許可されていないテーブルへの書込みが要求された: ${table}`);
  }
}

export function qualifiedTable(table: string): string {
  assertAllowedTable(table);
  return `${REFERENCE_SCHEMA}.${table}`;
}

/** `--execute`が明示的に指定された場合だけ実接続する。既定はdry-run。 */
export function parseExecuteFlag(argv: readonly string[]): boolean {
  return argv.includes("--execute");
}

/** `--validate-only`が指定された場合、接続文字列の組み立て・検証だけを行い、実接続はしない。 */
export function parseValidateOnlyFlag(argv: readonly string[]): boolean {
  return argv.includes("--validate-only");
}

/** 接続文字列(または他の秘密値)の既知の値を、渡された文字列から除去する。 */
export function maskSecretValue(text: string, secret: string | undefined | null): string {
  if (!secret) return text;
  return text.split(secret).join("[REDACTED]");
}

const CONNECTION_STRING_LIKE_RE = /(postgres(?:ql)?:\/\/)[^\s"']+/gi;
const HOST_LIKE_RE = /\b([a-z0-9-]+\.)*(supabase\.co|pooler\.supabase\.com)\b/gi;

/**
 * 既知の秘密値だけでなく、接続文字列らしいパターン(postgres://...)・
 * Supabaseホスト名らしいパターンも保守的にマスクする(多層防御)。
 */
export function maskConnectionStringPatterns(text: string): string {
  return text.replace(CONNECTION_STRING_LIKE_RE, "$1[REDACTED]").replace(HOST_LIKE_RE, "[REDACTED-HOST]");
}

export function sanitizeErrorMessage(message: string, secrets?: string | null | ReadonlyArray<string | null | undefined>): string {
  const secretList = Array.isArray(secrets) ? secrets : [secrets];
  let result = message;
  for (const secret of secretList) {
    result = maskSecretValue(result, secret);
  }
  return maskConnectionStringPatterns(result);
}

export interface GuardCheck {
  ok: boolean;
  reason?: string;
}

/** 投入対象4テーブルすべてが0件であることを確認する(初回投入の前提条件)。 */
export function checkAllTablesEmpty(counts: Readonly<Record<string, number>>): GuardCheck {
  const nonEmpty = Object.entries(counts).filter(([, count]) => count !== 0);
  if (nonEmpty.length > 0) {
    return {
      ok: false,
      reason: `既存行が見つかったため初回投入を中止: ${nonEmpty.map(([t, c]) => `${t}=${c}件`).join(", ")}`,
    };
  }
  return { ok: true };
}

/** 投入後の件数が期待値と完全一致することを確認する(過不足いずれも失敗扱い)。 */
export function checkExactCounts(actual: Readonly<Record<string, number>>, expected: Readonly<Record<string, number>>): GuardCheck {
  const mismatches = Object.entries(expected).filter(([table, exp]) => actual[table] !== exp);
  if (mismatches.length > 0) {
    return {
      ok: false,
      reason: `件数が期待値と一致しない: ${mismatches.map(([t, exp]) => `${t}(期待${exp}件, 実測${actual[t] ?? "未取得"}件)`).join(", ")}`,
    };
  }
  return { ok: true };
}

export function checkHashesMatch(actual: Readonly<Record<string, string>>, expected: Readonly<Record<string, string>>): GuardCheck {
  const mismatches = Object.entries(expected).filter(([table, exp]) => actual[table] !== exp);
  if (mismatches.length > 0) {
    return { ok: false, reason: `payload_hashが一致しない: ${mismatches.map(([t]) => t).join(", ")}` };
  }
  return { ok: true };
}

export function checkNoDuplicates(duplicateIds: readonly string[], label: string): GuardCheck {
  if (duplicateIds.length > 0) {
    return { ok: false, reason: `${label}に重複IDが${duplicateIds.length}件見つかった` };
  }
  return { ok: true };
}

/** 投入後にDBから読み戻した主キー集合が、投入意図した主キー集合と完全一致するかを確認する(順序非依存)。 */
export function checkPrimaryKeySetMatches(actualIds: readonly string[], expectedIds: readonly string[], label: string): GuardCheck {
  const actual = new Set(actualIds);
  const expected = new Set(expectedIds);
  const missing = [...expected].filter((id) => !actual.has(id));
  const unexpected = [...actual].filter((id) => !expected.has(id));
  if (missing.length > 0 || unexpected.length > 0) {
    return {
      ok: false,
      reason: `${label}の主キー集合が一致しない(欠落${missing.length}件、想定外${unexpected.length}件)`,
    };
  }
  return { ok: true };
}

export function checkNoOrphans(orphanIds: readonly string[]): GuardCheck {
  if (orphanIds.length > 0) {
    return { ok: false, reason: `world_player_cardsに存在しない孤立参照が${orphanIds.length}件見つかった` };
  }
  return { ok: true };
}

export function checkNoInvalidRows(invalidCount: number, label: string): GuardCheck {
  if (invalidCount > 0) {
    return { ok: false, reason: `${label}に必須項目欠損・不正値の行が${invalidCount}件見つかった` };
  }
  return { ok: true };
}

/** 更新対象IDが全件、期待する形式(正規表現)に一致するかを確認する(不正なIDでのUPDATE実行を未然に防ぐ)。 */
export function checkAllIdsValid(ids: readonly string[], pattern: RegExp, label: string): GuardCheck {
  const invalidCount = ids.filter((id) => !pattern.test(id)).length;
  if (invalidCount > 0) {
    return { ok: false, reason: `${label}に形式不正なIDが${invalidCount}件見つかった` };
  }
  return { ok: true };
}

export function checkSqliteIntegrity(integrityCheckResult: string): GuardCheck {
  if (integrityCheckResult.trim().toLowerCase() !== "ok") {
    return { ok: false, reason: `SQLite integrity_checkが"ok"以外を返した: ${integrityCheckResult}` };
  }
  return { ok: true };
}

export interface CommitDecision {
  decision: "commit" | "rollback";
  reasons: string[];
}

/** 全チェックが成功した場合だけCOMMIT、1件でも失敗があればROLLBACKする。 */
export function decideCommitOrRollback(checks: readonly GuardCheck[]): CommitDecision {
  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { decision: "rollback", reasons: failed.map((c) => c.reason ?? "理由不明の検証失敗") };
  }
  return { decision: "commit", reasons: [] };
}

export interface IdempotencyCandidate {
  batchId: string;
  datasetVersion: string;
}

/** 同一import_batch_idの再実行、同一dataset_versionの重複投入を拒否する。 */
export function checkIdempotencyGuard(
  existingBatchIds: ReadonlySet<string>,
  existingDatasetVersions: ReadonlySet<string>,
  candidate: IdempotencyCandidate,
): GuardCheck {
  if (existingBatchIds.has(candidate.batchId)) {
    return { ok: false, reason: `import_batch_id ${candidate.batchId} は既に使用済み(再実行を拒否)` };
  }
  if (existingDatasetVersions.has(candidate.datasetVersion)) {
    return { ok: false, reason: `dataset_version ${candidate.datasetVersion} は既に投入済み(重複投入を拒否)` };
  }
  return { ok: true };
}

/** 配列を指定サイズごとのチャンクへ分割する。 */
export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunkRows: sizeは1以上である必要がある");
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size) as T[]);
  }
  return chunks;
}

/**
 * パラメータ化された複数行UPSERT文のSQLテキストを組み立てる(値そのものは含まない。
 * プレースホルダーのみのため、このSQL文字列自体はログへ出しても安全)。
 */
export function buildUpsertSql(table: string, columns: readonly string[], rowCount: number, conflictColumn: string): string {
  const qualified = qualifiedTable(table);
  if (rowCount <= 0) throw new Error("buildUpsertSql: rowCountは1以上である必要がある");
  const valueRows: string[] = [];
  let paramIndex = 1;
  for (let r = 0; r < rowCount; r += 1) {
    const placeholders = columns.map(() => `$${paramIndex++}`);
    valueRows.push(`(${placeholders.join(", ")})`);
  }
  const updateSet = columns
    .filter((c) => c !== conflictColumn)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return [
    `insert into ${qualified} (${columns.join(", ")})`,
    `values ${valueRows.join(", ")}`,
    `on conflict (${conflictColumn}) do update set ${updateSet}`,
  ].join("\n");
}

/** カラムごとの明示的なPostgres型キャスト(UPDATE...FROM (VALUES ...)のVALUES内で型を明確にするため)。 */
export type BulkUpdateColumnCast = "text" | "text[]" | "jsonb" | "integer" | "numeric" | "none";

/**
 * `UPDATE ... FROM (VALUES ...) AS v(pk, col1, col2, ...) WHERE t.pk = v.pk`形式の
 * パラメータ化された複数行UPDATE文を組み立てる(値そのものは含まない、プレースホルダーのみ)。
 * 既存の初回投入(buildUpsertSql、INSERT専用)とは別物で、既存行の追加列だけをUPDATEする
 * 差分投入(reference_data.world_player_cards/managersへの詳細フィールド追加)に使う。
 *
 * 主キー列のキャストは`columnCasts`で必ず明示すること(省略や"none"は例外)。
 * `INSERT INTO (columns) VALUES (...)`とは異なり、`FROM (VALUES ...) AS v(...)`は
 * 挿入先カラムからの型推論が効かないため、キャスト無しのパラメータはPostgreSQLに
 * text相当として推論されることがある。主キーがinteger等の場合、後続のWHERE句
 * (`t.pk = v.pk`)で`operator does not exist: integer = text`のように失敗する
 * (実際に発生した障害の原因)。この関数はその型推論への依存を構造的に排除する。
 */
export function buildBulkUpdateSql(
  table: string,
  pkColumn: string,
  columns: readonly string[],
  columnCasts: Readonly<Record<string, BulkUpdateColumnCast>>,
  rowCount: number,
): string {
  const qualified = qualifiedTable(table);
  if (rowCount <= 0) throw new Error("buildBulkUpdateSql: rowCountは1以上である必要がある");
  const pkCast = columnCasts[pkColumn];
  if (!pkCast || pkCast === "none") {
    throw new Error(
      `buildBulkUpdateSql: 主キー列(${pkColumn})の型キャストが未指定。` +
        `PostgreSQLがVALUES句の型をtext相当へ推論し、実カラムの型と比較できず` +
        `"operator does not exist"で失敗する恐れがあるため、呼び出し側でtext/integer等を必ず指定すること。`,
    );
  }
  const allColumns = [pkColumn, ...columns];
  const valueRows: string[] = [];
  let paramIndex = 1;
  for (let r = 0; r < rowCount; r += 1) {
    const placeholders = allColumns.map((c) => {
      const cast = columnCasts[c] ?? "none";
      const ph = `$${paramIndex++}`;
      return cast === "none" ? ph : `${ph}::${cast}`;
    });
    valueRows.push(`(${placeholders.join(", ")})`);
  }
  const setClause = columns.map((c) => `${c} = v.${c}`).join(", ");
  return [
    `update ${qualified} as t`,
    `set ${setClause}`,
    `from (values ${valueRows.join(", ")}) as v(${allColumns.join(", ")})`,
    `where t.${pkColumn} = v.${pkColumn}`,
  ].join("\n");
}
