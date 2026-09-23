import { UPDATE_TABLE_CONTRACTS, type ReferenceTable } from "./update-contract";
import { UPDATER_COLUMN_GRANTS, UPDATER_POLICY_NAMES, UPDATER_ROLE_NAME, UPDATER_ROLE_SETTINGS, type UpdaterTable } from "./updater-role";

/**
 * Stage 2: 本人がProductionで実行したmetadata確認SQL(stage2-production-metadata-check.sql)の結果JSONを、
 * リポジトリの契約と照合する純関数。結果にはmetadataだけが含まれ、行データ・秘密情報は含まれない。
 *
 *   pre : updater role作成前(roleもupdater policyも無い・対象tableの列/RLS/ownerが契約どおり)
 *   post: 作成後(role属性・列単位grant・policy 9件・利用者/認証データへの実効権限なし)
 */

export type MetadataPhase = "pre" | "post";

interface ColumnMeta {
  name: string;
  type: string;
  notNull: boolean;
}
interface TableMeta {
  name: string;
  owner: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  columns: ColumnMeta[] | null;
}
interface RoleMeta {
  name: string;
  canLogin: boolean;
  super: boolean;
  createDb: boolean;
  createRole: boolean;
  replication: boolean;
  bypassRls: boolean;
  inherit: boolean;
  connLimit: number;
  config: string[];
}
interface PolicyMeta {
  table: string;
  name: string;
  cmd: string;
  permissive: string;
  roles: string[] | string;
}
export interface Stage2Metadata {
  checkedAt?: string;
  serverVersionNum?: string;
  tables: TableMeta[];
  roles: RoleMeta[];
  policies: PolicyMeta[];
  updaterTableGrants: { table: string; privilege: string }[];
  updaterColumnGrants: { table: string; privilege: string; column: string }[];
  updaterSensitiveAccess: string[];
}

export interface MetadataCheckResult {
  readonly phase: MetadataPhase;
  readonly ok: boolean;
  readonly problems: readonly string[];
}

const TABLES: readonly ReferenceTable[] = ["world_player_cards", "managers", "player_card_analysis", "import_batches"];
const BACKUP_ROLE = "reference_data_backup_reader";

function expectedType(table: ReferenceTable, column: string): string | null {
  const c = UPDATE_TABLE_CONTRACTS[table];
  if (c.jsonbColumns.includes(column)) return "jsonb";
  if (c.textArrayColumns.includes(column)) return "text[]";
  if (c.timestampColumns.includes(column)) return "timestamp with time zone";
  if (column === "import_batch_id" || column === "batch_id") return "uuid";
  return null;
}

function rolesOf(p: PolicyMeta): string[] {
  if (Array.isArray(p.roles)) return p.roles;
  return String(p.roles).replace(/[{}]/g, "").split(",").filter(Boolean);
}

/** 結果JSON(SQL Editorからそのまま貼られた文字列でもよい)を解析する。 */
export function parseStage2Metadata(text: string): Stage2Metadata {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("metadata JSONが見つからない");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  const body = (parsed.stage2_metadata ?? parsed) as Stage2Metadata;
  for (const key of ["tables", "roles", "policies", "updaterTableGrants", "updaterColumnGrants", "updaterSensitiveAccess"] as const) {
    if (!Array.isArray(body[key])) throw new Error(`metadataに${key}配列が無い`);
  }
  return body;
}

/** `schema`はProductionでは常にreference_data(隔離検証でだけ別名を渡す)。 */
export function checkStage2Metadata(meta: Stage2Metadata, phase: MetadataPhase, options: { schema?: string } = {}): MetadataCheckResult {
  const schema = options.schema ?? UPDATER_ROLE_SETTINGS.search_path;
  const problems: string[] = [];
  const add = (p: string) => problems.push(p);

  for (const t of TABLES) {
    const tm = meta.tables.find((x) => x.name === t);
    if (!tm) {
      add(`table_missing:${t}`);
      continue;
    }
    if (!tm.rls_enabled || !tm.rls_forced) add(`rls_not_forced:${t}`);
    if (tm.owner === UPDATER_ROLE_NAME || tm.owner === BACKUP_ROLE) add(`table_owned_by_limited_role:${t}`);
    const cols = tm.columns ?? [];
    const names = cols.map((c) => c.name).sort();
    const expected = [...UPDATE_TABLE_CONTRACTS[t].productionColumns].sort();
    for (const c of expected) if (!names.includes(c)) add(`column_missing:${t}.${c}`);
    for (const c of names) if (!expected.includes(c)) add(`column_unexpected:${t}.${c}`);
    for (const c of cols) {
      const want = expectedType(t, c.name);
      if (want && c.type !== want) add(`column_type:${t}.${c.name}`);
    }
  }

  const backup = meta.roles.find((r) => r.name === BACKUP_ROLE);
  if (!backup) add("backup_role_missing");
  else if (backup.bypassRls || backup.super) add("backup_role_elevated");

  const updater = meta.roles.find((r) => r.name === UPDATER_ROLE_NAME);
  const updaterPolicies = meta.policies.filter((p) => p.name.includes("_updater_"));

  if (phase === "pre") {
    if (updater) add("updater_role_already_exists");
    if (updaterPolicies.length > 0) add("updater_policies_already_exist");
    if (meta.updaterTableGrants.length > 0 || meta.updaterColumnGrants.length > 0) add("updater_grants_already_exist");
  } else {
    if (!updater) add("updater_role_missing");
    else {
      if (!updater.canLogin) add("updater_cannot_login");
      for (const [k, v] of [["super", updater.super], ["createDb", updater.createDb], ["createRole", updater.createRole], ["replication", updater.replication], ["bypassRls", updater.bypassRls], ["inherit", updater.inherit]] as const) {
        if (v) add(`updater_attribute:${k}`);
      }
      if (updater.connLimit !== UPDATER_ROLE_SETTINGS.connectionLimit) add("updater_connection_limit");
      const cfg = [...(updater.config ?? [])].sort();
      const wantCfg = [
        `idle_in_transaction_session_timeout=${UPDATER_ROLE_SETTINGS.idle_in_transaction_session_timeout}`,
        `lock_timeout=${UPDATER_ROLE_SETTINGS.lock_timeout}`,
        `search_path=${schema}`,
        `statement_timeout=${UPDATER_ROLE_SETTINGS.statement_timeout}`,
      ].sort();
      if (JSON.stringify(cfg) !== JSON.stringify(wantCfg)) add("updater_settings");
    }
    const tableGrants = meta.updaterTableGrants.map((g) => `${g.table}:${g.privilege}`).sort();
    const wantTable = (Object.keys(UPDATER_COLUMN_GRANTS) as UpdaterTable[]).map((t) => `${t}:SELECT`).sort();
    if (JSON.stringify(tableGrants) !== JSON.stringify(wantTable)) add("updater_table_grants");
    for (const t of Object.keys(UPDATER_COLUMN_GRANTS) as UpdaterTable[]) {
      for (const p of ["insert", "update"] as const) {
        const actual = meta.updaterColumnGrants.filter((g) => g.table === t && g.privilege === p.toUpperCase()).map((g) => g.column).sort();
        if (JSON.stringify(actual) !== JSON.stringify([...UPDATER_COLUMN_GRANTS[t][p]].sort())) add(`updater_column_grants:${t}:${p}`);
      }
    }
    const names = updaterPolicies.map((p) => p.name).sort();
    if (JSON.stringify(names) !== JSON.stringify([...UPDATER_POLICY_NAMES].sort())) add("updater_policies");
    for (const p of updaterPolicies) {
      if (p.cmd === "DELETE" || p.cmd === "ALL") add(`updater_policy_command:${p.name}`);
      if (JSON.stringify(rolesOf(p)) !== JSON.stringify([UPDATER_ROLE_NAME])) add(`updater_policy_roles:${p.name}`);
    }
    if (meta.updaterSensitiveAccess.length > 0) add(`updater_sensitive_access:${meta.updaterSensitiveAccess.join(",")}`);
  }
  // Backup readerのpolicyは維持されていること(Run #7のBackup経路)。
  if (meta.policies.filter((p) => p.name.includes("_backup_reader_select")).length !== 4) add("backup_reader_policies_changed");

  return { phase, ok: problems.length === 0, problems };
}
