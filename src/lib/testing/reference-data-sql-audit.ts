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

/**
 * SQL文中の文字列リテラル('...')とドル引用符文字列($$...$$/$tag$...$tag$)の中身だけを
 * 空へ置き換える(構造検証のため、リテラルの「外側」だけを見たい場合に使う)。
 * `splitSqlStatements`と同じ文字走査ロジックを、分割ではなく置換のために使う。
 */
function stripStringAndDollarQuoteLiterals(sql: string): string {
  let out = "";
  let i = 0;
  const n = sql.length;
  let inSingleQuote = false;
  let dollarTag: string | null = null;
  while (i < n) {
    const ch = sql[i];
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        out += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i++;
      continue;
    }
    if (inSingleQuote) {
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        inSingleQuote = false;
        out += ch;
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "$") {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        out += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * `COMMENT ON ... IS`句には単一の文字列定数(またはドル引用符文字列)しか書けず、
 * `||`のような式は使えない(PostgreSQLのCOMMENT文法上のエラーになる。実際に
 * "syntax error at or near ||" で発生した障害の再発防止)。
 * リテラルの中身を除いた「外側」に`||`が残っていれば、式を書こうとした証拠として検出する。
 * 問題があれば説明文の配列を返す(無ければ空配列)。
 */
export function checkNoExpressionInCommentOn(sql: string): string[] {
  const statements = splitSqlStatements(sql);
  const offenders = statements.filter((s) => /^comment\s+on\b/i.test(s.trim()) && stripStringAndDollarQuoteLiterals(s).includes("||"));
  if (offenders.length > 0) {
    return [`COMMENT ON ... IS句に||を使った式が含まれています(単一の文字列リテラルのみ許可されます、${offenders.length}件)`];
  }
  return [];
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

  issues.push(...checkNoExpressionInCommentOn(sql));

  return { ok: issues.length === 0, issues };
}

/** 詳細フィールド追加(前進用migration)で列追加が許可される既存テーブル。 */
export const EXTENDABLE_REFERENCE_TABLES = ["world_player_cards", "managers"] as const;

/**
 * player_card_analysis(分析用互換名フィールド追加)migrationで列追加が許可されるテーブル。
 * `EXTENDABLE_REFERENCE_TABLES`とは別物(既存のdetail-extension migrationは
 * player_card_analysisへのALTERを意図的に対象外としていたため、そちらの既定値は変更しない)。
 */
export const ANALYSIS_NAME_EXTENDABLE_TABLES = ["player_card_analysis"] as const;

const DROP_DATABASE_RE = /\bdrop\s+database\b/i;
const DROP_SCHEMA_PUBLIC_RE = /\bdrop\s+schema\s+(?:if\s+exists\s+)?public\b/i;
const TRUNCATE_RE = /\btruncate\b/i;
const CREATE_OR_DROP_SCHEMA_RE = /\b(create|drop)\s+schema\b/i;
const CREATE_TABLE_RE = /\bcreate\s+table\b/i;
const DROP_TABLE_RE = /\bdrop\s+table\b/i;
const POLICY_STATEMENT_RE = /\b(create|drop|alter)\s+policy\b/i;
const GRANT_OR_REVOKE_RE = /^(grant|revoke)\b/i;
const INSERT_INTO_RE = /\binsert\s+into\b/i;

/**
 * `extend-reference-data-detail-schema.sql`のような「既存reference_dataテーブルへの
 * 列追加(ALTER TABLE ADD COLUMN)だけを行う前進用migration」の安全性を検証する。
 *
 * `auditReferenceDataSql`(スキーマ全体のCREATE用)とは前提が異なる:
 *   - CREATE SCHEMA/CREATE TABLE/RLS有効化/CREATE POLICY/GRANTのいずれも
 *     期待しない(既存スキーマに存在済みのため、このファイルでは触れないのが正しい)。
 *   - 逆に、これらの文が1つでも含まれていたら、想定外の操作として違反にする
 *     (「列追加だけ」という前提から逸脱していないかを検出する)。
 */
export function auditReferenceDataExtensionSql(
  sql: string,
  schema = "reference_data",
  allowedTables: readonly string[] = EXTENDABLE_REFERENCE_TABLES,
): ReferenceDataSqlAuditResult {
  const issues: string[] = [];
  const statements = splitSqlStatements(sql);

  if (statements.length === 0) issues.push("SQL文が1つも見つかりません");

  const alterStatements = statements.filter((s) => /^alter\s+table\b/i.test(s.trim()));
  if (alterStatements.length === 0) issues.push("ALTER TABLE文が見つかりません");

  for (const stmt of alterStatements) {
    const targetsExtendable = allowedTables.some((t) => new RegExp(`alter\\s+table\\s+(?:${schema}\\.)?${t}\\b`, "i").test(stmt));
    if (!targetsExtendable) {
      issues.push(`許可されていないテーブルへのALTER TABLEがあります(対象は${allowedTables.join("/")}のみ): ${stmt.slice(0, 80)}`);
    }
  }

  // 想定外の操作(このmigrationはADD COLUMN/制約追加だけを行うべき)
  if (CREATE_OR_DROP_SCHEMA_RE.test(sql)) issues.push("CREATE/DROP SCHEMAが含まれています(このmigrationはスキーマ変更を行わないはずです)");
  if (CREATE_TABLE_RE.test(sql)) issues.push("CREATE TABLEが含まれています(このmigrationは既存テーブルへの列追加のみを行うはずです)");
  if (DROP_TABLE_RE.test(sql)) issues.push("DROP TABLEが含まれています");
  if (POLICY_STATEMENT_RE.test(sql)) issues.push("CREATE/ALTER/DROP POLICYが含まれています(RLSポリシーは既存のまま変更しないはずです)");
  if (statements.some((s) => GRANT_OR_REVOKE_RE.test(s.trim()))) {
    issues.push("GRANT/REVOKE文が含まれています(列追加だけならテーブル単位の既存GRANTがそのまま適用されるため、新規GRANTは不要のはずです)");
  }
  if (INSERT_INTO_RE.test(sql)) issues.push("INSERT INTO文が含まれています(このmigrationはDDLのみで、実データ投入を含まないはずです)");

  // 破壊的操作の禁止
  if (DROP_DATABASE_RE.test(sql)) issues.push("DROP DATABASEが含まれています");
  if (DROP_SCHEMA_PUBLIC_RE.test(sql)) issues.push("DROP SCHEMA publicが含まれています");
  if (TRUNCATE_RE.test(sql)) issues.push("TRUNCATEが含まれています");
  if (GRANT_ALL_RE.test(sql)) issues.push("GRANT ALLへの言及があります");
  if (AUTH_USERS_MUTATION_RE.test(sql)) issues.push("auth.usersを変更/削除/切り詰める文が含まれています");
  if (SYSTEM_SCHEMA_MUTATION_RE.test(sql)) issues.push("Supabaseのシステムスキーマを変更/削除する文が含まれています");
  if (/\b(alter|drop)\s+table\s+(?:public\.)?(my_team_snapshots|rls_probe_records)\b/i.test(sql)) {
    issues.push("既存の公開スキーマテーブル(my_team_snapshots/rls_probe_records)を変更/削除する文が含まれています");
  }
  const explicitlyOutOfScope = ["player_card_analysis", "import_batches"].filter((t) => !allowedTables.includes(t));
  if (explicitlyOutOfScope.length > 0 && new RegExp(`\\balter\\s+table\\s+(?:${schema}\\.)?(${explicitlyOutOfScope.join("|")})\\b`, "i").test(sql)) {
    issues.push(`${explicitlyOutOfScope.join("/")}を変更する文が含まれています(このmigrationの対象外です)`);
  }

  // 秘密情報
  if (SERVICE_ROLE_RE.test(sql)) issues.push("service_roleへの言及があります");
  if (SECRET_LIKE_RE.test(sql)) issues.push("Secret key/JWT形式に見える文字列が含まれています");
  if (DYNAMIC_SQL_RE.test(sql)) issues.push("動的SQL(EXECUTE)の使用が疑われます");
  if (EMAIL_COLUMN_RE.test(sql.replace(/--[^\n]*/g, ""))) {
    // コメントを除いた本文にemailという語が出現しないか(個人情報カラムの誤混入防止)。
    issues.push("emailという語が実SQL本文に含まれています(参照データに個人情報は不要です)");
  }

  issues.push(...checkNoExpressionInCommentOn(sql));

  return { ok: issues.length === 0, issues };
}
