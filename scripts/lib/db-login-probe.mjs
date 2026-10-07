/**
 * 自動 Apply 用の DB 接続の確認（2026-10-07・読み取りだけ・書き込みなし）。
 *
 * 段階を分ける:
 *   1. ログインの確認: 接続して `select 1` だけ（表に依存しない）。
 *   2. アプリの権限の確認（1 が成功した後だけ）: system catalog と `has_*_privilege` の読み取りだけ。
 *      関係（表）の名前は schema 付きで渡し、`to_regclass` で引く（無い表を名前で参照しないため 42P01 にならない）。
 *      列単位の grant（`grant update (...)`）があるため、UPDATE / INSERT は `has_column_privilege` で列ごとに確かめる
 *      （`has_table_privilege(..., 'UPDATE')` は列単位の grant では false になる）。
 *   INSERT・UPDATE・DELETE は実行しない。
 *
 * 出力（分類）にはエラー文・接続情報・パスワードを含めない。42P01 だけは、エラー文から「関係の名前」を
 * 安全な形（英数字・`_`・`.` だけ）の場合に限って取り出す。
 */

export const PROBE_CLASSIFICATIONS = Object.freeze([
  "LOGIN_OK_AND_PRIVILEGES_OK",
  "INVALID_PASSWORD",
  "AUTHENTICATED_BUT_PROBE_RELATION_MISSING",
  "AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE",
  "AUTHENTICATED_AS_UNEXPECTED_ROLE",
  "CONNECTION_FAILURE",
  "TLS_FAILURE",
  "PROBE_FAILED_WITH_SQLSTATE",
]);

const TLS_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_UNTRUSTED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "EPROTO",
]);
const NETWORK_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]);
const SAFE_IDENT = /^[A-Za-z0-9_.]{1,127}$/;
const SAFE_CODE = /^[A-Za-z0-9_]{1,64}$/;

/**
 * 例外を分類する。返すのは分類・SQLSTATE（または Node のエラーコード）・42P01 の関係の名前だけ。
 * @param {unknown} err
 * @returns {{ classification: string, code: string | null, relation: string | null }}
 */
export function classifyProbeError(err) {
  const e = err && typeof err === "object" ? /** @type {Record<string, unknown>} */ (err) : {};
  const code = typeof e.code === "string" && SAFE_CODE.test(e.code) ? e.code : null;
  const message = typeof e.message === "string" ? e.message : "";
  if (code === "28P01") return { classification: "INVALID_PASSWORD", code, relation: null };
  if (code === "42P01") {
    const m = /relation "([^"]+)" does not exist/.exec(message);
    const relation = m && SAFE_IDENT.test(m[1]) ? m[1] : null;
    return { classification: "AUTHENTICATED_BUT_PROBE_RELATION_MISSING", code, relation };
  }
  if (code === "42501") return { classification: "AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE", code, relation: null };
  if (code && /^08/.test(code)) return { classification: "CONNECTION_FAILURE", code, relation: null };
  if (code && (TLS_CODES.has(code) || /^ERR_(TLS|SSL)_/.test(code))) return { classification: "TLS_FAILURE", code, relation: null };
  // pg は「サーバーが SSL に対応していない」をコードなしのエラーで返す。
  if (!code && /does not support SSL connections|SSL/i.test(message) && /SSL|TLS|certificate/i.test(message)) return { classification: "TLS_FAILURE", code: "SSL_NOT_SUPPORTED", relation: null };
  if (code && NETWORK_CODES.has(code)) return { classification: "CONNECTION_FAILURE", code, relation: null };
  if (!code && /timeout|terminated unexpectedly|Connection terminated/i.test(message)) return { classification: "CONNECTION_FAILURE", code: "CONNECTION_TIMEOUT_OR_CLOSED", relation: null };
  return { classification: "PROBE_FAILED_WITH_SQLSTATE", code: code ?? "UNKNOWN", relation: null };
}

/**
 * 権限の確認で使う SQL（読み取りだけ）。$1..$3 は同じ長さの配列（関係・権限・列。表の SELECT は列を空文字）。
 * 無い表・列は NULL になり、エラーにならない（to_regclass・pg_attribute の外部結合・NULL に対する has_* は NULL）。
 */
export const PRIVILEGE_PROBE_SQL = `
with req(rel, priv, col) as (select * from unnest($1::text[], $2::text[], $3::text[]))
select
  req.rel, req.priv, req.col,
  to_regclass(req.rel) is not null as rel_exists,
  (req.col = '' or a.attnum is not null) as col_exists,
  case
    when to_regclass(req.rel) is null then null
    when req.col = '' then has_table_privilege(to_regclass(req.rel), req.priv)
    when a.attnum is null then null
    else has_column_privilege(to_regclass(req.rel), a.attnum, req.priv)
  end as granted
from req
left join pg_attribute a on a.attrelid = to_regclass(req.rel) and a.attname = req.col and not a.attisdropped`;

export const SCHEMA_PROBE_SQL = `
select current_user::text as role,
  (select has_schema_privilege(n.oid, 'USAGE') from pg_namespace n where n.nspname = $1) as schema_usage,
  exists (select 1 from pg_namespace n where n.nspname = $1) as schema_exists`;

/**
 * 必要な権限の一覧を、SQL へ渡す 3 つの配列にする。
 * @param {{ schema: string, tables: Record<string, { select?: boolean, update?: readonly string[], insert?: readonly string[] }> }} spec
 */
export function flattenPrivilegeSpec(spec) {
  const rels = [];
  const privs = [];
  const cols = [];
  for (const [table, req] of Object.entries(spec.tables)) {
    const rel = `${spec.schema}.${table}`;
    if (!SAFE_IDENT.test(rel)) throw new Error("unsafe relation name in spec");
    if (req.select) {
      rels.push(rel);
      privs.push("SELECT");
      cols.push("");
    }
    for (const [priv, list] of [["UPDATE", req.update ?? []], ["INSERT", req.insert ?? []]]) {
      for (const c of list) {
        if (!/^[a-z_][a-z0-9_]{0,62}$/.test(c)) throw new Error("unsafe column name in spec");
        rels.push(rel);
        privs.push(priv);
        cols.push(c);
      }
    }
  }
  return { rels, privs, cols };
}

/**
 * 接続して、ログイン → 権限の順に確かめる。`connect` は接続済みの pg.Client を返す関数（失敗は例外）。
 * @param {{ connect: () => Promise<{ query: Function, end: Function }>, expectedRole: string, spec: { schema: string, tables: Record<string, any> } }} opts
 */
export async function probeDatabaseLogin({ connect, expectedRole, spec }) {
  let client = null;
  try {
    client = await connect();
  } catch (err) {
    return { stage: "connect", ...classifyProbeError(err) };
  }
  try {
    try {
      const r = await client.query("select 1 as ok");
      if (r?.rows?.[0]?.ok !== 1) return { stage: "login", classification: "PROBE_FAILED_WITH_SQLSTATE", code: "UNEXPECTED_RESULT", relation: null };
    } catch (err) {
      return { stage: "login", ...classifyProbeError(err) };
    }
    let role;
    try {
      const s = await client.query(SCHEMA_PROBE_SQL, [spec.schema]);
      const row = s.rows[0];
      role = String(row.role);
      if (role !== expectedRole) return { stage: "privileges", classification: "AUTHENTICATED_AS_UNEXPECTED_ROLE", code: null, relation: null, role };
      if (!row.schema_exists) return { stage: "privileges", classification: "AUTHENTICATED_BUT_PROBE_RELATION_MISSING", code: null, relation: spec.schema, role, missingRelations: [spec.schema] };
      if (row.schema_usage !== true) return { stage: "privileges", classification: "AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE", code: null, relation: null, role, missingPrivileges: [`${spec.schema}:USAGE`] };
      const { rels, privs, cols } = flattenPrivilegeSpec(spec);
      const p = await client.query(PRIVILEGE_PROBE_SQL, [rels, privs, cols]);
      const missingRelations = [...new Set(p.rows.filter((x) => x.rel_exists !== true).map((x) => String(x.rel)))];
      if (missingRelations.length) return { stage: "privileges", classification: "AUTHENTICATED_BUT_PROBE_RELATION_MISSING", code: null, relation: missingRelations[0], role, missingRelations };
      const missingPrivileges = p.rows
        .filter((x) => x.granted !== true)
        .map((x) => `${x.rel}${x.col ? `.${x.col}` : ""}:${x.priv}${x.col_exists === false ? "(column missing)" : ""}`);
      if (missingPrivileges.length) return { stage: "privileges", classification: "AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE", code: null, relation: null, role, missingPrivileges };
      return { stage: "privileges", classification: "LOGIN_OK_AND_PRIVILEGES_OK", code: null, relation: null, role, checked: p.rows.length };
    } catch (err) {
      return { stage: "privileges", ...classifyProbeError(err), role: role ?? null };
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* noop */
    }
  }
}

/**
 * 結果を 1 行の文字列にする（接続情報・パスワード・エラー文を含めない）。
 * @param {Record<string, any>} r
 */
export function formatProbeResult(r) {
  const parts = [`RESULT ${r.classification}`, `stage=${r.stage}`];
  if (r.code) parts.push(`sqlstate=${r.code}`);
  if (r.relation) parts.push(`relation=${r.relation}`);
  if (r.role) parts.push(`role=${SAFE_IDENT.test(r.role) ? r.role : "?"}`);
  if (r.checked) parts.push(`checked=${r.checked}`);
  if (r.missingPrivileges?.length) parts.push(`missing=${r.missingPrivileges.slice(0, 10).join(",")}${r.missingPrivileges.length > 10 ? ",…" : ""}`);
  return parts.join(" ");
}
