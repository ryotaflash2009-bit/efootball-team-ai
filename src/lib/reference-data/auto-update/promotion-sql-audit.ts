import type { GuardCheck } from "../real-import-guards";
import {
  PROMOTION_TABLE_SPECS,
  PROMOTION_STAGING_SCHEMA,
  PROMOTION_FINAL_SCHEMA,
  PROMOTION_ORDER,
  buildPromotionUpsertSql,
  buildPromotionReadbackSql,
  buildPromotionSelectByIdsSql,
  buildPromotionCountSql,
  buildPromotionDeleteByIdSql,
  buildSourceMetadataUpsertSql,
  buildSourceMetadataSelectSql,
  buildSourceMetadataDeleteSql,
} from "./promotion-sql";

/**
 * Phase 3(promotion検証): promotion SQL(隔離PostgreSQL専用、Production向けではない)の
 * 静的監査。生SQLファイルではなく、`promotion-sql.ts`のビルダー関数が実際に生成するSQL
 * 文字列を対象に検査する(このモジュール自体もSQLを実行しない)。
 */

// `reference_data.`は`reference_data_test.`にマッチしない(直後の文字が"_"であり"."ではないため)。
// `reference_data_ops.`も同様に`reference_data_ops_test.`にはマッチしない。
const FORBIDDEN_SCHEMA_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "public", re: /\bpublic\./i },
  { label: "auth", re: /\bauth\./i },
  { label: "reference_data(確定Production schema)", re: /\breference_data\./i },
  { label: "reference_data_ops(Production管理schema)", re: /\breference_data_ops\./i },
];

const USER_DATA_PATTERN = /\b(auth\.users|my_team_snapshots|rls_probe_records)\b/i;

/** 監査対象として代表的な行数(1件・複数件)でビルダーを呼び出し、SQL文字列を収集する。 */
function collectGeneratedSql(): string[] {
  const sqlList: string[] = [];
  for (const spec of PROMOTION_TABLE_SPECS) {
    sqlList.push(buildPromotionUpsertSql(spec.targetTable, 1));
    sqlList.push(buildPromotionUpsertSql(spec.targetTable, 3));
    sqlList.push(buildPromotionReadbackSql(spec.targetTable));
    sqlList.push(buildPromotionSelectByIdsSql(spec.targetTable, 2));
    sqlList.push(buildPromotionCountSql(spec.targetTable));
    sqlList.push(buildPromotionDeleteByIdSql(spec.targetTable));
  }
  sqlList.push(buildSourceMetadataUpsertSql());
  sqlList.push(buildSourceMetadataSelectSql());
  sqlList.push(buildSourceMetadataDeleteSql());
  return sqlList;
}

export function assertNoForbiddenSchemaReference(sqlList: readonly string[]): GuardCheck {
  for (const sql of sqlList) {
    for (const { label, re } of FORBIDDEN_SCHEMA_PATTERNS) {
      if (re.test(sql)) {
        return { ok: false, reason: `禁止されたschemaへの参照を検出(${label}): ${sql.slice(0, 80)}` };
      }
    }
  }
  return { ok: true };
}

export function assertNoUserDataTableReference(sqlList: readonly string[]): GuardCheck {
  const offending = sqlList.filter((sql) => USER_DATA_PATTERN.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `利用者データテーブルへの参照が含まれている: ${offending.length}件` };
  }
  return { ok: true };
}

export function assertNoSelectStar(sqlList: readonly string[]): GuardCheck {
  const offending = sqlList.filter((sql) => /select\s+\*/i.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `SELECT *を含む文が見つかった: ${offending.length}件` };
  }
  return { ok: true };
}

export function assertNoDestructiveDdl(sqlList: readonly string[]): GuardCheck {
  const re = /\b(truncate|drop|alter|grant|revoke)\b/i;
  const offending = sqlList.filter((sql) => re.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `TRUNCATE/DROP/ALTER/GRANT/REVOKEを含む文が見つかった: ${offending.length}件` };
  }
  return { ok: true };
}

export function assertNoDynamicSql(sqlList: readonly string[]): GuardCheck {
  const re = /\b(execute|do\s*\$)/i;
  const offending = sqlList.filter((sql) => re.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `動的SQL(EXECUTE/DO)を含む文が見つかった: ${offending.length}件` };
  }
  return { ok: true };
}

/** DELETEは`buildPromotionDeleteByIdSql`/`buildSourceMetadataDeleteSql`が生成するものだけに限定し、必ず主キー指定のWHERE句を伴うことを確認する。 */
export function assertDeleteOnlyByPrimaryKey(sqlList: readonly string[]): GuardCheck {
  const deleteStatements = sqlList.filter((sql) => /^\s*delete\b/i.test(sql));
  for (const sql of deleteStatements) {
    if (!/\bwhere\b/i.test(sql)) {
      return { ok: false, reason: `WHERE句のないDELETE文が見つかった(全件削除の危険): ${sql}` };
    }
    if (!/where\s+\w+\s*=\s*\?/i.test(sql)) {
      return { ok: false, reason: `主キー等価条件(WHERE col = ?)以外のDELETE文が見つかった: ${sql}` };
    }
  }
  return { ok: true };
}

/** VALUES部分がすべて`?`プレースホルダーであり、値そのものがSQL文字列へ埋め込まれていないことを確認する(SQL interpolationなし)。 */
export function assertParameterizedOnly(sqlList: readonly string[]): GuardCheck {
  const suspiciousLiteralRe = /values\s*\([^?]*'[^']*'[^)]*\)/i;
  const offending = sqlList.filter((sql) => suspiciousLiteralRe.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `VALUES句に文字列リテラルが直接埋め込まれている(パラメータ化違反): ${offending.length}件` };
  }
  return { ok: true };
}

export function assertNoSecretOrConnectionInfo(sqlList: readonly string[]): GuardCheck {
  const re = /(postgres(ql)?:\/\/|sb_secret_|password\s*=|supabase\.co)/i;
  const offending = sqlList.filter((sql) => re.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `接続文字列・パスワード・Supabaseホスト名らしき文字列が含まれている: ${offending.length}件` };
  }
  return { ok: true };
}

export function assertSchemasFixed(): GuardCheck {
  if (PROMOTION_STAGING_SCHEMA !== "reference_data_ops_test" || PROMOTION_FINAL_SCHEMA !== "reference_data_test") {
    return { ok: false, reason: `staging/final schema名が想定外(staging=${PROMOTION_STAGING_SCHEMA}, final=${PROMOTION_FINAL_SCHEMA})` };
  }
  return { ok: true };
}

export function assertPromotionOrderFixed(): GuardCheck {
  const expected = ["world_player_cards", "managers", "player_card_analysis"];
  if (PROMOTION_ORDER.length !== expected.length || PROMOTION_ORDER.some((t, i) => t !== expected[i])) {
    return { ok: false, reason: `promotion順序が想定外: ${PROMOTION_ORDER.join(" -> ")}` };
  }
  return { ok: true };
}

export function assertExactlyThreeAllowedTables(): GuardCheck {
  const expectedTargets = ["world_player_cards", "managers", "player_card_analysis"];
  const actualTargets = PROMOTION_TABLE_SPECS.map((s) => s.targetTable);
  if (actualTargets.length !== expectedTargets.length || expectedTargets.some((t) => !actualTargets.includes(t))) {
    return { ok: false, reason: `許可テーブル数が想定外(3件固定であるべき): ${actualTargets.join(", ")}` };
  }
  return { ok: true };
}

/** 3テーブルすべてについて、rollback用DELETE文が例外なく生成できることを確認する(rollbackとの対応)。 */
export function assertRollbackSqlExistsForAllTables(): GuardCheck {
  try {
    for (const spec of PROMOTION_TABLE_SPECS) {
      buildPromotionDeleteByIdSql(spec.targetTable);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `一部テーブルのrollback用DELETE文が生成できない: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** promotion SQL全体に対する静的監査(合成SQLファイルではなく、実際のビルダー出力を検査する)。 */
export function auditPromotionSql(): GuardCheck[] {
  const sqlList = collectGeneratedSql();
  return [
    assertNoForbiddenSchemaReference(sqlList),
    assertNoUserDataTableReference(sqlList),
    assertNoSelectStar(sqlList),
    assertNoDestructiveDdl(sqlList),
    assertNoDynamicSql(sqlList),
    assertDeleteOnlyByPrimaryKey(sqlList),
    assertParameterizedOnly(sqlList),
    assertNoSecretOrConnectionInfo(sqlList),
    assertSchemasFixed(),
    assertPromotionOrderFixed(),
    assertExactlyThreeAllowedTables(),
    assertRollbackSqlExistsForAllTables(),
  ];
}
