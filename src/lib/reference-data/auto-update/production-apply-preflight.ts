import { productionWriteLockKey } from "./update-apply";
import { UPDATER_COLUMN_GRANTS, UPDATER_ROLE_NAME, type UpdaterTable } from "./updater-role";

/**
 * Stage 2: reference_data_updaterとして接続したsessionが契約どおりかを、読み取り専用で確かめる。
 * (Production apply workflowのpreflight modeと、使い捨てPostgreSQLでの再現テストで使う)
 *
 * 行データは読まない(system catalog・information_schema・OID指定の権限関数・設定値・advisory lockの取得可否だけ)。
 * 呼び出し側は `begin read only` の中で実行し、終わったらrollbackする。
 *
 * 利用者・認証データからの分離(2026-09-24修正、Production preflight Run #2の失敗対応):
 *   以前は `to_regclass('auth.users')` 等の名前解決でtableを探していたが、schemaの名前解決には
 *   そのschemaのUSAGE権限が要るため、updaterにauthの権限が無い正常状態で
 *   「permission denied for schema auth」になっていた。現在は、全roleが読めるsystem catalog
 *   (pg_namespace・pg_class)で対象のOIDを求め、OID指定の has_schema_privilege・has_table_privilege・
 *   has_any_column_privilege で権限の有無だけを判定する(名前解決なし・行データを読まない・
 *   updaterへ権限を追加しない)。権限が1つでもあれば失敗。
 */

export interface PreflightClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface UpdaterPreflightResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly facts: Readonly<Record<string, unknown>>;
}

const TABLES = Object.keys(UPDATER_COLUMN_GRANTS) as UpdaterTable[];
/** updaterがUSAGEを持ってはならないschema。 */
export const FORBIDDEN_SCHEMA_USAGE = Object.freeze(["auth", "reference_data_ops"] as const);
/** updaterがtable・列のいずれの権限も持ってはならないschema(利用者・認証・Storage・Vault・運用データ)。 */
export const FORBIDDEN_TABLE_SCHEMAS = Object.freeze(["auth", "storage", "vault", "public", "reference_data_ops"] as const);
const EXPECTED_SETTINGS = { statement_timeout: "2min", lock_timeout: "5s", idle_in_transaction_session_timeout: "1min" } as const;

/** PostgreSQL/接続エラーを、本文・URL・SQLを含まない安全なcodeへ変換する。 */
export function safeErrorCode(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? (err as { code?: unknown }).code : undefined;
  if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return `sqlstate_${code}`;
  // Node.jsのsocket/TLSエラーcode(ECONNREFUSED・SELF_SIGNED_CERT_IN_CHAIN・ERR_TLS_CERT_ALTNAME_INVALID等)。値そのものは含まない。
  if (typeof code === "string" && /^[A-Z][A-Z0-9_]{2,40}$/.test(code)) return `net_${code}`;
  return "unknown";
}

class PreflightQueryError extends Error {
  constructor(readonly step: string, readonly code: string) {
    super(`preflight query failed: ${step} ${code}`);
  }
}

async function q(client: PreflightClient, step: string, sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  try {
    return (await client.query(sql, params)).rows;
  } catch (err) {
    throw new PreflightQueryError(step, safeErrorCode(err));
  }
}

export async function runUpdaterPreflight(client: PreflightClient, schema = "reference_data"): Promise<UpdaterPreflightResult> {
  try {
    return await runChecks(client, schema);
  } catch (err) {
    // どのcatalog照会の失敗も「確認できなかった」としてfail。権限拒否(42501)を含め、成功扱いにしない。
    if (err instanceof PreflightQueryError) return { ok: false, problems: [`query_failed:${err.step}:${err.code}`], facts: {} };
    return { ok: false, problems: ["query_failed:unexpected"], facts: {} };
  }
}

async function runChecks(client: PreflightClient, schema: string): Promise<UpdaterPreflightResult> {
  const problems: string[] = [];
  const add = (p: string) => problems.push(p);

  const who =
    (
      await q(
        client,
        "role",
        `select current_user::text as u, r.rolbypassrls as bypass, r.rolsuper as super, r.rolinherit as inherit,
                current_setting('statement_timeout') as statement_timeout, current_setting('lock_timeout') as lock_timeout,
                current_setting('idle_in_transaction_session_timeout') as idle_in_transaction_session_timeout,
                current_setting('transaction_read_only') as read_only
         from pg_catalog.pg_roles r where r.rolname = current_user`,
      )
    )[0] ?? {};
  if (who.u !== UPDATER_ROLE_NAME) add("wrong_role");
  if (who.bypass !== false) add("role_bypasses_rls");
  if (who.super !== false) add("role_is_superuser");
  if (who.inherit !== false) add("role_inherits");
  if (who.read_only !== "on") add("preflight_not_read_only");
  for (const [k, v] of Object.entries(EXPECTED_SETTINGS)) if (who[k] !== v) add(`setting:${k}`);

  const tableGrants = (
    await q(
      client,
      "table_grants",
      `select table_schema || '.' || table_name || ':' || privilege_type as g
       from information_schema.role_table_grants where grantee = current_user order by 1`,
    )
  ).map((r) => String(r.g));
  const wantTable = TABLES.map((t) => `${schema}.${t}:SELECT`).sort();
  if (JSON.stringify(tableGrants) !== JSON.stringify(wantTable)) add("table_grants");

  const columnGrants = await q(
    client,
    "column_grants",
    `select table_name, lower(privilege_type) as p, column_name
     from information_schema.column_privileges
     where grantee = current_user and table_schema = $1 and privilege_type in ('INSERT', 'UPDATE')`,
    [schema],
  );
  for (const t of TABLES) {
    for (const p of ["insert", "update"] as const) {
      const actual = columnGrants.filter((g) => g.table_name === t && g.p === p).map((g) => String(g.column_name)).sort();
      if (JSON.stringify(actual) !== JSON.stringify([...UPDATER_COLUMN_GRANTS[t][p]].sort())) add(`column_grants:${t}:${p}`);
    }
  }

  const tables = await q(
    client,
    "reference_tables",
    `select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as forced, pg_catalog.pg_get_userbyid(c.relowner) = current_user as owned
     from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1 and c.relname = any($2::text[])`,
    [schema, [...TABLES, "player_card_analysis"]],
  );
  for (const t of TABLES) {
    const row = tables.find((x) => x.name === t);
    if (!row) add(`table_missing:${t}`);
    else {
      if (row.rls !== true || row.forced !== true) add(`rls_not_forced:${t}`);
      if (row.owned === true) add(`role_owns_table:${t}`);
    }
  }
  if (tables.some((x) => x.owned === true && x.name === "player_card_analysis")) add("role_owns_table:player_card_analysis");

  // 利用者・認証データからの分離: catalogでOIDを求め、OID指定の権限関数で判定する(名前解決・行の読み取りなし)。
  const schemaUsage = (
    await q(
      client,
      "sensitive_schema_usage",
      `select n.nspname as name from pg_catalog.pg_namespace n
       where n.nspname = any($1::text[]) and pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE')
       order by 1`,
      [[...FORBIDDEN_SCHEMA_USAGE]],
    )
  ).map((r) => String(r.name));
  for (const s of schemaUsage) add(`sensitive_schema_usage:${s}`);

  const sensitive = (
    await q(
      client,
      "sensitive_table_access",
      `select n.nspname || '.' || c.relname as name
       from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p', 'v', 'm', 'f')
         and (n.nspname = any($1::text[]) or (n.nspname = $2 and c.relname = 'player_card_analysis'))
         and (pg_catalog.has_table_privilege(current_user, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
              or pg_catalog.has_any_column_privilege(current_user, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'))
       order by 1`,
      [[...FORBIDDEN_TABLE_SCHEMAS], schema],
    )
  ).map((r) => String(r.name));
  if (sensitive.length > 0) add(`sensitive_access:${sensitive.join(",")}`);

  const lock = (await q(client, "advisory_lock", "select pg_try_advisory_xact_lock($1::bigint) as ok", [productionWriteLockKey()]))[0];
  if (lock?.ok !== true) add("production_write_lock_busy");

  return {
    ok: problems.length === 0,
    problems,
    facts: {
      role: who.u ?? null,
      readOnly: who.read_only ?? null,
      tableGrantCount: tableGrants.length,
      columnGrantCount: columnGrants.length,
      sensitiveSchemaUsageCount: schemaUsage.length,
      sensitiveTableAccessCount: sensitive.length,
      sensitiveSchemasChecked: [...FORBIDDEN_TABLE_SCHEMAS],
    },
  };
}
