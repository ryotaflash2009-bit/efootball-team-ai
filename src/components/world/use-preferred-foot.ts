"use client";

import "@/lib/i18n/dictionaries/ja-ns/worldPlayerHero";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 利き足の値（World の元データは「Left foot」「Right foot」の英語）を表示言語の言葉にする（2026-11-04）。
 * 知らない値は元のまま返す（推測で書き換えない）。
 */
export function preferredFootKey(value: string | null | undefined): "footLeft" | "footRight" | null {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "left foot" || v === "left") return "footLeft";
  if (v === "right foot" || v === "right") return "footRight";
  return null;
}

export function usePreferredFootText(): (value: string | null | undefined) => string | null {
  const t = useT();
  return (value) => {
    if (value == null || value === "") return null;
    const key = preferredFootKey(value);
    return key ? t("worldPlayerHero", key) : value;
  };
}
