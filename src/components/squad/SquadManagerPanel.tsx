"use client";

import { useState } from "react";
import type { ManagerContext } from "@/lib/progression/types";
import type { ManagerDetail } from "@/lib/managers/types";
import { ManagerPicker } from "@/components/managers/ManagerPicker";
import { CurrentManagerCard } from "@/components/managers/CurrentManagerCard";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * スカッド全体の監督（1人）。共通 ManagerPicker を再利用。
 * - confirmed ブースターだけ全選手へ適用。
 * - 変更・解除は各選手の育成配分を変えず、buildSquad の再実行で managerBoosterDelta だけ再計算。
 */
export function SquadManagerPanel({
  manager,
  detail,
  boostedCount,
  onSelect,
}: {
  manager: ManagerContext | null;
  detail: ManagerDetail | null;
  boostedCount: number;
  onSelect: (id: number | null, ctx: ManagerContext | null, detail: ManagerDetail | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm">
      <h3 className="mb-2 font-semibold">{t("manager", "squadWideHeading")}</h3>
      <CurrentManagerCard
        manager={manager}
        detail={detail}
        reasons={manager?.confirmationStatus === "confirmed" ? (detail?.boosters ?? []).filter((b) => b.statKey && b.confirmationStatus === "confirmed").map((b) => ({ statKey: b.statKey!, statNameEn: b.statNameEn, delta: b.delta, managerName: manager?.managerName ?? null })) : []}
        onOpenPicker={() => setOpen(true)}
        onClear={() => onSelect(null, null, null)}
        onOpenDetailHref={manager?.internalManagerId ? `/managers/${manager.internalManagerId}` : undefined}
        compact
      />
      {manager?.confirmationStatus === "confirmed" ? (
        <p className="mt-1.5 text-2xs text-lime-300">
          {t("manager", "confirmedBoostersAppliedPrefix")}
          {boostedCount}
          {t("manager", "confirmedBoostersAppliedSuffix")}
        </p>
      ) : null}

      <ManagerPicker
        open={open}
        onClose={() => setOpen(false)}
        currentManagerId={manager?.internalManagerId ?? null}
        title={t("manager", "selectManagerTitle")}
        onSelect={(ctx, d) => onSelect(ctx?.internalManagerId ?? null, ctx, d)}
      />
    </div>
  );
}
