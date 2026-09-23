/**
 * PostgRESTの`or=(...)`フィルター文字列を、利用者の検索語から安全に組み立てる。
 *
 * 以前は検索語をそのまま`name_en.ilike.%${q}%,...`へ埋め込んでいたため、`,` `.` `(` `)` `"` を含む
 * 検索語でフィルター構文が壊れ(HTTP 500)、細工した入力で条件を追加できた。ここでは:
 *   - 値を必ず二重引用符で囲み、`\` と `"` をエスケープする(PostgRESTの予約文字を値として扱う)
 *   - LIKEの`%` `_` `\`をエスケープし、SQLite経路(ESCAPE '\')と同じく文字どおりに一致させる
 *   - 完全一致の条件(ID列)は、検索語がその列の形式に合う場合だけ追加する
 */

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export interface SearchOrFilterSpec {
  /** 部分一致(ilike)で検索する列。 */
  readonly likeColumns: readonly string[];
  /** 検索語が形式に合う場合だけ追加する完全一致の列。 */
  readonly exact?: { readonly column: string; readonly pattern: RegExp };
}

const COLUMN_RE = /^[a-z_][a-z0-9_]*$/;

export function buildSearchOrFilter(spec: SearchOrFilterSpec, search: string): string {
  const cols = [...spec.likeColumns, ...(spec.exact ? [spec.exact.column] : [])];
  for (const c of cols) if (!COLUMN_RE.test(c)) throw new Error(`列名が不正: ${c}`);
  const like = quotePostgrestValue(`%${escapeLikePattern(search)}%`);
  const parts = spec.likeColumns.map((c) => `${c}.ilike.${like}`);
  if (spec.exact && spec.exact.pattern.test(search)) parts.push(`${spec.exact.column}.eq.${quotePostgrestValue(search)}`);
  return parts.join(",");
}

export interface ParsedCondition {
  readonly field: string;
  readonly op: string;
  readonly value: string;
}

/**
 * `field.op.value,field.op."quoted value"` 形式を分解する(テスト用fake clientと往復検証に使う)。
 * 引用符の外の`,`だけで区切り、引用値は`\\` `\"`を戻す。
 */
export function parsePostgrestOrExpression(expr: string): ParsedCondition[] {
  const parts: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inQuote && ch === "\\" && i + 1 < expr.length) {
      cur += ch + expr[i + 1];
      i++;
      continue;
    }
    if (ch === '"') inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (inQuote) throw new Error("引用符が閉じていない");
  parts.push(cur);
  return parts.map((part) => {
    const first = part.indexOf(".");
    const second = part.indexOf(".", first + 1);
    if (first < 0 || second < 0) throw new Error("条件の形式が不正");
    const raw = part.slice(second + 1);
    const value = raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2 ? raw.slice(1, -1).replace(/\\(.)/g, "$1") : raw;
    return { field: part.slice(0, first), op: part.slice(first + 1, second), value };
  });
}

/** LIKEパターン(`%`/`_`ワイルドカード、`\`エスケープ)を正規表現へ変換する(テスト用fake clientで使う)。 */
export function likePatternToRegExp(pattern: string, caseInsensitive = true): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      re += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    } else if (ch === "%") re += "[\\s\\S]*";
    else if (ch === "_") re += "[\\s\\S]";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, caseInsensitive ? "i" : "");
}
