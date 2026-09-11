"use client";

import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

export type UserCardSort =
  | "added_desc"
  | "added_asc"
  | "ovr_desc"
  | "ovr_asc"
  | "name"
  | "position";

export interface UserCardFilterState {
  q: string;
  position: string;
  cardType: string;
  ownership: string;
  booster: string; // "" | "has" | "pom"
  sort: UserCardSort;
}

export const DEFAULT_FILTER: UserCardFilterState = {
  q: "",
  position: "",
  cardType: "",
  ownership: "",
  booster: "",
  sort: "added_desc",
};

function useSortOptions(): { value: UserCardSort; label: string }[] {
  const t = useT();
  const key = (k: keyof Dictionary["userCardFilters"]) => t("userCardFilters", k);
  return [
    { value: "added_desc", label: key("sortAddedDesc") },
    { value: "added_asc", label: key("sortAddedAsc") },
    { value: "ovr_desc", label: key("sortOvrDesc") },
    { value: "ovr_asc", label: key("sortOvrAsc") },
    { value: "name", label: key("sortName") },
    { value: "position", label: key("sortPosition") },
  ];
}

/**
 * お気に入り / My Team の一覧フィルター（登録済みカードだけを対象に client 側で解決）。
 * 全 13,009 カードを再取得しない。
 */
export function UserCardFilters({
  state,
  onChange,
  positions,
  cardTypes,
  showOwnership = false,
  total,
  shown,
}: {
  state: UserCardFilterState;
  onChange: (next: UserCardFilterState) => void;
  positions: string[];
  cardTypes: string[];
  showOwnership?: boolean;
  total: number;
  shown: number;
}) {
  const t = useT();
  const tuf = (k: keyof Dictionary["userCardFilters"]) => t("userCardFilters", k);
  const SORT_OPTIONS = useSortOptions();
  const set = (patch: Partial<UserCardFilterState>) => onChange({ ...state, ...patch });
  const active =
    state.q !== "" || state.position !== "" || state.cardType !== "" || state.ownership !== "" || state.booster !== "";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2/40 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1">
          <span className="sr-only">{tuf("searchSrLabel")}</span>
          <Icon name="search" size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={state.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={tuf("searchPlaceholder")}
            className="h-9 w-full rounded-md border border-border bg-surface px-2 pl-7 text-sm"
          />
        </label>

        <select
          value={state.sort}
          onChange={(e) => set({ sort: e.target.value as UserCardSort })}
          aria-label={tuf("sortAriaLabel")}
          className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={state.position}
          onChange={(e) => set({ position: e.target.value })}
          aria-label={tuf("positionFilterAriaLabel")}
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
        >
          <option value="">{tuf("positionFilterAll")}</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={state.cardType}
          onChange={(e) => set({ cardType: e.target.value })}
          aria-label={tuf("cardTypeFilterAriaLabel")}
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
        >
          <option value="">{tuf("cardTypeFilterAll")}</option>
          {cardTypes.map((ct) => (
            <option key={ct} value={ct}>
              {ct}
            </option>
          ))}
        </select>

        {showOwnership ? (
          <select
            value={state.ownership}
            onChange={(e) => set({ ownership: e.target.value })}
            aria-label={tuf("ownershipFilterAriaLabel")}
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
          >
            <option value="">{tuf("ownershipFilterAll")}</option>
            <option value="owned">{tuf("ownershipOwned")}</option>
            <option value="wanted">{tuf("ownershipWanted")}</option>
            <option value="released">{tuf("ownershipReleased")}</option>
            <option value="unknown">{tuf("ownershipUnknown")}</option>
          </select>
        ) : (
          <select
            value={state.ownership}
            onChange={(e) => set({ ownership: e.target.value })}
            aria-label={tuf("inTeamFilterAriaLabel")}
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
          >
            <option value="">{tuf("inTeamFilterAll")}</option>
            <option value="in_team">{tuf("inTeamFilterYes")}</option>
            <option value="not_in_team">{tuf("inTeamFilterNo")}</option>
          </select>
        )}

        <select
          value={state.booster}
          onChange={(e) => set({ booster: e.target.value })}
          aria-label={tuf("boosterFilterAriaLabel")}
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
        >
          <option value="">{tuf("boosterFilterAll")}</option>
          <option value="has">{tuf("boosterFilterHas")}</option>
          <option value="pom">{tuf("boosterFilterPom")}</option>
        </select>

        {active ? (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTER, sort: state.sort })}
            className="h-8 rounded-md border border-border px-2 text-xs text-text-dim hover:border-accent"
          >
            {tuf("clearFiltersButton")}
          </button>
        ) : null}

        <span className="ml-auto text-2xs text-text-muted">
          {tuf("countTemplate").replace("{shown}", String(shown)).replace("{total}", String(total))}
        </span>
      </div>
    </div>
  );
}
