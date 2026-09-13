"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SavedBuild } from "@/lib/progression/types";
import {
  isBuildStorageAvailable,
  listAllBuilds,
  getBuild,
  renameBuild,
  duplicateBuild,
  deleteBuild,
  getActiveBuildsStorageKey,
} from "@/lib/progression/build-storage";
import { subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { listSquads } from "@/lib/squad/squad-storage";
import { findSquadUsageByWorldCardId, type SquadUsage } from "@/lib/squad/usage";
import { useMyTeam } from "@/lib/user-cards/hooks";
import {
  addToMyTeam,
  getActiveMyTeamStorageKey,
  getMyTeamByWorldId,
  updateMyTeamRecord,
  isMyTeamStorageAvailable,
} from "@/lib/user-cards/my-team-storage";
import {
  OWNERSHIP_LABELS,
  OWNERSHIP_STATUSES,
  USAGE_LABELS,
  USAGE_STATUSES,
} from "@/lib/user-cards/types";
import type { MyTeamRecord, OwnershipStatus, UsageStatus } from "@/lib/user-cards/types";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import {
  buildFacets,
  buildUsageSummary,
  collectUsedBuildIds,
  filterBuilds,
  nextDuplicateBuildName,
  sortBuilds,
  validateBuildRename,
  resolveMyTeamBuildSelectionState,
  validateMyTeamBuildAssignment,
  validateMyTeamFavoriteBuildAssignment,
  validateMyTeamFavoriteBuildClear,
  describeMyTeamBuildChange,
  describeMyTeamFavoriteBuildChange,
  validateMyTeamRegistration,
  buildMyTeamRegistrationPreview,
  buildAllocationRows,
  buildPointSummary,
  resolveBuildRuleStatus,
  describeBuildPoM,
  buildHasExperimental,
  resolveSafeOwnershipDefault,
  resolveSafeUsageDefault,
  BUILD_SORT_KEYS,
  DEFAULT_BUILD_FILTER,
  type BuildFilterState,
  type BuildSortKey,
  type MyTeamRegistrationOptions,
} from "@/lib/progression/my-builds";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { MyBuildCard } from "./MyBuildCard";
import { BuildExportLauncher } from "./BuildExportModal";
import { BuildImportLauncher } from "./BuildImportModal";
import { DuplicateReviewTeaser } from "./DuplicateReviewTeaser";
import { LocalStorageNotice } from "@/components/user-cards/LocalStorageNotice";
import { ConfirmDialog } from "@/components/user-cards/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Surface } from "@/components/ui/Surface";
import { Modal } from "@/components/ui/Overlay";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useOwnershipLabels, useUsageLabels } from "@/components/user-cards/UserCardTile";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

function useSortLabels(): Record<BuildSortKey, string> {
  const t = useT();
  const key = (k: keyof Dictionary["myBuildsView"]) => t("myBuildsView", k);
  return {
    updated_desc: key("sortUpdatedDesc"),
    updated_asc: key("sortUpdatedAsc"),
    created_desc: key("sortCreatedDesc"),
    created_asc: key("sortCreatedAsc"),
    name_asc: key("sortNameAsc"),
    player_asc: key("sortPlayerAsc"),
  };
}

function useRuleLabel() {
  const t = useT();
  return (isV2: boolean, isLegacy: boolean) =>
    isV2 ? t("buildUsage", "ruleCurrentLabel") : isLegacy ? t("buildUsage", "ruleLegacyLabel") : t("buildUsage", "ruleUnknownLabel");
}

export function MyBuildsView() {
  const t = useT();
  const { locale } = useLocale();
  const tmb = (k: keyof Dictionary["myBuildsView"]) => t("myBuildsView", k);
  const fillMb = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const SORT_LABEL = useSortLabels();
  const cardFallbackName = (id: string) => fillMb(t("squadBuildPanel", "cardFallbackNameTemplate"), { id });
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [available, setAvailable] = useState(true);
  const [stale, setStale] = useState(false);
  const [filter, setFilter] = useState<BuildFilterState>(DEFAULT_BUILD_FILTER);
  const [sort, setSort] = useState<BuildSortKey>("updated_desc");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [staleMyTeam, setStaleMyTeam] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SavedBuild | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedBuild | null>(null);
  const [registerTarget, setRegisterTarget] = useState<SavedBuild | null>(null);
  const [assignTarget, setAssignTarget] = useState<SavedBuild | null>(null);
  const [clearTarget, setClearTarget] = useState<SavedBuild | null>(null);
  const [favoriteTarget, setFavoriteTarget] = useState<SavedBuild | null>(null);
  const [clearFavoriteTarget, setClearFavoriteTarget] = useState<SavedBuild | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { myTeam, scopeStatus } = useMyTeam();

  const reload = useCallback(() => {
    if (scopeStatus === "loading") return; // 認証確認中はMy Buildsを読み書きしない
    setAvailable(isBuildStorageAvailable());
    setBuilds(listAllBuilds());
    setStale(false);
  }, [scopeStatus]);

  useEffect(() => {
    reload();
  }, [reload]);

  // アカウント切り替え(ログイン/ログアウト/A↔B)時は、直前スコープの一覧を即座に破棄して
  // 新スコープの内容へ切り替える(別タブのstorageイベントとは異なり、確認バナーを挟まない)。
  useEffect(() => {
    return subscribeCurrentScope(() => {
      setBuilds([]);
      reload();
    });
  }, [reload]);

  // 別タブ更新（保存ビルド / My Team の対象キーのみ監視・自動リロード/自動差し替えはしない）
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key == null || e.key === getActiveBuildsStorageKey()) setStale(true);
      if (e.key == null || e.key === getActiveMyTeamStorageKey()) setStaleMyTeam(true);
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

  const ids = useMemo(() => [...new Set(builds.map((b) => b.worldCardId))], [builds]);
  const { cards, loading: cardsLoading, error: cardsError } = useResolvedCards(ids);
  const myTeamByCard = useMemo(
    () => new Map(myTeam.map((r) => [r.worldCardId, r])),
    [myTeam],
  );

  // スカッド横断使用状況（client のみ・スカッド本体は変更しない）
  const [squadUsageByCard, setSquadUsageByCard] = useState<Map<string, SquadUsage[]>>(new Map());
  const idsKey = ids.join(",");
  useEffect(() => {
    const squads = listSquads();
    const m = new Map<string, SquadUsage[]>();
    for (const id of idsKey ? idsKey.split(",") : []) {
      m.set(id, findSquadUsageByWorldCardId(squads, id));
    }
    setSquadUsageByCard(m);
  }, [idsKey, builds]);

  const usedBuildIds = useMemo(
    () => collectUsedBuildIds(builds, myTeam, squadUsageByCard),
    [builds, myTeam, squadUsageByCard],
  );
  const facets = useMemo(() => buildFacets(builds, cards), [builds, cards]);
  const visible = useMemo(
    () => sortBuilds(filterBuilds(builds, { cards, filter, usedBuildIds }), cards, sort),
    [builds, cards, filter, usedBuildIds, sort],
  );

  const legacyCount = useMemo(
    () => builds.filter((b) => !usedBuildIds.has(b.buildId)).length,
    [builds, usedBuildIds],
  );

  function handleRename(name: string): string | null {
    if (!renameTarget) return tmb("renameTargetMissing");
    const v = validateBuildRename(name);
    if (!v.ok) return v.error;
    const r = renameBuild(renameTarget.worldCardId, renameTarget.buildId, v.name);
    if (!r.ok) return r.error;
    setRenameTarget(null);
    reload();
    flash(fillMb(tmb("renamedNoticeTemplate"), { name: v.name }));
    return null;
  }

  function handleDuplicate(build: SavedBuild) {
    const sameCardNames = builds.filter((b) => b.worldCardId === build.worldCardId).map((b) => b.buildName);
    const name = nextDuplicateBuildName(build.buildName, sameCardNames);
    const r = duplicateBuild(build.worldCardId, build.buildId, name);
    if (!r.ok) {
      flash(fillMb(tmb("duplicateFailedTemplate"), { error: r.error }));
      return;
    }
    reload();
    flash(fillMb(tmb("duplicatedNoticeTemplate"), { name: r.build.buildName }));
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const r = deleteBuild(deleteTarget.worldCardId, deleteTarget.buildId);
    if (!r.ok) {
      flash(fillMb(tmb("deleteFailedTemplate"), { error: r.error ?? tmb("unknownError") }));
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    reload();
    flash(tmb("deletedNotice"));
  }

  /**
   * My Team 未登録カードを、確認ダイアログの入力値で My Team へ新規登録する。
   * 既存 addToMyTeam のみ使用（localStorage 直書きしない）。favoriteBuildId は addToMyTeam が
   * 受け取れないため、指定時のみ登録成功後に updateMyTeamRecord を追加で呼ぶ（2 段階・approach B）。
   * 戻り値: エラー文字列（ダイアログ内表示用）／成功なら null（ダイアログは閉じ済み）。
   */
  function handleRegisterToMyTeam(build: SavedBuild, opts: MyTeamRegistrationOptions): string | null {
    // 更新直前に再取得（表示開始時の状態を信用しない）
    const existingRecord = getMyTeamByWorldId(build.worldCardId);
    const storedBuild = getBuild(build.worldCardId, build.buildId);
    const v = validateMyTeamRegistration({
      build,
      existingRecord,
      storedBuild,
      storageAvailable: isMyTeamStorageAvailable(),
      ownershipStatus: opts.ownershipStatus,
      usageStatus: opts.usageStatus,
    });
    if (!v.ok) {
      if (v.code === "duplicate" || v.code === "build-missing") {
        // 別タブ更新の可能性 → ダイアログを閉じ、再読込を案内
        setRegisterTarget(null);
        setStaleMyTeam(true);
        flashError(v.error);
        return null;
      }
      return v.error;
    }

    const r = addToMyTeam({
      worldCardId: v.worldCardId,
      ownershipStatus: v.ownershipStatus,
      usageStatus: v.usageStatus,
      selectedBuildId: opts.setSelected ? build.buildId : null,
      note: "",
      tags: [],
    });
    if (!r.ok) {
      if (r.existing) {
        setRegisterTarget(null);
        setStaleMyTeam(true);
        flashError(tmb("alreadyRegisteredNotice"));
        return null;
      }
      return fillMb(tmb("registerFailedTemplate"), { error: r.error });
    }

    let favoriteNote = "";
    if (opts.setFavorite) {
      const fav = updateMyTeamRecord(r.record.teamCardId, { favoriteBuildId: build.buildId });
      favoriteNote = fav.ok
        ? fillMb(tmb("favoriteAlsoSetTemplate"), { name: build.buildName })
        : tmb("favoriteSetFailedNote");
    }

    setRegisterTarget(null);
    const cardName = resolvePlayerDisplayName(cards.get(build.worldCardId) ?? {}, locale, cardFallbackName(build.worldCardId));
    const selNote = opts.setSelected ? fillMb(tmb("selectedAlsoSetTemplate"), { name: build.buildName }) : "";
    flash(fillMb(tmb("registeredNoticeTemplate"), { name: cardName, selNote, favoriteNote }).trim());
    // useMyTeam（useSyncExternalStore）が更新を受けてカード表示を即時切り替える
    return null;
  }

  /** 対象保存ビルドを、同一 worldCardId の My Team レコードの selectedBuildId へ設定する。 */
  function handleAssignToMyTeam(build: SavedBuild) {
    // 更新直前に既存ストレージから再取得（表示開始時の状態を信用しない）
    const record = getMyTeamByWorldId(build.worldCardId);
    const stored = getBuild(build.worldCardId, build.buildId);
    const v = validateMyTeamBuildAssignment({
      build,
      record,
      storedBuild: stored,
      storageAvailable: isMyTeamStorageAvailable(),
    });
    if (!v.ok) {
      setAssignTarget(null);
      flashError(v.error);
      return;
    }
    if (record && record.selectedBuildId === build.buildId) {
      setAssignTarget(null);
      flash(tmb("alreadySelectedNotice"));
      return;
    }
    const r = updateMyTeamRecord(v.teamCardId, { selectedBuildId: build.buildId });
    if (!r.ok) {
      flashError(fillMb(tmb("assignFailedTemplate"), { error: r.error ?? tmb("unknownError") }));
      return;
    }
    setAssignTarget(null);
    flash(fillMb(tmb("assignedNoticeTemplate"), { name: build.buildName }));
    // useMyTeam（useSyncExternalStore）が更新を受けて使用状況を再計算する
  }

  /** My Team の選択中ビルドを解除する（selectedBuildId を null へ・他フィールドは維持）。 */
  function handleClearMyTeamSelection(build: SavedBuild) {
    const record = getMyTeamByWorldId(build.worldCardId);
    if (!record || record.selectedBuildId !== build.buildId) {
      setClearTarget(null);
      flashError(tmb("selectionChangedError"));
      return;
    }
    const r = updateMyTeamRecord(record.teamCardId, { selectedBuildId: null });
    if (!r.ok) {
      flashError(fillMb(tmb("clearSelectionFailedTemplate"), { error: r.error ?? tmb("unknownError") }));
      return;
    }
    setClearTarget(null);
    flash(tmb("clearedSelectionNotice"));
  }

  /** 対象保存ビルドを、同一 worldCardId の My Team レコードの favoriteBuildId へ設定する（selectedBuildId は変更しない）。 */
  function handleSetFavoriteBuild(build: SavedBuild) {
    const record = getMyTeamByWorldId(build.worldCardId);
    const stored = getBuild(build.worldCardId, build.buildId);
    const v = validateMyTeamFavoriteBuildAssignment({
      build,
      record,
      storedBuild: stored,
      storageAvailable: isMyTeamStorageAvailable(),
    });
    if (!v.ok) {
      setFavoriteTarget(null);
      flashError(v.error);
      return;
    }
    if (record && record.favoriteBuildId === build.buildId) {
      setFavoriteTarget(null);
      flash(tmb("alreadyFavoriteNotice"));
      return;
    }
    const r = updateMyTeamRecord(v.teamCardId, { favoriteBuildId: build.buildId });
    if (!r.ok) {
      flashError(fillMb(tmb("setFavoriteFailedTemplate"), { error: r.error ?? tmb("unknownError") }));
      return;
    }
    setFavoriteTarget(null);
    flash(fillMb(tmb("setFavoriteNoticeTemplate"), { name: build.buildName }));
  }

  /** My Team のお気に入りビルドを解除する（favoriteBuildId を null へ・selectedBuildId・他フィールドは維持）。 */
  function handleClearFavoriteBuild(build: SavedBuild) {
    const record = getMyTeamByWorldId(build.worldCardId);
    const stored = getBuild(build.worldCardId, build.buildId);
    const v = validateMyTeamFavoriteBuildClear({
      build,
      record,
      storedBuild: stored,
      storageAvailable: isMyTeamStorageAvailable(),
    });
    if (!v.ok) {
      setClearFavoriteTarget(null);
      flashError(v.error);
      return;
    }
    const r = updateMyTeamRecord(v.teamCardId, { favoriteBuildId: null });
    if (!r.ok) {
      flashError(fillMb(tmb("clearFavoriteFailedTemplate"), { error: r.error ?? tmb("unknownError") }));
      return;
    }
    setClearFavoriteTarget(null);
    flash(fillMb(tmb("clearedFavoriteNoticeTemplate"), { name: build.buildName }));
  }

  const filterActive =
    filter.q.trim() !== "" ||
    filter.cardType != null ||
    filter.position != null ||
    filter.rules !== "all" ||
    filter.pom !== "all" ||
    filter.experimental !== "all" ||
    filter.usage !== "all";

  if (scopeStatus === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={tmb("pageTitle")} icon="sliders" description={tmb("pageDescription")} />
        <Surface padding="md">
          <p className="text-sm text-text-dim">{tmb("scopeLoadingMessage")}</p>
        </Surface>
      </div>
    );
  }

  if (builds.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={tmb("pageTitle")} icon="sliders" description={tmb("pageDescription")} />
        <LocalStorageNotice kind="builds" />
        <DuplicateReviewTeaser />
        <BuildImportLauncher
          builds={builds}
          cards={cards}
          available={available}
          stale={stale}
          onReload={reload}
        />
        <BuildExportLauncher
          builds={builds}
          cards={cards}
          usedBuildIds={usedBuildIds}
          available={available}
          stale={stale}
          onReload={reload}
        />
        <EmptyState
          icon="sliders"
          title={tmb("emptyTitle")}
          description={tmb("emptyDescription")}
          action={
            <Link href="/players" className={buttonClasses("primary", "sm")}>
              {tmb("findPlayersLink")}
            </Link>
          }
          secondaryAction={
            <Link href="/compare" className={buttonClasses("secondary", "sm")}>
              {tmb("openComparelink")}
            </Link>
          }
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/my-team" className={buttonClasses("outline", "sm")}>
              {tmb("openMyTeamLink")}
            </Link>
            <Link href="/squads" className={buttonClasses("outline", "sm")}>
              {tmb("openSquadsLink")}
            </Link>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={tmb("pageTitle")} icon="sliders" description={tmb("pageDescription")} />
      <LocalStorageNotice kind="builds" />

      {!available ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-2xs text-warning">
          {tmb("storageUnavailableNotice")}
        </p>
      ) : null}
      {cardsError ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-2xs text-danger">
          {cardsError}
        </p>
      ) : null}
      {errorNotice ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-2xs text-danger">
          {errorNotice}
        </p>
      ) : null}
      {stale ? (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-2 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-2xs text-info"
        >
          <Icon name="refresh" size={14} className="shrink-0" />
          <span>{tmb("staleBuildsNotice")}</span>
          <button
            type="button"
            onClick={reload}
            className="rounded border border-info/50 px-2 py-0.5 font-semibold hover:bg-info/10"
          >
            {tmb("reloadButton")}
          </button>
        </div>
      ) : null}
      {staleMyTeam ? (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-2 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-2xs text-info"
        >
          <Icon name="refresh" size={14} className="shrink-0" />
          <span>{tmb("staleMyTeamNotice")}</span>
          <button
            type="button"
            onClick={() => {
              setStaleMyTeam(false);
              reload();
            }}
            className="rounded border border-info/50 px-2 py-0.5 font-semibold hover:bg-info/10"
          >
            {tmb("reloadButton")}
          </button>
        </div>
      ) : null}
      {notice ? (
        <p aria-live="polite" className="rounded-md border border-accent/40 bg-accent-soft/40 px-3 py-2 text-2xs text-accent">
          {notice}
        </p>
      ) : null}

      <DuplicateReviewTeaser />

      <BuildImportLauncher
        builds={builds}
        cards={cards}
        available={available}
        stale={stale}
        onReload={reload}
      />

      <BuildExportLauncher
        builds={builds}
        cards={cards}
        usedBuildIds={usedBuildIds}
        available={available}
        stale={stale}
        onReload={reload}
      />

      <Surface padding="sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-2xs text-text-muted">{tmb("statTotalLabel")}</dt>
            <dd className="font-bold tabular-nums">{builds.length}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tmb("statVisibleLabel")}</dt>
            <dd className="font-bold tabular-nums">{visible.length}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tmb("statUsedLabel")}</dt>
            <dd className="font-bold tabular-nums">{usedBuildIds.size}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tmb("statUnusedLabel")}</dt>
            <dd className="font-bold tabular-nums">{legacyCount}</dd>
          </div>
        </dl>
        <p className="mt-1.5 text-2xs text-text-muted">{tmb("usedExplanationNote")}</p>
      </Surface>

      {/* 検索・絞り込み・並び替え（モバイルは折りたたみ） */}
      <details open className="rounded-md border border-border bg-surface-2/30 [&_summary]:list-none">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-text-dim">
          <Icon name="filter" size={14} />
          {tmb("filterSectionHeading")}
          {filterActive ? <span className="rounded bg-accent-soft px-1.5 py-0.5 text-2xs text-accent">{tmb("filterActiveBadge")}</span> : null}
        </summary>
        <div className="flex flex-col gap-2 border-t border-border/60 p-3">
          <label className="flex flex-col gap-1 text-2xs text-text-dim">
            {tmb("searchLabel")}
            <input
              type="text"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
              placeholder={tmb("searchPlaceholder")}
              aria-label={tmb("searchAriaLabel")}
              className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tmb("cardTypeLabel")}
              <select
                value={filter.cardType ?? ""}
                onChange={(e) => setFilter((f) => ({ ...f, cardType: e.target.value || null }))}
                aria-label={tmb("cardTypeAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                <option value="">{tmb("filterAllOption")}</option>
                {facets.cardTypes.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tmb("positionLabel")}
              <select
                value={filter.position ?? ""}
                onChange={(e) => setFilter((f) => ({ ...f, position: e.target.value || null }))}
                aria-label={tmb("positionAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                <option value="">{tmb("filterAllOption")}</option>
                {facets.positions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tmb("rulesLabel")}
              <select
                value={filter.rules}
                onChange={(e) => setFilter((f) => ({ ...f, rules: e.target.value as BuildFilterState["rules"] }))}
                aria-label={tmb("rulesAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                <option value="all">{tmb("filterAllOption")}</option>
                <option value="current">{t("buildUsage", "ruleCurrentLabel")}</option>
                <option value="legacy">{t("buildUsage", "ruleLegacyLabel")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tmb("pomLabel")}
              <select
                value={filter.pom}
                onChange={(e) => setFilter((f) => ({ ...f, pom: e.target.value as BuildFilterState["pom"] }))}
                aria-label={tmb("pomAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                <option value="all">{tmb("filterAllOption")}</option>
                <option value="with">{tmb("pomWithOption")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tmb("experimentalLabel")}
              <select
                value={filter.experimental}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, experimental: e.target.value as BuildFilterState["experimental"] }))
                }
                aria-label={tmb("experimentalAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                <option value="all">{tmb("filterAllOption")}</option>
                <option value="with">{tmb("experimentalWithOption")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {tmb("usageLabel")}
              <select
                value={filter.usage}
                onChange={(e) => setFilter((f) => ({ ...f, usage: e.target.value as BuildFilterState["usage"] }))}
                aria-label={tmb("usageAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                <option value="all">{tmb("filterAllOption")}</option>
                <option value="used">{tmb("usageUsedOption")}</option>
                <option value="unused">{tmb("usageUnusedOption")}</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-2xs text-text-dim">
              {tmb("sortLabel")}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as BuildSortKey)}
                aria-label={tmb("sortAriaLabel")}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                {BUILD_SORT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {filterActive ? (
              <button
                type="button"
                onClick={() => setFilter(DEFAULT_BUILD_FILTER)}
                className="rounded border border-border px-2 py-1 text-2xs hover:border-accent"
              >
                {tmb("clearFiltersButton")}
              </button>
            ) : null}
          </div>
        </div>
      </details>

      {cardsLoading ? <p className="text-2xs text-text-muted">{t("myTeam", "resolvingCards")}</p> : null}

      {visible.length === 0 ? (
        <EmptyState
          variant="no-results"
          title={tmb("noResultsTitle")}
          description={t("myTeam", "noResultsDescription")}
          action={
            <button type="button" onClick={() => setFilter(DEFAULT_BUILD_FILTER)} className={buttonClasses("primary", "sm")}>
              {tmb("clearFiltersButton")}
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((build) => {
            const card = cards.get(build.worldCardId) ?? null;
            const usage = buildUsageSummary(build, {
              myTeam,
              squadUsage: squadUsageByCard.get(build.worldCardId) ?? [],
            });
            return (
              <li key={build.buildId}>
                <MyBuildCard
                  build={build}
                  card={card}
                  cardLoading={cardsLoading}
                  usage={usage}
                  myTeamSelection={resolveMyTeamBuildSelectionState(
                    build,
                    myTeamByCard.get(build.worldCardId) ?? null,
                  )}
                  onRegisterToMyTeam={() => setRegisterTarget(build)}
                  onAssignToMyTeam={() => setAssignTarget(build)}
                  onClearMyTeamSelection={() => setClearTarget(build)}
                  onSetFavoriteBuild={() => setFavoriteTarget(build)}
                  onClearFavoriteBuild={() => setClearFavoriteTarget(build)}
                  onRename={() => setRenameTarget(build)}
                  onDuplicate={() => handleDuplicate(build)}
                  onDelete={() => setDeleteTarget(build)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {renameTarget ? (
        <RenameDialog
          build={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSubmit={handleRename}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title={tmb("deleteConfirmTitle")}
        danger
        confirmLabel={tmb("deleteConfirmButton")}
        body={
          deleteTarget ? (
            <DeleteBody
              build={deleteTarget}
              usageSummary={buildUsageSummary(deleteTarget, { myTeam, squadUsage: squadUsageByCard.get(deleteTarget.worldCardId) ?? [] })}
              playerName={(() => {
                const c = cards.get(deleteTarget.worldCardId);
                return c && (c.nameJa || c.nameEn) ? resolvePlayerDisplayName(c, locale) : null;
              })()}
            />
          ) : null
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {registerTarget ? (
        <RegisterToMyTeamDialog
          build={registerTarget}
          card={cards.get(registerTarget.worldCardId) ?? null}
          alreadyInMyTeam={myTeamByCard.has(registerTarget.worldCardId)}
          onClose={() => setRegisterTarget(null)}
          onConfirm={(opts) => handleRegisterToMyTeam(registerTarget, opts)}
        />
      ) : null}

      {assignTarget
        ? (() => {
            const rec = myTeamByCard.get(assignTarget.worldCardId) ?? null;
            const currentSelected =
              rec?.selectedBuildId != null
                ? builds.find(
                    (b) => b.buildId === rec.selectedBuildId && b.worldCardId === assignTarget.worldCardId,
                  ) ?? null
                : null;
            return (
              <AssignToMyTeamDialog
                build={assignTarget}
                card={cards.get(assignTarget.worldCardId) ?? null}
                record={rec}
                currentSelectedBuild={currentSelected}
                onClose={() => setAssignTarget(null)}
                onConfirm={() => handleAssignToMyTeam(assignTarget)}
              />
            );
          })()
        : null}

      <ConfirmDialog
        open={clearTarget != null}
        title={tmb("clearSelectionConfirmTitle")}
        confirmLabel={tmb("clearSelectionConfirmButton")}
        body={
          clearTarget ? (
            <div className="space-y-2 text-xs">
              <p>{fillMb(tmb("clearSelectionBodyTemplate"), { name: clearTarget.buildName })}</p>
              <p className="text-text-muted">
                {fillMb(tmb("idLineTemplate"), { worldCardId: clearTarget.worldCardId, buildId: clearTarget.buildId })}
              </p>
              <p className="text-text-dim">{tmb("clearSelectionUnchangedNote")}</p>
            </div>
          ) : null
        }
        onCancel={() => setClearTarget(null)}
        onConfirm={() => clearTarget && handleClearMyTeamSelection(clearTarget)}
      />

      {favoriteTarget
        ? (() => {
            const rec = myTeamByCard.get(favoriteTarget.worldCardId) ?? null;
            const curFav =
              rec?.favoriteBuildId != null
                ? builds.find(
                    (b) => b.buildId === rec.favoriteBuildId && b.worldCardId === favoriteTarget.worldCardId,
                  ) ?? null
                : null;
            const curSel =
              rec?.selectedBuildId != null
                ? builds.find(
                    (b) => b.buildId === rec.selectedBuildId && b.worldCardId === favoriteTarget.worldCardId,
                  ) ?? null
                : null;
            return (
              <SetFavoriteBuildDialog
                build={favoriteTarget}
                card={cards.get(favoriteTarget.worldCardId) ?? null}
                record={rec}
                currentFavoriteBuild={curFav}
                currentSelectedBuild={curSel}
                onClose={() => setFavoriteTarget(null)}
                onConfirm={() => handleSetFavoriteBuild(favoriteTarget)}
              />
            );
          })()
        : null}

      <ConfirmDialog
        open={clearFavoriteTarget != null}
        title={tmb("clearFavoriteConfirmTitle")}
        confirmLabel={tmb("clearFavoriteConfirmButton")}
        body={
          clearFavoriteTarget ? (
            <div className="space-y-2 text-xs">
              <p>{fillMb(tmb("clearFavoriteBodyTemplate"), { name: clearFavoriteTarget.buildName })}</p>
              <p className="text-text-muted">
                {fillMb(tmb("idLineTemplate"), { worldCardId: clearFavoriteTarget.worldCardId, buildId: clearFavoriteTarget.buildId })}
              </p>
              <ul className="list-disc pl-4 text-text-dim">
                <li>{tmb("clearFavoriteChangedItem")}</li>
                <li>{tmb("clearFavoriteUnchangedItemTemplate")}</li>
              </ul>
            </div>
          ) : null
        }
        onCancel={() => setClearFavoriteTarget(null)}
        onConfirm={() => clearFavoriteTarget && handleClearFavoriteBuild(clearFavoriteTarget)}
      />
    </div>
  );
}

function RegisterToMyTeamDialog({
  build,
  card,
  alreadyInMyTeam,
  onClose,
  onConfirm,
}: {
  build: SavedBuild;
  card: WorldPlayerListItem | null;
  /** ダイアログを開いた時点で既に登録済み（重複導線を出さない用）。 */
  alreadyInMyTeam: boolean;
  onClose: () => void;
  /** 成功なら null（親がダイアログを閉じる）、失敗ならエラー文字列。 */
  onConfirm: (opts: MyTeamRegistrationOptions) => string | null;
}) {
  const [ownership, setOwnership] = useState<OwnershipStatus>(resolveSafeOwnershipDefault());
  const [usage, setUsage] = useState<UsageStatus>(resolveSafeUsageDefault());
  const [setSelected, setSetSelected] = useState(true);
  const [setFavorite, setSetFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tmb = (k: keyof Dictionary["myBuildsView"]) => t("myBuildsView", k);
  const fillMb = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const OWNERSHIP_LABELS = useOwnershipLabels();
  const USAGE_LABELS = useUsageLabels();
  const ruleLabel = useRuleLabel();

  const name = resolvePlayerDisplayName(card ?? {}, locale, fillMb(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: build.worldCardId }));
  const sources = card
    ? resolveCardImageSources({
        worldCardId: card.worldCardId,
        efhubCardId: card.efhubCardId,
        hasEfhubLink: card.hasEfhubLink,
        hasWorldImage: card.imageUrlCandidate != null,
        hasWorldMobileImage: card.mobileImageUrlCandidate != null,
      })
    : [];

  const rule = resolveBuildRuleStatus(build.rulesVersion);
  const points = buildPointSummary(build, card?.maximumLevel ?? null);
  const pom = describeBuildPoM(build);
  const activeRows = buildAllocationRows(build.progressionAllocation).filter((r) => r.level > 0);
  const hasExperimental = buildHasExperimental(build);
  const preview = buildMyTeamRegistrationPreview(build, {
    ownershipStatus: ownership,
    usageStatus: usage,
    setSelected,
    setFavorite,
  });

  function submit() {
    const err = onConfirm({ ownershipStatus: ownership, usageStatus: usage, setSelected, setFavorite });
    if (err) setError(err);
  }

  return (
    <Modal open onClose={onClose} title={tmb("registerModalTitle")} size="sm">
      <div className="flex flex-col gap-3 text-sm">
        {/* 1. カード情報 */}
        <div className="flex gap-2.5">
          <div className="w-14 shrink-0">
            <WorldCardImage sources={sources} alt={card ? fillMb(tmb("cardImageAltTemplate"), { name }) : tmb("cardImageAltGeneric")} size="card" />
          </div>
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{name}</p>
            <p className="text-text-muted">{card?.nameEn ?? `ID ${build.worldCardId}`}</p>
            <p className="mt-0.5 text-text-dim">
              {card?.cardType ?? tmb("cardTypeUnknown")} / {card?.registeredPosition ?? tmb("registeredPositionUnknown")} / World ID{" "}
              {build.worldCardId}
            </p>
          </div>
        </div>

        {alreadyInMyTeam ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {tmb("alreadyInMyTeamNotice")}
          </p>
        ) : null}

        {/* 2. 保存ビルド情報 */}
        <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs">
          <p>
            {tmb("buildToUseLabel")}
            <b>{build.buildName}</b>
            <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: build.buildId })}</span>
          </p>
          <p className="mt-0.5 text-text-dim">
            rulesVersion {build.rulesVersion}（{ruleLabel(rule.isV2, rule.isLegacy)}）
          </p>
          <p className="mt-0.5 text-text-dim">
            {tmb("allocationLabel")}
            {activeRows.length > 0
              ? activeRows.map((r) => `${r.label} Lv${r.level}`).join(" / ")
              : tmb("noAllocationBase")}
          </p>
          <p className="mt-0.5 text-text-dim">
            {fillMb(tmb("usedPointsLabel"), { value: String(points.usedPoints) })}
            {points.totalPoints == null ? tmb("totalUnknownSuffix") : fillMb(tmb("totalPointsSuffixTemplate"), { value: String(points.totalPoints) })}
          </p>
          <p className="mt-0.5 text-text-dim">
            {tmb("pomRowLabel")}
            {pom.has ? pom.tierLabel : tmb("pomUnspecified")}
          </p>
          <p className="mt-0.5 text-text-dim">
            {tmb("experimentalRowLabel")}
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
        </div>

        {/* 3-4. 所有状態・使用状態 */}
        <Select
          label={tmb("ownershipLabel")}
          hint={tmb("ownershipHint")}
          value={ownership}
          onChange={(e) => setOwnership(e.target.value as OwnershipStatus)}
        >
          {OWNERSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OWNERSHIP_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          label={tmb("usageStatusLabel")}
          hint={tmb("usageStatusHint")}
          value={usage}
          onChange={(e) => setUsage(e.target.value as UsageStatus)}
        >
          {USAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {USAGE_LABELS[s]}
            </option>
          ))}
        </Select>

        {/* 5-6. 選択中ビルド / お気に入りビルド（独立） */}
        <fieldset className="flex flex-col gap-1.5 rounded border border-border p-2">
          <legend className="px-1 text-2xs text-text-dim">{tmb("associationLegend")}</legend>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={setSelected}
              onChange={(e) => setSetSelected(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {tmb("setSelectedOptionPrefix")}
              <b>{t("myTeamBuildPanel", "selectedBuildNoun")}</b>
              {tmb("setSelectedOptionSuffix")}
              <span className="block text-2xs text-text-muted">{tmb("setSelectedHint")}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={setFavorite}
              onChange={(e) => setSetFavorite(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {tmb("setFavoriteOptionPrefix")}
              <b>{t("myTeamBuildPanel", "favoriteBuildNoun")}</b>
              {tmb("setFavoriteOptionSuffix")}
              <span className="block text-2xs text-text-muted">{tmb("setFavoriteHint")}</span>
            </span>
          </label>
        </fieldset>

        {/* 7. 作成される My Team レコードのプレビュー */}
        <div className="rounded border border-accent/30 bg-accent-soft/30 p-2 text-2xs">
          <p className="font-semibold text-text-dim">{tmb("previewHeading")}</p>
          <ul className="mt-1 space-y-0.5">
            <li>{fillMb(tmb("previewOwnershipTemplate"), { value: OWNERSHIP_LABELS[preview.ownershipStatus] })}</li>
            <li>{fillMb(tmb("previewUsageTemplate"), { value: USAGE_LABELS[preview.usageStatus] })}</li>
            <li>{fillMb(tmb("previewSelectedTemplate"), { value: preview.selectedBuildName ?? tmb("previewNoneValue") })}</li>
            <li>{fillMb(tmb("previewFavoriteTemplate"), { value: preview.favoriteBuildName ?? tmb("previewNoneValue") })}</li>
            <li>{tmb("previewTagsNone")}</li>
            <li>{tmb("previewNotesNone")}</li>
            <li>{tmb("previewSquadNoChange")}</li>
            <li>{tmb("previewFavoriteFlagNoChange")}</li>
          </ul>
          {preview.twoStage ? (
            <p className="mt-1 text-text-muted">{tmb("twoStageNote")}</p>
          ) : null}
        </div>

        {/* 8. 変更されない項目 */}
        <ul className="list-disc pl-4 text-2xs text-text-dim">
          <li>{tmb("unchangedListItem1")}</li>
          <li>{tmb("unchangedListItem2")}</li>
        </ul>

        <p className="text-2xs">{tmb("confirmStatement")}</p>

        {error ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tmb("cancelButton")}
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={alreadyInMyTeam}>
            {tmb("registerButton")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SetFavoriteBuildDialog({
  build,
  card,
  record,
  currentFavoriteBuild,
  currentSelectedBuild,
  onClose,
  onConfirm,
}: {
  build: SavedBuild;
  card: WorldPlayerListItem | null;
  record: MyTeamRecord | null;
  currentFavoriteBuild: SavedBuild | null;
  currentSelectedBuild: SavedBuild | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tmb = (k: keyof Dictionary["myBuildsView"]) => t("myBuildsView", k);
  const fillMb = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const name = resolvePlayerDisplayName(card ?? {}, locale, fillMb(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: build.worldCardId }));
  const sources = card
    ? resolveCardImageSources({
        worldCardId: card.worldCardId,
        efhubCardId: card.efhubCardId,
        hasEfhubLink: card.hasEfhubLink,
        hasWorldImage: card.imageUrlCandidate != null,
        hasWorldMobileImage: card.mobileImageUrlCandidate != null,
      })
    : [];
  const desc = record ? describeMyTeamFavoriteBuildChange(build, record, currentFavoriteBuild) : null;
  const canConfirm = record != null && desc != null && !desc.alreadyFavorite;

  return (
    <Modal open onClose={onClose} title={tmb("changeFavoriteModalTitle")} size="sm">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex gap-2.5">
          <div className="w-14 shrink-0">
            <WorldCardImage sources={sources} alt={card ? fillMb(tmb("cardImageAltTemplate"), { name }) : tmb("cardImageAltGeneric")} size="card" />
          </div>
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{name}</p>
            <p className="text-text-muted">{card?.nameEn ?? `ID ${build.worldCardId}`}</p>
            <p className="mt-0.5 text-text-dim">
              {card?.cardType ?? tmb("cardTypeUnknown")} / {card?.registeredPosition ?? "?"} / World ID {build.worldCardId}
            </p>
          </div>
        </div>

        {!record ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {tmb("notInMyTeamNotice")}
          </p>
        ) : (
          <>
            <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs">
              <p>
                {tmb("settingBuildLabel")}
                <b>{build.buildName}</b>
                <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: build.buildId })}</span>
              </p>
              <p className="mt-0.5">
                {tmb("currentFavoriteLabel")}
                {desc && desc.fromBuildId == null ? (
                  <span className="text-text-muted">{tmb("noneLabel")}</span>
                ) : desc && desc.fromMissing ? (
                  <span className="text-warning">{fillMb(tmb("currentFavoriteMissingTemplate"), { id: String(desc.fromBuildId) })}</span>
                ) : (
                  <span>
                    <b>{desc?.fromBuildName}</b>
                    <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: String(desc?.fromBuildId) })}</span>
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-text-dim">
                {tmb("currentSelectedUnchangedLabel")}
                {desc?.selectedBuildId == null ? (
                  <span className="text-text-muted">{tmb("noneLabel")}</span>
                ) : (
                  <span>
                    {currentSelectedBuild?.buildName ?? tmb("missingBuildFallback")}
                    <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: desc.selectedBuildId })}</span>
                  </span>
                )}
              </p>
              {desc?.alreadyFavorite ? (
                <p className="mt-0.5 text-yellow-300">{tmb("alreadyFavoriteNoChangeNote")}</p>
              ) : null}
            </div>

            <p className="text-2xs">{fillMb(tmb("confirmFavoriteChangeTemplate"), { name: build.buildName })}</p>
            <ul className="list-disc pl-4 text-2xs text-text-dim">
              <li>{tmb("favoriteChangedItem")}</li>
              <li>{tmb("favoriteUnchangedItemTemplate")}</li>
              <li>{tmb("favoriteNoAutoApplyNote")}</li>
            </ul>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tmb("cancelButton")}
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} disabled={!canConfirm}>
            {tmb("makeFavoriteButton")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignToMyTeamDialog({
  build,
  card,
  record,
  currentSelectedBuild,
  onClose,
  onConfirm,
}: {
  build: SavedBuild;
  card: WorldPlayerListItem | null;
  record: MyTeamRecord | null;
  currentSelectedBuild: SavedBuild | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tmb = (k: keyof Dictionary["myBuildsView"]) => t("myBuildsView", k);
  const fillMb = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const name = resolvePlayerDisplayName(card ?? {}, locale, fillMb(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: build.worldCardId }));
  const sources = card
    ? resolveCardImageSources({
        worldCardId: card.worldCardId,
        efhubCardId: card.efhubCardId,
        hasEfhubLink: card.hasEfhubLink,
        hasWorldImage: card.imageUrlCandidate != null,
        hasWorldMobileImage: card.mobileImageUrlCandidate != null,
      })
    : [];
  const desc = record ? describeMyTeamBuildChange(build, record, currentSelectedBuild) : null;
  const canConfirm = record != null && desc != null && !desc.alreadySelected;

  return (
    <Modal open onClose={onClose} title={tmb("changeSelectedModalTitle")} size="sm">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex gap-2.5">
          <div className="w-14 shrink-0">
            <WorldCardImage sources={sources} alt={card ? fillMb(tmb("cardImageAltTemplate"), { name }) : tmb("cardImageAltGeneric")} size="card" />
          </div>
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{name}</p>
            <p className="text-text-muted">{card?.nameEn ?? `ID ${build.worldCardId}`}</p>
            <p className="mt-0.5 text-text-dim">
              {card?.cardType ?? tmb("cardTypeUnknown")} / {card?.registeredPosition ?? "?"} / World ID {build.worldCardId}
            </p>
          </div>
        </div>

        {!record ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {tmb("notInMyTeamNotice")}
          </p>
        ) : (
          <>
            <div className="rounded border border-border bg-surface-2/40 p-2 text-2xs">
              <p>
                {tmb("settingBuildLabel")}
                <b>{build.buildName}</b>
                <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: build.buildId })}</span>
              </p>
              <p className="mt-0.5">
                {tmb("currentSelectedLabel")}
                {desc && desc.fromBuildId == null ? (
                  <span className="text-text-muted">{tmb("noneLabel")}</span>
                ) : desc && desc.fromMissing ? (
                  <span className="text-warning">{fillMb(tmb("currentSelectedMissingTemplate"), { id: String(desc.fromBuildId) })}</span>
                ) : (
                  <span>
                    <b>{desc?.fromBuildName}</b>
                    <span className="ml-1 text-text-muted">{fillMb(tmb("buildIdSuffixTemplate"), { id: String(desc?.fromBuildId) })}</span>
                  </span>
                )}
              </p>
              {desc?.alreadySelected ? (
                <p className="mt-0.5 text-accent">{tmb("alreadySelectedNoChangeNote")}</p>
              ) : null}
            </div>

            <p className="text-2xs">{fillMb(tmb("confirmSelectedChangeTemplate"), { name: build.buildName })}</p>
            <ul className="list-disc pl-4 text-2xs text-text-dim">
              <li>{tmb("selectedChangedItem")}</li>
              <li>{tmb("selectedUnchangedItemTemplate")}</li>
              <li>{tmb("selectedNoAutoApplyNote")}</li>
            </ul>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tmb("cancelButton")}
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} disabled={!canConfirm}>
            {tmb("makeSelectedButton")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RenameDialog({
  build,
  onClose,
  onSubmit,
}: {
  build: SavedBuild;
  onClose: () => void;
  /** 成功なら null、失敗ならエラー文字列を返す。 */
  onSubmit: (name: string) => string | null;
}) {
  const [name, setName] = useState(build.buildName);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const tmb = (k: keyof Dictionary["myBuildsView"]) => t("myBuildsView", k);

  function submit() {
    const err = onSubmit(name);
    if (err) setError(err);
  }

  return (
    <Modal open onClose={onClose} title={tmb("renameModalTitle")} size="sm">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-2xs text-text-dim">{tmb("renameDescription")}</p>
        <label className="flex flex-col gap-1 text-xs">
          {tmb("newNameLabel")}
          <input
            type="text"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            aria-label={tmb("newNameAriaLabel")}
            aria-invalid={error != null}
            className="rounded border border-border bg-surface-2 px-2 py-1.5 text-sm"
          />
        </label>
        {error ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-2xs text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tmb("cancelButton")}
          </Button>
          <Button variant="primary" size="sm" onClick={submit}>
            {tmb("changeButton")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteBody({
  build,
  usageSummary,
  playerName,
}: {
  build: SavedBuild;
  usageSummary: ReturnType<typeof buildUsageSummary>;
  playerName: string | null;
}) {
  const t = useT();
  const tmb = (k: keyof Dictionary["myBuildsView"]) => t("myBuildsView", k);
  const fillMb = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  return (
    <div className="space-y-2 text-xs">
      <p>
        {fillMb(tmb("deleteBodyTemplate"), { name: build.buildName, playerSuffix: playerName ? `（${playerName}）` : "" })}
      </p>
      <p className="text-text-muted">
        {fillMb(tmb("idLineTemplate"), { worldCardId: build.worldCardId, buildId: build.buildId })}
      </p>
      {usageSummary.anyUsage ? (
        <div className="rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-warning">
          <p className="font-semibold">{tmb("referencedFromLabel")}</p>
          <ul className="mt-0.5 list-disc pl-4">
            {usageSummary.myTeamSelected ? <li>{tmb("myTeamSelectedItem")}</li> : null}
            {usageSummary.myTeamFavorite ? <li>{tmb("myTeamFavoriteItem")}</li> : null}
            {usageSummary.squads.map((s) => (
              <li key={s.squadId}>
                {fillMb(tmb("squadReferenceTemplate"), { name: s.squadName, areas: s.areas.join(" / ") })}
              </li>
            ))}
          </ul>
          <p className="mt-1">{tmb("deleteSafeNote")}</p>
        </div>
      ) : (
        <p className="text-text-muted">{tmb("noReferenceNote")}</p>
      )}
      <p className="text-text-dim">{tmb("deleteIrreversibleNote")}</p>
    </div>
  );
}
