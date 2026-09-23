import { UPDATER_COLUMN_GRANTS, UPDATER_NEVER_UPDATED_COLUMNS, UPDATER_POLICY_NAMES, UPDATER_ROLE_NAME, type UpdaterTable } from "./updater-role";

/**
 * reference_data_updater用SQL草案の静的監査(Phase G準備)。SQLは実行しない。
 * 列単位grantがUPDATER_COLUMN_GRANTSと完全一致し、保持列・identityをUPDATEできず、
 * DELETE/TRUNCATE等を与えず、対象外schema/tableへ触れないことを確認する。
 */

export interface AuditProblem {
  readonly check: string;
  readonly detail: string;
}

/** `--`行コメントと`$$ ... $$`のDO block本文以外(実際に変更を行う文)だけを残す。 */
export function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function statements(sql: string): string[] {
  return stripSqlComments(sql)
    .replace(/\$\$[\s\S]*?\$\$/g, "$$DO_BLOCK$$")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);
}

const TABLES: readonly UpdaterTable[] = ["world_player_cards", "managers", "import_batches"];

function parseColumnGrant(stmt: string): { privilege: "insert" | "update"; columns: string[]; table: string; grantee: string } | null {
  const m = stmt.match(/^grant (insert|update) \(([^)]*)\) on table reference_data\.([a-z_]+) to ([a-z_]+)$/i);
  if (!m) return null;
  return { privilege: m[1].toLowerCase() as "insert" | "update", columns: m[2].split(",").map((c) => c.trim()), table: m[3], grantee: m[4] };
}

export function auditCreateUpdaterRoleSql(sql: string): AuditProblem[] {
  const problems: AuditProblem[] = [];
  const add = (check: string, detail: string) => problems.push({ check, detail });
  const header = sql.slice(0, 2500);
  for (const phrase of ["DO NOT RUN", "DESIGN ONLY", "REQUIRES SEPARATE APPROVAL", "PRODUCTION NOT APPLIED", "DOES NOT CREATE OR STORE A PASSWORD", "DOES NOT GRANT USER-DATA ACCESS", "DOES NOT GRANT DELETE OR TRUNCATE"]) {
    if (!header.includes(phrase)) add("banner", phrase);
  }
  const code = stripSqlComments(sql);
  if (/\bpassword\s+'/i.test(code) || /\bencrypted\s+password\b/i.test(code)) add("no_password", "password literal");
  if (/postgres(ql)?:\/\/|supabase\.co|sslmode=|service_role/i.test(code)) add("no_connection_info", "connection info or service role");
  if (/\bexecute\b/i.test(code)) add("no_dynamic_sql", "execute");
  if (/\b(auth|public|storage|vault|reference_data_ops)\./i.test(code)) add("scope", "non-reference_data schema referenced");
  if (/player_card_analysis/i.test(code)) add("scope", "player_card_analysis referenced");

  const stmts = statements(sql);
  const create = stmts.find((s) => /^create role /i.test(s));
  if (!create) add("create_role", "missing");
  else {
    if (!create.startsWith(`create role ${UPDATER_ROLE_NAME} with`)) add("create_role", "role name");
    for (const attr of ["login", "nosuperuser", "nocreatedb", "nocreaterole", "noreplication", "nobypassrls", "noinherit", "connection limit 1"]) {
      if (!new RegExp(`\\b${attr}\\b`, "i").test(create)) add("create_role", `missing ${attr}`);
    }
    if (/\b(superuser|createdb|createrole|replication|bypassrls|inherit)\b/i.test(create.replace(/\bno(superuser|createdb|createrole|replication|bypassrls|inherit)\b/gi, ""))) add("create_role", "elevated attribute");
  }

  const grants = stmts.filter((s) => /^grant /i.test(s));
  const seen: Record<string, { insert?: string[]; update?: string[]; select?: boolean }> = {};
  for (const g of grants) {
    if (!new RegExp(` to ${UPDATER_ROLE_NAME}$`, "i").test(g)) add("grantee", g);
    if (/\b(delete|truncate|references|trigger|all)\b/i.test(g.replace(/ to [a-z_]+$/i, ""))) add("forbidden_privilege", g);
    if (/^grant usage on schema reference_data to /i.test(g)) continue;
    const sel = g.match(/^grant select on table reference_data\.([a-z_]+) to /i);
    if (sel) {
      (seen[sel[1]] ??= {}).select = true;
      continue;
    }
    const col = parseColumnGrant(g);
    if (!col) {
      add("unexpected_grant", g);
      continue;
    }
    (seen[col.table] ??= {})[col.privilege] = col.columns;
  }
  for (const t of Object.keys(seen)) if (!(TABLES as readonly string[]).includes(t)) add("scope", `grant on ${t}`);
  for (const t of TABLES) {
    const s = seen[t] ?? {};
    if (!s.select) add("select", t);
    for (const p of ["insert", "update"] as const) {
      const expected = [...UPDATER_COLUMN_GRANTS[t][p]].sort();
      const actual = [...(s[p] ?? [])].sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) add("column_grants", `${t} ${p}`);
    }
    for (const c of UPDATER_NEVER_UPDATED_COLUMNS[t]) if ((s.update ?? []).includes(c)) add("never_updated", `${t}.${c}`);
  }
  for (const setting of ["statement_timeout = '120s'", "lock_timeout = '5s'", "idle_in_transaction_session_timeout = '60s'", "search_path = reference_data"]) {
    if (!stmts.includes(`alter role ${UPDATER_ROLE_NAME} set ${setting}`)) add("settings", setting);
  }
  return problems;
}

export function auditUpdaterPolicySql(sql: string): AuditProblem[] {
  const problems: AuditProblem[] = [];
  const add = (check: string, detail: string) => problems.push({ check, detail });
  for (const phrase of ["DO NOT RUN", "DESIGN ONLY", "REQUIRES SEPARATE APPROVAL", "PRODUCTION NOT APPLIED", "NO DELETE POLICY"]) {
    if (!sql.slice(0, 2000).includes(phrase)) add("banner", phrase);
  }
  const policies = statements(sql).filter((s) => /^create policy /i.test(s));
  const names = policies.map((p) => p.split(" ")[2]);
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...UPDATER_POLICY_NAMES].sort())) add("policy_names", names.join(","));
  for (const p of policies) {
    if (!new RegExp(` to ${UPDATER_ROLE_NAME} `, "i").test(p)) add("policy_role", p);
    if (/\bfor (delete|all)\b/i.test(p)) add("policy_command", p);
    if (!/ as permissive /i.test(p)) add("policy_permissive", p);
    if (!/ on reference_data\.(world_player_cards|managers|import_batches) /i.test(p)) add("policy_table", p);
  }
  const ibUpdate = policies.find((p) => p.includes("import_batches_updater_update_pending"));
  if (!ibUpdate || !/using \(status = 'pending'\)/i.test(ibUpdate)) add("import_batches_pending_only", "update policy must be limited to pending rows");
  if (/\b(grant|revoke|drop|alter table|truncate|delete from)\b/i.test(stripSqlComments(sql).replace(/\$\$[\s\S]*?\$\$/g, ""))) add("only_create_policy", "other statements");
  return problems;
}

export function auditUpdaterRollbackSql(sql: string): AuditProblem[] {
  const problems: AuditProblem[] = [];
  const add = (check: string, detail: string) => problems.push({ check, detail });
  for (const phrase of ["DO NOT RUN", "DESIGN ONLY", "REQUIRES SEPARATE APPROVAL", "PRODUCTION NOT APPLIED", "DOES NOT TOUCH REFERENCE DATA ROWS"]) {
    if (!sql.slice(0, 2000).includes(phrase)) add("banner", phrase);
  }
  const stmts = statements(sql);
  if (stmts[0] !== `alter role ${UPDATER_ROLE_NAME} nologin`) add("nologin_first", stmts[0] ?? "");
  const dropped = stmts.filter((s) => /^drop policy /i.test(s)).map((s) => s.split(" ")[4]);
  if (JSON.stringify([...dropped].sort()) !== JSON.stringify([...UPDATER_POLICY_NAMES].sort())) add("drops_all_updater_policies", dropped.join(","));
  for (const s of stmts) {
    if (/\b(delete from|truncate|drop table|drop schema|update reference_data)\b/i.test(s)) add("no_row_changes", s);
    if (/^(grant|create)/i.test(s)) add("no_new_privileges", s);
  }
  if (!stmts.includes(`drop role if exists ${UPDATER_ROLE_NAME}`)) add("drop_role", "missing");
  return problems;
}

export function auditUpdaterVerifySql(sql: string): AuditProblem[] {
  const problems: AuditProblem[] = [];
  for (const phrase of ["READ ONLY", "METADATA ONLY", "DOES NOT READ USER ROW DATA"]) {
    if (!sql.slice(0, 2000).includes(phrase)) problems.push({ check: "banner", detail: phrase });
  }
  for (const s of statements(sql)) {
    if (!/^select /i.test(s)) problems.push({ check: "select_only", detail: s });
    if (/from reference_data\./i.test(s)) problems.push({ check: "metadata_only", detail: s });
  }
  return problems;
}
