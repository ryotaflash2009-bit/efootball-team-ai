"use client";

import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Locale } from "@/lib/i18n/locale";

/**
 * 表示言語（日本語/English）の切り替えUI。
 * - 現在選択中の言語は `aria-pressed` とテキスト表記の両方で示す（色だけに依存しない）。
 * - キーボード操作可能な通常の <button>。
 * - 言語変更は React Context の値を切り替えるだけで、ページ遷移・再マウント・データ再取得は発生しない
 *   （現在のページ・スカッドの編集状態・保存データは維持される）。
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const t = useT();

  const options: { value: Locale; label: string }[] = [
    { value: "ja", label: t("language", "japanese") },
    { value: "en", label: t("language", "english") },
  ];

  return (
    <div
      role="group"
      aria-label={t("language", "ariaLabel")}
      className={`inline-flex shrink-0 overflow-hidden rounded-md border border-border ${compact ? "text-2xs" : "text-xs"}`}
    >
      {options.map((opt) => {
        const active = opt.value === locale;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(opt.value)}
            className={`min-h-[32px] px-2.5 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "bg-accent text-accent-ink underline underline-offset-2" : "bg-surface-2 text-text-dim hover:text-text"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
