import type { Locale } from "./locale";

/** `Intl` 標準APIだけを使う日付・数値のロケール別表示（能力値・スコアそのものは変更しない・表示専用）。 */

const INTL_LOCALE: Record<Locale, string> = { ja: "ja-JP", en: "en-US" };

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}
