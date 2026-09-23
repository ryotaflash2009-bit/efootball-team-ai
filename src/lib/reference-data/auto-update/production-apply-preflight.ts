import { productionWriteLockKey } from "./update-apply";
import { UPDATER_COLUMN_GRANTS, UPDATER_ROLE_NAME, type UpdaterTable } from "./updater-role";

/**
 * Stage 2: reference_data_updaterとして接続したsessionが契約どおりかを、読み取り専用で確かめる。
 * (Production apply workflowのpreflight modeと、使い捨てPostgreSQLでの再現テストで使う)
 *
 * 行データは読まない(catalog・information_schema・権限関数・設定値・advisory lockの取得可否だけ)。
 * 呼び出し側は `begin read only` の中で実行し、終わったらrollbackする。
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
const SENSITIVE = ["auth.users", "auth.identities", "auth.sessions", "public.my_team_snapshots"];
const EXPECTED_SETTINGS = { statement_timeout: "2min", lock_timeout: "5s", idle_in_transaction_session_timeout: "1min" } as const;

export async function runUpdaterPreflight(client: PreflightClient, schema = "reference_data"): Promise<UpdaterPreflightResult> {
  const problems: string[] = [];
  const add = (p: string) => problems.push(p);

  const who = (
    await client.query(
      `select current_user::text as u, r.rolbypassrls as bypass, r.rolsuper as super, r.rolinherit as inherit,
              current_setting('statement_timeout') as statement_timeout, current_setting('lock_timeout') as lock_timeout,
              current_setting('idle_in_transaction_session_timeout') as idle_in_transaction_session_timeout,
              current_setting('transaction_read_only') as read_only
       from pg_catalog.pg_roles r where r.rolname = current_user`,
    )
  ).rows[0] ?? {};
  if (who.u !== UPDATER_ROLE_NAME) add("wrong_role");
  if (who.bypass !== false) add("role_bypasses_rls");
  if (who.super !== false) add("role_is_superuser");
  if (who.inherit !== false) add("role_inherits");
  if (who.read_only !== "on") add("preflight_not_read_only");
  for (const [k, v] of Object.entries(EXPECTED_SETTINGS)) if (who[k] !== v) add(`setting:${k}`);

  const tableGrants = (
    await client.query(
      `select table_schema || '.' || table_name || ':' || privilege_type as g
       from information_schema.role_table_grants where grantee = current_user order by 1`,
    )
  ).rows.map((r) => String(r.g));
  const wantTable = TABLES.map((t) => `${schema}.${t}:SELECT`).sort();
  if (JSON.stringify(tableGrants) !== JSON.stringify(wantTable)) add("table_grants");

  const columnGrants = (
    await client.query(
      `select table_name, lower(privilege_type) as p, column_name
       from information_schema.column_privileges
       where grantee = current_user and table_schema = $1 and privilege_type in ('INSERT', 'UPDATE')`,
      [schema],
    )
  ).rows;
  for (const t of TABLES) {
    for (const p of ["insert", "update"] as const) {
      const actual = columnGrants.filter((g) => g.table_name === t && g.p === p).map((g) => String(g.column_name)).sort();
      if (JSON.stringify(actual) !== JSON.stringify([...UPDATER_COLUMN_GRANTS[t][p]].sort())) add(`column_grants:${t}:${p}`);
    }
  }

  const tables = (
    await client.query(
      `select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as forced, pg_catalog.pg_get_userbyid(c.relowner) = current_user as owned
       from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relname = any($2::text[])`,
      [schema, [...TABLES, "player_card_analysis"]],
    )
  ).rows;
  for (const t of TABLES) {
    const row = tables.find((x) => x.name === t);
    if (!row) add(`table_missing:${t}`);
    else {
      if (row.rls !== true || row.forced !== true) add(`rls_not_forced:${t}`);
      if (row.owned === true) add(`role_owns_table:${t}`);
    }
  }

  const sensitive = (
    await client.query(
      `select x.name from unnest($1::text[]) as x(name)
       where pg_catalog.to_regclass(x.name) is not null
         and pg_catalog.has_table_privilege(current_user, pg_catalog.to_regclass(x.name), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')`,
      [[...SENSITIVE, `${schema}.player_card_analysis`]],
    )
  ).rows.map((r) => String(r.name));
  if (sensitive.length > 0) add(`sensitive_access:${sensitive.join(",")}`);

  const lock = (await client.query("select pg_try_advisory_xact_lock($1::bigint) as ok", [productionWriteLockKey()])).rows[0];
  if (lock?.ok !== true) add("production_write_lock_busy");

  return {
    ok: problems.length === 0,
    problems,
    facts: { role: who.u ?? null, readOnly: who.read_only ?? null, tableGrantCount: tableGrants.length, columnGrantCount: columnGrants.length, sensitiveAccess: sensitive },
  };
}
