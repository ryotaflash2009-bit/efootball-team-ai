"use client";

import "@/lib/i18n/dictionaries/ja-ns/myTeamButton";
import { useState } from "react";
import Link from "next/link";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { Icon } from "@/components/ui/Icon";
import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n/LocaleContext";

// 追加のダイアログは押したときだけ読み込む（一覧のカードごとに置くため最初の JS を軽く・2026-10-28）
const MyTeamAddDialog = dynamic(() => import("./MyTeamAddDialog").then((m) => m.MyTeamAddDialog), { ssr: false });

/**
 * My Team 追加ボタン（共通）。
 *  - 未登録: ダイアログを開いて所有状態などを入力 → 追加。
 *  - 登録済み: 「My Team 登録済み」＋ /my-team で開く導線（重複登録しない）。
 *  - variant "card": 一覧のカードの下（比較のボタンと同じ幅いっぱい・登録済みは印だけ・高さは同じ・2026-10-26）。
 */
export function MyTeamButton({
  worldCardId,
  playerName,
  variant = "detail",
  className = "",
}: {
  worldCardId: string;
  playerName: string;
  variant?: "detail" | "compact" | "card";
  className?: string;
}) {
  const t = useT();
  const { getByWorldId, available } = useMyTeam();
  const rec = getByWorldId(worldCardId);
  const [open, setOpen] = useState(false);

  if (rec && variant === "card") {
    return (
      <span
        className={`inline-flex w-full items-center justify-center gap-1 rounded-md border border-info/40 bg-info/10 px-2 py-1 text-2xs font-semibold text-info ${className}`}
        aria-label={t("myTeamButton", "registeredAria")}
      >
        <Icon name="check" size={12} />
        {t("myTeamButton", "registeredLabel")}
      </span>
    );
  }

  if (rec) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-info/40 bg-info/10 px-2 py-1 text-2xs font-semibold text-info"
          aria-label={t("myTeamButton", "registeredAria")}
        >
          <Icon name="check" size={13} />
          {t("myTeamButton", "registeredLabel")}
        </span>
        <Link
          href="/my-team"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-2xs text-accent hover:underline"
        >
          {t("myTeamButton", "openInMyTeamLink")}
          <Icon name="arrow-right" size={12} />
        </Link>
      </span>
    );
  }

  const btnClass =
    variant === "card"
      ? "inline-flex w-full items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-semibold text-text-dim transition-colors hover:border-accent hover:text-text"
      : variant === "compact"
      ? "inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-semibold text-text-dim transition-colors hover:border-accent hover:text-text"
      : "inline-flex h-9 min-h-[36px] items-center gap-1.5 rounded-md border border-border-strong bg-surface-2 px-3 text-sm font-semibold text-text transition-colors hover:border-accent";

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <button type="button" onClick={() => setOpen(true)} className={btnClass}>
        <Icon name="shirt" size={variant === "detail" ? 15 : variant === "card" ? 12 : 13} />
        {t("myTeamButton", "addButton")}
      </button>
      {!available ? (
        <span className="mt-0.5 text-2xs text-warning">{t("myTeamButton", "unavailableNote")}</span>
      ) : null}
      {open ? <MyTeamAddDialog worldCardId={worldCardId} playerName={playerName} open onClose={() => setOpen(false)} /> : null}
    </span>
  );
}
