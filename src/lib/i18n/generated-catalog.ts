import { localizedAbilityName, localizedGroupName, currentGameTermsLocale } from "./game-terms";
import { STAT_LABEL_JA, GROUP_LABEL_JA } from "@/lib/world/stat-labels";
import { fillMessage } from "./message-format";

/**
 * 計算ライブラリが作る文（診断・比較・育成の説明）の、ja・en 以外の言語の表示（2026-10-06）。
 *
 * - 文は「メッセージ ID + 引数 + 言語ごとの書式」で表す。固定の文の ID は計算ライブラリの原文（日本語のリテラル）、
 *   パターンの文の ID は `<module>:<正規表現の hash>`（正規表現が変われば ID も変わり、訳は自動的に未対応＝English に戻る）。
 * - 書式の差し込み: `{1}`（そのまま）・`{loc:1}`（同じモジュールで再帰的に訳す）・`{fixed:1}`（固定の文）・`{cat:1}`・`{side:1}`・
 *   `{roles:1}`・`{pos:1}` など（`terms` の表で引く）・`{stat:1}`（能力名の並び）・`{group:1}`（育成カテゴリ）。複数形は fillMessage の書式。
 * - 訳が無い・引数を訳せない場合は null を返し、呼び出し側は従来どおり English を出す（言語が混ざった文を出さない）。
 * - 言語ごとの表（catalog）は、その言語の辞書の chunk が読み込まれたときに登録される（初回 JS に含めない）。
 */

export interface GeneratedModuleCatalog {
  /** 固定の文: 原文（日本語）→ 訳 */
  fixed?: Readonly<Record<string, string>>;
  /** パターンの文: ID → 書式 */
  patterns?: Readonly<Record<string, string>>;
  /** 差し込みの語の表（cat・side・roles・pos 等）: 原文の語 → 訳 */
  terms?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
export type GeneratedCatalog = Readonly<Record<string, GeneratedModuleCatalog>>;

const CATALOGS: Record<string, GeneratedCatalog> = {};

export function registerGeneratedCatalog(locale: string, catalog: GeneratedCatalog): void {
  CATALOGS[locale] = catalog;
}

/** 正規表現から安定した短い ID を作る（FNV-1a 32bit）。 */
export function ruleId(module: string, re: RegExp): string {
  let h = 0x811c9dc5;
  const s = re.source;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${module}:${h.toString(16).padStart(8, "0")}`;
}

const STAT_KEY_BY_JA: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(STAT_LABEL_JA).map(([k, v]) => [v, k]));
const GROUP_KEY_BY_JA: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(GROUP_LABEL_JA).map(([k, v]) => [v, k]));

type AnyRule = readonly [RegExp, ...unknown[]];

function statList(value: string): string | null {
  const parts = value.split(/\s*[/／・、]\s*/).filter(Boolean);
  const out = parts.map((p) => {
    const key = STAT_KEY_BY_JA[p.trim()];
    return key ? localizedAbilityName(key) : null;
  });
  if (out.some((x) => x === null)) return null;
  const sep = value.includes(" / ") ? " / " : ", ";
  return (out as string[]).join(sep);
}

function token(kind: string, value: string, module: string, cat: GeneratedModuleCatalog, patterns: readonly AnyRule[]): string | null {
  switch (kind) {
    case "loc":
      return generatedOverlay(module, value, patterns);
    case "fixed":
      // English の FIXED_EN[v] ?? v と同じ（固定の文でなければ元の値: 数値・記号など）
      return cat.fixed?.[value] ?? value;
    case "roles":
      // 「役割 / 役割」の並び。各要素を固定の文で訳し、無ければ元の値（English の roles() と同じ）
      return value
        .split(" / ")
        .map((r) => cat.fixed?.[r] ?? r)
        .join(" / ");
    case "pos":
      // ポジションの略号はそのまま。「不明」などだけ terms.pos で訳す
      return cat.terms?.pos?.[value] ?? value;
    case "stat":
      return statList(value);
    case "group": {
      const key = GROUP_KEY_BY_JA[value] ?? value;
      return localizedGroupName(key);
    }
    default:
      return cat.terms?.[kind]?.[value] ?? null;
  }
}

/**
 * 表示言語（ja・en 以外）の訳を返す。訳が無ければ null（呼び出し側は English）。
 * patterns: そのモジュールの規則（[正規表現, …] の配列。ID は正規表現から作る）。
 */
export function generatedOverlay(module: string, text: string, patterns: readonly AnyRule[]): string | null {
  const locale = currentGameTermsLocale();
  if (!locale) return null;
  const cat = CATALOGS[locale]?.[module];
  if (!cat) return null;
  const fixed = cat.fixed?.[text];
  if (fixed !== undefined) return fixed;
  const statsOnly = statList(text);
  if (statsOnly !== null && /[^\x00-\x7f]/.test(text)) return statsOnly;
  for (const rule of patterns) {
    const re = rule[0];
    const m = text.match(re);
    if (!m) continue;
    const template = cat.patterns?.[ruleId(module, re)];
    if (!template) return null;
    let failed = false;
    const vars: Record<string, string> = {};
    const filled = template.replace(/\{([a-z]+):(\d+)\}/g, (_all, kind: string, n: string) => {
      const v = m[Number(n)] ?? "";
      const r = token(kind, v, module, cat, patterns);
      if (r === null) failed = true;
      return r ?? "";
    });
    if (failed) return null;
    for (let i = 1; i < m.length; i++) vars[String(i)] = m[i] ?? "";
    return fillMessage(filled, vars);
  }
  return null;
}
