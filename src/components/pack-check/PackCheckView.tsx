"use client";

import { GlossaryLink } from "@/components/public-info/GlossaryLink";
import "@/lib/i18n/dictionaries/ja-ns/packCheck";
import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import { Surface } from "@/components/ui/Surface";
import { PageHeader } from "@/components/ui/PageHeader";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import { packCheck, type PackCardVerdict } from "@/lib/new-cards/pack-check";
import type { ImpactCard } from "@/lib/new-cards/team-impact";
import { fetchNewCardsOnce } from "@/lib/new-cards/fetch-new-cards";
import type { WorldPlayerListItem } from "@/lib/world/types";

const MAX_CARDS = 30;
const MIN_QUERY_LEN = 2;
const ID_RE = /^\d{1,20}$/;

type SearchState = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "results"; players: WorldPlayerListItem[] };

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => ID_RE.test(s)))].slice(0, MAX_CARDS);
}

const VERDICT_CLASS: Record<PackCardVerdict, string> = {
  upgrade: "bg-accent/15 text-accent",
  new_position: "bg-surface-2 text-text",
  no_upgrade: "bg-surface-2 text-text-dim",
  already_owned: "bg-surface-2 text-text-muted",
  unknown: "bg-surface-2 text-text-muted",
};

/**
 * パック診断（2026-10-17）: 選んだカード（URL の ids）を My Team（所持）と比べる。計算は `packCheck`（ブラウザーの中だけ）。
 */
export function PackCheckView() {
  const t = useT();
  const { locale } = useLocale();
  const tp = useCallback((k: Parameters<typeof t<"packCheck">>[1]) => t("packCheck", k), [t]);
  usePageTitle(t("nav", "packCheck"));
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ids = useMemo(() => parseIds(searchParams.get("ids")), [searchParams]);

  // URL の更新は非同期のため、続けて押したときに前の操作を失わないよう、最新の一覧を ref に持つ（2026-10-18）
  const latestIds = useRef(ids);
  useEffect(() => {
    latestIds.current = ids;
  }, [ids]);
  const setIds = useCallback(
    (next: string[]) => {
      const list = next.slice(0, MAX_CARDS);
      latestIds.current = list;
      const qs = list.length ? `?ids=${list.join(",")}` : "";
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname],
  );
  const add = (id: string) => {
    const cur = latestIds.current;
    if (!cur.includes(id) && cur.length < MAX_CARDS) setIds([...cur, id]);
  };
  const remove = (id: string) => setIds(latestIds.current.filter((x) => x !== id));

  // パックのカード・所持のカード
  const { cards: packCards, loading: packLoading } = useResolvedCards(ids);
  const { ownedIds, owned, scopeStatus } = useOwnedCards();
  const pack = useMemo(() => ids.map((id) => packCards.get(id)).filter((c): c is NonNullable<typeof c> => c != null), [ids, packCards]);
  const { results, summary } = useMemo(() => packCheck(pack, owned), [pack, owned]);

  // 検索
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const reqId = useRef(0);
  useEffect(() => {
    const query = q.trim();
    if (query.length < MIN_QUERY_LEN) {
      reqId.current += 1; // 読み込み中の古い検索の結果を捨てる
      setSearch({ kind: "idle" });
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(() => {
      setSearch({ kind: "loading" });
      fetch(`/api/world/players?q=${encodeURIComponent(query)}&pageSize=20`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { players?: WorldPlayerListItem[]; provisionalMatches?: WorldPlayerListItem[] }) => {
          // 暫定のカード（正式なデータの反映前）も検索から追加できる（2026-10-24）
          const players = [...(Array.isArray(j.provisionalMatches) ? j.provisionalMatches : []), ...(Array.isArray(j.players) ? j.players : [])];
          if (id === reqId.current) setSearch({ kind: "results", players });
        })
        .catch(() => {
          if (id === reqId.current) setSearch({ kind: "error" });
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  // 最近追加されたカード・暫定のカード（開いたときだけ読む）
  const [newCards, setNewCards] = useState<ImpactCard[] | null>(null);
  const loadNewCards = () => {
    if (newCards && newCards.length > 0) return; // 空（取得の失敗を含む）なら開き直したときに読み直す
    void fetchNewCardsOnce().then(setNewCards);
  };

  const name = (c: ImpactCard) => resolvePlayerDisplayName(c, locale);
  const basis = (b: "max" | "base") => t("provisionalCards", b === "max" ? "impactBasisMax" : "impactBasisBase");
  const ovr = (c: ImpactCard) => c.ovrMax ?? c.ovrBase ?? "—";
  const full = ids.length >= MAX_CARDS;
  const verdictLabel: Record<PackCardVerdict, string> = {
    upgrade: tp("verdictUpgrade"),
    new_position: tp("verdictNewPosition"),
    no_upgrade: tp("verdictNoUpgrade"),
    already_owned: tp("verdictAlreadyOwned"),
    unknown: tp("verdictUnknown"),
  };

  const pickRow = (c: ImpactCard) => {
    const picked = ids.includes(c.worldCardId);
    return (
      <li key={c.worldCardId} className="flex items-center gap-2 py-1.5">
        <span className="w-10 shrink-0 text-xs font-bold text-text-dim">{c.registeredPosition ?? "—"}</span>
        <span className="min-w-0 flex-1 truncate">{name(c)}</span>
        <span className="text-xs text-text-dim">{ovr(c)}</span>
        <button
          type="button"
          className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-50"
          disabled={picked || full}
          onClick={() => add(c.worldCardId)}
          data-testid="pack-check-add"
        >
          {tp("addButton")}
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4" data-testid="pack-check">
      <PageHeader title={tp("heading")} icon="pack" description={tp("intro")} />
      <p className="text-xs text-text-muted">{tp("privacyNote")}</p>
      <GlossaryLink anchor="ovr-max" />

      <Surface padding="md" className="flex flex-col gap-2 text-sm">
        <label htmlFor="pack-check-q" className="font-semibold">
          {tp("searchLabel")}
        </label>
        <input
          id="pack-check-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tp("searchPlaceholder")}
          className="w-full rounded border border-border bg-surface px-3 py-2"
          data-testid="pack-check-search"
        />
        {full ? <p className="text-xs text-text-muted">{fillMessage(tp("limitTemplate"), { max: String(MAX_CARDS) })}</p> : null}
        {search.kind === "loading" ? <p className="text-xs text-text-muted">{tp("loading")}</p> : null}
        {search.kind === "error" ? <p className="text-xs text-text-muted">{tp("searchError")}</p> : null}
        {search.kind === "results" ? (
          search.players.length === 0 ? (
            <p className="text-xs text-text-muted">{tp("searchNoResults")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border" data-testid="pack-check-search-results">
              {search.players.map(pickRow)}
            </ul>
          )
        ) : null}
        <details onToggle={(e) => (e.currentTarget.open ? loadNewCards() : undefined)} data-testid="pack-check-new-cards">
          <summary className="cursor-pointer text-accent">{tp("addNewCards")}</summary>
          {newCards == null ? (
            <p className="text-xs text-text-muted">{tp("loading")}</p>
          ) : (
            <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">{newCards.map(pickRow)}</ul>
          )}
        </details>
      </Surface>

      <section className="flex flex-col gap-2" data-testid="pack-check-results">
        {ids.length === 0 ? (
          <Surface padding="md" className="text-sm text-text-dim" data-testid="pack-check-empty">
            {tp("emptyPack")}
          </Surface>
        ) : (
          <>
            {scopeStatus !== "loading" && ownedIds.length === 0 ? (
              <Surface padding="md" className="flex flex-col gap-1 text-sm text-text-dim" data-testid="pack-check-no-team">
                <p>{tp("noTeam")}</p>
                <Link href="/my-team" className="w-fit text-accent hover:underline">
                  {tp("openMyTeam")}
                </Link>
              </Surface>
            ) : null}
            <Surface padding="md" className="flex flex-col gap-1 text-sm" data-testid="pack-check-summary">
              <p className="font-semibold">
                {fillMessage(tp("summaryTemplate"), {
                  total: String(summary.total),
                  upgrades: String(summary.upgrades),
                  newPositions: String(summary.newPositions),
                  alreadyOwned: String(summary.alreadyOwned),
                })}
              </p>
              {summary.bestDelta != null ? <p className="text-xs text-text-dim">{fillMessage(tp("bestDeltaTemplate"), { delta: String(summary.bestDelta) })}</p> : null}
            </Surface>
            {packLoading && pack.length < ids.length ? <p className="text-xs text-text-muted">{tp("loading")}</p> : null}
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface text-sm" data-testid="pack-check-list">
              {results.map((r) => (
                <li key={r.card.worldCardId} className="flex flex-col gap-0.5 px-3 py-2" data-verdict={r.verdict}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="w-10 shrink-0 text-xs font-bold text-text-dim">{r.card.registeredPosition ?? "—"}</span>
                    <Link href={`/players/world/${r.card.worldCardId}`} className="font-semibold text-accent hover:underline">
                      {name(r.card)}
                    </Link>
                    <span className={`rounded px-1.5 py-0.5 text-2xs ${VERDICT_CLASS[r.verdict]}`}>{verdictLabel[r.verdict]}</span>
                    <button type="button" className="ms-auto text-xs text-text-dim hover:underline" onClick={() => remove(r.card.worldCardId)}>
                      {tp("removeButton")}
                    </button>
                  </div>
                  {r.newOvr != null && r.verdict !== "already_owned" && r.verdict !== "unknown" ? (
                    <span className="text-xs text-text-dim">
                      {r.verdict === "new_position"
                        ? fillMessage(tp("rowNewPositionTemplate"), { basis: basis(r.basis), newOvr: String(r.newOvr) })
                        : fillMessage(tp(r.verdict === "upgrade" ? "rowUpgradeTemplate" : "rowNoUpgradeTemplate"), {
                            basis: basis(r.basis),
                            newOvr: String(r.newOvr),
                            ownedName: r.bestOwned ? name(r.bestOwned) : "—",
                            ownedOvr: String(r.ownedOvr ?? "—"),
                            delta: String(r.delta ?? 0),
                          })}
                    </span>
                  ) : null}
                  {r.samePlayerOwned && r.verdict !== "already_owned" ? (
                    <span className="text-xs text-text-muted">{fillMessage(tp("samePlayerTemplate"), { name: name(r.samePlayerOwned) })}</span>
                  ) : null}
                  {r.bestOwned && r.verdict !== "already_owned" ? (
                    <Link href={`/compare?ids=${r.card.worldCardId},${r.bestOwned.worldCardId}`} className="w-fit text-xs text-accent hover:underline" data-testid="compare-with-owned">
                      {tp("compareAbilities")}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            <button type="button" className="w-fit text-xs text-text-dim hover:underline" onClick={() => setIds([])}>
              {tp("clearButton")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
