import { splitSqlStatements } from "./sql-statement-split";

/**
 * `docs/production-readiness/sql/create-reference-data-schema.sql`の安全性を
 * 構造的に検証する純関数。`my-team-cloud-sql-audit.ts`/`rls-probe-sql-audit.ts`と
 * 同じ方針(`splitSqlStatements`で個々のSQL文へ分割し、各文自身を検証する)を、
 * 「全ユーザー共通の読み取り専用参照データ」向けに適用する。
 *
 * my_team_snapshots等(個人データ)との重要な違い:
 *   - SELECTポリシーは anon **と** authenticated の両方に許可されているべき
 *     (個人データとは逆に、anonを除外するのは誤り)。
 *   - SELECTポリシーの USING (true) は正しい設計(参照データは行の所有者という
 *     概念を持たないため、無条件許可を「危険な穴」として検出しない)。
 *   - INSERT/UPDATE/DELETEポリシーは1つも存在してはならない
 *     (存在すること自体が違反。my_team_snapshotsとは逆の検査)。
 *   - GRANTはSELECTのみで、INSERT/UPDATE/DELETE/TRUNCATE/ALLは一切許可しない。
 */
export interface ReferenceDataSqlAuditResult {
  ok: boolean;
  issues: string[];
}

const TRUE_POLICY_RE = /\b(using|with\s+check)\s*\(\s*true\s*\)/i;
const SERVICE_ROLE_RE = /service_role/i;
const SECRET_LIKE_RE = /sb_secret_|(?<![A-Za-z0-9_])eyJ[A-Za-z0-9_-]/;
const EMAIL_COLUMN_RE = /\bemail\b/i;
const DYNAMIC_SQL_RE = /\bexecute\s+(format\s*\(|'|")/i;
const AUTH_USERS_MUTATION_RE = /\b(alter|drop|truncate)\s+table\s+(?:public\.)?auth\.users\b/i;
const SYSTEM_SCHEMA_MUTATION_RE = /\b(alter|drop)\s+schema\s+(auth|storage|realtime|extensions|graphql|graphql_public|pgsodium|vault)\b/i;
const GRANT_ALL_RE = /\bgrant\s+all\b/i;
const USER_ID_AUTH_UID_RE = /\buser_id\b[^,)]*auth\.uid\(\)/i;

/** 公開参照テーブル(anon/authenticatedともSELECTのみ許可)の対象一覧。 */
export const PUBLIC_REFERENCE_TABLES = ["world_player_cards", "managers", "player_card_analysis"] as const;
/** 管理専用テーブル(anon/authenticatedからは一切触れない)。 */
export const ADMIN_ONLY_TABLES = ["import_batches"] as const;

function tableRe(schema: string, table: string): RegExp {
  return new RegExp(`(?:${schema}\\.)?${table}\\b`, "i");
}

function findPolicyStatements(statements: string[], schema: string, table: string, kind: string): string[] {
  const policyRe = new RegExp(`create\\s+policy\\s+\\S+\\s+on\\s+(?:${schema}\\.)?${table}\\b`, "i");
  const kindRe = new RegExp(`for\\s+${kind}\\b`, "i");
  return statements.filter((s) => policyRe.test(s) && kindRe.test(s));
}

function rolesOf(stmt: string): string[] {
  const roleListMatch = /\bto\s+([\s\S]*?)(?:\busing\b|\bwith\s+check\b|;|$)/i.exec(stmt);
  const roleList = roleListMatch ? roleListMatch[1] : "";
  return roleList
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

export function auditReferenceDataSql(sql: string, schema = "reference_data"): ReferenceDataSqlAuditResult {
  const issues: string[] = [];
  const statements = splitSqlStatements(sql);

  if (!new RegExp(`create\\s+schema\\s+if\\s+not\\s+exists\\s+${schema}\\b`, "i").test(sql)) {
    issues.push(`CREATE SCHEMA IF NOT EXISTS ${schema} が見つかりません(既存スキーマを無条件に上書きする恐れがあります)`);
  }

  // ---- 公開参照テーブル(anon/authenticatedともSELECTのみ) ----
  for (const table of PUBLIC_REFERENCE_TABLES) {
    const enableRlsRe = new RegExp(`alter\\s+table\\s+(?:${schema}\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
    if (!statements.some((s) => enableRlsRe.test(s))) {
      issues.push(`${table}: RLSが有効化されていません(ENABLE ROW LEVEL SECURITY)`);
    }
    const forceRlsRe = new RegExp(`alter\\s+table\\s+(?:${schema}\\.)?${table}\\s+force\\s+row\\s+level\\s+security`, "i");
    if (!statements.some((s) => forceRlsRe.test(s))) {
      issues.push(`${table}: FORCE ROW LEVEL SECURITYが設定されていません`);
    }

    const selectPolicies = findPolicyStatements(statements, schema, table, "select");
    if (selectPolicies.length === 0) {
      issues.push(`${table}: SELECTポリシーが見つかりません`);
    } else {
      const stmt = selectPolicies[0];
      const roles = rolesOf(stmt);
      if (!roles.includes("anon")) issues.push(`${table}: SELECTポリシーがanonへ許可されていません(公開参照データはanonも読めるべきです)`);
      if (!roles.includes("authenticated")) issues.push(`${table}: SELECTポリシーがauthenticatedへ許可されていません`);
      // 参照データはUSING (true)が正しい設計であり、無条件許可を違反として検出しない。
    }

    for (const kind of ["insert", "update", "delete"] as const) {
      const stmts = findPolicyStatements(statements, schema, table, kind);
      if (stmts.length > 0) {
        issues.push(`${table}: ${kind.toUpperCase()}ポリシーが存在します(公開参照テーブルへの書込みポリシーは一切作らないでください)`);
      }
    }

    // user_id = auth.uid() のような個人データ用の行所有条件を、参照データへ誤って
    // 適用していないことを確認する(個人データ用RLSとの混同を検出)。
    const createTableStmt = statements.find((s) => new RegExp(`create\\s+table[^;]*${tableRe(schema, table).source}`, "is").test(s));
    if (createTableStmt && USER_ID_AUTH_UID_RE.test(createTableStmt)) {
      issues.push(`${table}: user_id = auth.uid() 相当の個人データ用条件が参照テーブルに含まれています(混同の疑い)`);
    }
  }

  // ---- 管理専用テーブル(ポリシー0件・GRANT0件であるべき) ----
  for (const table of ADMIN_ONLY_TABLES) {
    const enableRlsRe = new RegExp(`alter\\s+table\\s+(?:${schema}\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
    if (!statements.some((s) => enableRlsRe.test(s))) {
      issues.push(`${table}: RLSが有効化されていません`);
    }
    for (const kind of ["select", "insert", "update", "delete"] as const) {
      const stmts = findPolicyStatements(statements, schema, table, kind);
      if (stmts.length > 0) {
        issues.push(`${table}: ${kind.toUpperCase()}ポリシーが存在します(管理専用テーブルにはポリシーを作らないでください)`);
      }
    }
  }

  // ---- GRANT ----
  // コメント内に"GRANT ALL"という説明文が書かれている場合まで違反として誤検出しないよう、
  // 実際のGRANT文(コメントを含まない、trim済みの文の先頭がgrantで始まるもの)だけを対象にする。
  const grantStatements = statements.filter((s) => /^grant\b/i.test(s.trim()));
  if (grantStatements.some((g) => GRANT_ALL_RE.test(g))) {
    issues.push("GRANT ALLが使用されています(必要最小限のGRANTだけを使ってください)");
  }
  for (const g of grantStatements) {
    for (const kind of ["insert", "update", "delete", "truncate"] as const) {
      const kindRe = new RegExp(`\\bgrant\\s+[^;]*\\b${kind}\\b[^;]*\\bto\\s+[^;]*\\b(anon|authenticated)\\b`, "i");
      if (kindRe.test(g)) {
        issues.push(`anon/authenticatedへ${kind.toUpperCase()}権限がGRANTされています`);
      }
    }
    for (const table of ADMIN_ONLY_TABLES) {
      if (tableRe(schema, table).test(g) && /\bto\s+[^;]*\b(anon|authenticated)\b/i.test(g)) {
        issues.push(`${table}(管理専用)がanon/authenticatedへGRANTされています`);
      }
    }
  }
  for (const table of PUBLIC_REFERENCE_TABLES) {
    const grantedSelect = grantStatements.some(
      (g) => /^grant\s+select\b/i.test(g) && tableRe(schema, table).test(g) && /\bto\s+[^;]*\banon\b/i.test(g) && /\bto\s+[^;]*\bauthenticated\b/i.test(g),
    );
    if (!grantedSelect) {
      issues.push(`${table}: anon/authenticated双方へのGRANT SELECTが見つかりません`);
    }
  }

  // ---- テーブル構造の共通チェック ----
  const worldTableStmt = statements.find((s) => new RegExp(`create\\s+table[^;]*${tableRe(schema, "world_player_cards").source}`, "is").test(s));
  if (worldTableStmt) {
    if (!/world_card_id\s+text\s+primary\s+key/i.test(worldTableStmt)) issues.push("world_player_cards: world_card_idが主キーになっていません");
    if (!/name_en\s+text\s+not\s+null/i.test(worldTableStmt)) issues.push("world_player_cards: name_enにNOT NULL制約がありません");
    if (!/dataset_version\s+text\s+not\s+null/i.test(worldTableStmt)) issues.push("world_player_cards: dataset_versionにNOT NULL制約がありません");
    if (!/stats\s+jsonb/i.test(worldTableStmt)) issues.push("world_player_cards: statsがjsonb型になっていません");
    if (EMAIL_COLUMN_RE.test(worldTableStmt)) issues.push("world_player_cards: emailカラムが含まれています(参照データに個人情報は不要です)");
  } else {
    issues.push("world_player_cards のCREATE TABLE文が見つかりません");
  }

  const managersTableStmt = statements.find((s) => new RegExp(`create\\s+table[^;]*${tableRe(schema, "managers").source}`, "is").test(s));
  if (managersTableStmt) {
    if (!/internal_manager_id\s+integer\s+primary\s+key/i.test(managersTableStmt)) issues.push("managers: internal_manager_idが主キーになっていません");
    if (!/dataset_version\s+text\s+not\s+null/i.test(managersTableStmt)) issues.push("managers: dataset_versionにNOT NULL制約がありません");
    if (EMAIL_COLUMN_RE.test(managersTableStmt)) issues.push("managers: emailカラムが含まれています");
  } else {
    issues.push("managers のCREATE TABLE文が見つかりません");
  }

  const analysisTableStmt = statements.find((s) => new RegExp(`create\\s+table[^;]*${tableRe(schema, "player_card_analysis").source}`, "is").test(s));
  if (analysisTableStmt) {
    if (!new RegExp(`references\\s+(?:${schema}\\.)?world_player_cards`, "i").test(analysisTableStmt)) {
      issues.push("player_card_analysis: world_player_cardsへの外部キー参照が見つかりません");
    }
  } else {
    issues.push("player_card_analysis のCREATE TABLE文が見つかりません");
  }

  // ---- 共通の安全性チェック ----
  if (SERVICE_ROLE_RE.test(sql)) issues.push("service_roleへの言及があります");
  if (SECRET_LIKE_RE.test(sql)) issues.push("Secret key/JWT形式に見える文字列が含まれています");
  if (DYNAMIC_SQL_RE.test(sql)) issues.push("動的SQL(EXECUTE)の使用が疑われます");
  if (AUTH_USERS_MUTATION_RE.test(sql)) issues.push("auth.usersを変更/削除/切り詰める文が含まれています");
  if (SYSTEM_SCHEMA_MUTATION_RE.test(sql)) issues.push("Supabaseのシステムスキーマを変更/削除する文が含まれています");
  if (/\bdrop\s+table\s+(?:public\.)?(my_team_snapshots|rls_probe_records)\b/i.test(sql)) {
    issues.push("既存の公開スキーマテーブル(my_team_snapshots/rls_probe_records)を削除する文が含まれています");
  }
  if (/\balter\s+table\s+(?:public\.)?(my_team_snapshots|rls_probe_records)\b/i.test(sql)) {
    issues.push("既存の公開スキーマテーブル(my_team_snapshots/rls_probe_records)を変更する文が含まれています");
  }

  const functionStatements = statements.filter((s) => /create\s+(?:or\s+replace\s+)?function\b/i.test(s));
  for (const fn of functionStatements) {
    if (/security\s+definer/i.test(fn)) {
      issues.push("SECURITY DEFINER関数が使われています(必要性の明示的な確認が必要)");
    }
    if (!/set\s+search_path\s*=/i.test(fn)) {
      issues.push("関数にsearch_pathの固定設定がありません");
    }
  }

  return { ok: issues.length === 0, issues };
}
