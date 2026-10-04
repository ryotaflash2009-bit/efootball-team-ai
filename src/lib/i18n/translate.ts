import type { Locale } from "./locale";
import ja from "./dictionaries/ja";
import { jaSplitNamespace } from "./dictionaries/ja-registry";
import type { Dictionary } from "./dictionaries/ja";

/**
 * 既定言語（ja）は静的に持つ（SSR と hydration は常に ja）。英語の辞書は、英語を選んだ利用者のときだけ
 * `loadDictionary("en")` で後から読み込む（2026-10-04: 全画面の初回 JS から英語の辞書を外す）。
 * 読み込み前の英語の要求は ja へフォールバックする（生のキーは出さない）。テストは setup で登録する。
 */
/**
 * 日本語は核（ja.ts）と、画面ごとに import して登録する名前空間（ja-ns/*）に分けている（2026-10-04）。
 * JA_VIEW はその 2 つを合わせて 1 つの辞書として見せる。
 */
const JA_VIEW = new Proxy(ja as unknown as Dictionary, {
  get(target, prop) {
    const own = (target as unknown as Record<string | symbol, unknown>)[prop];
    return own !== undefined ? own : typeof prop === "string" ? jaSplitNamespace(prop as keyof Dictionary) : undefined;
  },
});
const DICTIONARIES: Partial<Record<Locale, Dictionary>> = { ja: JA_VIEW };
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
  return DICTIONARIES[locale] ?? JA_VIEW;
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
