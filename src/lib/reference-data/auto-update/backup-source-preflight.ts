import type { GuardCheck } from "../real-import-guards";
import type { QueryClient } from "./apply-orchestrator";
import { BACKUP_TARGET_TABLES } from "./backup-target";
import { BACKUP_SOURCE_TEST_SCHEMA, PRODUCTION_REFERENCE_DATA_SCHEMA, type BackupDumpSourceSchemaName } from "./backup-schema";

/**
 * Production export前の読み取り専用preflight。接続先が想定どおりか、対象4テーブルの
 * 行が実際に「見える」状態かを、秘密情報を一切出力せずに確認する。
 *
 * 2026-09-23追記(workflow Run #6の空Backup): 対象4テーブルはいずれもRLS有効
 * (FORCE)で、SELECTポリシーは`anon`/`authenticated`向けにしか存在せず、
 * `reference_data_backup_reader`は`NOBYPASSRLS`で自分に適用されるポリシーを
 * 持たない。PostgreSQLはこの状態のSELECTをエラーにせず「0行」として返すため、
 * exportは黙って空になった。このpreflightはカタログ(pg_class/pg_policies/pg_roles)
 * だけを読み、この状態をexport前に明示的な理由付きでblockedにする。
 *
 * 読むのはシステムカタログと関数値(current_database/current_user/session_user)だけで、
 * 利用者データ・auth系テーブル・対象テーブルの行そのものは読まない。書込みSQLは含まない。
 * 出力する値はdatabase名・role名(いずれも秘密情報ではない、設計文書に記載済み)と
 * テーブル名・真偽値だけで、host・Project Ref・URL・password・証明書は含まれない。
 */

export interface ExpectedSourceIdentity {
  database: string;
  currentUser: string;
  sessionUser: string;
}

export const PRODUCTION_EXPECTED_SOURCE_IDENTITY: ExpectedSourceIdentity = Object.freeze({
  database: "postgres",
  currentUser: "reference_data_backup_reader",
  sessionUser: "reference_data_backup_reader",
});

const PREFLIGHT_SCHEMAS: readonly string[] = [PRODUCTION_REFERENCE_DATA_SCHEMA, BACKUP_SOURCE_TEST_SCHEMA];
const SAFE_IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function assertPreflightSchema(schemaName: string): void {
  if (!PREFLIGHT_SCHEMAS.includes(schemaName) || !SAFE_IDENTIFIER_RE.test(schemaName)) {
    throw new Error(`preflight対象として許可されていないschema: ${schemaName}`);
  }
}

export function buildSourceIdentitySql(): string {
  return [
    "select current_database() as current_database_name,",
    "  current_user as current_user_name,",
    "  session_user as session_user_name,",
    "  r.rolsuper as is_superuser,",
    "  r.rolbypassrls as bypass_rls",
    "from pg_catalog.pg_roles r",
    "where r.rolname = current_user",
  ].join("\n");
}

export function buildSourceTableVisibilitySql(schemaName: BackupDumpSourceSchemaName): string {
  assertPreflightSchema(schemaName);
  for (const t of BACKUP_TARGET_TABLES) {
    if (!SAFE_IDENTIFIER_RE.test(t)) throw new Error(`不正なテーブル名: ${t}`);
  }
  const tableArray = BACKUP_TARGET_TABLES.map((t) => `'${t}'`).join(", ");
  return [
    "select t.table_name,",
    "  c.oid is not null as table_exists,",
    "  coalesce(c.relrowsecurity, false) as rls_enabled,",
    "  case when c.oid is null then false else has_table_privilege(c.oid, 'SELECT') end as has_select_privilege,",
    "  exists (",
    "    select 1 from pg_catalog.pg_policies p",
    `    where p.schemaname = '${schemaName}'`,
    "      and p.tablename = t.table_name",
    "      and p.permissive = 'PERMISSIVE'",
    "      and p.cmd in ('SELECT', 'ALL')",
    "      and (p.roles @> array[current_user]::name[] or p.roles @> array['public']::name[])",
    "  ) as has_applicable_select_policy",
    `from unnest(array[${tableArray}]::text[]) as t(table_name)`,
    `left join pg_catalog.pg_class c on c.oid = to_regclass('${schemaName}.' || t.table_name)`,
    "order by t.table_name",
  ].join("\n");
}

function asBool(v: unknown): boolean | null {
  if (v === true || v === "t" || v === "true") return true;
  if (v === false || v === "f" || v === "false") return false;
  return null;
}

/** identity/visibilityクエリの結果行から、preflightの合否を判定する(純関数)。失敗理由をすべて返す。 */
export function evaluateSourcePreflight(
  identityRows: readonly Record<string, unknown>[],
  tableRows: readonly Record<string, unknown>[],
  expected: ExpectedSourceIdentity,
): GuardCheck[] {
  const checks: GuardCheck[] = [];

  if (identityRows.length !== 1) {
    checks.push({ ok: false, reason: `接続先identityを1行で取得できない(取得行数: ${identityRows.length}、blocked)` });
    return checks;
  }
  const identity = identityRows[0];
  if (identity.current_database_name !== expected.database) {
    checks.push({ ok: false, reason: `current_database()が想定(${expected.database})と一致しない(blocked)` });
  }
  if (identity.current_user_name !== expected.currentUser) {
    checks.push({ ok: false, reason: `current_userが想定(${expected.currentUser})と一致しない(blocked)` });
  }
  if (identity.session_user_name !== expected.sessionUser) {
    checks.push({ ok: false, reason: `session_userが想定(${expected.sessionUser})と一致しない(blocked)` });
  }
  const isSuperuser = asBool(identity.is_superuser);
  const bypassRls = asBool(identity.bypass_rls);
  if (isSuperuser === null || bypassRls === null) {
    checks.push({ ok: false, reason: "role属性(superuser/bypassrls)を判定できない(blocked)" });
    return checks;
  }
  const rlsBypassed = isSuperuser || bypassRls;

  const byTable = new Map<string, Record<string, unknown>>();
  for (const row of tableRows) {
    if (typeof row.table_name === "string") byTable.set(row.table_name, row);
  }
  for (const table of BACKUP_TARGET_TABLES) {
    const row = byTable.get(table);
    if (!row) {
      checks.push({ ok: false, reason: `${table}のpreflight結果が無い(blocked)` });
      continue;
    }
    const exists = asBool(row.table_exists);
    const canSelect = asBool(row.has_select_privilege);
    const rlsEnabled = asBool(row.rls_enabled);
    const hasPolicy = asBool(row.has_applicable_select_policy);
    if (exists === null || canSelect === null || rlsEnabled === null || hasPolicy === null) {
      checks.push({ ok: false, reason: `${table}のpreflight結果の形式が不正(blocked)` });
      continue;
    }
    if (!exists) {
      checks.push({ ok: false, reason: `${table}が存在しない(blocked)` });
      continue;
    }
    if (!canSelect) {
      checks.push({ ok: false, reason: `${table}へのSELECT権限が無い(blocked)` });
      continue;
    }
    if (rlsEnabled && !rlsBypassed && !hasPolicy) {
      checks.push({
        ok: false,
        reason: `${table}はRLS有効だが、このroleに適用されるSELECTポリシーが無い(RLSの既定拒否により行が0件に見える状態、blocked)`,
      });
      continue;
    }
    checks.push({ ok: true });
  }
  return checks;
}

function requireRows(result: unknown, label: string): Record<string, unknown>[] {
  const rows = (result as { rows?: unknown } | null | undefined)?.rows;
  if (!Array.isArray(rows)) throw new Error(`${label}の結果にrows配列が無い(blocked)`);
  return rows as Record<string, unknown>[];
}

export interface SourcePreflightResult {
  ok: boolean;
  reasons: string[];
}

export async function runSourcePreflight(
  client: QueryClient,
  schemaName: BackupDumpSourceSchemaName,
  expected: ExpectedSourceIdentity,
): Promise<SourcePreflightResult> {
  const identityRows = requireRows(await client.query(buildSourceIdentitySql()), "identity preflight");
  const tableRows = requireRows(await client.query(buildSourceTableVisibilitySql(schemaName)), "table visibility preflight");
  const failed = evaluateSourcePreflight(identityRows, tableRows, expected).filter((c) => !c.ok);
  return { ok: failed.length === 0, reasons: failed.map((c) => c.reason ?? "理由不明") };
}
