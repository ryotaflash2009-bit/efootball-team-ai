import { splitSqlStatements } from "../../testing/sql-statement-split";
import type { GuardCheck } from "../real-import-guards";

/**
 * Production向けreference_data_ops SQL案(未実行)の静的監査。
 * 実DB・実ネットワークへは一切接続しない純関数群。
 */

function stripLineComments(sql: string): string {
  let out = "";
  let inSingleQuote = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inSingleQuote) {
      out += ch;
      if (ch === "'") inSingleQuote = false;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      out += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      if (nl === -1) break;
      i = nl - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/** ファイル冒頭にDO NOT RUN系の警告表示があることを確認する。 */
export function assertHasDoNotRunBanner(rawSql: string): GuardCheck {
  const header = rawSql.slice(0, 2000);
  const hasDoNotRun = /DO NOT RUN/i.test(header);
  const hasDesignOnlyOrNotApplied = /DESIGN ONLY|PRODUCTION NOT APPLIED/i.test(header);
  if (!hasDoNotRun || !hasDesignOnlyOrNotApplied) {
    return { ok: false, reason: "ファイル冒頭にDO NOT RUN / DESIGN ONLY / PRODUCTION NOT APPLIEDの警告表示が無い" };
  }
  return { ok: true };
}

/** public/authスキーマへの変更(CREATE/ALTER/DROP/GRANT)を含まないことを確認する。 */
export function assertNoPublicOrAuthSchemaChange(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  const re = /\b(create|alter|drop|grant|revoke)\b[^;]*\b(public\.|auth\.)/gi;
  if (re.test(sql)) {
    return { ok: false, reason: "public/authスキーマへの変更(CREATE/ALTER/DROP/GRANT/REVOKE)が含まれている" };
  }
  return { ok: true };
}

/** 利用者データテーブルへの参照を含まないことを確認する。 */
export function assertNoUserDataTableReference(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (/\b(auth\.users|my_team_snapshots|rls_probe_records)\b/i.test(sql)) {
    return { ok: false, reason: "利用者データテーブル(auth.users/my_team_snapshots/rls_probe_records)への参照が含まれている" };
  }
  return { ok: true };
}

/** reference_data(確定済み参照データ)スキーマへの変更を含まないことを確認する(reference_data_opsとは別物)。 */
export function assertNoReferenceDataSchemaChange(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (/\b(create|alter|drop|grant|revoke)\b[^;]*\breference_data\./gi.test(sql)) {
    return { ok: false, reason: "reference_data(確定済み参照データ)スキーマへの変更が含まれている" };
  }
  return { ok: true };
}

/** DROP CASCADE/TRUNCATE/利用者データDMLが無いことを確認する(CASCADEは理由を問わず常に拒否する)。 */
export function assertNoUnexpectedDestructiveOps(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  const statements = splitSqlStatements(sql).filter((s) => s.trim().length > 0);

  if (/\btruncate\b/i.test(sql)) {
    return { ok: false, reason: "TRUNCATEが含まれている" };
  }
  if (/\b(insert\s+into|update\s+\w|delete\s+from)\b/i.test(sql)) {
    // update_jobs等のDDLコメント文中の"update"や、alter table ... add columnのような
    // DDLは対象外(insert into/update <table>/delete fromという実際のDML文だけを検出する)。
    const dmlLike = statements.filter((s) => /^\s*(insert\s+into|update\s+\w|delete\s+from)\b/i.test(s.trim()));
    if (dmlLike.length > 0) {
      return { ok: false, reason: `データ操作(INSERT/UPDATE/DELETE)文が含まれている: ${dmlLike.length}件` };
    }
  }

  const dropCascadeStatements = statements.filter((s) => /\bdrop\b[^;]*\bcascade\b/i.test(s));
  if (dropCascadeStatements.length > 0) {
    return {
      ok: false,
      reason: `DROP ... CASCADEが含まれている(理由を問わず禁止、対象オブジェクトを個別に明示DROPすること): ${dropCascadeStatements.length}件`,
    };
  }
  return { ok: true };
}

/** DO/EXECUTE等の動的SQLが無いことを確認する(rollbackは静的な明示DROPだけを対象とする)。 */
export function assertNoDynamicSqlInRollback(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (/\bdo\s*\$/i.test(sql) || /\bexecute\s+(format\s*\(|')/i.test(sql)) {
    return { ok: false, reason: "rollback SQLに動的SQL(DO/EXECUTE)が含まれている(対象は静的な明示DROPだけとする)" };
  }
  return { ok: true };
}

/** すべてのDROP文が対象schema内のテーブル、またはschema自体だけを対象にしていることを確認する。 */
export function assertAllDropsAreSchemaQualified(rawSql: string, schemaName: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  const statements = splitSqlStatements(sql).filter((s) => s.trim().length > 0);
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!/^drop\b/i.test(trimmed)) continue;
    const isSchemaDrop = new RegExp(`^drop\\s+schema\\s+if\\s+exists\\s+${schemaName}\\s*$`, "i").test(trimmed);
    const isTableDrop = new RegExp(`^drop\\s+table\\s+if\\s+exists\\s+${schemaName}\\.\\w+\\s*$`, "i").test(trimmed);
    if (!isSchemaDrop && !isTableDrop) {
      return {
        ok: false,
        reason: `想定外のDROP文(${schemaName}内のテーブル、または${schemaName}自体のIF EXISTS付き明示DROPだけを許可): ${trimmed.slice(0, 80)}`,
      };
    }
  }
  return { ok: true };
}

/** CREATE SQLから `create table if not exists <schema>.<table>` のテーブル名を出現順に抽出する。 */
export function extractCreatedTableNames(createSql: string, schemaName: string): string[] {
  const sql = stripLineComments(createSql);
  const statements = splitSqlStatements(sql);
  const re = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+${schemaName}\\.(\\w+)`, "i");
  const names: string[] = [];
  for (const stmt of statements) {
    const m = stmt.match(re);
    if (m) names.push(m[1]);
  }
  return names;
}

/** CREATE SQLから、同一schema内テーブル間の外部キー依存(子テーブル→参照している親テーブル)を抽出する。 */
export function extractForeignKeyDependencies(createSql: string, schemaName: string): Map<string, Set<string>> {
  const sql = stripLineComments(createSql);
  const statements = splitSqlStatements(sql);
  const createRe = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+${schemaName}\\.(\\w+)`, "i");
  const refRe = new RegExp(`references\\s+${schemaName}\\.(\\w+)`, "gi");
  const deps = new Map<string, Set<string>>();
  for (const stmt of statements) {
    const createMatch = stmt.match(createRe);
    if (!createMatch) continue;
    const child = createMatch[1];
    const parents = new Set<string>();
    let m: RegExpExecArray | null;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(stmt)) !== null) {
      if (m[1] !== child) parents.add(m[1]);
    }
    deps.set(child, parents);
  }
  return deps;
}

/** ROLLBACK SQLから `drop table if exists <schema>.<table>` のテーブル名を出現順に抽出する。 */
export function extractDroppedTableNames(rollbackSql: string, schemaName: string): string[] {
  const sql = stripLineComments(rollbackSql);
  const statements = splitSqlStatements(sql);
  const re = new RegExp(`drop\\s+table\\s+if\\s+exists\\s+${schemaName}\\.(\\w+)`, "i");
  const names: string[] = [];
  for (const stmt of statements) {
    const m = stmt.match(re);
    if (m) names.push(m[1]);
  }
  return names;
}

/** 作成SQLで作られる全テーブルと、rollback SQLで明示DROPされる全テーブルの集合が一致することを確認する。 */
export function assertRollbackObjectSetMatchesCreate(createSql: string, rollbackSql: string, schemaName: string): GuardCheck {
  const created = new Set(extractCreatedTableNames(createSql, schemaName));
  const dropped = extractDroppedTableNames(rollbackSql, schemaName);
  const droppedSet = new Set(dropped);
  const missing = [...created].filter((t) => !droppedSet.has(t));
  const unexpected = dropped.filter((t) => !created.has(t));
  if (missing.length > 0 || unexpected.length > 0) {
    return {
      ok: false,
      reason: `作成SQLとrollback SQLのテーブル集合が一致しない(不足: ${missing.join(",") || "なし"} / 想定外: ${unexpected.join(",") || "なし"})`,
    };
  }
  if (dropped.length !== droppedSet.size) {
    return { ok: false, reason: "rollback SQLに同一テーブルへの重複DROPが含まれている" };
  }
  return { ok: true };
}

/** rollback SQLのDROP順序が、作成SQLの外部キー依存(子を先に、参照される親を後に)と整合することを確認する。 */
export function assertRollbackOrderRespectsDependencies(createSql: string, rollbackSql: string, schemaName: string): GuardCheck {
  const deps = extractForeignKeyDependencies(createSql, schemaName);
  const dropped = extractDroppedTableNames(rollbackSql, schemaName);
  const dropIndex = new Map(dropped.map((t, i) => [t, i]));
  for (const [child, parents] of deps) {
    const childIdx = dropIndex.get(child);
    for (const parent of parents) {
      const parentIdx = dropIndex.get(parent);
      if (childIdx === undefined || parentIdx === undefined) continue;
      if (childIdx > parentIdx) {
        return {
          ok: false,
          reason: `DROP順序が依存関係と不整合(${child}は${parent}を参照しているため、${parent}より先に${child}をDROPする必要がある)`,
        };
      }
    }
  }
  return { ok: true };
}

/** rollback SQLの最後の文が、対象schema自体のCASCADEなしDROPであることを確認する。 */
export function assertRollbackDropsSchemaLast(rollbackSql: string, schemaName: string): GuardCheck {
  const sql = stripLineComments(rollbackSql);
  const statements = splitSqlStatements(sql).filter((s) => s.trim().length > 0);
  if (statements.length === 0) {
    return { ok: false, reason: "rollback SQLに文が含まれていない" };
  }
  const last = statements[statements.length - 1].trim();
  const re = new RegExp(`^drop\\s+schema\\s+if\\s+exists\\s+${schemaName}\\s*$`, "i");
  if (!re.test(last)) {
    return { ok: false, reason: "最後の文が対象schema自体の明示的なDROP SCHEMA(CASCADEなし)ではない" };
  }
  return { ok: true };
}

/** 実行主体が未確定のため、特定ロールへのGRANT(anon/authenticated等)を含まないことを確認する。 */
export function assertNoRoleGrants(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  const grantToRole = /\bgrant\b[^;]*\bto\s+(anon|authenticated|\w+_service|\w+_writer)\b/i;
  if (grantToRole.test(sql)) {
    return { ok: false, reason: "特定ロールへのGRANTが含まれている(実行主体未確定のため今回は含めない設計)" };
  }
  return { ok: true };
}

export function auditProductionOpsCreateSql(rawSql: string): GuardCheck[] {
  return [
    assertHasDoNotRunBanner(rawSql),
    assertNoPublicOrAuthSchemaChange(rawSql),
    assertNoUserDataTableReference(rawSql),
    assertNoUnexpectedDestructiveOps(rawSql),
    assertNoRoleGrants(rawSql),
  ];
}

export function auditProductionOpsRollbackSql(createSql: string, rollbackSql: string, schemaName: string): GuardCheck[] {
  return [
    assertHasDoNotRunBanner(rollbackSql),
    assertNoPublicOrAuthSchemaChange(rollbackSql),
    assertNoReferenceDataSchemaChange(rollbackSql),
    assertNoUserDataTableReference(rollbackSql),
    assertNoUnexpectedDestructiveOps(rollbackSql),
    assertNoDynamicSqlInRollback(rollbackSql),
    assertAllDropsAreSchemaQualified(rollbackSql, schemaName),
    assertRollbackObjectSetMatchesCreate(createSql, rollbackSql, schemaName),
    assertRollbackOrderRespectsDependencies(createSql, rollbackSql, schemaName),
    assertRollbackDropsSchemaLast(rollbackSql, schemaName),
  ];
}

export function auditProductionOpsPreflightSql(rawSql: string): GuardCheck[] {
  const sql = stripLineComments(rawSql);
  const statements = splitSqlStatements(sql).filter((s) => s.trim().length > 0);
  const nonSelect = statements.filter((s) => !/^\s*(select|show)\b/i.test(s.trim()));
  return [
    assertHasDoNotRunBanner(rawSql),
    assertNoPublicOrAuthSchemaChange(rawSql),
    assertNoUserDataTableReference(rawSql),
    {
      ok: nonSelect.length === 0,
      reason: nonSelect.length === 0 ? undefined : `SELECT/SHOW以外の文が含まれている: ${nonSelect.length}件`,
    },
  ];
}
