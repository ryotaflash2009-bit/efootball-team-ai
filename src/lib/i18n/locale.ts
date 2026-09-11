/**
 * 対応言語の定義・判定・永続化キー（純関数のみ・localStorage / navigator へのアクセスは
 * 呼び出し側（`LocaleContext.tsx`）だけで行う。ここでは値の妥当性判定だけを行う）。
 *
 * 設計方針:
 *  - 対応言語は ja / en の2言語のみ（3言語目以降・地域バリアント(en-US等)は今回対象外）。
 *  - 既定言語は ja（既存の日本語表示を変えない）。
 *  - 不正・未対応の値は必ず既定言語へフォールバックする（推測で別言語に丸めない）。
 *  - この値は表示言語の選択であり、保存スキーマ・storageVersion・rulesVersion・SQLiteとは無関係。
 *    スカッド・保存ビルド・診断ロジック・能力値計算には一切影響しない。
 */

export const SUPPORTED_LOCALES = ["ja", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ja";

/** localStorage キー（表示言語の手動選択だけを保持する。保存スカッド・保存ビルドとは別キー）。 */
export const LOCALE_STORAGE_KEY = "efootball-team-ai:locale:v1";

/** 値が対応言語として妥当か（型ガード）。不正値は呼び出し側で `DEFAULT_LOCALE` へフォールバックする。 */
export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * ブラウザの言語設定（`navigator.language` 等の文字列）から初期言語を決定する純関数。
 * 日本語系（"ja" / "ja-JP" 等、大文字小文字を無視）だけを ja とし、それ以外は en にフォールバックする
 * （未対応言語を推測で日本語に寄せない）。
 */
export function detectLocaleFromBrowserLanguage(browserLanguage: string | null | undefined): Locale {
  if (!browserLanguage) return DEFAULT_LOCALE;
  const primary = browserLanguage.trim().toLowerCase().split("-")[0];
  return primary === "ja" ? "ja" : "en";
}

/** 保存値・URL値などの未検証の入力から、安全にLocaleへ変換する（不正値は既定言語）。 */
export function normalizeLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
