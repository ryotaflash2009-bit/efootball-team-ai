"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listSquadEntries,
  listSquads,
  getSquad,
  emptySquad,
  saveSquad,
  renameSquad,
  duplicateSquad,
  deleteSquad,
  isSquadStorageAvailable,
  getActiveSquadsStorageKey,
} from "@/lib/squad/squad-storage";
import { saveTemplateFromSquad } from "@/lib/squad/templates";
import { findSquadUsageByWorldCardId } from "@/lib/squad/usage";
import { FORMATIONS, getFormation } from "@/lib/squad/formations";
import { resolvePendingSquadAddition, pendingSquadAdditionQuery } from "@/lib/squad/pending-addition";
import type { SquadListEntry } from "@/lib/squad/types";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";

type SquadSort = "updated_desc" | "created_desc" | "name" | "formation";
import { Surface } from "@/components/ui/Surface";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { MiniPitch } from "./MiniPitch";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { formatDateTime } from "@/lib/i18n/format";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Locale } from "@/lib/i18n/locale";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { PageHeader } from "@/components/ui/PageHeader";

function safeFormatDateTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDateTime(d, locale);
}

export function SquadListBoard({
  pendingWorldCardId = null,
  pendingBuildId = null,
}: {
  pendingWorldCardId?: string | null;
  pendingBuildId?: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const tsl = (k: keyof Dictionary["squadList"]) => t("squadList", k);
  const fillSl = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const cardQuery = pendingSquadAdditionQuery(resolvePendingSquadAddition(pendingWorldCardId, pendingBuildId));
  const [entries, setEntries] = useState<SquadListEntry[] | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const [newName, setNewName] = useState("");
  const [newFormation, setNewFormation] = useState(FORMATIONS[0].id);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fFormation, setFFormation] = useState("");
  const [fCustom, setFCustom] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<SquadSort>("updated_desc");
  const [playerQuery, setPlayerQuery] = useState("");
  const [usageHits, setUsageHits] = useState<Set<string> | null>(null);
  // 引き継ぎバナーに内部ID(worldCardId)をそのまま出さないための表示名解決。
  // 取得できるまでは名前を出さず(ID露出を避ける)、失敗時もIDへフォールバックしない。
  const [pendingCardName, setPendingCardName] = useState<string | null>(null);

  // スカッド編集画面(SquadBuildPanel)と同じ理由: この画面はMy Team/My Builds/お気に入りの
  // いずれも経由せず開ける可能性があるため、自力でスコープを解決してストレージへ伝える。
  const scopeState = useSyncedStorageScope();
  const scopeLoading = scopeState.status === "loading";

  const reload = useCallback(() => {
    if (scopeState.status === "loading") return; // 認証確認中はスカッドを読み書きしない
    setStorageOk(isSquadStorageAvailable());
    setEntries(listSquadEntries());
  }, [scopeState.status]);

  useEffect(() => {
    if (scopeState.status === "loading") {
      setEntries(null); // アカウント切替時、直前スコープの一覧を表示し続けない
      return;
    }
    reload();
  }, [scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // 別タブでの更新・アカウント切替を検知して再読込する。
  useEffect(() => subscribeCurrentScope(reload), [reload]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key == null || e.key === getActiveSquadsStorageKey()) reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reload]);

  useEffect(() => {
    if (!pendingWorldCardId) {
      setPendingCardName(null);
      return;
    }
    let cancelled = false;
    setPendingCardName(null);
    fetch(`/api/world/players/${encodeURIComponent(pendingWorldCardId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { player?: { nameJa?: string | null; nameEn?: string | null } } | null) => {
        if (cancelled || !body?.player) return;
        setPendingCardName(resolvePlayerDisplayName(body.player, locale, null));
      })
      .catch(() => {
        /* 取得失敗時はIDへフォールバックせず、名前なし(読み込み中相当)のままにする */
      });
    return () => {
      cancelled = true;
    };
  }, [pendingWorldCardId, locale]);

  // 使用選手検索: worldCardId を含むスカッドの id 集合
  useEffect(() => {
    const v = playerQuery.trim();
    if (!/^[0-9]{3,20}$/.test(v)) {
      setUsageHits(null);
      return;
    }
    const hits = new Set(findSquadUsageByWorldCardId(listSquads(), v).map((u) => u.squadId));
    setUsageHits(hits);
  }, [playerQuery, entries]);

  const shown = useMemo(() => {
    let list = entries ?? [];
    const ql = q.trim().toLowerCase();
    if (ql) list = list.filter((e) => e.squadName.toLowerCase().includes(ql));
    if (fFormation) list = list.filter((e) => e.formationId === fFormation);
    if (fCustom === "yes") list = list.filter((e) => e.hasCustomPositioning);
    if (fCustom === "no") list = list.filter((e) => !e.hasCustomPositioning);
    if (usageHits) list = list.filter((e) => usageHits.has(e.squadId));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.squadName.localeCompare(b.squadName));
    else if (sort === "formation") sorted.sort((a, b) => a.formationName.localeCompare(b.formationName) || a.squadName.localeCompare(b.squadName));
    else if (sort === "created_desc") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted;
  }, [entries, q, fFormation, fCustom, sort, usageHits]);

  function saveAsTemplate(squadId: string) {
    const sq = getSquad(squadId);
    if (!sq) return;
    const name = window.prompt(tsl("templateNamePrompt"), `${sq.squadName}${tsl("templateNamePromptSuffix")}`);
    if (name == null) return;
    const r = saveTemplateFromSquad(sq, name);
    if (r.ok) setError(null);
    else setError(r.error);
  }

  function create() {
    const sq = emptySquad(newName.trim() || tsl("defaultNewSquadName"), newFormation);
    const r = saveSquad(sq);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/squads/${r.squad.squadId}${cardQuery}`);
  }

  if (scopeLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={tsl("pageTitle")}
          icon="squad"
          description={fillSl(tsl("pageDescriptionTemplate"), { formations: FORMATIONS.map((f) => f.name).join(" / ") })}
        />
        <Surface tone="outline" className="text-center">
          <p className="text-sm text-text-dim">{tsl("scopeLoadingMessage")}</p>
        </Surface>
      </div>
    );
  }

  if (!storageOk) {
    return (
      <Surface tone="outline" className="text-center">
        <p className="text-base font-semibold">{tsl("noStorageTitle")}</p>
        <p className="mt-2 text-sm text-text-dim">{tsl("noStorageDescription")}</p>
      </Surface>
    );
  }

  const createForm = (
    <Surface tone="raised" id="create-squad">
      <p className="text-sm font-semibold">{tsl("createFormHeading")}</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={tsl("squadNameLabel")}
              value={newName}
              maxLength={50}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={tsl("squadNamePlaceholder")}
              aria-label={tsl("squadNameAriaLabel")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-formation-select" className="text-xs font-medium text-text-dim">
              {tsl("formationLabel")}
            </label>
            <select
              id="new-formation-select"
              value={newFormation}
              onChange={(e) => setNewFormation(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface-2 px-3 text-sm"
            >
              {FORMATIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <Button variant="primary" iconLeft="plus" onClick={create}>
            {tsl("createAndEditButton")}
          </Button>
        </div>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          {FORMATIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setNewFormation(f.id)}
              aria-pressed={newFormation === f.id}
              className={`rounded-md border p-1 text-center transition-colors ${
                newFormation === f.id ? "border-accent bg-accent-soft" : "border-border hover:border-accent"
              }`}
              title={f.name}
            >
              <MiniPitch formationId={f.id} />
              <span className={`mt-0.5 block text-[10px] font-semibold ${newFormation === f.id ? "text-accent" : "text-text-dim"}`}>
                {f.name}
              </span>
            </button>
          ))}
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </Surface>
  );

  return (
    <div className="flex flex-col gap-6">
      {pendingWorldCardId ? (
        <Surface tone="inset" padding="sm">
          <p className="text-sm">
            <b>{fillSl(tsl("pendingCardBannerBoldTemplate"), { name: pendingCardName ?? tsl("pendingCardBannerNameLoading") })}</b>
            {tsl("pendingCardBannerSuffix")}
            <Link href={`/players/world/${encodeURIComponent(pendingWorldCardId)}`} className="ml-2 text-accent hover:underline">
              {tsl("pendingCardDetailLink")}
            </Link>
          </p>
        </Surface>
      ) : null}
      <PageHeader
        title={tsl("pageTitle")}
        icon="squad"
        description={fillSl(tsl("pageDescriptionTemplate"), { formations: FORMATIONS.map((f) => f.name).join(" / ") })}
        actions={
          <Link href="/compare" className={buttonClasses("secondary", "sm")}>
            {tsl("goToCompareLink")}
          </Link>
        }
      />
      {/* ヒーロー */}
      <Surface tone="raised" padding="lg">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="mx-auto w-32 shrink-0 sm:mx-0">
            <MiniPitch formationId="4-3-3" filledSlotIds={FORMATIONS[0].slots.map((s) => s.slotId)} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{tsl("heroHeading")}</h2>
            <p className="mt-1 text-sm text-text-dim">{tsl("heroDescription")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="#create-squad" className={buttonClasses("primary", "md")}>
                <Icon name="plus" size={16} />
                {entries && entries.length > 0 ? tsl("createNewSquadButton") : tsl("createFirstSquadButton")}
              </a>
              <Link href="/compare" className={buttonClasses("secondary", "md")}>
                <Icon name="compare" size={16} />
                {tsl("goToCompareButton")}
              </Link>
            </div>
          </div>
        </div>
      </Surface>

      {createForm}

      {/* 一覧 */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {fillSl(tsl("savedSquadsHeadingTemplate"), { counts: entries ? `（${shown.length}/${entries.length}）` : "" })}
          </p>
          <span className="flex gap-3 text-xs">
            <Link href="/squads/compare" className="text-accent hover:underline">
              {tsl("compareSquadsLink")}
            </Link>
            <Link href="/squads/templates" className="text-accent hover:underline">
              {tsl("templateListLink")}
            </Link>
          </span>
        </div>

        {entries && entries.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tsl("searchByNamePlaceholder")}
              aria-label={tsl("searchByNameAriaLabel")}
              className="rounded border border-border bg-surface-2 px-2 py-1"
            />
            <input
              type="search"
              value={playerQuery}
              onChange={(e) => setPlayerQuery(e.target.value)}
              placeholder={tsl("searchByPlayerPlaceholder")}
              aria-label={tsl("searchByPlayerAriaLabel")}
              className="w-40 rounded border border-border bg-surface-2 px-2 py-1"
            />
            <select
              value={fFormation}
              onChange={(e) => setFFormation(e.target.value)}
              aria-label={tsl("formationFilterAriaLabel")}
              className="rounded border border-border bg-surface-2 px-2 py-1"
            >
              <option value="">{tsl("formationFilterAll")}</option>
              {FORMATIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={fCustom}
              onChange={(e) => setFCustom(e.target.value as "" | "yes" | "no")}
              aria-label={tsl("customFilterAriaLabel")}
              className="rounded border border-border bg-surface-2 px-2 py-1"
            >
              <option value="">{tsl("customFilterAll")}</option>
              <option value="yes">{tsl("customFilterYes")}</option>
              <option value="no">{tsl("customFilterNo")}</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SquadSort)}
              aria-label={tsl("sortAriaLabel")}
              className="rounded border border-border bg-surface-2 px-2 py-1"
            >
              <option value="updated_desc">{tsl("sortUpdatedDesc")}</option>
              <option value="created_desc">{tsl("sortCreatedDesc")}</option>
              <option value="name">{tsl("sortName")}</option>
              <option value="formation">{tsl("sortFormation")}</option>
            </select>
          </div>
        ) : null}

        {entries == null ? (
          <p className="text-sm text-text-dim">{tsl("loading")}</p>
        ) : entries.length === 0 ? (
          <Surface tone="outline" className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="w-24">
              <MiniPitch formationId="4-3-3" />
            </div>
            <p className="text-sm font-semibold">{tsl("emptyTitle")}</p>
            <p className="text-xs text-text-dim">{tsl("emptyDescription")}</p>
            <a href="#create-squad" className={buttonClasses("primary", "sm")}>
              <Icon name="plus" size={14} />
              {tsl("createFirstSquadButton")}
            </a>
          </Surface>
        ) : shown.length === 0 ? (
          <p className="text-sm text-text-dim">{tsl("noResultsMatchFilter")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((e) => (
              <li key={e.squadId}>
                <Surface className="flex h-full gap-3">
                  <Link href={`/squads/${e.squadId}`} className="w-16 shrink-0">
                    <MiniPitch formationId={e.formationId} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/squads/${e.squadId}`} className="truncate text-sm font-semibold hover:text-accent">
                      {e.squadName}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-text-muted">
                      <span className="font-medium text-text-dim">{e.formationName}</span>
                      {e.hasCustomPositioning ? <Badge tone="accent" size="xs">{tsl("customPositioningBadge")}</Badge> : null}
                      <span>{fillSl(tsl("startingCountTemplate"), { count: String(e.startingCount) })}</span>
                      <span>{fillSl(tsl("benchCountTemplate"), { count: String(e.benchCount) })}</span>
                      <span>{e.managerId != null ? tsl("hasManagerLabel") : tsl("noManagerLabel")}</span>
                    </p>
                    <p className="mt-0.5 text-2xs text-text-muted">
                      {fillSl(tsl("updatedAtTemplate"), { date: safeFormatDateTime(e.updatedAt, locale) })}
                    </p>
                    {e.rulesOutdated ? (
                      <span className="mt-0.5">
                        <Badge tone="warning" size="xs">{tsl("outdatedRulesBadge")}</Badge>
                      </span>
                    ) : null}

                    <div className="mt-auto flex flex-wrap gap-1 pt-2 text-2xs">
                      {cardQuery ? (
                        <Link
                          href={`/squads/${e.squadId}${cardQuery}`}
                          className="rounded border border-accent px-2 py-1 text-accent hover:bg-accent/10"
                        >
                          {tsl("addThisCardLink")}
                        </Link>
                      ) : null}
                      <Link href={`/squads/${e.squadId}`} className="rounded border border-border px-2 py-1 text-accent hover:border-accent">
                        {tsl("openLink")}
                      </Link>
                      <Link
                        href={`/squads/compare?a=${encodeURIComponent(e.squadId)}`}
                        className="rounded border border-border px-2 py-1 hover:border-accent"
                        title={tsl("compareLinkTitle")}
                      >
                        {tsl("compareLink")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          const r = duplicateSquad(e.squadId);
                          if (r.ok) reload();
                          else setError(r.error);
                        }}
                        className="rounded border border-border px-2 py-1 hover:border-accent"
                      >
                        {tsl("duplicateButton")}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveAsTemplate(e.squadId)}
                        className="rounded border border-border px-2 py-1 hover:border-accent"
                      >
                        {tsl("saveAsTemplateButton")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const name = window.prompt(tsl("renamePrompt"), e.squadName);
                          if (name == null) return;
                          const r = renameSquad(e.squadId, name);
                          if (r.ok) reload();
                          else setError(r.error);
                        }}
                        className="rounded border border-border px-2 py-1 hover:border-accent"
                      >
                        {tsl("renameButton")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(e.squadId)}
                        className="rounded border border-border px-2 py-1 text-danger hover:opacity-80"
                      >
                        {tsl("deleteButton")}
                      </button>
                    </div>

                    {confirmId === e.squadId ? (
                      <div className="mt-2 rounded border border-danger/50 bg-surface-2/40 p-2 text-2xs">
                        <p>{fillSl(tsl("deleteConfirmTemplate"), { name: e.squadName })}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const r = deleteSquad(e.squadId);
                              if (r.ok) {
                                setConfirmId(null);
                                reload();
                              } else setError(r.error ?? tsl("deleteFailedFallback"));
                            }}
                            className="rounded border border-danger px-2 py-1 text-danger"
                          >
                            {tsl("deleteConfirmButton")}
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="rounded border border-border px-2 py-1">
                            {tsl("deleteCancelButton")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

