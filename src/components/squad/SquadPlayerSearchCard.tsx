"use client";

import type { WorldPlayerListItem } from "@/lib/world/types";
import { WorldPlayerSearchCard } from "@/components/world/WorldPlayerSearchCard";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * スカッド選手検索の 1 結果カード。
 * 表示は選手比較検索と共通の `WorldPlayerSearchCard` を再利用し、ここではスカッド固有の
 * 「配置先スロット / ベンチ」「配置済み判定」だけをマッピングする。
 */
export function SquadPlayerSearchCard({
  player,
  targetLabel,
  duplicate,
  duplicateWhere,
  onPick,
}: {
  player: WorldPlayerListItem;
  /** 追加先（「LWF へ追加」「ベンチへ追加」など） */
  targetLabel: string;
  duplicate: boolean;
  duplicateWhere: string | null;
  onPick: () => void;
}) {
  const t = useT();
  const disabledReason = duplicate
    ? duplicateWhere
      ? t("playerSearchPanel", "placedWithLocationTemplate").replace("{where}", duplicateWhere)
      : t("playerSearchPanel", "placedLabel")
    : null;
  return (
    <WorldPlayerSearchCard
      player={player}
      actionLabel={targetLabel}
      onPick={onPick}
      disabled={duplicate}
      disabledReason={disabledReason}
      imageWidthClass="w-14 sm:w-16"
    />
  );
}
