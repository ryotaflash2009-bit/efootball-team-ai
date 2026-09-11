"use client";

import type {
  ProgressionCard,
  PointsSummary,
  PlayerBoosterInfo,
  SelectedConditionalBooster,
  SelectedPlayerBooster,
  AppliedPlayerBooster,
  ManagerContext,
  ManagerBoosterReason,
} from "@/lib/progression/types";
import type { ManagerDetail } from "@/lib/managers/types";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Badge } from "@/components/ui/Badge";
import { PointsBar } from "./PointsBar";
import { AttachedBoosterSection } from "./AttachedBoosterSection";
import { B2BoosterSelector } from "./B2BoosterSelector";
import { CurrentManagerCard } from "@/components/managers/CurrentManagerCard";
import { FavoriteButton } from "@/components/user-cards/FavoriteButton";
import { MyTeamButton } from "@/components/user-cards/MyTeamButton";

/**
 * 育成タブ上部の選手概要（育成操作中も選手情報・残ポイント・ブースター・監督が見える）。
 * ゲーム内のポジション別 OVR はデータに無いため表示しない（画像だけでは判断できない）。
 */
export function ProgressionSummary({
  card,
  imageSources,
  points,
  attached,
  attachedNote,
  conditionalSelections,
  onConditionalChange,
  selectedBoosters,
  appliedBoosters,
  onSelectedBoostersChange,
  manager,
  managerDetail,
  managerReasons,
  onOpenPicker,
  onClearManager,
}: {
  card: ProgressionCard;
  imageSources: string[];
  points: PointsSummary;
  attached: PlayerBoosterInfo[];
  attachedNote?: string;
  conditionalSelections: SelectedConditionalBooster[];
  onConditionalChange: (next: SelectedConditionalBooster[]) => void;
  selectedBoosters: SelectedPlayerBooster[];
  appliedBoosters: AppliedPlayerBooster[];
  onSelectedBoostersChange: (next: SelectedPlayerBooster[]) => void;
  manager: ManagerContext | null;
  managerDetail: ManagerDetail | null;
  managerReasons: ManagerBoosterReason[];
  onOpenPicker: () => void;
  onClearManager: () => void;
}) {
  const overriddenSlots = new Set(selectedBoosters.map((s) => s.slot));
  const name = card.nameJa || card.nameEn || `カード ${card.worldCardId}`;

  return (
    <div className="rounded-lg border border-border-strong bg-surface p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="w-20 shrink-0 sm:w-24">
          <WorldCardImage sources={imageSources} alt={name} size="detail" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-2xl font-black leading-none text-accent tabular-nums">
              {card.ovrMax ?? card.ovrBase ?? "–"}
            </span>
            <span className="text-2xs font-semibold text-text-dim">最大 OVR</span>
            <span className="text-2xs text-text-dim">Lv上限 {card.maximumLevel ?? "–"}</span>
          </div>
          <h3 className="mt-1 truncate text-lg font-bold leading-tight">{name}</h3>
          <p className="truncate text-xs text-text-dim">{card.nameEn || "（英語名なし）"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {card.registeredPosition ? <Badge tone="neutral">{card.registeredPosition}</Badge> : null}
            {card.cardType ? <Badge tone="outline">{card.cardType}</Badge> : null}
            <Badge tone="outline">ID {card.worldCardId}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <FavoriteButton worldCardId={card.worldCardId} variant="compact" />
            <MyTeamButton worldCardId={card.worldCardId} playerName={name} variant="compact" />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <PointsBar points={points} />
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-text-dim">ブースター</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          <AttachedBoosterSection
            attached={attached}
            attachedNote={attachedNote}
            conditionalSelections={conditionalSelections}
            onConditionalChange={onConditionalChange}
            overriddenSlots={overriddenSlots}
          />
          <div>
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-text-dim">
              <Badge tone="neutral" size="xs">B2</Badge>
              追加ブースター（B2・手動選択）
            </p>
            <p className="mt-0.5 text-2xs text-text-muted">
              カード本来の付属ブースター（B1）ではなく、ユーザーが追加で選ぶブースターです。確認済みのB2ブースターを選ぶと、対象能力・通常の最終値・比較の順位・チーム集計へ即座に反映します。未確認のB2ブースター（試算・過去の選択のみ変更可）は「試算最終値」にのみ反映し、通常の最終値・比較の順位・チーム集計は変えません。
            </p>
            <div className="mt-1.5">
              <B2BoosterSelector
                selected={selectedBoosters}
                attached={attached}
                applied={appliedBoosters}
                onChange={onSelectedBoostersChange}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-text-dim">監督</p>
        <CurrentManagerCard
          manager={manager}
          detail={managerDetail}
          reasons={managerReasons}
          onOpenPicker={onOpenPicker}
          onClear={onClearManager}
          onOpenDetailHref={manager?.internalManagerId ? `/managers/${manager.internalManagerId}` : undefined}
          compact
        />
      </div>
    </div>
  );
}

/**
 * スクロール後に残る細いスティッキーバー。残ポイントと主要操作だけ固定。
 */
export function ProgressionStickyBar({
  card,
  imageSources,
  points,
  onReset,
  canReset,
}: {
  card: ProgressionCard;
  imageSources: string[];
  points: PointsSummary;
  onReset: () => void;
  canReset: boolean;
}) {
  const name = card.nameJa || card.nameEn || `カード ${card.worldCardId}`;
  const low = points.remainingPoints <= 0 || (points.totalPoints > 0 && points.remainingPoints <= 2);

  return (
    <div className="sticky top-[calc(var(--header-h)+2.75rem)] z-10 -mx-1 mb-1 flex items-center gap-2 rounded-md border border-border bg-bg/95 px-2 py-1.5 backdrop-blur">
      <div className="hidden h-9 w-7 shrink-0 overflow-hidden rounded sm:block">
        <WorldCardImage sources={imageSources} alt={name} size="card" />
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{name}</span>
      <span className="shrink-0 text-2xs text-text-dim">最大OVR {card.ovrMax ?? "–"}</span>
      <span className="shrink-0 text-xs tabular-nums">
        残り{" "}
        <b className={points.remainingPoints < 0 ? "text-danger" : low ? "text-warning" : "text-accent"}>
          {points.remainingPoints}
        </b>
        <span className="text-text-dim"> / {points.totalPoints} pt</span>
      </span>
      <button
        type="button"
        onClick={onReset}
        disabled={!canReset}
        className="shrink-0 rounded border border-border px-2 py-1 text-2xs text-danger transition-colors hover:enabled:border-danger disabled:opacity-40"
      >
        育成リセット
      </button>
    </div>
  );
}
