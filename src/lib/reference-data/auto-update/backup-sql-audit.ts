import type { GuardCheck } from "../real-import-guards";
import { BACKUP_TARGET_TABLES } from "./backup-target";
import { BACKUP_SOURCE_TEST_SCHEMA, BACKUP_RESTORE_TEST_SCHEMA } from "./backup-schema";
import { buildBackupDumpSelectSql, buildBackupCountSql, buildBackupRestoreInsertSql, buildBackupTruncateRestoreTargetSql } from "./backup-sql";

/**
 * Backup/Restore SQL(隔離PostgreSQL専用、Production向けではない)の静的監査。
 * `promotion-sql-audit.ts`と同じ方針: 生SQLファイルではなく、`backup-sql.ts`のビルダー関数が
 * 実際に生成するSQL文字列を対象に検査する。
 *
 * Promotionの監査と異なりTRUNCATEを一律禁止にしない理由: Restoreは「空のRestore先schemaへ
 * 書き戻す」ことが前提のため、TRUNCATEは`BACKUP_RESTORE_TEST_SCHEMA`だけに対して許可する
 * (それ以外のschemaに対するTRUNCATEは禁止のまま)。
 */

const FORBIDDEN_SCHEMA_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "public", re: /\bpublic\./i },
  { label: "auth", re: /\bauth\./i },
  { label: "reference_data(確定Production schema)", re: /\breference_data\./i },
  { label: "reference_data_ops(Production管理schema)", re: /\breference_data_ops\./i },
];

const USER_DATA_PATTERN = /\b(auth\.users|my_team_snapshots|rls_probe_records)\b/i;

function collectGeneratedSql(): string[] {
  const sqlList: string[] = [];
  for (const table of BACKUP_TARGET_TABLES) {
    sqlList.push(buildBackupDumpSelectSql(BACKUP_SOURCE_TEST_SCHEMA, table));
    sqlList.push(buildBackupDumpSelectSql(BACKUP_RESTORE_TEST_SCHEMA, table));
    sqlList.push(buildBackupCountSql(BACKUP_SOURCE_TEST_SCHEMA, table));
    sqlList.push(buildBackupTruncateRestoreTargetSql(table));
    sqlList.push(buildBackupRestoreInsertSql(table, 1));
    sqlList.push(buildBackupRestoreInsertSql(table, 3));
  }
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

/** DROP DATABASE・DROP SCHEMA・ALTER・GRANT/REVOKEは常に禁止(TRUNCATEはRestore先schemaだけ例外)。 */
export function assertNoBroadDestructiveDdl(sqlList: readonly string[]): GuardCheck {
  const re = /\b(drop\s+database|drop\s+schema|alter|grant|revoke)\b/i;
  const offending = sqlList.filter((sql) => re.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `DROP DATABASE/DROP SCHEMA/ALTER/GRANT/REVOKEを含む文が見つかった: ${offending.length}件` };
  }
  return { ok: true };
}

/** TRUNCATEは`BACKUP_RESTORE_TEST_SCHEMA`(常に空のRestore先)だけに限定して許可する。 */
export function assertTruncateScopedToRestoreTargetOnly(sqlList: readonly string[]): GuardCheck {
  const truncateStatements = sqlList.filter((sql) => /\btruncate\b/i.test(sql));
  for (const sql of truncateStatements) {
    if (!sql.includes(`${BACKUP_RESTORE_TEST_SCHEMA}.`)) {
      return { ok: false, reason: `Restore先schema(${BACKUP_RESTORE_TEST_SCHEMA})以外へのTRUNCATEが見つかった: ${sql}` };
    }
  }
  return { ok: true };
}

export function assertNoDynamicSql(sqlList: readonly string[]): GuardCheck {
  const re = /\bexecute\b|\bdo\s*\$|\bcall\b/i;
  const offending = sqlList.filter((sql) => re.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `動的SQL(EXECUTE/DO/CALL)を含む文が見つかった: ${offending.length}件` };
  }
  return { ok: true };
}

export function assertParameterizedOnly(sqlList: readonly string[]): GuardCheck {
  const suspiciousLiteralRe = /values\s*\([^?]*'[^']*'[^)]*\)/i;
  const offending = sqlList.filter((sql) => suspiciousLiteralRe.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `VALUES句に文字列リテラルが直接埋め込まれている(パラメータ化違反): ${offending.length}件` };
  }
  return { ok: true };
}

export function assertNoSecretOrConnectionInfo(sqlList: readonly string[]): GuardCheck {
  const re = /(postgres(ql)?:\/\/|sb_secret_|password\s*=|supabase\.co|token|api[_-]?key)/i;
  const offending = sqlList.filter((sql) => re.test(sql));
  if (offending.length > 0) {
    return { ok: false, reason: `接続文字列・パスワード・トークン・Supabaseホスト名らしき文字列が含まれている: ${offending.length}件` };
  }
  return { ok: true };
}

export function assertExactlyFourAllowedTables(): GuardCheck {
  const expected = ["world_player_cards", "managers", "player_card_analysis", "import_batches"];
  const actual = [...BACKUP_TARGET_TABLES];
  if (actual.length !== expected.length || !expected.every((t) => actual.includes(t))) {
    return { ok: false, reason: `Backup対象テーブル数が想定外(4件固定であるべき): ${actual.join(", ")}` };
  }
  return { ok: true };
}

const BYPASS_FLAG_PATTERNS: readonly string[] = ["--no-encryption", "--skip-checksum", "--skip-restore-test"];

/** 将来CLIスクリプトを追加する場合に備え、既知のbypassフラグが指定されていないことを確認する(現状は空argvに対しても常に安全)。 */
export function assertNoBypassFlags(argv: readonly string[]): GuardCheck {
  const found = BYPASS_FLAG_PATTERNS.filter((flag) => argv.includes(flag));
  if (found.length > 0) {
    return { ok: false, reason: `禁止されたbypassフラグが指定されている: ${found.join(", ")}` };
  }
  return { ok: true };
}

/** Backup/Restore SQL全体に対する静的監査(合成SQLファイルではなく、実際のビルダー出力を検査する)。 */
export function auditBackupSql(): GuardCheck[] {
  const sqlList = collectGeneratedSql();
  return [
    assertNoForbiddenSchemaReference(sqlList),
    assertNoUserDataTableReference(sqlList),
    assertNoSelectStar(sqlList),
    assertNoBroadDestructiveDdl(sqlList),
    assertTruncateScopedToRestoreTargetOnly(sqlList),
    assertNoDynamicSql(sqlList),
    assertParameterizedOnly(sqlList),
    assertNoSecretOrConnectionInfo(sqlList),
    assertExactlyFourAllowedTables(),
    assertNoBypassFlags([]),
  ];
}
