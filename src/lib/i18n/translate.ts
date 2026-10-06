import ja from "./dictionaries/ja";
import { jaSplitNamespace } from "./dictionaries/ja-registry";
import type { Dictionary } from "./dictionaries/ja";
import { localeInfo, type DisplayLocale } from "./locale-registry";

/**
 * 既定言語（ja）は静的に持つ（SSR と hydration は常に ja）。英語の辞書は、英語を選んだ利用者のときだけ
 * `loadDictionary("en")` で後から読み込む（2026-10-04: 全画面の初回 JS から英語の辞書を外す）。
 * 読み込み前の英語の要求は ja へフォールバックする（生のキーは出さない）。テストは setup で登録する。
 */
/**
 * 日本語は核（ja.ts）と、画面ごとに import して登録する名前空間（ja-ns/*）に分けている（2026-10-04）。
 * JA_VIEW はその 2 つを合わせて 1 つの辞書として見せる。
 */
/**
 * 多言語（2026-10-06）: ja・en 以外の言語は「一部の名前空間・キーだけを持つ辞書」（PartialDictionary）を
 * 言語ごとの別 chunk として後から読み込む（`dictionaries/locales/<code>.ts`）。解決の順は
 * その言語 → English → 日本語。新しい言語では英語の辞書も読み込む（日本語を世界向けの最後の代わりにしない）。
 * 疑似ロケール（en-XA・ar-XB）は英語の辞書から機械的に作る（内部の確認だけ）。
 */
const JA_VIEW = new Proxy(ja as unknown as Dictionary, {
  get(target, prop) {
    const own = (target as unknown as Record<string | symbol, unknown>)[prop];
    return own !== undefined ? own : typeof prop === "string" ? jaSplitNamespace(prop as keyof Dictionary) : undefined;
  },
});

export type PartialDictionary = { [N in keyof Dictionary]?: Partial<Dictionary[N]> };

const DICTIONARIES: Partial<Record<DisplayLocale, Dictionary | PartialDictionary>> = { ja: JA_VIEW };
const LOADING: Partial<Record<DisplayLocale, Promise<void>>> = {};

/** ja・en 以外の言語の辞書（言語ごとに別 chunk。初回 JS に含めない）。 */
const LOADERS: Partial<Record<DisplayLocale, () => Promise<PartialDictionary>>> = {
  es: () => import("./dictionaries/locales/es").then((m) => m.default),
  "pt-BR": () => import("./dictionaries/locales/pt-BR").then((m) => m.default),
  fr: () => import("./dictionaries/locales/fr").then((m) => m.default),
  de: () => import("./dictionaries/locales/de").then((m) => m.default),
  it: () => import("./dictionaries/locales/it").then((m) => m.default),
  ko: () => import("./dictionaries/locales/ko").then((m) => m.default),
  "zh-CN": () => import("./dictionaries/locales/zh-CN").then((m) => m.default),
  "zh-TW": () => import("./dictionaries/locales/zh-TW").then((m) => m.default),
  id: () => import("./dictionaries/locales/id").then((m) => m.default),
  tr: () => import("./dictionaries/locales/tr").then((m) => m.default),
  "en-XA": () => Promise.all([import("./dictionaries/en"), import("./pseudo-locale")]).then(([en, p]) => p.pseudoDictionary(en.default, "en-XA")),
  "ar-XB": () => Promise.all([import("./dictionaries/en"), import("./pseudo-locale")]).then(([en, p]) => p.pseudoDictionary(en.default, "ar-XB")),
};

export function registerDictionary(locale: DisplayLocale, dictionary: Dictionary | PartialDictionary): void {
  DICTIONARIES[locale] = dictionary;
}

/** その言語の表示に必要な辞書がそろっているか（ja・en 以外は英語の辞書も必要）。 */
export function hasDictionary(locale: DisplayLocale): boolean {
  if (DICTIONARIES[locale] == null) return false;
  return locale === "ja" || locale === "en" || DICTIONARIES.en != null;
}

function loadOne(locale: DisplayLocale): Promise<void> {
  if (DICTIONARIES[locale] != null) return Promise.resolve();
  const loader = locale === "en" ? () => import("./dictionaries/en").then((m) => m.default as Dictionary | PartialDictionary) : LOADERS[locale];
  if (!loader) return Promise.resolve();
  LOADING[locale] ??= loader()
    .then((d) => registerDictionary(locale, d))
    .catch(() => {
      delete LOADING[locale]; // 次の切り替えで再試行できるようにする
    });
  return LOADING[locale] as Promise<void>;
}

/** 辞書を読み込む（済みなら即時）。失敗しても例外にしない（呼び出し側は読み込めた言語で表示する）。 */
export function loadDictionary(locale: DisplayLocale): Promise<void> {
  if (locale === "ja") return Promise.resolve();
  if (locale === "en") return loadOne("en");
  return Promise.all([loadOne("en"), loadOne(locale)]).then(() => undefined);
}

/** ja・en の完全な辞書（ほかの言語は基本の言語の辞書）。表示層の `dictionary` 参照用。 */
export function dictionaryOf(locale: DisplayLocale): Dictionary {
  const base = locale === "ja" ? "ja" : "en";
  return (DICTIONARIES[base] as Dictionary | undefined) ?? JA_VIEW;
}

type Namespace = keyof Dictionary;

/** 欠落したキーの記録（内部の確認・テスト用。利用者へは出さない）。 */
const MISSING = new Set<string>();
export function missingKeysSeen(): readonly string[] {
  return [...MISSING];
}

/**
 * 翻訳キーを解決する純関数。その言語 → English（ja 以外）→ 日本語の順に探す。
 * 見つからない場合は開発時だけ console.warn し、**画面へ生のキー文字列を出さない。**
 */
export function translate<N extends Namespace>(locale: DisplayLocale, namespace: N, key: keyof Dictionary[N]): string {
  const dict = DICTIONARIES[locale] as PartialDictionary | undefined;
  const value = dict?.[namespace]?.[key];
  if (typeof value === "string" && value.length > 0) return value;

  if (locale !== "ja" && locale !== "en") {
    // 内部の確認用の言語の未翻訳: 英語で出す（coverage の報告で数える）
    MISSING.add(`${locale}:${String(namespace)}.${String(key)}`);
    const en = (DICTIONARIES.en as Dictionary | undefined)?.[namespace]?.[key];
    if (typeof en === "string") return en;
  } else if (dict && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key: ${String(namespace)}.${String(key)} for locale "${locale}"`);
  }
  const fallback = JA_VIEW[namespace]?.[key];
  if (typeof fallback === "string") return fallback;
  // 日本語の名前空間が読み込まれていない（その画面が ja-ns/<名前空間> を import していない）。本番でも console に出し、
  // 公開 black-box の console error で検出できるようにする（空の文字を黙って出さない）。
  if (typeof window !== "undefined" && JA_VIEW[namespace] === undefined) {
    // eslint-disable-next-line no-console
    console.error(`[i18n] namespace not loaded: ${String(namespace)}`);
  }
  return "";
}

/** 表示言語の情報（方向・Intl）。 */
export function directionOf(locale: DisplayLocale): "ltr" | "rtl" {
  return localeInfo(locale)?.dir ?? "ltr";
}
