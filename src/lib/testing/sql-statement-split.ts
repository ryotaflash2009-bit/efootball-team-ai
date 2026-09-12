/**
 * SQLテキストを「文」単位へ分割する、この監査専用の最小限のパーサー。
 *
 * `;`だけで単純分割すると、PL/pgSQL関数本体(`$$ ... $$`)内のセミコロンや、
 * 文字列リテラル内の`;`まで誤って分割してしまう。ここでは以下を正しく無視して
 * トップレベルの`;`だけで分割する:
 *   - `--`行コメント
 *   - `/* ... *\/`ブロックコメント
 *   - `'...'`文字列リテラル(`''`エスケープ含む)
 *   - `$$ ... $$` / `$tag$ ... $tag$`ドルクオート文字列(関数本体等)
 *
 * 本格的なSQLパーサーではないが、汎用の文字列置換や正規表現一発で
 * 「ファイル全体にauth.uid()という文字列が含まれるか」を見るよりも、
 * 個々の文(CREATE POLICY等)を単位にして構造を検証できるようにする。
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  const n = sql.length;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let dollarTag: string | null = null;

  while (i < n) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);

    if (inLineComment) {
      current += ch;
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (two === "*/") {
        current += two;
        i += 2;
        inBlockComment = false;
        continue;
      }
      current += ch;
      i++;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += ch;
      i++;
      continue;
    }
    if (inSingleQuote) {
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += "''";
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      current += ch;
      i++;
      continue;
    }

    if (two === "--") {
      inLineComment = true;
      current += two;
      i += 2;
      continue;
    }
    if (two === "/*") {
      inBlockComment = true;
      current += two;
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      i++;
      continue;
    }
    if (ch === "$") {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  const trimmedTail = current.trim();
  if (trimmedTail) statements.push(trimmedTail);
  return statements;
}
