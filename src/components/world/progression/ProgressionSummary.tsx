"use client";

import "@/lib/i18n/dictionaries/ja-ns/abilityEditor";
import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
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
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
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
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const overriddenSlots = new Set(selectedBoosters.map((s) => s.slot));
  const name = resolvePlayerDisplayName(card, locale, tp("cardFallbackName").replace("{id}", card.worldCardId));

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
            <span className="text-2xs font-semibold text-text-dim">{tp("maxOvrLabel")}</span>
            <span className="text-2xs text-text-dim">{tp("levelCap").replace("{level}", String(card.maximumLevel ?? "–"))}</span>
          </div>
          <h3 className="mt-1 truncate text-lg font-bold leading-tight">{name}</h3>
          {locale === "ja" ? <p className="truncate text-xs text-text-dim">{card.nameEn || tp("noEnglishName")}</p> : null}
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
        <p className="mb-1.5 text-xs font-semibold text-text-dim">{tp("boostersHeading")}</p>
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
              {tp("b2Heading")}
            </p>
            <p className="mt-0.5 text-2xs text-text-muted">
              {tp("b2Note")}
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
        <p className="mb-1.5 text-xs font-semibold text-text-dim">{tp("managerHeading")}</p>
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
  onUndoReset = null,
}: {
  card: ProgressionCard;
  imageSources: string[];
  points: PointsSummary;
  onReset: () => void;
  canReset: boolean;
  /** 全リセット直後だけ表示する「取り消す」（次の変更で消える）。 */
  onUndoReset?: (() => void) | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const name = resolvePlayerDisplayName(card, locale, t("progressionTab", "cardFallbackName").replace("{id}", card.worldCardId));
  const low = points.remainingPoints <= 0 || (points.totalPoints > 0 && points.remainingPoints <= 2);

  return (
    <div className="sticky top-[calc(var(--header-h)+2.75rem)] z-10 -mx-1 mb-1 flex items-center gap-2 rounded-md border border-border bg-bg/95 px-2 py-1.5 backdrop-blur [@media(max-height:520px)]:static">
      <div className="hidden h-9 w-7 shrink-0 overflow-hidden rounded sm:block">
        <WorldCardImage sources={imageSources} alt={name} size="card" />
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{name}</span>
      <span className="shrink-0 text-2xs text-text-dim">{t("progressionTab", "maxOvrShort")} {card.ovrMax ?? "–"}</span>
      <span className="shrink-0 text-xs tabular-nums">
        {t("progressionTab", "remainingLabel")}{" "}
        <b className={points.remainingPoints < 0 ? "text-danger" : low ? "text-warning" : "text-accent"}>
          {points.remainingPoints}
        </b>
        <span className="text-text-dim"> / {points.totalPoints} pt</span>
      </span>
      {onUndoReset ? (
        <button
          type="button"
          onClick={onUndoReset}
          className="min-h-[44px] shrink-0 rounded border border-accent/60 bg-accent/10 px-2 text-2xs font-semibold text-accent"
        >
          {t("abilityEditor", "undoReset")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          className="min-h-[44px] shrink-0 rounded border border-border px-2 text-2xs text-danger transition-colors hover:enabled:border-danger disabled:opacity-40"
        >
          {t("abilityEditor", "resetAll")}
        </button>
      )}
    </div>
  );
}
