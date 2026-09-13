"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SavedBuild } from "@/lib/progression/types";
import type { SquadPlayerDisplay } from "@/lib/squad/types";
import { SQUAD_STORAGE_KEY } from "@/lib/squad/types";
import { getBuild, isBuildStorageAvailable, listBuilds, getActiveBuildsStorageKey } from "@/lib/progression/build-storage";
import { isSquadStorageAvailable } from "@/lib/squad/squad-storage";
import { useStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { setCurrentScope, subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import {
  buildAllocationRows,
  buildHasExperimental,
  buildPointSummary,
  describeBuildPoM,
  formatBuildTimestamp,
  matchesBuildSearch,
  normalizeBuildSearchQuery,
  resolveBuildRef,
  resolveBuildRuleStatus,
  sortMyTeamBuildPanel,
  validateSquadBuildAssignment,
} from "@/lib/progression/my-builds";
import { resolveCardImageSources } from "@/lib/world/image";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * スカッド編集画面の「保存ビルドを選ぶ」パネル。対象スカッドの特定の枠（先発 slot / ベンチ sub）の
 * `savedBuildId` を、保存ビルドの内容を確認しながら安全に設定・解除する。
 * - My Team の `selectedBuildId` / `favoriteBuildId` は変更しない（別系統）。
 * - 対象枠の `savedBuildId` 以外（座標・配置・キャプテン・セットプレー・監督・他枠・他スカッド）は変更しない。
 * - 更新は SquadEditor の `patch`（対象枠 1 件のみ）経由。既存の自動保存が永続化する。既存 select は残す。
 */
export function SquadBuildPanel({
  squadId,
  squadName,
  areaLabel,
  slotLabel,
  worldCardId,
  card,
  currentSavedBuildId,
  currentSlotWorldCardId,
  slotExists,
  onSet,
  onClear,
  onRequestReload,
  onClose,
}: {
  squadId: string;
  squadName: string;
  /** 「先発」/「ベンチ」 */
  areaLabel: string;
  /** 「CF」/「ベンチ 2」など */
  slotLabel: string;
  worldCardId: string;
  card: SquadPlayerDisplay | null;
  currentSavedBuildId: string | null;
  /** 編集中スカッド state から見た対象枠の現在のカード（別タブでの入れ替え検出用）。 */
  currentSlotWorldCardId: string | null;
  slotExists: boolean;
  /** buildId を対象枠の savedBuildId へ設定（SquadEditor が対象枠 1 件のみ patch）。 */
  onSet: (buildId: string) => void;
  /** 対象枠の savedBuildId を null へ。 */
  onClear: () => void;
  /** 別タブ更新後に編集中スカッドを storage から読み直す。 */
  onRequestReload: () => void;
  onClose: () => void;
}) {
  // スカッド自体はブラウザー共通のままだが、パネルが表示する保存ビルドはアカウント別領域の
  // ものになったため、このパネル自身がスコープを解決してストレージモジュールへ伝える
  // (スカッド編集画面はMy Team/My Builds/お気に入りのいずれも経由せず開ける可能性があるため)。
  const scopeState = useStorageScope();
  useEffect(() => {
    setCurrentScope(scopeState.status === "resolved" ? scopeState.scope : null);
  }, [scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopeLoading = scopeState.status === "loading";

  const [builds, setBuilds] = useState<SavedBuild[]>(() => listBuilds(worldCardId));
  const [q, setQ] = useState("");
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "set"; build: SavedBuild } | { kind: "clear" } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: keyof Dictionary["squadBuildPanel"]) => t("squadBuildPanel", k);
  const fill = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const errorMessageFor = (code: string) =>
    code === "storage"
      ? tp("errorStorage")
      : code === "card-mismatch"
        ? tp("errorCardMismatch")
        : code === "slot-missing"
          ? tp("errorSlotMissing")
          : code === "build-id"
            ? tp("errorBuildId")
            : tp("errorBuildMissing");

  const reloadBuilds = useCallback(() => {
    if (scopeState.status === "loading") return; // 認証確認中はMy Buildsを読み書きしない
    setBuilds(listBuilds(worldCardId));
    setStale(false);
  }, [worldCardId, scopeState.status]);

  useEffect(() => {
    reloadBuilds();
  }, [reloadBuilds]);

  // アカウント切り替え時は、直前スコープの一覧を即座に破棄して新スコープへ切り替える。
  useEffect(() => subscribeCurrentScope(reloadBuilds), [reloadBuilds]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key == null || e.key === SQUAD_STORAGE_KEY || e.key === getActiveBuildsStorageKey()) setStale(true);
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

  const name = resolvePlayerDisplayName(card ?? {}, locale, fill(tp("cardFallbackNameTemplate"), { id: worldCardId }));
  const sources = card
    ? resolveCardImageSources({
        worldCardId,
        efhubCardId: card.efhubCardId,
        hasEfhubLink: card.hasEfhubLink,
        hasWorldImage: card.imageUrlCandidate != null,
        hasWorldMobileImage: card.mobileImageUrlCandidate != null,
      })
    : [];

  const ref = useMemo(() => resolveBuildRef(currentSavedBuildId, builds), [currentSavedBuildId, builds]);
  const nq = useMemo(() => normalizeBuildSearchQuery(q), [q]);
  const visible = useMemo(() => {
    const filtered = builds.filter((b) => matchesBuildSearch(b, null, nq));
    return sortMyTeamBuildPanel(filtered, { selectedBuildId: currentSavedBuildId, favoriteBuildId: null });
  }, [builds, nq, currentSavedBuildId]);

  const detailHref = `/players/world/${encodeURIComponent(worldCardId)}`;
  const storageOk = isSquadStorageAvailable() && isBuildStorageAvailable();

  function runValidate(targetBuildId: string | null) {
    return validateSquadBuildAssignment({
      storageAvailable: storageOk,
      slotExists,
      slotWorldCardId: currentSlotWorldCardId,
      expectedWorldCardId: worldCardId,
      currentSavedBuildId,
      targetBuildId,
      storedBuild: targetBuildId != null ? getBuild(worldCardId, targetBuildId) : null,
    });
  }

  function doSet(build: SavedBuild) {
    setConfirm(null);
    const v = runValidate(build.buildId);
    if (!v.ok) {
      flashError(errorMessageFor(v.code));
      return;
    }
    if (!v.changed) {
      flash(tp("alreadyUsingNotice"));
      return;
    }
    onSet(build.buildId);
    flash(fill(tp("setSuccessTemplate"), { area: areaLabel, slot: slotLabel, buildName: build.buildName }));
  }

  function doClear() {
    setConfirm(null);
    const v = runValidate(null);
    if (!v.ok) {
      flashError(errorMessageFor(v.code));
      return;
    }
    if (!v.changed) {
      flash(tp("alreadyUnsetNotice"));
      return;
    }
    onClear();
    flash(fill(tp("clearSuccessTemplate"), { area: areaLabel, slot: slotLabel }));
  }

  return (
    <Modal open onClose={onClose} title={tp("modalTitle")} size="lg">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-2xs text-text-dim">{tp("intro")}</p>
        {scopeLoading ? <p className="text-2xs text-info">{tp("scopeLoadingNotice")}</p> : null}

        {/* 対象枠 */}
        <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs">
          <p className="font-semibold text-text-dim">{tp("targetHeading")}</p>
          <p className="mt-0.5">
            {tp("targetSquadLabel")}
            <b>{squadName}</b>
            <span className="ml-1 text-text-muted">（{squadId}）</span>
          </p>
          <p className="mt-0.5">
            {tp("targetSlotLabel")}
            <b>{areaLabel}</b> ・ {slotLabel}
          </p>
        </div>

        {/* 対象カード */}
        <div className="flex gap-2.5">
          <Link href={detailHref} className="w-14 shrink-0" aria-label={fill(tp("cardDetailAriaTemplate"), { name })}>
            <WorldCardImage
              sources={sources}
              alt={card ? fill(tp("cardImageAltTemplate"), { name }) : tp("cardImageAltGeneric")}
              size="card"
            />
          </Link>
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{name}</p>
            <p className="text-text-muted">{card?.nameEn ?? `ID ${worldCardId}`}</p>
            <p className="mt-0.5 text-text-dim">
              {card?.cardType ?? tp("cardTypeUnknown")} / {card?.registeredPosition ?? tp("registeredPositionUnknown")} / World ID{" "}
              {worldCardId}
            </p>
          </div>
        </div>

        {/* 現在のスカッド用ビルド */}
        <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs">
          <p>
            {tp("currentBuildLabel")}
            {ref.buildId == null ? (
              <span className="text-text-muted">{tp("noneLabel")}</span>
            ) : ref.missing ? (
              <span className="text-warning">{fill(tp("missingBuildTemplate"), { id: String(ref.buildId) })}</span>
            ) : (
              <span>
                <b>{ref.build?.buildName}</b>
                <span className="ml-1 text-text-muted">{fill(tp("buildIdSuffixTemplate"), { id: String(ref.buildId) })}</span>
              </span>
            )}
            {ref.buildId != null ? (
              <button
                type="button"
                onClick={() => setConfirm({ kind: "clear" })}
                className="ml-2 rounded border border-border px-1.5 py-0.5 hover:border-accent"
              >
                {tp("clearSelectionButton")}
              </button>
            ) : null}
          </p>
          <p className="mt-0.5 text-text-muted">{fill(tp("savedBuildCountTemplate"), { count: String(builds.length) })}</p>
        </div>

        {!storageOk ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {tp("storageUnavailable")}
          </p>
        ) : null}
        {stale ? (
          <div
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 rounded border border-info/40 bg-info/10 px-2 py-1 text-2xs text-info"
          >
            <Icon name="refresh" size={12} className="shrink-0" />
            <span>{tp("staleNotice")}</span>
            <button
              type="button"
              onClick={() => {
                reloadBuilds();
                onRequestReload();
              }}
              className="rounded border border-info/50 px-1.5 py-0.5 font-semibold"
            >
              {tp("reloadButton")}
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

        {/* 確認 */}
        {confirm ? (
          <div role="alertdialog" aria-label={tp("confirmDialogAria")} className="rounded border border-warning/50 bg-warning/10 p-2 text-2xs">
            {confirm.kind === "clear" ? (
              <>
                <p>
                  {fill(tp("confirmClearTextTemplate"), { area: areaLabel, slot: slotLabel, name, worldCardId })}
                </p>
                <ul className="mt-0.5 list-disc pl-4 text-text-dim">
                  <li>{tp("clearChangedItemsLabel")}</li>
                  <li>{tp("clearUnchangedItemsLabel")}</li>
                </ul>
              </>
            ) : (
              <>
                <p>{tp("confirmSetIntro")}</p>
                <div className="mt-1 rounded border border-border/60 bg-surface p-1.5">
                  <p>
                    {tp("currentPrefixLabel")}
                    {ref.buildId == null ? (
                      <span className="text-text-muted">{tp("noneLabel")}</span>
                    ) : ref.missing ? (
                      <span className="text-warning">{fill(tp("deletedTemplate"), { id: String(ref.buildId) })}</span>
                    ) : (
                      <span>
                        {ref.build?.buildName}
                        <span className="ml-1 text-text-muted">{fill(tp("buildIdSuffixTemplate"), { id: String(ref.buildId) })}</span>
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5">
                    {tp("afterChangeLabel")}
                    <b>{confirm.build.buildName}</b>
                    <span className="ml-1 text-text-muted">{fill(tp("buildIdSuffixTemplate"), { id: confirm.build.buildId })}</span>
                  </p>
                  <p className="mt-0.5 text-text-dim">
                    {fill(tp("ruleVersionTemplate"), {
                      version: confirm.build.rulesVersion ?? "",
                      label: resolveBuildRuleStatus(confirm.build.rulesVersion).isV2
                        ? t("buildUsage", "ruleCurrentLabel")
                        : resolveBuildRuleStatus(confirm.build.rulesVersion).isLegacy
                          ? t("buildUsage", "ruleLegacyLabel")
                          : t("buildUsage", "ruleUnknownLabel"),
                    })}
                    {tp("allocationLabel")}
                    {buildAllocationRows(confirm.build.progressionAllocation)
                      .filter((r) => r.level > 0)
                      .map((r) => `${r.label} Lv${r.level}`)
                      .join(" / ") || tp("noAllocation")}
                    {tp("pomLabel")}
                    {describeBuildPoM(confirm.build).has ? describeBuildPoM(confirm.build).tierLabel : tp("pomUnspecified")}
                  </p>
                </div>
                <ul className="mt-1 list-disc pl-4 text-text-dim">
                  <li>{tp("setChangedItemsLabel")}</li>
                  <li>{tp("setUnchangedItemsLabel")}</li>
                </ul>
                <p className="mt-0.5 text-text-muted">{tp("setFooterNote")}</p>
              </>
            )}
            <div className="mt-1 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => (confirm.kind === "clear" ? doClear() : doSet(confirm.build))}
              >
                {confirm.kind === "clear" ? tp("confirmClearButton") : tp("confirmSetButton")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                {tp("cancelButton")}
              </Button>
            </div>
          </div>
        ) : null}

        {/* 一覧 */}
        {builds.length === 0 ? (
          <div className="rounded border border-border bg-surface-2/30 p-3 text-2xs">
            <p className="text-sm font-semibold">{tp("emptyBuildsHeading")}</p>
            <p className="mt-1 text-text-dim">{tp("emptyBuildsBody")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Link
                href={detailHref}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="players" size={12} />
                {tp("playerDetailLink")}
              </Link>
              <Link
                href={`${detailHref}?tab=progression`}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="sliders" size={12} />
                {tp("progressionTabLink")}
              </Link>
              <Link
                href="/my-builds"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="sliders" size={12} />
                {tp("myBuildsLink")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tp("searchLabel")}
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tp("searchPlaceholder")}
                aria-label={tp("searchAriaLabel")}
                className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </label>
            {visible.length === 0 ? (
              <p className="text-2xs text-text-muted">{tp("noSearchResults")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visible.map((b) => (
                  <SquadBuildRow
                    key={b.buildId}
                    build={b}
                    maximumLevel={card?.maximumLevel ?? null}
                    inUse={currentSavedBuildId === b.buildId}
                    disabled={!storageOk}
                    onUse={() => setConfirm({ kind: "set", build: b })}
                    onStopUse={() => setConfirm({ kind: "clear" })}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-2xs">
          <Link
            href="/my-builds"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
          >
            <Icon name="sliders" size={12} />
            {tp("manageInMyBuilds")}
          </Link>
          <Link
            href={`${detailHref}?tab=progression`}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
          >
            <Icon name="sliders" size={12} />
            {tp("createBuildInProgression")}
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
            {tp("closeButton")}
          </Button>
        </div>
        <p className="text-[9px] text-text-muted">{tp("footerNote")}</p>
      </div>
    </Modal>
  );
}

function SquadBuildRow({
  build,
  maximumLevel,
  inUse,
  disabled,
  onUse,
  onStopUse,
}: {
  build: SavedBuild;
  maximumLevel: number | null;
  inUse: boolean;
  disabled: boolean;
  onUse: () => void;
  onStopUse: () => void;
}) {
  const t = useT();
  const tp = (k: keyof Dictionary["squadBuildPanel"]) => t("squadBuildPanel", k);
  const fill = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const rule = resolveBuildRuleStatus(build.rulesVersion);
  const ruleLabel = rule.isV2 ? t("buildUsage", "ruleCurrentLabel") : rule.isLegacy ? t("buildUsage", "ruleLegacyLabel") : t("buildUsage", "ruleUnknownLabel");
  const points = buildPointSummary(build, maximumLevel);
  const pom = describeBuildPoM(build);
  const activeRows = buildAllocationRows(build.progressionAllocation).filter((r) => r.level > 0);
  const allRows = buildAllocationRows(build.progressionAllocation);
  const hasExperimental = buildHasExperimental(build);
  const pointsText =
    points.totalPoints == null
      ? fill(tp("pointsUsedNoTotalTemplate"), { used: String(points.usedPoints) })
      : fill(tp("pointsUsedTotalTemplate"), { used: String(points.usedPoints), total: String(points.totalPoints) });
  const remainingText =
    points.remainingPoints == null ? tp("remainingUnknown") : fill(tp("remainingTemplate"), { remaining: String(points.remainingPoints) });

  return (
    <li className="rounded border border-border bg-surface p-2 text-2xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold">{build.buildName}</span>
        <Badge tone={rule.isV2 ? "neutral" : "warning"} size="xs">
          {ruleLabel}
        </Badge>
        {inUse ? (
          <Badge tone="accent" size="xs">
            {tp("inUseBadge")}
          </Badge>
        ) : null}
      </div>
      <p className="mt-0.5 text-text-muted">
        buildId {build.buildId} · rulesVersion {build.rulesVersion}
      </p>
      <p className="mt-0.5 text-text-dim">
        {tp("allocationRowLabel")}
        {activeRows.length > 0
          ? activeRows.map((r) => `${r.label} Lv${r.level}`).join(" / ")
          : tp("noAllocationBase")}
      </p>
      <details className="mt-0.5">
        <summary className="cursor-pointer text-text-muted hover:text-text">{tp("allAllocationSummary")}</summary>
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
        {points.overAllocated ? <span className="ml-2 text-danger">{tp("overAllocated")}</span> : null}
      </p>
      <p className="mt-0.5 text-text-dim">
        {tp("pomRowLabel")}
        {pom.has ? pom.tierLabel : tp("pomUnspecified")}
        {tp("experimentalLabel")}
        {hasExperimental ? tp("yes") : tp("no")}
      </p>
      <p className="mt-0.5 text-text-dim">
        {tp("estimatedOvrLabel")}
        {build.calculatedOvr ?? "—"}（
        {build.calculationMode === "confirmed"
          ? tp("calcModeConfirmed")
          : build.calculationMode === "unsupported"
            ? tp("calcModeUnsupported")
            : tp("calcModeProvisional")}
        ）
      </p>
      <p className="mt-0.5 text-text-muted">{tp("totalOvrPlaceholder")}</p>
      <p className="mt-0.5 text-text-muted">
        {fill(tp("createdUpdatedTemplate"), {
          created: formatBuildTimestamp(build.createdAt),
          updated: formatBuildTimestamp(build.updatedAt),
        })}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {inUse ? (
          <button
            type="button"
            onClick={onStopUse}
            disabled={disabled}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent disabled:opacity-50"
          >
            {tp("clearSelectionButton")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onUse}
            disabled={disabled}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-accent disabled:opacity-50"
          >
            <Icon name="check" size={12} />
            {tp("useThisBuild")}
          </button>
        )}
      </div>
    </li>
  );
}
