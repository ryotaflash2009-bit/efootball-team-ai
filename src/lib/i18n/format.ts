import type { Locale } from "./locale";

/** `Intl` 標準APIだけを使う日付・数値のロケール別表示（能力値・スコアそのものは変更しない・表示専用）。 */

const INTL_LOCALE: Record<Locale, string> = { ja: "ja-JP", en: "en-US" };

/**
 * 日時の表示は固定の時間帯(日本時間)で行い、日時には時間帯名を付ける。
 *
 * 理由(2026-09-24、公開サイトのRelease Gateで確認): サーバー(Vercel、UTC)と閲覧者のブラウザー(日本、JST)で
 * 時間帯が異なると、サーバーが描画した日時とブラウザーでの再描画が一致せず、Reactのhydration不一致
 * (#418)がconsole errorとして発生し、表示も時間帯の説明なしにUTCの時刻になっていた。
 * 表示用の時間帯を固定すれば、サーバー・ブラウザー・閲覧者の時間帯に関係なく同じ文字列になる。
 */
export const DISPLAY_TIME_ZONE = "Asia/Tokyo";

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { year: "numeric", month: "long", day: "numeric", timeZone: DISPLAY_TIME_ZONE }).format(date);
}

export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
    timeZoneName: "short",
  }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}
