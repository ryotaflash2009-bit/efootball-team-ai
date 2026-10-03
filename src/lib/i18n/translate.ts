import type { Locale } from "./locale";
import ja from "./dictionaries/ja";
import type { Dictionary } from "./dictionaries/ja";

/**
 * 既定言語（ja）は静的に持つ（SSR と hydration は常に ja）。英語の辞書は、英語を選んだ利用者のときだけ
 * `loadDictionary("en")` で後から読み込む（2026-10-04: 全画面の初回 JS から英語の辞書を外す）。
 * 読み込み前の英語の要求は ja へフォールバックする（生のキーは出さない）。テストは setup で登録する。
 */
const DICTIONARIES: Partial<Record<Locale, Dictionary>> = { ja };
const LOADING: Partial<Record<Locale, Promise<void>>> = {};

export function registerDictionary(locale: Locale, dictionary: Dictionary): void {
  DICTIONARIES[locale] = dictionary;
}

export function hasDictionary(locale: Locale): boolean {
  return DICTIONARIES[locale] != null;
}

/** 辞書を読み込む（済みなら即時）。失敗しても例外にしない（呼び出し側は ja のまま表示する）。 */
export function loadDictionary(locale: Locale): Promise<void> {
  if (hasDictionary(locale)) return Promise.resolve();
  if (locale !== "en") return Promise.resolve();
  LOADING.en ??= import("./dictionaries/en")
    .then((m) => registerDictionary("en", m.default))
    .catch(() => {
      delete LOADING.en; // 次の切り替えで再試行できるようにする
    });
  return LOADING.en;
}

export function dictionaryOf(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? ja;
}

type Namespace = keyof Dictionary;

/**
 * 翻訳キーを解決する純関数。`namespace.key` の組み合わせが存在しない場合は、
 * 開発時に安全な範囲で検出できるよう console.warn（本番ビルドでは出さない）した上で、
 * 常に既定言語（ja）の値へフォールバックする。**画面へ生のキー文字列を出さない。**
 */
export function translate<N extends Namespace>(locale: Locale, namespace: N, key: keyof Dictionary[N]): string {
  const dict = DICTIONARIES[locale];
  const value = dict?.[namespace]?.[key];
  if (typeof value === "string") return value;

  if (dict && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key: ${String(namespace)}.${String(key)} for locale "${locale}"`);
  }
  const fallback = ja[namespace]?.[key];
  return typeof fallback === "string" ? fallback : "";
}
