"use client";

import dynamic from "next/dynamic";
import { isLocalePreviewEnabled, useLocale, useT } from "@/lib/i18n/LocaleContext";
import { selectableLocales, type DisplayLocale } from "@/lib/i18n/locale-registry";

/** 内部の確認用の言語の一覧（開発・内部ページを有効にした build だけで使う。公開の初回 JS に含めない）。 */
const PreviewLanguageMenu = dynamic(() => import("./PreviewLanguageMenu").then((m) => m.PreviewLanguageMenu), { ssr: false });

/**
 * 表示言語の切り替えUI。
 * - 公開している言語（PUBLISHED。現在は日本語・English）は、その言語自身の名前のボタン（`aria-pressed`）。国旗は使わない。
 * - 内部の確認用の言語（開発・内部ページを有効にした build だけ）は「ほかの言語（確認中）」の一覧（listbox）。
 *   矢印キー・Home/End・Enter/Space で選び、Escape・外側のクリックで閉じ、閉じたらボタンへフォーカスを戻す。
 * - 言語変更は React Context の値を切り替えるだけで、ページ遷移・再マウント・データ再取得は発生しない
 *   （現在のページ・URL の query・スカッドの編集状態・保存データは維持される）。
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { displayLocale, setLocale } = useLocale();
  const t = useT();
  const published = selectableLocales({ internalPreview: false });
  const preview = isLocalePreviewEnabled() ? selectableLocales({ internalPreview: true }).filter((l) => l.state !== "PUBLISHED") : [];

  return (
    <div className="inline-flex shrink-0 items-center gap-1">
      <div
        role="group"
        aria-label={t("language", "ariaLabel")}
        className={`inline-flex shrink-0 overflow-hidden rounded-md border border-border ${compact ? "text-2xs" : "text-xs"}`}
      >
        {published.map((opt) => {
          const active = opt.code === displayLocale;
          return (
            <button
              key={opt.code}
              type="button"
              lang={opt.code}
              aria-pressed={active}
              onClick={() => setLocale(opt.code as DisplayLocale)}
              className={`min-h-[32px] px-2.5 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-accent text-accent-ink underline underline-offset-2" : "bg-surface-2 text-text-dim hover:text-text"
              }`}
            >
              {opt.nativeName}
            </button>
          );
        })}
      </div>
      {preview.length > 0 ? <PreviewLanguageMenu options={preview.map((l) => ({ code: l.code as DisplayLocale, nativeName: l.nativeName, dir: l.dir }))} compact={compact} /> : null}
    </div>
  );
}
