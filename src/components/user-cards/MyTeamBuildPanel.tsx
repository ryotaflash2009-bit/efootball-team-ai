"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SavedBuild } from "@/lib/progression/types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import { MY_TEAM_STORAGE_KEY } from "@/lib/user-cards/types";
import { useOwnershipLabels, useUsageLabels } from "./UserCardTile";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import {
  getMyTeamRecord,
  isMyTeamStorageAvailable,
  updateMyTeamRecord,
} from "@/lib/user-cards/my-team-storage";
import { getBuild, listBuilds } from "@/lib/progression/build-storage";
import { BUILD_STORAGE_KEY } from "@/lib/progression/constants";
import {
  buildAllocationRows,
  buildHasExperimental,
  buildPointSummary,
  describeBuildPoM,
  formatBuildTimestamp,
  matchesBuildSearch,
  normalizeBuildSearchQuery,
  resolveBuildRuleStatus,
  resolveMyTeamBuildRefs,
  sortMyTeamBuildPanel,
  validateMyTeamBuildAssignment,
  validateMyTeamBuildRefClear,
  validateMyTeamFavoriteBuildAssignment,
  type MyTeamBuildClearField,
} from "@/lib/progression/my-builds";
import { resolveCardImageSources } from "@/lib/world/image";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
// 解除確認はネストした Modal を避けるためパネル内インライン（role="alertdialog"）で行う。

/**
 * My Team 画面の「保存ビルドを選ぶ」パネル。対象カード（worldCardId）の保存ビルドだけを
 * 内容まで確認しながら、選択中ビルド（selectedBuildId）とお気に入りビルド（favoriteBuildId）を
 * **独立して**設定・解除する。既存 `updateMyTeamRecord` のみ使用（localStorage 直書きなし・新キーなし）。
 * 既存の簡易 select は MyTeamView 側に残る（このパネルは詳細確認用の追加導線）。
 */
export function MyTeamBuildPanel({
  worldCardId,
  card,
  teamCardId,
  onClose,
}: {
  worldCardId: string;
  card: WorldPlayerListItem | null;
  teamCardId: string;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<MyTeamRecord | null>(() => getMyTeamRecord(teamCardId));
  const [builds, setBuilds] = useState<SavedBuild[]>(() => listBuilds(worldCardId));
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [confirmClear, setConfirmClear] = useState<{
    field: MyTeamBuildClearField;
    buildId: string | null;
    name: string;
  } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tmb = (k: keyof Dictionary["myTeamBuildPanel"]) => t("myTeamBuildPanel", k);
  const fillMb = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const OWNERSHIP_LABELS = useOwnershipLabels();
  const USAGE_LABELS = useUsageLabels();

  const reload = useCallback(() => {
    setRecord(getMyTeamRecord(teamCardId));
    setBuilds(listBuilds(worldCardId));
    setStale(false);
  }, [teamCardId, worldCardId]);

  // 別タブ更新（My Team / 保存ビルド）: 通知のみ・自動リロードしない・パネルを閉じない・検索を消さない
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key == null || e.key === MY_TEAM_STORAGE_KEY || e.key === BUILD_STORAGE_KEY) setStale(true);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  function flash(msg: string) {
    setNotice(msg);
    setErrorNotice(null);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }
  function flashError(msg: string) {
    setErrorNotice(msg);
    setNotice(null);
  }

  const name = resolvePlayerDisplayName(
    card ?? {},
    locale,
    fillMb(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: worldCardId }),
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

  const refs = useMemo(() => resolveMyTeamBuildRefs(record, builds), [record, builds]);
  const nq = useMemo(() => normalizeBuildSearchQuery(q), [q]);
  const visible = useMemo(() => {
    const filtered = builds.filter((b) => matchesBuildSearch(b, card, nq));
    return sortMyTeamBuildPanel(filtered, {
      selectedBuildId: record?.selectedBuildId ?? null,
      favoriteBuildId: record?.favoriteBuildId ?? null,
    });
  }, [builds, card, nq, record]);

  const detailHref = `/players/world/${encodeURIComponent(worldCardId)}`;

  function assign(build: SavedBuild, field: "selectedBuildId" | "favoriteBuildId") {
    const rec = getMyTeamRecord(teamCardId);
    const stored = getBuild(worldCardId, build.buildId);
    const input = { build, record: rec, storedBuild: stored, storageAvailable: isMyTeamStorageAvailable() };
    const v = field === "selectedBuildId"
      ? validateMyTeamBuildAssignment(input)
      : validateMyTeamFavoriteBuildAssignment(input);
    if (!v.ok) {
      flashError(v.error);
      reload();
      return;
    }
    const already =
      field === "selectedBuildId"
        ? rec?.selectedBuildId === build.buildId
        : rec?.favoriteBuildId === build.buildId;
    if (already) {
      flash(field === "selectedBuildId" ? tmb("alreadySelectedNotice") : tmb("alreadyFavoriteNotice"));
      return;
    }
    const r = updateMyTeamRecord(
      v.teamCardId,
      field === "selectedBuildId" ? { selectedBuildId: build.buildId } : { favoriteBuildId: build.buildId },
    );
    if (!r.ok) {
      flashError(fillMb(tmb("setFailedTemplate"), { error: r.error ?? tmb("unknownError") }));
      return;
    }
    reload();
    flash(
      fillMb(field === "selectedBuildId" ? tmb("setSelectedSuccessTemplate") : tmb("setFavoriteSuccessTemplate"), {
        name: build.buildName,
      }),
    );
  }

  function doClear() {
    if (!confirmClear) return;
    const { field, buildId } = confirmClear;
    const rec = getMyTeamRecord(teamCardId);
    const v = validateMyTeamBuildRefClear({
      record: rec,
      teamCardId,
      field,
      currentBuildId: buildId,
      storageAvailable: isMyTeamStorageAvailable(),
    });
    setConfirmClear(null);
    if (!v.ok) {
      flashError(v.error);
      reload();
      return;
    }
    const r = updateMyTeamRecord(
      v.teamCardId,
      field === "selectedBuildId" ? { selectedBuildId: null } : { favoriteBuildId: null },
    );
    if (!r.ok) {
      flashError(fillMb(tmb("clearFailedTemplate"), { error: r.error ?? tmb("unknownError") }));
      return;
    }
    reload();
    flash(field === "selectedBuildId" ? tmb("clearSelectedSuccess") : tmb("clearFavoriteSuccess"));
  }

  const storageUnavailable = !isMyTeamStorageAvailable();

  return (
    <Modal open onClose={onClose} title={tmb("modalTitle")} size="lg">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-2xs text-text-dim">{tmb("intro")}</p>

        {/* 対象カード */}
        <div className="flex gap-2.5">
          <Link href={detailHref} className="w-14 shrink-0" aria-label={fillMb(tmb("cardDetailAriaTemplate"), { name })}>
            <WorldCardImage
              sources={sources}
              alt={card ? fillMb(tmb("cardImageAltTemplate"), { name }) : tmb("cardImageAltGeneric")}
              size="card"
            />
          </Link>
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{name}</p>
            <p className="text-text-muted">{card?.nameEn ?? `ID ${worldCardId}`}</p>
            <p className="mt-0.5 text-text-dim">
              {card?.cardType ?? tmb("cardTypeUnknown")} / {card?.registeredPosition ?? tmb("registeredPositionUnknown")} / World ID{" "}
              {worldCardId}
            </p>
          </div>
        </div>

        {/* 現在の設定 */}
        <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs">
          <p className="font-semibold text-text-dim">{tmb("currentSettingsHeading")}</p>
          <ul className="mt-1 space-y-0.5">
            <li>
              {tmb("selectedBuildLabel")}
              {refs.selected.buildId == null ? (
                <span className="text-text-muted">{tmb("noneLabel")}</span>
              ) : refs.selected.missing ? (
                <span className="text-warning">
                  {fillMb(tmb("selectedMissingTemplate"), { id: String(refs.selected.buildId) })}
                </span>
              ) : (
                <span>
                  <b>{refs.selected.build?.buildName}</b>
                  <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: String(refs.selected.buildId) })}</span>
                </span>
              )}
              {refs.selected.buildId != null ? (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClear({
                      field: "selectedBuildId",
                      buildId: refs.selected.buildId,
                      name: refs.selected.build?.buildName ?? tmb("deletedBuildFallback"),
                    })
                  }
                  className="ml-2 rounded border border-border px-1.5 py-0.5 hover:border-accent"
                >
                  {tmb("clearSelectedButton")}
                </button>
              ) : null}
            </li>
            <li>
              {tmb("favoriteBuildLabel")}
              {refs.favorite.buildId == null ? (
                <span className="text-text-muted">{tmb("noneLabel")}</span>
              ) : refs.favorite.missing ? (
                <span className="text-warning">
                  {fillMb(tmb("favoriteMissingTemplate"), { id: String(refs.favorite.buildId) })}
                </span>
              ) : (
                <span>
                  <b>{refs.favorite.build?.buildName}</b>
                  <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: String(refs.favorite.buildId) })}</span>
                </span>
              )}
              {refs.favorite.buildId != null ? (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClear({
                      field: "favoriteBuildId",
                      buildId: refs.favorite.buildId,
                      name: refs.favorite.build?.buildName ?? tmb("deletedBuildFallback"),
                    })
                  }
                  className="ml-2 rounded border border-border px-1.5 py-0.5 hover:border-accent"
                >
                  {tmb("clearFavoriteButton")}
                </button>
              ) : null}
            </li>
            <li className="text-text-dim">
              {fillMb(tmb("ownershipUsageTemplate"), {
                ownership: record ? OWNERSHIP_LABELS[record.ownershipStatus] : tmb("unknownValuePlaceholder"),
                usage: record ? USAGE_LABELS[record.usageStatus] : tmb("unknownValuePlaceholder"),
              })}
            </li>
            <li className="text-text-muted">{fillMb(tmb("savedBuildCountTemplate"), { count: String(builds.length) })}</li>
          </ul>
        </div>

        {storageUnavailable ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {tmb("storageUnavailable")}
          </p>
        ) : null}
        {stale ? (
          <div
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 rounded border border-info/40 bg-info/10 px-2 py-1 text-2xs text-info"
          >
            <Icon name="refresh" size={12} className="shrink-0" />
            <span>{tmb("staleNotice")}</span>
            <button type="button" onClick={reload} className="rounded border border-info/50 px-1.5 py-0.5 font-semibold">
              {tmb("reloadButton")}
            </button>
          </div>
        ) : null}
        {errorNotice ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {errorNotice}
          </p>
        ) : null}
        {notice ? (
          <p aria-live="polite" className="rounded border border-accent/40 bg-accent-soft/40 px-2 py-1 text-2xs text-accent">
            {notice}
          </p>
        ) : null}

        {confirmClear ? (
          <div
            role="alertdialog"
            aria-label={tmb("confirmClearAria")}
            className="rounded border border-warning/50 bg-warning/10 p-2 text-2xs"
          >
            <p>
              {fillMb(tmb("confirmClearTextTemplate"), {
                field: confirmClear.field === "selectedBuildId" ? tmb("selectedBuildNoun") : tmb("favoriteBuildNoun"),
                name: confirmClear.name,
                fieldKey: confirmClear.field,
              })}
            </p>
            <p className="mt-0.5 text-text-dim">
              {fillMb(tmb("confirmClearUnchangedTemplate"), {
                otherField: confirmClear.field === "selectedBuildId" ? tmb("favoriteBuildNoun") : tmb("selectedBuildNoun"),
              })}
            </p>
            <div className="mt-1 flex gap-2">
              <Button variant="primary" size="sm" onClick={doClear}>
                {tmb("confirmClearButton")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(null)}>
                {tmb("cancelButton")}
              </Button>
            </div>
          </div>
        ) : null}

        {/* 保存ビルド一覧 */}
        {builds.length === 0 ? (
          <div className="rounded border border-border bg-surface-2/30 p-3 text-2xs">
            <p className="text-sm font-semibold">{tmb("emptyBuildsHeading")}</p>
            <p className="mt-1 text-text-dim">{tmb("emptyBuildsBody")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Link
                href={detailHref}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="players" size={12} />
                {tmb("playerDetailLink")}
              </Link>
              <Link
                href={`${detailHref}?tab=progression`}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="sliders" size={12} />
                {tmb("progressionTabLink")}
              </Link>
              <Link
                href={`/compare?ids=${encodeURIComponent(worldCardId)}`}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="compare" size={12} />
                {tmb("compareLink")}
              </Link>
              <Link
                href="/my-builds"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="sliders" size={12} />
                {tmb("myBuildsLink")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tmb("searchLabel")}
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tmb("searchPlaceholder")}
                aria-label={tmb("searchAriaLabel")}
                className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </label>

            {visible.length === 0 ? (
              <p className="text-2xs text-text-muted">{tmb("noSearchResults")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visible.map((b) => (
                  <BuildRow
                    key={b.buildId}
                    build={b}
                    card={card}
                    isSelected={record?.selectedBuildId === b.buildId}
                    isFavorite={record?.favoriteBuildId === b.buildId}
                    disabled={storageUnavailable}
                    onSetSelected={() => assign(b, "selectedBuildId")}
                    onSetFavorite={() => assign(b, "favoriteBuildId")}
                    onClearSelected={() =>
                      setConfirmClear({ field: "selectedBuildId", buildId: b.buildId, name: b.buildName })
                    }
                    onClearFavorite={() =>
                      setConfirmClear({ field: "favoriteBuildId", buildId: b.buildId, name: b.buildName })
                    }
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {/* 補助操作 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-2xs">
          <Link
            href="/my-builds"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
          >
            <Icon name="sliders" size={12} />
            {tmb("manageInMyBuilds")}
          </Link>
          <Link
            href={`${detailHref}?tab=progression`}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
          >
            <Icon name="sliders" size={12} />
            {tmb("createBuildInProgression")}
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
            {tmb("closeButton")}
          </Button>
        </div>
        <p className="text-[9px] text-text-muted">{tmb("footerNote")}</p>
      </div>
    </Modal>
  );
}

function BuildRow({
  build,
  card,
  isSelected,
  isFavorite,
  disabled,
  onSetSelected,
  onSetFavorite,
  onClearSelected,
  onClearFavorite,
}: {
  build: SavedBuild;
  card: WorldPlayerListItem | null;
  isSelected: boolean;
  isFavorite: boolean;
  disabled: boolean;
  onSetSelected: () => void;
  onSetFavorite: () => void;
  onClearSelected: () => void;
  onClearFavorite: () => void;
}) {
  const t = useT();
  const tmb = (k: keyof Dictionary["myTeamBuildPanel"]) => t("myTeamBuildPanel", k);
  const fillMb = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const rule = resolveBuildRuleStatus(build.rulesVersion);
  const ruleLabel = rule.isV2 ? t("buildUsage", "ruleCurrentLabel") : rule.isLegacy ? t("buildUsage", "ruleLegacyLabel") : t("buildUsage", "ruleUnknownLabel");
  const points = buildPointSummary(build, card?.maximumLevel ?? null);
  const pom = describeBuildPoM(build);
  const activeRows = buildAllocationRows(build.progressionAllocation).filter((r) => r.level > 0);
  const allRows = buildAllocationRows(build.progressionAllocation);
  const hasExperimental = buildHasExperimental(build);
  const pointsText =
    points.totalPoints == null
      ? fillMb(tmb("pointsUsedNoTotalTemplate"), { used: String(points.usedPoints) })
      : fillMb(tmb("pointsUsedTotalTemplate"), { used: String(points.usedPoints), total: String(points.totalPoints) });
  const remainingText =
    points.remainingPoints == null ? tmb("remainingUnknown") : fillMb(tmb("remainingTemplate"), { remaining: String(points.remainingPoints) });

  return (
    <li className="rounded border border-border bg-surface p-2 text-2xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold">{build.buildName}</span>
        <Badge tone={rule.isV2 ? "neutral" : "warning"} size="xs">
          {ruleLabel}
        </Badge>
        {isSelected ? (
          <Badge tone="accent" size="xs">
            {tmb("selectedBadge")}
          </Badge>
        ) : null}
        {isFavorite ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-yellow-400/15 px-1 py-0.5 text-[9px] font-semibold text-yellow-300">
            <Icon name="star" size={10} />
            {tmb("favoriteBadge")}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-text-muted">
        buildId {build.buildId} · rulesVersion {build.rulesVersion}
      </p>
      <p className="mt-0.5 text-text-dim">
        {tmb("allocationRowLabel")}
        {activeRows.length > 0
          ? activeRows.map((r) => `${r.label} Lv${r.level}`).join(" / ")
          : tmb("noAllocationBase")}
      </p>
      <details className="mt-0.5">
        <summary className="cursor-pointer text-text-muted hover:text-text">{tmb("allAllocationSummary")}</summary>
        <ul className="mt-0.5 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
          {allRows.map((r) => (
            <li key={r.groupId} className={r.level > 0 ? "text-text" : "text-text-muted"}>
              {r.label}: Lv {r.level}
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-0.5 text-text-dim">
        <span className="tabular-nums">{pointsText}</span>
        <span className="ml-2 tabular-nums">{remainingText}</span>
        {points.overAllocated ? <span className="ml-2 text-danger">{tmb("overAllocated")}</span> : null}
      </p>
      <p className="mt-0.5 text-text-dim">
        {tmb("pomRowLabel")}
        {pom.has ? pom.tierLabel : tmb("pomUnspecified")}
        {tmb("experimentalLabel")}
        {hasExperimental ? tmb("yes") : tmb("no")}
      </p>
      <p className="mt-0.5 text-text-dim">
        {tmb("estimatedOvrLabel")}
        {build.calculatedOvr ?? "—"}（
        {build.calculationMode === "confirmed"
          ? tmb("calcModeConfirmed")
          : build.calculationMode === "unsupported"
            ? tmb("calcModeUnsupported")
            : tmb("calcModeProvisional")}
        ）
      </p>
      <p className="mt-0.5 text-text-muted">{tmb("totalOvrPlaceholder")}</p>
      <p className="mt-0.5 text-text-muted">
        {fillMb(tmb("createdUpdatedTemplate"), {
          created: formatBuildTimestamp(build.createdAt),
          updated: formatBuildTimestamp(build.updatedAt),
        })}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {isSelected ? (
          <button
            type="button"
            onClick={onClearSelected}
            disabled={disabled}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent disabled:opacity-50"
          >
            {tmb("clearSelectedButton")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSetSelected}
            disabled={disabled}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-accent disabled:opacity-50"
          >
            <Icon name="check" size={12} />
            {tmb("setSelectedButton")}
          </button>
        )}
        {isFavorite ? (
          <button
            type="button"
            onClick={onClearFavorite}
            disabled={disabled}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent disabled:opacity-50"
          >
            {tmb("clearFavoriteButton")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSetFavorite}
            disabled={disabled}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-accent disabled:opacity-50"
          >
            <Icon name="star" size={12} />
            {tmb("setFavoriteButton")}
          </button>
        )}
      </div>
    </li>
  );
}
