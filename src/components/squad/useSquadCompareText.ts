"use client";

import "@/lib/i18n/dictionaries/ja-ns/compareCategory";
import "@/lib/i18n/dictionaries/ja-ns/squadCompareBoard";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { localizeSquadText } from "@/lib/squad/squad-text-en";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { CompareCardUnit } from "@/lib/squad/compare-squads";

export type ScKey = keyof Dictionary["squadCompareBoard"];

/**
 * 表示言語の文言（2026-10-04: この画面は日本語の固定文だった。日本語の文言は変えずに辞書 squadCompareBoard へ移した）。
 * lib: ライブラリが返す日本語（指標名・注記・配置の表記・適性）を英語表示にする（compare-text-en.ts）。
 */
export function useSquadCompareText() {
  const t = useT();
  const { locale } = useLocale();
  const tx = (k: ScKey, vars?: Record<string, string | number>) => {
    let out = t("squadCompareBoard", k);
    if (vars) for (const [key, v] of Object.entries(vars)) out = out.split(`{${key}}`).join(String(v));
    return out;
  };
  const lib = (text: string) => localizeSquadText(text, locale);
  // 選手名は表示言語に合わせる（他の画面と同じ resolvePlayerDisplayName）。
  const name = (u: { nameJa: string | null; nameEn: string | null; worldCardId: string }) =>
    resolvePlayerDisplayName(u, locale, tx("cardFallbackTemplate", { id: u.worldCardId }));
  const category = (id: string) => t("compareCategory", id as keyof Dictionary["compareCategory"]);
  return { tx, lib, name, category, locale, t };
}

/** 比較結果の行（worldCardId を持つ）の選手名を表示言語で解決する。カードの情報が無ければライブラリの名前のまま。 */
export function useCompareCardName(units: { a: CompareCardUnit[]; b: CompareCardUnit[] }) {
  const { name } = useSquadCompareText();
  const byId = new Map<string, CompareCardUnit>();
  for (const u of [...units.a, ...units.b]) if (!byId.has(u.worldCardId)) byId.set(u.worldCardId, u);
  return (worldCardId: string, fallback: string) => {
    const u = byId.get(worldCardId);
    return u && (u.nameJa || u.nameEn) ? name(u) : fallback;
  };
}
