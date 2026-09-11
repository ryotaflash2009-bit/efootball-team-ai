"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  detectLocaleFromBrowserLanguage,
  normalizeLocale,
  type Locale,
} from "./locale";
import { dictionaryOf, translate } from "./translate";
import type { Dictionary } from "./dictionaries/ja";

/**
 * 表示言語（ja/en）のコンテキスト。
 *
 * - サーバー側の初期HTMLは常に `DEFAULT_LOCALE`（ja）で描画する（`layout.tsx` の `<html lang="ja">` と一致させ、
 *   hydration不一致を避ける）。マウント後に `localStorage` の手動選択、無ければ `navigator.language` を見て
 *   実際の表示言語へ切り替える（1回だけ）。
 * - 手動選択は `localStorage`（`LOCALE_STORAGE_KEY`）だけに保存する。SQLite・保存スカッド・保存ビルドとは
 *   完全に独立した別キーであり、これらのスキーマ・storageVersion・rulesVersionには一切触れない。
 * - 言語切り替えは表示だけを差し替える。診断の再計算・能力値の再計算・ページ全体の再マウントは行わない
 *   （React Context の値が変わるだけなので、既存の画面状態・編集中のフォーム状態は保持される）。
 */

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  dictionary: Dictionary;
  t: <N extends keyof Dictionary>(namespace: N, key: keyof Dictionary[N]) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw == null) return null;
    return normalizeLocale(raw);
  } catch {
    return null;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // サーバーHTMLと同じ既定値でマウントし、hydration後に実際の言語へ切り替える。
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored) {
      setLocaleState(stored);
      return;
    }
    const detected = detectLocaleFromBrowserLanguage(typeof navigator !== "undefined" ? navigator.language : null);
    setLocaleState(detected);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    const safe = normalizeLocale(next);
    setLocaleState(safe);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, safe);
    } catch {
      /* localStorageが使用不可でも表示言語自体は切り替える */
    }
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = dictionaryOf(locale);
    return {
      locale,
      setLocale,
      dictionary,
      t: (namespace, key) => translate(locale, namespace, key),
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** 現在の表示言語と切り替え関数。 */
export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

/** 翻訳関数 `t(namespace, key)`。欠落キーは安全に既定言語へフォールバックし、生のキーは返さない。 */
export function useT(): <N extends keyof Dictionary>(namespace: N, key: keyof Dictionary[N]) => string {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used within LocaleProvider");
  return ctx.t;
}
