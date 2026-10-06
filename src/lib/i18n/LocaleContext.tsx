"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, type Locale } from "./locale";
import { isSelectableLocale, localeInfo, negotiateDisplayLocale, readStoredDisplayLocale, type DisplayLocale } from "./locale-registry";
import { dictionaryOf, hasDictionary, loadDictionary, missingKeysSeen, translate } from "./translate";
import { setPluralLocale } from "./message-format";
import { areInternalPagesVisible } from "@/lib/public-info/internal-pages";
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
  /** 基本の言語（ja / en）。計算ライブラリ・表示層の文章の分岐に使う（ja 以外の言語はすべて en）。 */
  locale: Locale;
  /** 実際の表示言語（BCP 47。locale-registry.ts）。 */
  displayLocale: DisplayLocale;
  setLocale: (next: DisplayLocale) => void;
  dictionary: Dictionary;
  t: <N extends keyof Dictionary>(namespace: N, key: keyof Dictionary[N]) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** 内部の確認用の言語を選べるか（開発・内部ページを有効にした build だけ。Production・Preview では偽）。 */
const INTERNAL_PREVIEW = areInternalPagesVisible();

// 内部の確認の build だけ: 確認中の言語で English へ戻ったキーの一覧を、多言語の black-box が読めるようにする（Production には出ない）
if (INTERNAL_PREVIEW && typeof window !== "undefined") {
  (window as unknown as { __eftaI18nMissing?: () => readonly string[] }).__eftaI18nMissing = missingKeysSeen;
}

function readStoredLocale(): DisplayLocale | null {
  try {
    return readStoredDisplayLocale(localStorage.getItem(LOCALE_STORAGE_KEY), { internalPreview: INTERNAL_PREVIEW });
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  const list = Array.isArray(navigator.languages) && navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  return list.filter((x): x is string => typeof x === "string");
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // サーバーHTMLと同じ既定値でマウントし、hydration後に実際の言語へ切り替える。
  const [locale, setLocaleState] = useState<DisplayLocale>(DEFAULT_LOCALE);
  // 保存値・ブラウザーの言語から実際の言語を決めたか（決める前は既定の ja のまま）。
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    setResolved(true);
    if (stored) {
      setLocaleState(stored);
      return;
    }
    // 選べる言語（Production では ja・en）の中で、ブラウザーの言語の優先の順に決める。どれも無ければ English。
    setLocaleState(negotiateDisplayLocale(browserLanguages(), { internalPreview: INTERNAL_PREVIEW }));
  }, []);

  const setLocale = useCallback((next: DisplayLocale) => {
    if (!isSelectableLocale(next, { internalPreview: INTERNAL_PREVIEW })) return;
    const safe = next;
    setLocaleState(safe);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, safe);
    } catch {
      /* localStorageが使用不可でも表示言語自体は切り替える */
    }
  }, []);

  // 英語の辞書は後から読み込む。読み込みが終わるまでは ja のまま表示し、終わったら切り替える
  // （一部だけ英語になる中間の表示を出さない）。
  const [loadedTick, setLoadedTick] = useState(0);
  useEffect(() => {
    if (hasDictionary(locale)) return;
    let alive = true;
    void loadDictionary(locale).then(() => {
      if (alive) setLoadedTick((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [locale]);
  const effectiveLocale: DisplayLocale = hasDictionary(locale) ? locale : DEFAULT_LOCALE;
  const info = localeInfo(effectiveLocale);

  useEffect(() => {
    document.documentElement.lang = effectiveLocale;
    // 右から左の言語（ar・疑似の ar-XB）だけ dir="rtl"。それ以外は属性を外して既定（ltr）に戻す。
    if (info.dir === "rtl") document.documentElement.dir = "rtl";
    else document.documentElement.removeAttribute("dir");
    // 実際の言語の辞書を適用したら、本文を表示する（layout の head の script が英語の利用者だけ一時的に隠している）。
    if (resolved && effectiveLocale === locale) document.documentElement.removeAttribute("data-locale-pending");
  }, [effectiveLocale, locale, resolved, info.dir]);

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = dictionaryOf(effectiveLocale);
    // 複数形の選択（fillMessage の {count, plural, …}）も表示言語の規則にする
    setPluralLocale(info.intl);
    return {
      locale: info.base,
      displayLocale: effectiveLocale,
      setLocale,
      dictionary,
      t: (namespace, key) => translate(effectiveLocale, namespace, key),
    };
    // loadedTick: 辞書の読み込み完了で再計算する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLocale, setLocale, loadedTick, info]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** 現在の基本の言語（ja / en）と切り替え関数。 */
export function useLocale(): { locale: Locale; displayLocale: DisplayLocale; setLocale: (next: DisplayLocale) => void } {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return { locale: ctx.locale, displayLocale: ctx.displayLocale, setLocale: ctx.setLocale };
}

/** 内部の確認用の言語を選べる build か（言語の選択の表示用）。 */
export function isLocalePreviewEnabled(): boolean {
  return INTERNAL_PREVIEW;
}

/** 翻訳関数 `t(namespace, key)`。欠落キーは安全に既定言語へフォールバックし、生のキーは返さない。 */
export function useT(): <N extends keyof Dictionary>(namespace: N, key: keyof Dictionary[N]) => string {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used within LocaleProvider");
  return ctx.t;
}
