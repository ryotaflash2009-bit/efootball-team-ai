import type { Locale } from "./locale";
import ja from "./dictionaries/ja";
import en from "./dictionaries/en";
import type { Dictionary } from "./dictionaries/ja";

const DICTIONARIES: Record<Locale, Dictionary> = { ja, en };

export function dictionaryOf(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
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

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key: ${String(namespace)}.${String(key)} for locale "${locale}"`);
  }
  const fallback = ja[namespace]?.[key];
  return typeof fallback === "string" ? fallback : "";
}
