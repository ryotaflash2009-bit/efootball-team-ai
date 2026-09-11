"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ManagerContext } from "@/lib/progression/types";
import type { ManagerDetail, ManagerListItem, ManagerSortKey } from "@/lib/managers/types";
import { managerToContext } from "@/lib/managers/to-context";
import { Drawer } from "@/components/ui/Overlay";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Input, Select } from "@/components/ui/Field";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProficiencyBar } from "./ProficiencyBar";
import { TACTICS, topTactic, tacticTier, TACTIC_TEXT, managerInitials } from "./tactics";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

function useSorts(): { value: ManagerSortKey; label: string }[] {
  const t = useT();
  const key = (k: keyof Dictionary["managerPicker"]) => t("managerPicker", k);
  return [
    { value: "name", label: key("sortName") },
    { value: "released_desc", label: key("sortReleasedDesc") },
    { value: "released_asc", label: key("sortReleasedAsc") },
    { value: "possession_desc", label: key("sortPossessionDesc") },
    { value: "quick_counter_desc", label: key("sortQuickCounterDesc") },
    { value: "long_ball_counter_desc", label: key("sortLongBallCounterDesc") },
    { value: "out_wide_desc", label: key("sortOutWideDesc") },
    { value: "long_ball_desc", label: key("sortLongBallDesc") },
    { value: "overload_desc", label: key("sortOverloadDesc") },
  ];
}

/**
 * 共通の監督選択コンポーネント（育成 / 比較 / スカッドで再利用）。
 * 名前を知らなくても、得意戦術・ブースター・Link-Up Play を確認して一覧カードから選べる。
 * PC: 右からのワイドドロワー。モバイル: 全画面に近いドロワー。
 */
export function ManagerPicker({
  open,
  onClose,
  currentManagerId,
  onSelect,
  title,
}: {
  open: boolean;
  onClose: () => void;
  currentManagerId: number | null;
  /** ctx=null は「監督なし」。detail は選択時のみ。 */
  onSelect: (ctx: ManagerContext | null, detail: ManagerDetail | null) => void;
  title?: string;
}) {
  const t = useT();
  const SORTS = useSorts();
  const resolvedTitle = title ?? t("managerPicker", "defaultTitle");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ManagerSortKey>("name");
  const [topTacticFilter, setTopTacticFilter] = useState("");
  const [hasBooster, setHasBooster] = useState("");
  const [hasLinkUp, setHasLinkUp] = useState("");
  const [year, setYear] = useState("");
  const [dq, setDq] = useState("");
  const [managers, setManagers] = useState<ManagerListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ManagerDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    const sp = new URLSearchParams({ pageSize: "100", sort });
    if (dq.trim()) sp.set("q", dq.trim());
    if (hasBooster) sp.set("hasBooster", hasBooster);
    if (hasLinkUp) sp.set("hasLinkUpPlay", hasLinkUp);
    setError(null);
    setManagers(null);
    fetch(`/api/managers?${sp.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setManagers(Array.isArray(data.managers) ? data.managers : []))
      .catch(() => setError(t("managerPicker", "loadError")));
  }, [dq, sort, hasBooster, hasLinkUp, t]);

  useEffect(() => {
    if (!open) return;
    setDetailId(null);
    load();
  }, [open, load]);

  function onQuery(v: string) {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setDq(v), 250);
  }
  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const years = useMemo(() => {
    if (!managers) return [];
    const set = new Set<string>();
    for (const m of managers) {
      const y = m.releasedAt?.slice(0, 4);
      if (y && /^\d{4}$/.test(y)) set.add(y);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [managers]);

  const filtered = useMemo(() => {
    if (!managers) return null;
    return managers.filter(
      (m) =>
        (!topTacticFilter || topTactic(m.proficiencies)?.abbr === topTacticFilter) &&
        (!year || m.releasedAt?.slice(0, 4) === year),
    );
  }, [managers, topTacticFilter, year]);

  // 詳細取得
  useEffect(() => {
    if (detailId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    fetch(`/api/managers/${detailId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data: { manager: ManagerDetail }) => !cancelled && setDetail(data.manager))
      .catch(() => !cancelled && setError(t("managerPicker", "detailError")));
    return () => {
      cancelled = true;
    };
  }, [detailId, t]);

  async function choose(id: number) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/managers/${id}`);
      if (!r.ok) throw new Error();
      const data = (await r.json()) as { manager: ManagerDetail };
      onSelect(managerToContext(data.manager), data.manager);
      onClose();
    } catch {
      setError(t("managerPicker", "chooseError"));
    } finally {
      setBusy(false);
    }
  }

  const controlCls = "h-9 rounded-md border border-border bg-surface-2 px-2 text-xs";

  return (
    <Drawer open={open} onClose={onClose} title={resolvedTitle}>
      {detailId != null ? (
        <PickerDetail
          detail={detail}
          isCurrent={detailId === currentManagerId}
          onBack={() => setDetailId(null)}
          onChoose={() => choose(detailId)}
          busy={busy}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* 現在の選択 + 監督なし */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2/40 px-3 py-2 text-xs">
            <span className="text-text-dim">
              {t("managerPicker", "currentPrefix")}
              {currentManagerId != null ? `${t("managerPicker", "currentIdPrefix")}${currentManagerId}` : t("managerPicker", "currentNone")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelect(null, null);
                onClose();
              }}
              className="text-danger"
            >
              {t("managerPicker", "setNoManager")}
            </Button>
          </div>

          {/* 検索 */}
          <Input
            label={t("managerPicker", "searchLabel")}
            type="search"
            value={q}
            maxLength={80}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("managerPicker", "searchPlaceholder")}
          />

          {/* フィルター */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select value={topTacticFilter} onChange={(e) => setTopTacticFilter(e.target.value)} aria-label={t("managerPicker", "tacticFilterAria")} className={controlCls}>
              <option value="">{t("managerPicker", "tacticFilterAll")}</option>
              {TACTICS.map((tac) => (
                <option key={tac.key} value={tac.abbr}>
                  {tac.abbr} {tac.en}
                </option>
              ))}
            </select>
            <select value={hasBooster} onChange={(e) => setHasBooster(e.target.value)} aria-label={t("managerPicker", "boosterFilterAria")} className={controlCls}>
              <option value="">{t("managerPicker", "boosterFilterAll")}</option>
              <option value="1">{t("managerPicker", "boosterFilterHas")}</option>
              <option value="0">{t("managerPicker", "boosterFilterNone")}</option>
            </select>
            <select value={hasLinkUp} onChange={(e) => setHasLinkUp(e.target.value)} aria-label={t("managerPicker", "linkUpFilterAria")} className={controlCls}>
              <option value="">{t("managerPicker", "linkUpFilterAll")}</option>
              <option value="1">{t("managerPicker", "linkUpFilterHas")}</option>
              <option value="0">{t("managerPicker", "linkUpFilterNone")}</option>
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} aria-label={t("managerPicker", "yearFilterAria")} className={controlCls}>
              <option value="">{t("managerPicker", "yearFilterAll")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                  {t("managerPicker", "yearSuffix")}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as ManagerSortKey)} aria-label={t("managerPicker", "sortAria")} className={controlCls}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* 略称凡例 */}
          <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-2xs text-text-muted">
            {TACTICS.map((tac) => (
              <span key={tac.key}>
                <b className="text-text-dim">{tac.abbr}</b> {tac.en}
              </span>
            ))}
          </p>

          {error ? <p className="text-xs text-danger">{error}</p> : null}

          {/* 一覧 */}
          {filtered == null ? (
            <LoadingState variant="list" count={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="no-results"
              title={t("managerPicker", "noResultsTitle")}
              description={t("managerPicker", "noResultsDescription")}
            />
          ) : (
            <>
              <p className="text-2xs text-text-muted">
                {filtered.length}
                {t("managerPicker", "countSuffix")}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {filtered.map((m) => (
                  <li key={m.internalManagerId}>
                    <PickerCard
                      manager={m}
                      isCurrent={m.internalManagerId === currentManagerId}
                      onDetail={() => setDetailId(m.internalManagerId)}
                      onChoose={() => choose(m.internalManagerId)}
                      busy={busy}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

function PickerCard({
  manager,
  isCurrent,
  onDetail,
  onChoose,
  busy,
}: {
  manager: ManagerListItem;
  isCurrent: boolean;
  onDetail: () => void;
  onChoose: () => void;
  busy: boolean;
}) {
  const top = topTactic(manager.proficiencies);
  const t = useT();
  const { locale } = useLocale();
  const displayName = resolvePlayerDisplayName(manager, locale, manager.nameEn);
  return (
    <div
      className={`flex h-full flex-col rounded-md border p-2.5 ${
        isCurrent ? "border-accent bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-black text-text-dim">
          {managerInitials(manager.nameEn)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {displayName}
            {isCurrent ? <span className="ml-1 text-2xs text-accent">{t("managerPicker", "selectedBadge")}</span> : null}
          </p>
          <p className="text-2xs text-text-muted">
            {t("managerPicker", "releasedPrefix")}
            {manager.releasedAt ?? t("managerPicker", "unknownReleased")} · {t("managerPicker", "idPrefix")}
            {manager.internalManagerId}
          </p>
        </div>
      </div>
      {top ? (
        <p className="mt-1.5 text-xs">
          {t("managerPicker", "bestTacticPrefix")}
          <span className="font-semibold">{top.en}</span>{" "}
          <span className={`font-black tabular-nums ${TACTIC_TEXT[tacticTier(top.value)]}`}>{top.value}</span>
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {manager.hasLinkUpPlay ? <Badge tone="info" size="xs">Link-Up</Badge> : null}
        {manager.boosterSummary.length > 0 ? (
          manager.boosterSummary.map((b, i) => (
            <Badge key={i} tone="accent" size="xs">
              {b}
            </Badge>
          ))
        ) : (
          <Badge tone="outline" size="xs">{t("managerPicker", "noBoosterBadge")}</Badge>
        )}
      </div>
      <div className="mt-1.5">
        <ProficiencyBar proficiencies={manager.proficiencies} compact />
      </div>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={onDetail}
          className="flex-1 rounded border border-border px-2 py-1 text-2xs hover:border-accent"
        >
          {t("managerPicker", "viewDetail")}
        </button>
        <button
          type="button"
          onClick={onChoose}
          disabled={busy}
          className={`flex-1 rounded border px-2 py-1 text-2xs font-semibold ${
            isCurrent ? "border-accent text-accent" : "border-accent bg-accent-soft text-accent"
          } disabled:opacity-50`}
        >
          {isCurrent ? t("managerPicker", "selectedBadge") : t("managerPicker", "chooseThis")}
        </button>
      </div>
    </div>
  );
}

function PickerDetail({
  detail,
  isCurrent,
  onBack,
  onChoose,
  busy,
}: {
  detail: ManagerDetail | null;
  isCurrent: boolean;
  onBack: () => void;
  onChoose: () => void;
  busy: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  if (!detail) return <LoadingState variant="detail" />;
  const top = topTactic(detail.proficiencies);
  const displayName = resolvePlayerDisplayName(detail, locale, detail.nameEn);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1 text-sm text-text-dim hover:text-accent">
        <Icon name="chevron-left" size={16} />
        {t("managerPicker", "backToList")}
      </button>

      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-surface-3 text-lg font-black text-text-dim">
          {managerInitials(detail.nameEn)}
        </span>
        <div>
          <h3 className="text-lg font-bold">{displayName}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="neutral" size="xs">
              {t("managerPicker", "releasedPrefix")}
              {detail.releasedAt ?? t("managerPicker", "unknownReleased")}
            </Badge>
            <Badge tone="outline" size="xs">
              {t("managerPicker", "idPrefix")}
              {detail.internalManagerId}
            </Badge>
            {detail.hasLinkUpPlay ? <Badge tone="info" size="xs">Link-Up Play</Badge> : null}
          </div>
        </div>
      </div>

      {top ? (
        <p className="text-sm">
          {t("managerPicker", "bestTacticPrefix")}
          <span className="font-semibold">{top.en}</span>{" "}
          <span className={`text-xl font-black tabular-nums ${TACTIC_TEXT[tacticTier(top.value)]}`}>{top.value}</span>
        </p>
      ) : null}

      <section>
        <h4 className="mb-1.5 text-sm font-semibold">{t("managerPicker", "proficienciesHeading")}</h4>
        <ProficiencyBar proficiencies={detail.proficiencies} showRank />
      </section>

      <section>
        <h4 className="mb-1.5 text-sm font-semibold">{t("managerPicker", "boostersHeading")}</h4>
        {detail.boosters.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-xs">
            {detail.boosters.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-surface-2/40 px-2 py-1.5">
                <span className="font-medium">{b.statNameEn}</span>
                <span className="rounded bg-success/15 px-1.5 py-0.5 font-bold text-success">{b.rawValue}</span>
                <Badge tone={b.confirmationStatus === "confirmed" && b.statKey ? "success" : "warning"} size="xs">
                  {b.confirmationStatus === "confirmed" && b.statKey ? "confirmed" : b.confirmationStatus}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-dim">{t("managerPicker", "noBoosterMessage")}</p>
        )}
        <p className="mt-1 text-2xs text-text-muted">{t("managerPicker", "boosterApplicationNote")}</p>
      </section>

      {detail.linkUpPlays.length > 0 ? (
        <section>
          <h4 className="mb-1.5 text-sm font-semibold">{t("managerPicker", "linkUpHeading")}</h4>
          <ul className="flex flex-col gap-2 text-xs">
            {detail.linkUpPlays.map((lu, i) => (
              <li key={i} className="rounded border border-border/60 bg-surface-2/40 p-2">
                <p className="font-semibold">{lu.name}</p>
                <p className="mt-0.5 text-text-dim">
                  {t("managerPicker", "centerPiecePrefix")}
                  {lu.centerPiece ? `${lu.centerPiece.playingStyle ?? "?"} / ${lu.centerPiece.positions.join(", ") || "?"}` : "—"}
                </p>
                <p className="text-text-dim">
                  {t("managerPicker", "keyManPrefix")}
                  {lu.keyMan ? `${lu.keyMan.playingStyle ?? "?"} / ${lu.keyMan.positions.join(", ") || "?"}` : "—"}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-2xs text-text-muted">{t("managerPicker", "linkUpNote")}</p>
        </section>
      ) : null}

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-surface px-4 py-3">
        <button
          type="button"
          onClick={onChoose}
          disabled={busy}
          className={`${buttonClasses("primary", "md")} w-full`}
        >
          {isCurrent ? t("managerPicker", "chooseThisSelected") : t("managerPicker", "chooseThis")}
        </button>
      </div>
    </div>
  );
}
