/**
 * 文言の差し込み（2026-10-06）。画面の `{name}` の差し込みを 1 か所にまとめ、複数形を扱う。
 *
 * - `{name}` は値に置き換える（同じ名前が複数あればすべて）。値の無い `{name}` はそのまま残さず空にしない（元のまま残す）。
 * - 複数形: `{count, plural, =0 {…} one {# carta} other {# cartas}}`（ICU の書式の一部）。`#` は渡された値（書式済みの数）。
 *   どの形を使うかは `Intl.PluralRules`（表示言語。LocaleProvider が `setPluralLocale` で設定）で、値の数字から決める。
 * - 日本語・English の辞書は複数形の書式を使わないため、結果は従来の差し込みと同じ。
 */

let pluralLocale = "en-US";
let rules: Intl.PluralRules | null = null;

export function setPluralLocale(intl: string): void {
  if (intl === pluralLocale && rules) return;
  pluralLocale = intl;
  rules = null;
}

function pluralRules(): Intl.PluralRules {
  if (!rules) {
    try {
      rules = new Intl.PluralRules(pluralLocale);
    } catch {
      rules = new Intl.PluralRules("en-US");
    }
  }
  return rules;
}

/** 書式済みの数（"13,372"・"13.372"・"1 234"）から整数を読む（複数形の選択だけに使う）。 */
export function countFromFormatted(value: string): number | null {
  const m = String(value).match(/-?\d[\d\s.,  ']*/);
  if (!m) return null;
  const digits = m[0].replace(/[^\d-]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** `{` と `}` の対応をたどって、`start` の `{` に対応する `}` の位置を返す。 */
function matchBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function selectPlural(body: string, value: string): string {
  // body: "=0 {…} one {…} other {…}"
  const forms = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const m = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/.exec(body.slice(i));
    if (!m) break;
    const open = i + m[0].length - 1;
    const close = matchBrace(body, open);
    if (close < 0) break;
    forms.set(m[1], body.slice(open + 1, close));
    i = close + 1;
  }
  const n = countFromFormatted(value);
  let chosen = forms.get("other") ?? "";
  if (n !== null) {
    const exact = forms.get(`=${n}`);
    chosen = exact ?? forms.get(pluralRules().select(n)) ?? chosen;
  }
  return chosen.replace(/#/g, value);
}

export function fillMessage(template: string, vars: Record<string, string>): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{", i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const close = matchBrace(template, open);
    if (close < 0) {
      out += template.slice(open);
      break;
    }
    const inner = template.slice(open + 1, close);
    const plural = /^\s*([A-Za-z0-9_]+)\s*,\s*plural\s*,([\s\S]*)$/.exec(inner);
    if (plural) {
      const value = vars[plural[1]];
      out += value === undefined ? template.slice(open, close + 1) : fillMessage(selectPlural(plural[2], value), vars);
    } else if (/^[A-Za-z0-9_]+$/.test(inner) && vars[inner] !== undefined) {
      out += vars[inner];
    } else {
      out += template.slice(open, close + 1);
    }
    i = close + 1;
  }
  return out;
}
