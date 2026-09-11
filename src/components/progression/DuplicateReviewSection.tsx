"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_DUPLICATE_REVIEW_FILTER,
  DUPLICATE_REVIEW_SORT_KEYS,
  filterDuplicateReviewGroups,
  sortDuplicateReviewGroups,
  type DuplicateGroup,
  type DuplicateReview,
  type DuplicateReviewFilter,
  type DuplicateReviewSortKey,
} from "@/lib/progression/build-duplicate-review";
import { buildAllocationRows, describeBuildPoM, formatBuildTimestamp } from "@/lib/progression/my-builds";
import { resolveCardImageSources } from "@/lib/world/image";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";

function useSortLabels(): Record<DuplicateReviewSortKey, string> {
  const t = useT();
  const drs = (k: keyof Dictionary["duplicateReviewSection"]) => t("duplicateReviewSection", k);
  return {
    updated_desc: drs("sortUpdatedDesc"),
    created_desc: drs("sortCreatedDesc"),
    size_desc: drs("sortSizeDesc"),
    refs_desc: drs("sortRefsDesc"),
    unused_first: drs("sortUnusedFirst"),
    used_first: drs("sortUsedFirst"),
    player_asc: drs("sortPlayerAsc"),
    name_asc: drs("sortNameAsc"),
    id_stable: drs("sortIdStable"),
  };
}

/**
 * 保存ビルド「重複候補」確認セクション（`/build-inventory` 内・読み取り専用）。
 * 削除・統合・上書き・付け替えは行わない。既存 `buildInventory()` の結果から作った
 * `DuplicateReview` を表示するだけ（この画面で保存・再計算はしない）。
 */
export function DuplicateReviewSection({
  review,
  staleBuild,
  staleMyTeam,
  staleSquad,
  onReload,
}: {
  review: DuplicateReview;
  staleBuild: boolean;
  staleMyTeam: boolean;
  staleSquad: boolean;
  onReload: () => void;
}) {
  const t = useT();
  const drs = (k: keyof Dictionary["duplicateReviewSection"]) => t("duplicateReviewSection", k);
  const fillDrs = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const SORT_LABEL = useSortLabels();
  const [filter, setFilter] = useState<DuplicateReviewFilter>(DEFAULT_DUPLICATE_REVIEW_FILTER);
  const [sort, setSort] = useState<DuplicateReviewSortKey>("updated_desc");

  const visible = useMemo(
    () => sortDuplicateReviewGroups(filterDuplicateReviewGroups(review.groups, filter), sort),
    [review.groups, filter, sort],
  );

  const s = review.summary;
  const stale = staleBuild || staleMyTeam || staleSquad;
  const hasAny = s.exactGroupCount > 0 || s.similarGroupCount > 0;
  const hasUnresolved = review.unresolved.length > 0;

  const filterActive =
    filter.q.trim() !== "" ||
    filter.kind !== "all" ||
    filter.usage !== "all" ||
    filter.myTeamRef ||
    filter.squadRef ||
    filter.multiUse ||
    filter.rules !== "all" ||
    filter.pom ||
    filter.experimental ||
    filter.cardType != null ||
    filter.position != null;

  return (
    <details open={hasAny || hasUnresolved} className="rounded-md border border-border bg-surface-2/30 [&_summary]:list-none">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-text-dim">
        <Icon name="copy" size={14} className={hasAny ? "text-warning" : ""} />
        {fillDrs(drs("headingTemplate"), { count: String(s.exactGroupCount + s.similarGroupCount) })}
      </summary>
      <div className="flex flex-col gap-3 border-t border-border/60 p-3 text-2xs">
        <p className="text-text-dim">{drs("intro1")}</p>
        <p className="text-text-dim">{drs("intro2")}</p>
        <p className="text-text-dim">{drs("intro3")}</p>

        {stale ? (
          <div
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 rounded border border-info/40 bg-info/10 px-2 py-1.5 text-info"
          >
            <Icon name="refresh" size={14} className="shrink-0" />
            <span>
              {fillDrs(drs("staleNoticeTemplate"), {
                targets: [staleBuild ? drs("staleBuildLabel") : null, staleMyTeam ? drs("staleMyTeamLabel") : null, staleSquad ? drs("staleSquadLabel") : null]
                  .filter(Boolean)
                  .join(" / "),
              })}
            </span>
            <button
              type="button"
              onClick={onReload}
              className="rounded border border-info/50 px-2 py-0.5 font-semibold hover:bg-info/10"
            >
              {t("buildExportModal", "reloadButton")}
            </button>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          <Stat label={drs("totalBuildsLabel")} value={s.totalBuilds} unit={drs("unitBuildSuffix")} />
          <Stat label={drs("exactGroupCountLabel")} value={s.exactGroupCount} unit={drs("unitGroupSuffix")} warn={s.exactGroupCount > 0} />
          <Stat label={drs("exactBuildCountLabel")} value={s.exactBuildCount} unit={drs("unitBuildSuffix")} warn={s.exactBuildCount > 0} />
          <Stat label={drs("similarGroupCountLabel")} value={s.similarGroupCount} unit={drs("unitGroupSuffix")} warn={s.similarGroupCount > 0} />
          <Stat label={drs("similarBuildCountLabel")} value={s.similarBuildCount} unit={drs("unitBuildSuffix")} warn={s.similarBuildCount > 0} />
          <Stat label={drs("noCandidateLabel")} value={s.noCandidateBuilds} unit={drs("unitBuildSuffix")} />
          <Stat label={drs("unresolvedLabel")} value={s.unresolvedBuilds} unit={drs("unitBuildSuffix")} warn={s.unresolvedBuilds > 0} />
          <Stat label={drs("usedCandidateLabel")} value={s.usedCandidateBuilds} unit={drs("unitBuildSuffix")} />
          <Stat label={drs("unusedCandidateLabel")} value={s.unusedCandidateBuilds} unit={drs("unitBuildSuffix")} />
          <Stat label={drs("myTeamRefCandidateLabel")} value={s.myTeamRefCandidateBuilds} unit={drs("unitBuildSuffix")} />
          <Stat label={drs("squadRefCandidateLabel")} value={s.squadRefCandidateBuilds} unit={drs("unitBuildSuffix")} />
        </dl>
        <p className="text-text-muted">
          {drs("footnote")}
          {drs("statusLabel")}
          <span className={hasAny ? "text-warning font-semibold" : "text-accent font-semibold"}>
            {hasAny ? drs("statusWarning") : drs("statusNormal")}
          </span>
          {hasUnresolved ? <span className="ml-1 font-semibold text-warning">{drs("unresolvedSuffix")}</span> : null}
        </p>

        {hasUnresolved ? (
          <details className="rounded border border-warning/40 bg-warning/5 p-2">
            <summary className="cursor-pointer font-semibold text-warning">
              {fillDrs(drs("unresolvedSummaryTemplate"), { count: String(review.unresolved.length) })}
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {review.unresolved.map((u, i) => (
                <li key={i} className="rounded border border-border/60 p-1.5">
                  <span className="text-text-dim">{u.reasonLabel}</span>
                  <span className="ml-2 text-text-muted">
                    {u.worldCardId ? fillDrs(drs("worldIdTemplate"), { id: u.worldCardId }) : drs("worldIdUnknown")} /{" "}
                    {u.buildId ? fillDrs(drs("buildIdTemplate"), { id: u.buildId }) : drs("buildIdUnknown")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-text-muted">{drs("unresolvedFootnote")}</p>
          </details>
        ) : null}

        {!s.similarSupported ? (
          <p className="rounded border border-border/60 bg-surface p-2 text-text-muted">{drs("similarUnsupportedNote")}</p>
        ) : null}

        <FilterBar
          filter={filter}
          setFilter={setFilter}
          sort={sort}
          setSort={setSort}
          filterActive={filterActive}
          cardTypes={review.cardTypes}
          positions={review.positions}
          sortLabels={SORT_LABEL}
        />

        {s.totalBuilds === 0 ? (
          <p className="text-text-muted">{drs("noBuildsLabel")}</p>
        ) : review.groups.length === 0 ? (
          <p className="text-text-muted">{drs("noExactMatchLabel")}</p>
        ) : visible.length === 0 ? (
          <p className="text-text-muted">{drs("noMatchingCandidatesLabel")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((g) => (
              <li key={g.id}>
                <DuplicateGroupCard group={g} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function FilterBar({
  filter,
  setFilter,
  sort,
  setSort,
  filterActive,
  cardTypes,
  positions,
  sortLabels,
}: {
  filter: DuplicateReviewFilter;
  setFilter: (f: DuplicateReviewFilter | ((f: DuplicateReviewFilter) => DuplicateReviewFilter)) => void;
  sort: DuplicateReviewSortKey;
  setSort: (k: DuplicateReviewSortKey) => void;
  filterActive: boolean;
  cardTypes: string[];
  positions: string[];
  sortLabels: Record<DuplicateReviewSortKey, string>;
}) {
  const t = useT();
  const drs = (k: keyof Dictionary["duplicateReviewSection"]) => t("duplicateReviewSection", k);
  return (
    <details className="rounded border border-border bg-surface [&_summary]:list-none">
      <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 font-semibold text-text-dim">
        <Icon name="filter" size={13} />
        {drs("searchFilterSortHeading")}
        {filterActive ? <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">{drs("filterActiveLabel")}</span> : null}
      </summary>
      <div className="flex flex-col gap-2 border-t border-border/60 p-2">
        <label className="flex flex-col gap-1 text-text-dim">
          {drs("searchLabel")}
          <input
            type="text"
            value={filter.q}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
            aria-label={drs("searchAriaLabel")}
            className="rounded border border-border bg-surface-2 px-2 py-1 text-xs"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Sel label={drs("kindFilterLabel")} value={filter.kind} onChange={(v) => setFilter((f) => ({ ...f, kind: v as DuplicateReviewFilter["kind"] }))}
            options={[["all", drs("allOption")], ["exact", drs("exactOption")], ["similar", drs("similarOption")]]} />
          <Sel label={drs("usageFilterLabel")} value={filter.usage} onChange={(v) => setFilter((f) => ({ ...f, usage: v as DuplicateReviewFilter["usage"] }))}
            options={[["all", drs("allOption")], ["used", drs("usedOption")], ["unused", drs("unusedOption")]]} />
          <Sel label={drs("rulesFilterLabel")} value={filter.rules} onChange={(v) => setFilter((f) => ({ ...f, rules: v as DuplicateReviewFilter["rules"] }))}
            options={[["all", drs("allOption")], ["current", drs("currentRulesOption")], ["legacy", drs("legacyRulesOption")]]} />
          <Sel label={drs("cardTypeFilterLabel")} value={filter.cardType ?? ""} onChange={(v) => setFilter((f) => ({ ...f, cardType: v || null }))}
            options={[["", drs("allOption")], ...cardTypes.map((ct) => [ct, ct] as [string, string])]} />
          <Sel label={drs("registeredPositionFilterLabel")} value={filter.position ?? ""} onChange={(v) => setFilter((f) => ({ ...f, position: v || null }))}
            options={[["", drs("allOption")], ...positions.map((p) => [p, p] as [string, string])]} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Chk label={drs("myTeamRefCheckLabel")} checked={filter.myTeamRef} onChange={(c) => setFilter((f) => ({ ...f, myTeamRef: c }))} />
          <Chk label={drs("squadRefCheckLabel")} checked={filter.squadRef} onChange={(c) => setFilter((f) => ({ ...f, squadRef: c }))} />
          <Chk label={drs("multiUseCheckLabel")} checked={filter.multiUse} onChange={(c) => setFilter((f) => ({ ...f, multiUse: c }))} />
          <Chk label={drs("pomCheckLabel")} checked={filter.pom} onChange={(c) => setFilter((f) => ({ ...f, pom: c }))} />
          <Chk label={drs("experimentalCheckLabel")} checked={filter.experimental} onChange={(c) => setFilter((f) => ({ ...f, experimental: c }))} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-text-dim">
            {drs("sortLabel")}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as DuplicateReviewSortKey)}
              aria-label={drs("sortLabel")}
              className="rounded border border-border bg-surface-2 px-1.5 py-1 text-xs"
            >
              {DUPLICATE_REVIEW_SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {sortLabels[k]}
                </option>
              ))}
            </select>
          </label>
          {filterActive ? (
            <button
              type="button"
              onClick={() => setFilter(DEFAULT_DUPLICATE_REVIEW_FILTER)}
              className="rounded border border-border px-2 py-1 hover:border-accent"
            >
              {drs("clearSearchButton")}
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function DuplicateGroupCard({ group: g }: { group: DuplicateGroup }) {
  const t = useT();
  const { locale } = useLocale();
  const drs = (k: keyof Dictionary["duplicateReviewSection"]) => t("duplicateReviewSection", k);
  const fillDrs = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const fallbackName = t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", g.worldCardId);
  const name = resolvePlayerDisplayName(g.card ?? {}, locale, fallbackName);
  const sources = g.card
    ? resolveCardImageSources({
        worldCardId: g.card.worldCardId,
        efhubCardId: g.card.efhubCardId,
        hasEfhubLink: g.card.hasEfhubLink,
        hasWorldImage: g.card.imageUrlCandidate != null,
        hasWorldMobileImage: g.card.mobileImageUrlCandidate != null,
      })
    : [];
  const detailHref = `/players/world/${encodeURIComponent(g.worldCardId)}`;
  const squadLinks = new Map<string, string>();
  for (const b of g.builds) for (const sq of b.squads) squadLinks.set(sq.squadId, sq.squadName);

  return (
    <div className="rounded-card border border-border bg-surface p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={g.kind === "exact" ? "warning" : "info"} size="xs">
          {g.kind === "exact" ? drs("exactBadge") : drs("similarBadge")}
        </Badge>
        <Badge tone={g.ruleKind === "current" ? "neutral" : "warning"} size="xs">
          {g.ruleLabel}
        </Badge>
        <span className="font-semibold">
          {g.buildCount}
          {drs("buildCountSuffix")}
        </span>
        {g.anyUsed ? <Badge tone="accent" size="xs">{drs("anyUsedBadge")}</Badge> : <Badge tone="outline" size="xs">{drs("allUnusedBadge")}</Badge>}
      </div>
      <div className="mt-1.5 flex gap-2">
        <Link href={detailHref} className="w-12 shrink-0" aria-label={fillDrs(t("myBuildCard", "selectPlayerDetailAriaTemplate"), { name })}>
          <WorldCardImage
            sources={sources}
            alt={g.card ? fillDrs(t("squadBuildPanel", "cardImageAltTemplate"), { name }) : t("myBuildCard", "cardImageAltResolving")}
            size="card"
          />
        </Link>
        <div className="min-w-0">
          <Link href={detailHref} className="block truncate font-semibold hover:text-accent" title={name}>
            {name}
          </Link>
          <p className="truncate text-text-muted">
            {g.card?.cardType ?? t("worldPlayerSearchCard", "unknownCardType")} / {g.card?.registeredPosition ?? t("worldPlayerSearchCard", "unknownPosition")} / World ID {g.worldCardId}
          </p>
        </div>
      </div>

      <div className="mt-2 rounded border border-border/60 bg-surface-2/40 p-2">
        <p className="font-semibold text-text-dim">{drs("matchingFieldsHeading")}</p>
        <p className="mt-0.5 text-text-dim">{g.sameFields.join(" / ")}</p>
        {g.diffFields.length > 0 ? (
          <>
            <p className="mt-1 font-semibold text-text-dim">{drs("differingFieldsHeading")}</p>
            <p className="mt-0.5 text-text-dim">{g.diffFields.join(" / ")}</p>
          </>
        ) : null}
        {g.kind === "similar" && g.reasonLabel ? (
          <p className="mt-1 text-warning">{fillDrs(drs("similarReasonTemplate"), { reason: g.reasonLabel })}</p>
        ) : null}
      </div>

      <ul className="mt-2 flex flex-col gap-1.5">
        {g.builds.map((b) => (
          <li key={b.build.buildId} className="rounded border border-border/60 p-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-semibold">{b.build.buildName}</span>
              {b.used ? (
                <Badge tone="accent" size="xs">
                  {fillDrs(drs("usedRefTemplate"), { count: String(b.refCount) })}
                </Badge>
              ) : (
                <Badge tone="outline" size="xs">{drs("unusedBadge")}</Badge>
              )}
              {b.multiUse ? <Badge tone="accent" size="xs">{drs("multiUseBadge")}</Badge> : null}
              {b.pom ? <Badge tone="outline" size="xs">{drs("pomBadge")}</Badge> : null}
              {b.experimental ? <Badge tone="outline" size="xs">{drs("experimentalBadge")}</Badge> : null}
            </div>
            <p className="mt-0.5 text-text-muted">
              buildId {b.build.buildId} / rulesVersion {b.build.rulesVersion}
            </p>
            <AllocationLine build={b.build} />
            <p className="mt-0.5 text-text-dim">
              {drs("selectedBoosterLabel")}
              {b.build.selectedPlayerBooster ?? t("squadBuildPanel", "pomUnspecified")}
              {drs("pomFieldLabel")}
              {describeBuildPoM(b.build).has ? describeBuildPoM(b.build).tierLabel : t("squadBuildPanel", "pomUnspecified")}
            </p>
            <p className="mt-0.5 text-text-dim">
              {drs("estimatedOvrLabel")}
              {b.build.calculatedOvr ?? "—"}
            </p>
            <p className="mt-0.5 text-text-muted">
              {fillDrs(t("squadBuildPanel", "createdUpdatedTemplate"), {
                created: formatBuildTimestamp(b.build.createdAt),
                updated: formatBuildTimestamp(b.build.updatedAt),
              })}
            </p>
            <p className="mt-0.5 text-text-dim">
              {b.myTeamSelectedCount > 0 ? drs("myTeamSelectedInline") : ""}
              {b.myTeamFavoriteCount > 0 ? drs("myTeamFavoriteInline") : ""}
              {b.squads.length > 0
                ? b.squads.map((sq) => fillDrs(t("myBuildCard", "squadUsingLinkTemplate"), { name: sq.squadName })).join(" / ")
                : b.used
                  ? ""
                  : drs("noReferenceLabel")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Link href="/my-builds" className="inline-flex min-h-[32px] items-center gap-1 rounded border border-border px-2 hover:border-accent">
                <Icon name="sliders" size={11} />
                {t("buildInventoryView", "manageInMyBuildsLink")}
              </Link>
              <Link href={`${detailHref}?tab=progression`} className="inline-flex min-h-[32px] items-center gap-1 rounded border border-border px-2 hover:border-accent">
                <Icon name="sliders" size={11} />
                {t("myBuildCard", "openProgressionLink")}
              </Link>
              {b.myTeamSelectedCount > 0 || b.myTeamFavoriteCount > 0 ? (
                <Link href="/my-team" className="inline-flex min-h-[32px] items-center gap-1 rounded border border-border px-2 hover:border-accent">
                  <Icon name="shirt" size={11} />
                  {drs("openMyTeamLink")}
                </Link>
              ) : null}
              {b.squads.map((sq) => (
                <Link
                  key={sq.squadId}
                  href={`/squads/${encodeURIComponent(sq.squadId)}`}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded border border-border px-2 hover:border-accent"
                >
                  <Icon name="squad" size={11} />
                  {fillDrs(drs("openSquadTemplate"), { name: sq.squadName })}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-1.5">
        <Link href={detailHref} className="inline-flex min-h-[32px] items-center gap-1 rounded border border-border px-2 hover:border-accent">
          <Icon name="players" size={11} />
          {t("myBuildCard", "playerDetailLink")}
        </Link>
      </div>
    </div>
  );
}

function AllocationLine({ build }: { build: DuplicateGroup["builds"][number]["build"] }) {
  const t = useT();
  const active = buildAllocationRows(build.progressionAllocation).filter((r) => r.level > 0);
  return (
    <p className="mt-0.5 text-text-dim">
      {t("buildImportModal", "allocationLabelTemplate").replace(
        "{allocation}",
        active.length > 0 ? active.map((r) => `${r.label} Lv${r.level}`).join(" / ") : t("squadBuildPanel", "noAllocationBase"),
      )}
    </p>
  );
}

function Stat({ label, value, unit, warn = false }: { label: string; value: number; unit: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className={`font-bold tabular-nums ${warn && value > 0 ? "text-warning" : ""}`}>
        {value} <span className="font-normal text-text-muted">{unit}</span>
      </dd>
    </div>
  );
}

function Sel({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-text-dim">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded border border-border bg-surface-2 px-1.5 py-1 text-xs"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 text-text-dim">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
