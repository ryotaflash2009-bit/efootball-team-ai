import { createHash } from "node:crypto";
import { BACKUP_READER_ROLE } from "./backup-reader-rls-policy-sql-audit";
import { Stage4Stop, targetSchema, type Stage4Client } from "./stage4-managers";
import { PRODUCTION_REFERENCE_SCHEMA } from "./update-apply";

/**
 * 承認1回化(docs/production-readiness/automated-update-pipeline.md)のための2つの部品。
 *
 * 1. Plan の Production 読み取りは **読み取り専用role** で行う(書き込みcredentialを使わない)。
 *    接続先roleが許可リストにあり、読み取り専用transactionで、危険な属性(superuser・BYPASSRLS 等)も
 *    書き込み権限(INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER・schemaへのCREATE)も無く、
 *    対象tableをSELECTできることを、行を読む前に確認する。
 * 2. Dry run は Production へ接続しない。Plan が読んだ Production の状態を **スナップショット** として
 *    artifact に残し、その sha256 を bundle に記録する。Dry run はスナップショットの sha256 を照合してから使う。
 *    Productionが Plan 後に変わっていないか(stale)は、Apply が書き込み前に Production を読み直して確認する。
 */

/** Plan の読み取りに使ってよいrole。専用role(将来)と、既存の読み取り専用Backup role。 */
export const PLAN_READER_ROLES: readonly string[] = Object.freeze(["reference_data_plan_reader", BACKUP_READER_ROLE]);

const READ_TABLES = ["world_player_cards", "managers", "import_batches"] as const;
const ALL_TABLES = [...READ_TABLES, "player_card_analysis"] as const;
const WRITE_PRIVILEGES = ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"] as const;

export interface PlanReadPreflight {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly facts: { readonly role: string | null; readonly readOnlyTransaction: boolean };
}

/** 呼び出し側が `begin read only` の中で実行する。カタログと権限関数だけを読む(行データは読まない)。 */
export async function runPlanReadPreflight(client: Stage4Client, schema: string = PRODUCTION_REFERENCE_SCHEMA): Promise<PlanReadPreflight> {
  const s = targetSchema(schema);
  const problems: string[] = [];
  const who = (await client.query("select current_user::text as u, current_setting('transaction_read_only') as ro")).rows[0] ?? {};
  const role = typeof who.u === "string" ? who.u : null;
  const ro = who.ro === "on";
  if (!role || !PLAN_READER_ROLES.includes(role)) problems.push("plan_role_not_allowed");
  if (!ro) problems.push("plan_not_read_only_transaction");
  const attrs = (await client.query("select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication from pg_catalog.pg_roles where rolname = current_user")).rows[0];
  if (!attrs) problems.push("plan_role_missing");
  else for (const k of ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb", "rolreplication"]) if (attrs[k] !== false) problems.push(`plan_role_attribute:${k}`);
  const schemaCreate = (await client.query("select has_schema_privilege(current_user, $1, 'CREATE') as c", [s])).rows[0];
  if (schemaCreate?.c !== false) problems.push("plan_schema_create_privilege");
  for (const t of ALL_TABLES) {
    for (const p of WRITE_PRIVILEGES) {
      const r = (await client.query(`select has_table_privilege(current_user, $1, '${p}') as g`, [`${s}.${t}`])).rows[0];
      if (r?.g !== false) problems.push(`plan_write_privilege:${t}:${p.toLowerCase()}`);
    }
  }
  for (const t of READ_TABLES) {
    const r = (await client.query("select has_table_privilege(current_user, $1, 'SELECT') as g", [`${s}.${t}`])).rows[0];
    if (r?.g !== true) problems.push(`plan_select_missing:${t}`);
  }
  return { ok: problems.length === 0, problems, facts: { role, readOnlyTransaction: ro } };
}

// ---------------------------------------------------------------------------
// スナップショット
// ---------------------------------------------------------------------------

export const STATE_SNAPSHOT_SCHEMA = "stage4-state-snapshot/v1";
export type SnapshotKind = "world" | "managers";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Productionの状態(Date を含む)を JSON にし、その sha256 を返す。行データは公開参照データだけ(利用者データは含まない)。 */
export function serializeStateSnapshot(kind: SnapshotKind, capturedAt: string, state: object): { text: string; sha256: string } {
  const text = JSON.stringify({ schema: STATE_SNAPSHOT_SCHEMA, kind, capturedAt, state });
  return { text, sha256: sha256(text) };
}

/**
 * スナップショットを検証して復元する。sha256 が bundle の記録と一致し、形式・件数が整合する場合だけ返す。
 * 日時は JSON で文字列になるが、差分・checksum は `normalizeTimestamp` で Date と同じ値として扱われる。
 */
export function parseStateSnapshot<T extends { counts: Record<string, number> }>(text: string, kind: SnapshotKind, expectedSha256: string | undefined): T {
  if (!expectedSha256 || !/^[0-9a-f]{64}$/.test(expectedSha256)) throw new Stage4Stop("state_snapshot_not_bound");
  if (sha256(text) !== expectedSha256) throw new Stage4Stop("state_snapshot_checksum_mismatch");
  let d: { schema?: unknown; kind?: unknown; state?: unknown };
  try {
    d = JSON.parse(text);
  } catch {
    throw new Stage4Stop("state_snapshot_not_json");
  }
  if (d.schema !== STATE_SNAPSHOT_SCHEMA || d.kind !== kind || !d.state || typeof d.state !== "object") throw new Stage4Stop("state_snapshot_shape");
  const st = d.state as Record<string, unknown>;
  const counts = st.counts as Record<string, unknown> | undefined;
  const rows = kind === "world" ? st.world : st.managers;
  if (!counts || !Array.isArray(rows) || !Array.isArray(st.importBatches)) throw new Stage4Stop("state_snapshot_shape");
  const table = kind === "world" ? "world_player_cards" : "managers";
  if (counts[table] !== rows.length || counts.import_batches !== st.importBatches.length) throw new Stage4Stop("state_snapshot_inconsistent");
  return st as unknown as T;
}
