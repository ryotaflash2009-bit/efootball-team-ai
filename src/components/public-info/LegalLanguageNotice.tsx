"use client";

import { useLocale, useT } from "@/lib/i18n/LocaleContext";

/**
 * 法務文書（利用規約・プライバシー・免責事項）を日本語・English 以外の表示言語で開いたときの短い案内（2026-10-06）。
 * 法務文書は専門家のレビューの無い翻訳を正式版として出さないため、English で表示する。どの言語を優先するかは書かない（未確定）。
 */
export function LegalLanguageNotice() {
  const { displayLocale } = useLocale();
  const t = useT();
  if (displayLocale === "ja" || displayLocale === "en") return null;
  return (
    <p className="text-xs text-text-dim" data-testid="legal-language-notice">
      {t("common", "legalEnglishOnlyNotice")}
    </p>
  );
}
