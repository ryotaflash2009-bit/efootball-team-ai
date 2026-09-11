import type { Locale } from "./locale";
import { translate } from "./translate";

/**
 * 表示専用の選手名（監督名にも流用可）ロケール別選択。
 * 保存データ（SQLite の name_ja / name_en 列など）は一切変更しない。呼び出し側が持つ
 * `fallback`（例: 「カード {id}」）は既存の安全な表示名として扱い、そのまま尊重する。
 *
 * - ja: 確認済み日本語名 → 確認済み英語名 → fallback → ローカライズ済み「名前不明」
 * - en: 確認済み英語名 → fallback → 確認済み日本語名 → ローカライズ済み「Unknown Player」
 *
 * fallback を渡さない呼び出し元では、ja/en とも確認済みの別言語名を fallback として使う
 * （fallback省略時は「他言語名を確認済みの安全な表示名」として扱う）。
 */
export function resolvePlayerDisplayName(
  names: { nameJa?: string | null; nameEn?: string | null },
  locale: Locale,
  fallback?: string | null,
): string {
  const ja = names.nameJa?.trim() ? names.nameJa : null;
  const en = names.nameEn?.trim() ? names.nameEn : null;
  const safeFallback = fallback?.trim() ? fallback : null;
  const unknown = translate(locale, "common", "unknownPlayer");

  if (locale === "ja") {
    return ja || en || safeFallback || unknown;
  }
  return en || safeFallback || ja || unknown;
}
