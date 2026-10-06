"use client";

import { useEffect } from "react";
import { useLocale } from "./LocaleContext";
import { formatPageTitle } from "./page-titles";

/** 題名を設定し、Next.js が画面の移動で戻した場合も合わせ直す（同じなら書かない）。後始末の関数を返す。 */
export function keepDocumentTitle(desired: string): () => void {
  const apply = () => {
    if (document.title !== desired) document.title = desired;
  };
  apply();
  const obs = new MutationObserver(apply);
  obs.observe(document.head, { subtree: true, childList: true, characterData: true });
  return () => obs.disconnect();
}

/**
 * 日本語以外の表示言語で、この画面のタブの題名を表示言語にする（2026-10-07）。日本語ではサーバーの題名のまま。
 * 描画には何も出さない（hydration に関係しない）。
 */
export function usePageTitle(label: string | null | undefined): void {
  const { displayLocale } = useLocale();
  useEffect(() => {
    if (displayLocale === "ja" || typeof document === "undefined") return;
    const desired = formatPageTitle(label);
    if (!desired) return;
    return keepDocumentTitle(desired);
  }, [label, displayLocale]);
}
