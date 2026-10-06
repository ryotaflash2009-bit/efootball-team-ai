import type { Locale } from "./locale";

/**
 * 表示言語の契約（2026-10-06・多言語の基盤）。純関数とデータだけ（辞書を含めない・初回 JS を増やさない）。
 *
 * - コードは BCP 47（言語-地域。中国語は地域で簡体字・繁体字を分ける）。保存値は大文字・小文字を正規化した正式な表記。
 * - `base` は計算ライブラリ・表示層の文章（`locale === "en"` の分岐）に使う基本の言語。日本語以外はすべて英語。
 *   新しい言語でも、辞書に無い文言は英語で出す（日本語を世界向けの最後の代わりにしない）。
 * - 利用者が選べるのは `PUBLISHED` の言語だけ。それ以外は内部の確認用（`areInternalPagesVisible()` が真のとき）だけ。
 *   言語ごとに `SUSPENDED` へ戻せば、その言語だけを止められる（日本語・英語には影響しない）。
 * - 状態の根拠は `docs/i18n/locale-status.md`（翻訳の品質・レビュー・coverage）。
 */

export type LocaleReleaseState =
  | "INTERNAL_DRAFT"
  | "MACHINE_DRAFT"
  | "REVIEW_REQUIRED"
  | "RELEASE_CANDIDATE"
  | "PRODUCTION_READY"
  | "PUBLISHED"
  | "SUSPENDED";

export interface LocaleInfo {
  /** BCP 47 の正式な表記（保存値・`<html lang>`）。 */
  readonly code: string;
  /** その言語自身での名前（言語の選択に表示する。国旗は使わない）。 */
  readonly nativeName: string;
  readonly englishName: string;
  readonly dir: "ltr" | "rtl";
  /** 計算ライブラリ・表示層の文章の言語（ja か en）。 */
  readonly base: Locale;
  /** Intl に渡すロケール。 */
  readonly intl: string;
  readonly state: LocaleReleaseState;
  /** 導入の段階（0: 既存・1: 疑似・2〜4: 追加の段階）。 */
  readonly phase: 0 | 1 | 2 | 3 | 4;
  /** 疑似ローカライズ（開発・CI・内部の確認だけ。利用者の選択へ出さない）。 */
  readonly pseudo?: true;
}

export const LOCALES = [
  { code: "ja", nativeName: "日本語", englishName: "Japanese", dir: "ltr", base: "ja", intl: "ja-JP", state: "PUBLISHED", phase: 0 },
  { code: "en", nativeName: "English", englishName: "English", dir: "ltr", base: "en", intl: "en-US", state: "PUBLISHED", phase: 0 },
  { code: "es", nativeName: "Español", englishName: "Spanish", dir: "ltr", base: "en", intl: "es", state: "MACHINE_DRAFT", phase: 2 },
  { code: "pt-BR", nativeName: "Português (Brasil)", englishName: "Portuguese (Brazil)", dir: "ltr", base: "en", intl: "pt-BR", state: "MACHINE_DRAFT", phase: 2 },
  { code: "fr", nativeName: "Français", englishName: "French", dir: "ltr", base: "en", intl: "fr-FR", state: "MACHINE_DRAFT", phase: 2 },
  { code: "de", nativeName: "Deutsch", englishName: "German", dir: "ltr", base: "en", intl: "de-DE", state: "MACHINE_DRAFT", phase: 2 },
  { code: "it", nativeName: "Italiano", englishName: "Italian", dir: "ltr", base: "en", intl: "it-IT", state: "MACHINE_DRAFT", phase: 2 },
  { code: "ko", nativeName: "한국어", englishName: "Korean", dir: "ltr", base: "en", intl: "ko-KR", state: "MACHINE_DRAFT", phase: 3 },
  { code: "zh-CN", nativeName: "简体中文", englishName: "Chinese (Simplified)", dir: "ltr", base: "en", intl: "zh-CN", state: "MACHINE_DRAFT", phase: 3 },
  { code: "zh-TW", nativeName: "繁體中文", englishName: "Chinese (Traditional)", dir: "ltr", base: "en", intl: "zh-TW", state: "MACHINE_DRAFT", phase: 3 },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", dir: "ltr", base: "en", intl: "id-ID", state: "MACHINE_DRAFT", phase: 3 },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish", dir: "ltr", base: "en", intl: "tr-TR", state: "MACHINE_DRAFT", phase: 3 },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl", base: "en", intl: "ar", state: "INTERNAL_DRAFT", phase: 4 },
  { code: "th", nativeName: "ไทย", englishName: "Thai", dir: "ltr", base: "en", intl: "th-TH", state: "INTERNAL_DRAFT", phase: 4 },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese", dir: "ltr", base: "en", intl: "vi-VN", state: "INTERNAL_DRAFT", phase: 4 },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch", dir: "ltr", base: "en", intl: "nl-NL", state: "INTERNAL_DRAFT", phase: 4 },
  { code: "pl", nativeName: "Polski", englishName: "Polish", dir: "ltr", base: "en", intl: "pl-PL", state: "INTERNAL_DRAFT", phase: 4 },
  { code: "ru", nativeName: "Русский", englishName: "Russian", dir: "ltr", base: "en", intl: "ru-RU", state: "INTERNAL_DRAFT", phase: 4 },
  { code: "en-XA", nativeName: "[Ëñğļîšĥ ƥšéûðô]", englishName: "Pseudo-locale (long text, accents)", dir: "ltr", base: "en", intl: "en-US", state: "INTERNAL_DRAFT", phase: 1, pseudo: true },
  { code: "ar-XB", nativeName: "[ƥšéûðô ɹʇl]", englishName: "Pseudo-locale (right-to-left)", dir: "rtl", base: "en", intl: "en-US", state: "INTERNAL_DRAFT", phase: 1, pseudo: true },
] as const satisfies readonly LocaleInfo[];

export type DisplayLocale = (typeof LOCALES)[number]["code"];

const BY_CODE: ReadonlyMap<string, LocaleInfo> = new Map(LOCALES.map((l) => [l.code.toLowerCase(), l as LocaleInfo]));

export function localeInfo(code: DisplayLocale): LocaleInfo {
  return BY_CODE.get(code.toLowerCase()) as LocaleInfo;
}

/** 利用者の言語の選択に出してよいか（PUBLISHED だけ。内部の確認では SUSPENDED 以外の全部）。 */
export function isSelectableLocale(code: DisplayLocale, opts: { internalPreview: boolean }): boolean {
  const info = localeInfo(code);
  if (!info || info.state === "SUSPENDED") return false;
  if (info.state === "PUBLISHED") return true;
  return opts.internalPreview;
}

export function selectableLocales(opts: { internalPreview: boolean }): readonly LocaleInfo[] {
  return LOCALES.filter((l) => isSelectableLocale(l.code, opts));
}

export interface ParsedLanguageTag {
  language: string;
  script: string | null;
  region: string | null;
}

/** BCP 47 の言語タグの一部（言語-文字-地域）を読む。`_` も区切りとして受け付け、大文字・小文字を正規化する。 */
export function parseLanguageTag(tag: unknown): ParsedLanguageTag | null {
  if (typeof tag !== "string") return null;
  const t = tag.trim();
  if (t.length === 0 || t.length > 35 || !/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(t)) return null;
  const parts = t.split(/[-_]/);
  const language = parts[0].toLowerCase();
  let script: string | null = null;
  let region: string | null = null;
  for (const p of parts.slice(1)) {
    if (!script && !region && /^[A-Za-z]{4}$/.test(p)) script = p[0].toUpperCase() + p.slice(1).toLowerCase();
    else if (!region && (/^[A-Za-z]{2}$/.test(p) || /^\d{3}$/.test(p))) region = p.toUpperCase();
  }
  return { language, script, region };
}

/** 古い・別名の言語コード（BCP 47 で置き換えられたもの）。 */
const LANGUAGE_ALIASES: Readonly<Record<string, string>> = { in: "id", iw: "he", ji: "yi", no: "nb" };

/**
 * 1 つの言語タグを、対応する表示言語へ解決する（対応していなければ null）。
 * 1. 完全一致（大文字・小文字・`_` を正規化）
 * 2. 同じ言語の対応する形（en-GB → en、es-MX → es、pt-PT → pt-BR、de-AT → de）
 * 中国語は文字・地域で簡体字（zh-CN）と繁体字（zh-TW）を分け、`zh` だけの曖昧なタグは解決しない（null）。
 * 疑似ロケール（en-XA・ar-XB）は完全一致のときだけ。
 */
export function resolveLanguageTag(tag: unknown): DisplayLocale | null {
  const exact = typeof tag === "string" ? BY_CODE.get(tag.trim().replace(/_/g, "-").toLowerCase()) : undefined;
  if (exact) return exact.code as DisplayLocale;
  const p = parseLanguageTag(tag);
  if (!p) return null;
  const language = LANGUAGE_ALIASES[p.language] ?? p.language;
  if (language === "zh") {
    if (p.script === "Hant" || p.region === "TW" || p.region === "HK" || p.region === "MO") return "zh-TW";
    if (p.script === "Hans" || p.region === "CN" || p.region === "SG" || p.region === "MY") return "zh-CN";
    return null;
  }
  if (language === "pt") return "pt-BR";
  const base = BY_CODE.get(language);
  return base && !base.pseudo ? (base.code as DisplayLocale) : null;
}

/**
 * ブラウザーの言語の一覧（`navigator.languages`）から表示言語を決める。
 * 選べる言語（`isSelectableLocale`）の中で、優先の高い順に最初に解決できたもの。どれも無ければ English
 * （日本語は日本語の利用者のときだけ。世界向けの最後の代わりにしない）。
 */
export function negotiateDisplayLocale(browserLanguages: readonly (string | null | undefined)[], opts: { internalPreview: boolean }): DisplayLocale {
  for (const tag of browserLanguages) {
    const resolved = resolveLanguageTag(tag);
    if (resolved && isSelectableLocale(resolved, opts)) return resolved;
    // 選べない言語（例: 内部の確認中の es）は、同じ言語の選べる形も無いので次の候補へ進む
  }
  return "en";
}

/** 保存値（localStorage）を表示言語として読む。不正・選べない値は null（呼び出し側でブラウザーの言語へ戻る）。 */
export function readStoredDisplayLocale(raw: unknown, opts: { internalPreview: boolean }): DisplayLocale | null {
  if (typeof raw !== "string") return null;
  const resolved = BY_CODE.get(raw.trim().toLowerCase());
  if (!resolved) return null;
  return isSelectableLocale(resolved.code as DisplayLocale, opts) ? (resolved.code as DisplayLocale) : null;
}
