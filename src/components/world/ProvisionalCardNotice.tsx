"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useT } from "@/lib/i18n/LocaleContext";
import type { ProvisionalInfo } from "@/lib/reference-data/provisional/provisional-cards";

/** 暫定のカードの印（一覧のカード・詳細の見出し）。 */
export function ProvisionalBadge() {
  const t = useT();
  return (
    <span className="inline-flex items-center rounded bg-warning/15 px-1.5 py-0.5 text-2xs font-semibold text-warning" data-testid="provisional-badge" title={t("provisionalCards", "badgeTitle")}>
      {t("provisionalCards", "badge")}
    </span>
  );
}

/**
 * 暫定のカードの説明（詳細の画面）: 取得元・最大レベルの扱い・欠けることがある項目・正式なデータに置き換わること（2026-10-15）。
 */
export function ProvisionalCardNotice({ info }: { info: ProvisionalInfo }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  return (
    <div role="note" className="flex flex-col gap-1 rounded-md border border-warning/50 bg-warning/5 p-3 text-xs" data-testid="provisional-notice">
      <p className="flex items-center gap-2 font-semibold">
        <ProvisionalBadge />
        {tp("noticeTitle")}
      </p>
      <p className="text-text-dim">{tp("noticeBody")}</p>
      <p className="text-text-dim">{info.maxLevelSource ? tp("maxLevelFromUsers") : tp("maxLevelUnknown")}</p>
      <p className="text-text-muted">
        {tp("sourceLabel")}{" "}
        <a href={info.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
          PES Master
        </a>
      </p>
    </div>
  );
}
