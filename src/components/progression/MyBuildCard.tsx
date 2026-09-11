"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SavedBuild } from "@/lib/progression/types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { addCompareId } from "@/lib/comparison/compare-cart";
import {
  buildAllocationRows,
  buildPointSummary,
  resolveBuildRuleStatus,
  describeBuildPoM,
  buildHasExperimental,
  formatBuildTimestamp,
  type BuildUsageSummary,
  type MyTeamBuildSelection,
} from "@/lib/progression/my-builds";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * My Builds 一覧の 1 カード。既存の画像解決・辞書・ポイント集計を再利用（計算エンジンは変更しない）。
 * 色だけで現行/旧規則・Power of Many を区別しない（必ず文字ラベルを併記）。
 */
export function MyBuildCard({
  build,
  card,
  cardLoading,
  usage,
  myTeamSelection,
  onRegisterToMyTeam,
  onAssignToMyTeam,
  onClearMyTeamSelection,
  onSetFavoriteBuild,
  onClearFavoriteBuild,
  onRename,
  onDuplicate,
  onDelete,
}: {
  build: SavedBuild;
  /** 解決できたカード要約。null = 解決中 or 取得失敗。 */
  card: WorldPlayerListItem | null;
  cardLoading: boolean;
  usage: BuildUsageSummary;
  /** 同一 worldCardId の My Team レコードから見た、この保存ビルドの選択中／お気に入り状態。 */
  myTeamSelection: MyTeamBuildSelection;
  onRegisterToMyTeam: () => void;
  onAssignToMyTeam: () => void;
  onClearMyTeamSelection: () => void;
  onSetFavoriteBuild: () => void;
  onClearFavoriteBuild: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [compareMsg, setCompareMsg] = useState<string | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tmc = (k: keyof Dictionary["myBuildCard"]) => t("myBuildCard", k);
  const fillMc = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const name = resolvePlayerDisplayName(
    card ?? {},
    locale,
    fillMc(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: build.worldCardId }),
  );

  const sources = card
    ? resolveCardImageSources({
        worldCardId: card.worldCardId,
        efhubCardId: card.efhubCardId,
        hasEfhubLink: card.hasEfhubLink,
        hasWorldImage: card.imageUrlCandidate != null,
        hasWorldMobileImage: card.mobileImageUrlCandidate != null,
      })
    : [];

  const rule = useMemo(() => resolveBuildRuleStatus(build.rulesVersion), [build.rulesVersion]);
  const ruleLabel = rule.isV2 ? t("buildUsage", "ruleCurrentLabel") : rule.isLegacy ? t("buildUsage", "ruleLegacyLabel") : t("buildUsage", "ruleUnknownLabel");
  const points = useMemo(() => buildPointSummary(build, card?.maximumLevel ?? null), [build, card?.maximumLevel]);
  const pom = useMemo(() => describeBuildPoM(build), [build]);
  const allocRows = useMemo(() => buildAllocationRows(build.progressionAllocation), [build.progressionAllocation]);
  const activeRows = allocRows.filter((r) => r.level > 0);
  const hasExperimental = buildHasExperimental(build);

  const detailHref = `/players/world/${encodeURIComponent(build.worldCardId)}`;
  const progressionHref = `${detailHref}?tab=progression`;

  function addToCompare() {
    const r = addCompareId(build.worldCardId);
    setCompareMsg(
      r.result === "added"
        ? t("userCardTile", "compareAddedMsg")
        : r.result === "already"
          ? t("userCardTile", "compareAlreadyMsg")
          : r.result === "full"
            ? t("userCardTile", "compareFullMsg")
            : t("userCardTile", "compareFailedMsg"),
    );
  }

  const pointsText =
    points.totalPoints == null
      ? fillMc(t("squadBuildPanel", "pointsUsedNoTotalTemplate"), { used: String(points.usedPoints) })
      : fillMc(t("squadBuildPanel", "pointsUsedTotalTemplate"), { used: String(points.usedPoints), total: String(points.totalPoints) });
  const remainingText =
    points.remainingPoints == null
      ? t("squadBuildPanel", "remainingUnknown")
      : fillMc(t("squadBuildPanel", "remainingTemplate"), { remaining: String(points.remainingPoints) });

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface">
      {/* 見出し: カード画像 + 選手情報 + ビルド名 */}
      <div className="flex gap-2.5 p-2.5">
        <Link href={detailHref} className="w-16 shrink-0 sm:w-20" aria-label={fillMc(tmc("selectPlayerDetailAriaTemplate"), { name })}>
          <WorldCardImage
            sources={sources}
            alt={card ? fillMc(t("squadBuildPanel", "cardImageAltTemplate"), { name }) : tmc("cardImageAltResolving")}
            size="card"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" title={build.buildName}>
            {build.buildName}
          </p>
          <Link href={detailHref} className="block truncate text-xs text-text-dim hover:text-accent" title={name}>
            {name}
          </Link>
          <p className="truncate text-2xs text-text-muted">{card?.nameEn || `ID ${build.worldCardId}`}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {card?.registeredPosition ? <Badge tone="neutral" size="xs">{card.registeredPosition}</Badge> : null}
            {card?.cardType ? <Badge tone="outline" size="xs">{card.cardType}</Badge> : null}
            {card ? (
              <span className="text-2xs text-text-muted tabular-nums">
                {fillMc(tmc("maxBaseOvrTemplate"), { max: String(card.ovrMax ?? "–"), base: String(card.ovrBase ?? "–") })}
              </span>
            ) : null}
            <Badge tone={rule.isV2 ? "neutral" : "warning"} size="xs">
              {ruleLabel}
            </Badge>
          </div>
          <p className="mt-0.5 text-2xs text-text-muted">
            World ID {build.worldCardId} · buildId {build.buildId}
          </p>
        </div>
      </div>

      {/* カード情報を取得できないとき */}
      {!card && !cardLoading ? (
        <p className="mx-2.5 mb-2 rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
          {tmc("fetchFailedNote")}
        </p>
      ) : null}

      {/* 育成配分 */}
      <div className="border-t border-border/60 px-2.5 py-2 text-2xs">
        <p className="font-semibold text-text-dim">{tmc("allocationHeading")}</p>
        {activeRows.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {activeRows.map((r) => (
              <li key={r.groupId}>
                {r.label} <span className="font-semibold tabular-nums">Lv {r.level}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-text-muted">{t("squadBuildPanel", "noAllocationBase")}</p>
        )}
        <details className="mt-1">
          <summary className="cursor-pointer text-text-muted hover:text-text">{tmc("viewAllAllocationsSummary")}</summary>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
            {allocRows.map((r) => (
              <li key={r.groupId} className={r.level > 0 ? "text-text" : "text-text-muted"}>
                {r.label}: Lv {r.level}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* ポイント・規則・PoM・OVR */}
      <div className="border-t border-border/60 px-2.5 py-2 text-2xs">
        <p>
          <span className="tabular-nums">{pointsText}</span>
          <span className="ml-2 text-text-dim tabular-nums">{remainingText}</span>
          {points.overAllocated ? <span className="ml-2 text-danger">{t("squadBuildPanel", "overAllocated")}</span> : null}
        </p>
        {rule.isLegacy ? (
          <p className="mt-0.5 text-warning">
            {fillMc(tmc("legacyBuildWarningTemplate"), { version: String(build.rulesVersion) })}
          </p>
        ) : null}
        <p className="mt-0.5 text-text-dim">
          {t("squadBuildPanel", "pomRowLabel")}
          {pom.has ? pom.tierLabel : t("squadBuildPanel", "pomUnspecified")}
        </p>
        {hasExperimental ? (
          <p className="mt-0.5 text-text-dim">
            {fillMc(tmc("playerBoosterEstimateTemplate"), { id: String(build.selectedPlayerBooster) })}
          </p>
        ) : null}
        <p className="mt-0.5 text-text-dim">
          {fillMc(tmc("estimatedOvrTemplate"), {
            ovr: String(build.calculatedOvr ?? "—"),
            mode:
              build.calculationMode === "confirmed"
                ? t("squadBuildPanel", "calcModeConfirmed")
                : build.calculationMode === "unsupported"
                  ? t("squadBuildPanel", "calcModeUnsupported")
                  : t("squadBuildPanel", "calcModeProvisional"),
          })}
        </p>
        <p className="mt-0.5 text-text-muted">{t("squadBuildPanel", "totalOvrPlaceholder")}</p>
        <p className="mt-0.5 text-text-muted">
          {fillMc(t("squadBuildPanel", "createdUpdatedTemplate"), {
            created: formatBuildTimestamp(build.createdAt),
            updated: formatBuildTimestamp(build.updatedAt),
          })}
        </p>
      </div>

      {/* 使用状況 */}
      <div className="border-t border-border/60 px-2.5 py-2 text-2xs">
        <p className="font-semibold text-text-dim">{tmc("usageHeading")}</p>
        {usage.anyUsage ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {usage.myTeamSelected ? <li className="text-accent">{tmc("selectedInMyTeamBadge")}</li> : null}
            {usage.myTeamFavorite ? <li className="text-accent">{tmc("favoriteInMyTeamBadge")}</li> : null}
            {usage.squads.map((s) => (
              <li key={s.squadId}>
                <Link href={`/squads/${s.squadId}`} className="text-accent hover:underline">
                  {fillMc(tmc("squadUsingLinkTemplate"), { name: s.squadName })}
                </Link>
                <span className="text-text-muted">{fillMc(tmc("squadUsingSuffixTemplate"), { areas: s.areas.join(" / ") })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-text-muted">{tmc("noUsageLabel")}</p>
        )}
      </div>

      {/* 導線 */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-2.5 py-2">
        <Link
          href={detailHref}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="players" size={12} />
          {tmc("playerDetailLink")}
        </Link>
        <Link
          href={progressionHref}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="sliders" size={12} />
          {tmc("openProgressionLink")}
        </Link>
        <button
          type="button"
          onClick={addToCompare}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="compare" size={12} />
          {tmc("addToCompareButton")}
        </button>
        <Link
          href={`/squads?card=${encodeURIComponent(build.worldCardId)}`}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="squad" size={12} />
          {tmc("useInSquadLink")}
        </Link>
      </div>

      {/* My Team 連携（selectedBuildId / favoriteBuildId のみ・独立操作。スカッド・カードのお気に入りは変更しない） */}
      <div className="flex flex-col gap-1.5 border-t border-border/60 px-2.5 py-2 text-2xs">
        <p className="font-semibold text-text-dim">{tmc("myTeamIntegrationHeading")}</p>

        {myTeamSelection.state === "not-in-team" ? (
          <div className="flex flex-col gap-1">
            <span className="text-text-muted" aria-disabled="true">
              {tmc("notInMyTeamLabel")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onRegisterToMyTeam}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-accent"
              >
                <Icon name="shirt" size={12} />
                {tmc("registerToMyTeamButton")}
              </button>
              <Link
                href="/my-team"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                {tmc("openMyTeamLink")}
              </Link>
            </div>
            <p className="text-[9px] text-text-muted">{tmc("registerHintNote")}</p>
          </div>
        ) : (
          <>
            {/* 選択中ビルド */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-text-muted">{tmc("selectedBuildLabel")}</span>
              {myTeamSelection.isSelected ? (
                <>
                  <span className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-accent bg-accent-soft px-2 font-semibold text-accent">
                    <Icon name="check" size={12} />
                    {tmc("selectedInMyTeamBadge")}
                  </span>
                  <button
                    type="button"
                    onClick={onClearMyTeamSelection}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
                  >
                    {tmc("clearSelectionButton")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onAssignToMyTeam}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-accent"
                >
                  <Icon name="shirt" size={12} />
                  {tmc("useInMyTeamButton")}
                </button>
              )}
            </div>

            {/* お気に入りビルド（selectedBuildId とは独立） */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-text-muted">{tmc("favoriteBuildLabel")}</span>
              {myTeamSelection.isFavorite ? (
                <>
                  <span className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-yellow-400/50 bg-yellow-400/10 px-2 font-semibold text-yellow-300">
                    <Icon name="star" size={12} />
                    {tmc("favoriteInMyTeamBadge")}
                  </span>
                  <button
                    type="button"
                    onClick={onClearFavoriteBuild}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
                  >
                    {tmc("clearFavoriteButton")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onSetFavoriteBuild}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-accent"
                >
                  <Icon name="star" size={12} />
                  {tmc("setFavoriteButton")}
                </button>
              )}
            </div>
            <p className="text-[9px] text-text-muted">{tmc("favoriteHintNote")}</p>
          </>
        )}
      </div>

      {/* 管理操作 */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-surface-2/30 px-2.5 py-2">
        <button
          type="button"
          onClick={onRename}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="pencil" size={12} />
          {tmc("renameButton")}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
        >
          <Icon name="copy" size={12} />
          {tmc("duplicateButton")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs text-danger hover:border-danger"
        >
          <Icon name="trash" size={12} />
          {tmc("deleteButton")}
        </button>
      </div>
      {compareMsg ? (
        <p role="status" className="px-2.5 pb-2 text-2xs text-accent">
          {compareMsg}
        </p>
      ) : null}
    </div>
  );
}
