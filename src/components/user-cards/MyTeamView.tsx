"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMyTeam, useFavorites } from "@/lib/user-cards/hooks";
import { detectLegacyDataForKind } from "@/lib/local-storage-scope/legacy-detect";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import { removeFromMyTeam, updateMyTeamRecord } from "@/lib/user-cards/my-team-storage";
import { listBuilds } from "@/lib/progression/build-storage";
import { isV2RulesVersion } from "@/lib/progression/progression-rules";
import type { SavedBuild } from "@/lib/progression/types";
import { listSquads } from "@/lib/squad/squad-storage";
import { findSquadUsageByWorldCardId } from "@/lib/squad/usage";
import { filterAndSortUserCards, facetsFromRows, type UserCardRow } from "@/lib/user-cards/filter";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import { resolveMyTeamBuildRefs } from "@/lib/progression/my-builds";
import { UserCardFilters, DEFAULT_FILTER, type UserCardFilterState } from "./UserCardFilters";
import { UserCardTile } from "./UserCardTile";
import { LocalStorageNotice } from "./LocalStorageNotice";
import { MyTeamAddDialog } from "./MyTeamAddDialog";
import { MyTeamBuildPanel } from "./MyTeamBuildPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Surface } from "@/components/ui/Surface";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { PageHeader } from "@/components/ui/PageHeader";

export function MyTeamView() {
  const t = useT();
  const { locale } = useLocale();
  const tmt = useCallback((k: keyof Dictionary["myTeam"]) => t("myTeam", k), [t]);
  const fillMt = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s),
    [],
  );
  const cardFallbackName = useCallback(
    (id: string) => fillMt(t("squadBuildPanel", "cardFallbackNameTemplate"), { id }),
    [fillMt, t],
  );
  const { myTeam, available, scopeStatus } = useMyTeam();
  const { favoriteIds } = useFavorites();
  const ids = useMemo(() => myTeam.map((r) => r.worldCardId), [myTeam]);
  // レガシー(アカウント分離前)の共通My Team件数だけを表示する(中身は一切表示・自動表示しない)。
  // スコープとは独立した別キーを読むだけの軽量処理のため、メモ化せず毎レンダー評価する。
  const legacySummary = detectLegacyDataForKind("myTeam");
  const { cards, loading, error } = useResolvedCards(ids);
  const [filter, setFilter] = useState<UserCardFilterState>(DEFAULT_FILTER);
  const [editRec, setEditRec] = useState<MyTeamRecord | null>(null);
  const [confirmRec, setConfirmRec] = useState<MyTeamRecord | null>(null);
  const [buildPanelRec, setBuildPanelRec] = useState<MyTeamRecord | null>(null);

  // 各カードの保存ビルド（build-storage・client のみ）
  const [buildsByCard, setBuildsByCard] = useState<Map<string, SavedBuild[]>>(new Map());
  useEffect(() => {
    const m = new Map<string, SavedBuild[]>();
    for (const id of ids) m.set(id, listBuilds(id));
    setBuildsByCard(m);
  }, [ids]);

  // スカッド横断使用状況（client のみ）。usageStatus は自動変更しない。
  const [usageByCard, setUsageByCard] = useState<Map<string, { squadId: string; label: string }[]>>(new Map());
  useEffect(() => {
    const squads = listSquads();
    const m = new Map<string, { squadId: string; label: string }[]>();
    for (const id of ids) {
      const u = findSquadUsageByWorldCardId(squads, id);
      if (u.length === 0) continue;
      m.set(
        id,
        u.map((x) => ({
          squadId: x.squadId,
          label: `${x.squadName}（${x.formationName}${x.hasCustomPositioning ? tmt("customUsageSuffix") : ""}・${
            x.area === "starter"
              ? `${fillMt(tmt("starterUsageTemplate"), { role: x.placementRole ?? "?" })}${x.isCaptain ? tmt("captainUsageSuffix") : ""}`
              : tmt("benchUsageLabel")
          }）`,
        })),
      );
    }
    setUsageByCard(m);
  }, [ids, tmt, fillMt]);

  const rows: UserCardRow[] = useMemo(
    () =>
      myTeam.map((r) => ({
        worldCardId: r.worldCardId,
        addedAt: r.addedAt,
        card: cards.get(r.worldCardId) ?? null,
        inMyTeam: true,
        ownershipStatus: r.ownershipStatus,
      })),
    [myTeam, cards],
  );
  const facets = useMemo(() => facetsFromRows(rows), [rows]);
  const visible = useMemo(() => filterAndSortUserCards(rows, filter), [rows, filter]);
  const recByWorldId = useMemo(() => new Map(myTeam.map((r) => [r.worldCardId, r])), [myTeam]);

  const mainCount = myTeam.filter((r) => r.usageStatus === "main").length;
  const withBuilds = myTeam.filter((r) => (buildsByCard.get(r.worldCardId)?.length ?? 0) > 0).length;

  if (scopeStatus === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={tmt("pageTitle")} icon="shirt" description={tmt("pageDescription")} />
        <Surface padding="md">
          <p className="text-sm text-text-dim">{tmt("scopeLoadingMessage")}</p>
        </Surface>
      </div>
    );
  }

  if (myTeam.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={tmt("pageTitle")} icon="shirt" description={tmt("pageDescription")} />
        <LocalStorageNotice kind="my-team" />
        {legacySummary.hasData ? (
          <Surface tone="outline" padding="sm" className="flex flex-col gap-1.5">
            <p className="text-xs text-text-dim">
              {fillMt(tmt("legacyNoticeTemplate"), { count: String(legacySummary.itemCount) })}
            </p>
            <Link href="/account/local-data-migration" className="w-fit text-xs text-accent hover:underline">
              {tmt("migrationLinkLabel")}
            </Link>
          </Surface>
        ) : null}
        <EmptyState
          icon="shirt"
          title={tmt("emptyTitle")}
          description={tmt("emptyDescription")}
          action={
            <Link href="/players" className={buttonClasses("primary", "sm")}>
              {tmt("findPlayersLink")}
            </Link>
          }
          secondaryAction={
            <Link href="/favorites" className={buttonClasses("secondary", "sm")}>
              {tmt("viewFavoritesLink")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={tmt("pageTitle")} icon="shirt" description={tmt("pageDescription")} />
      <LocalStorageNotice kind="my-team" />
      {legacySummary.hasData ? (
        <Surface tone="outline" padding="sm" className="flex flex-col gap-1.5">
          <p className="text-xs text-text-dim">
            {fillMt(tmt("legacyNoticeTemplate"), { count: String(legacySummary.itemCount) })}
          </p>
          <Link href="/account/local-data-migration" className="w-fit text-xs text-accent hover:underline">
            {tmt("migrationLinkLabel")}
          </Link>
        </Surface>
      ) : null}
      {!available ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-2xs text-warning">
          {tmt("notAvailableNotice")}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-2xs text-danger">{error}</p>
      ) : null}

      <Surface padding="sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-2xs text-text-muted">{tmt("ownedCardCountLabel")}</dt>
            <dd className="font-bold tabular-nums">{myTeam.length}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tmt("totalFavoriteCountLabel")}</dt>
            <dd className="font-bold tabular-nums">{favoriteIds.size}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tmt("mainCardCountLabel")}</dt>
            <dd className="font-bold tabular-nums">{mainCount}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{tmt("buildsSavedCountLabel")}</dt>
            <dd className="font-bold tabular-nums">{withBuilds}</dd>
          </div>
        </dl>
        <p className="mt-1.5 text-2xs text-text-muted">{tmt("buildsSavedNote")}</p>
      </Surface>

      <UserCardFilters
        state={filter}
        onChange={setFilter}
        positions={facets.positions}
        cardTypes={facets.cardTypes}
        showOwnership
        total={myTeam.length}
        shown={visible.length}
      />

      {visible.length === 0 ? (
        <EmptyState
          variant="no-results"
          title={tmt("noResultsTitle")}
          description={tmt("noResultsDescription")}
          action={
            <button type="button" onClick={() => setFilter(DEFAULT_FILTER)} className={buttonClasses("primary", "sm")}>
              {tmt("clearFiltersButton")}
            </button>
          }
        />
      ) : (
        <>
          {loading ? <p className="text-2xs text-text-muted">{tmt("resolvingCards")}</p> : null}
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((row) => {
              const rec = recByWorldId.get(row.worldCardId);
              if (!rec) return null;
              const player = row.card;
              const name = resolvePlayerDisplayName(player ?? {}, locale, cardFallbackName(row.worldCardId));
              const builds = buildsByCard.get(row.worldCardId) ?? [];
              const buildRefs = resolveMyTeamBuildRefs(rec, builds);
              const selBuild = buildRefs.selected.build;
              return (
                <li key={rec.teamCardId}>
                  <UserCardTile
                    worldCardId={row.worldCardId}
                    card={player}
                    meta={{
                      addedAt: rec.addedAt,
                      note: rec.note,
                      tags: rec.tags,
                      ownershipStatus: rec.ownershipStatus,
                      usageStatus: rec.usageStatus,
                      buildCount: builds.length,
                      selectedBuildName: selBuild?.buildName ?? null,
                      squadUsage: usageByCard.get(row.worldCardId),
                    }}
                    showFavorite
                    extraActions={
                      <>
                        <button
                          type="button"
                          onClick={() => setEditRec(rec)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
                        >
                          <Icon name="pencil" size={12} />
                          {tmt("editButton")}
                        </button>
                        <Link
                          href={
                            selBuild
                              ? `/squads?card=${encodeURIComponent(row.worldCardId)}&build=${encodeURIComponent(selBuild.buildId)}`
                              : `/squads?card=${encodeURIComponent(row.worldCardId)}`
                          }
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
                        >
                          <Icon name="squad" size={12} />
                          {tmt("useInSquadLink")}
                        </Link>
                      </>
                    }
                    onRemove={() => setConfirmRec(rec)}
                    removeLabel={tmt("removeFromMyTeamLabel")}
                  />
                  <div className="mt-1 flex flex-col gap-1 rounded-md border border-border/60 bg-surface-2/30 px-2 py-1.5 text-2xs">
                    <p className="font-semibold text-text-dim">{tmt("savedBuildHeading")}</p>
                    <p>
                      {tmt("selectedPrefix")}
                      {buildRefs.selected.buildId == null ? (
                        <span className="text-text-muted">{tmt("noneLabel")}</span>
                      ) : buildRefs.selected.missing ? (
                        <span className="text-warning">{tmt("buildMissingLabel")}</span>
                      ) : (
                        <span className="text-accent">{buildRefs.selected.build?.buildName}</span>
                      )}
                      <span className="mx-1 text-text-muted">·</span>
                      {tmt("favoritePrefix")}
                      {buildRefs.favorite.buildId == null ? (
                        <span className="text-text-muted">{tmt("noneLabel")}</span>
                      ) : buildRefs.favorite.missing ? (
                        <span className="text-warning">{tmt("buildMissingLabel")}</span>
                      ) : (
                        <span className="text-yellow-300">{buildRefs.favorite.build?.buildName}</span>
                      )}
                      <span className="mx-1 text-text-muted">·</span>
                      <span className="text-text-muted">{fillMt(tmt("savedCountSuffix"), { count: String(builds.length) })}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {builds.length > 0 ? (
                        <label className="flex items-center gap-1">
                          <span className="text-text-dim">{tmt("quickSelectLabel")}</span>
                          <select
                            value={rec.selectedBuildId ?? ""}
                            onChange={(e) =>
                              updateMyTeamRecord(rec.teamCardId, { selectedBuildId: e.target.value || null })
                            }
                            aria-label={fillMt(tmt("selectedBuildAriaTemplate"), { name })}
                            className="rounded border border-border bg-surface px-1 py-0.5 text-2xs"
                          >
                            <option value="">{tmt("quickSelectNone")}</option>
                            {builds.map((b) => (
                              <option key={b.buildId} value={b.buildId}>
                                {b.buildName}
                                {!isV2RulesVersion(b.rulesVersion) ? tmt("legacyRulesSuffix") : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setBuildPanelRec(rec)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 font-semibold hover:border-accent"
                      >
                        <Icon name="sliders" size={12} />
                        {tmt("chooseBuildButton")}
                      </button>
                      {selBuild ? (
                        <Link
                          href={`/players/world/${encodeURIComponent(row.worldCardId)}?tab=progression`}
                          className="text-accent hover:underline"
                        >
                          {tmt("openInProgressionLink")}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editRec ? (
        <MyTeamAddDialog
          worldCardId={editRec.worldCardId}
          playerName={
            cards.get(editRec.worldCardId)?.nameJa ||
            cards.get(editRec.worldCardId)?.nameEn ||
            cardFallbackName(editRec.worldCardId)
          }
          open
          editRecord={editRec}
          onClose={() => setEditRec(null)}
        />
      ) : null}

      {buildPanelRec ? (
        <MyTeamBuildPanel
          worldCardId={buildPanelRec.worldCardId}
          card={cards.get(buildPanelRec.worldCardId) ?? null}
          teamCardId={buildPanelRec.teamCardId}
          onClose={() => setBuildPanelRec(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmRec != null}
        title={tmt("removeConfirmTitle")}
        danger
        confirmLabel={tmt("removeConfirmButton")}
        body={
          <>
            <p>
              {fillMt(tmt("removeConfirmBodyTemplate"), {
                name: confirmRec
                  ? cards.get(confirmRec.worldCardId)?.nameJa ||
                    cards.get(confirmRec.worldCardId)?.nameEn ||
                    cardFallbackName(confirmRec.worldCardId)
                  : "",
              })}
            </p>
            <p className="mt-1">{tmt("removeConfirmNote")}</p>
          </>
        }
        onCancel={() => setConfirmRec(null)}
        onConfirm={() => {
          if (confirmRec) removeFromMyTeam(confirmRec.teamCardId);
          setConfirmRec(null);
        }}
      />
    </div>
  );
}
