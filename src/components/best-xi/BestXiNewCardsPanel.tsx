"use client";

import "@/lib/i18n/dictionaries/ja-ns/bestXi";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getFormation } from "@/lib/squad/formations";
import { fetchNewCardsOnce } from "@/lib/new-cards/fetch-new-cards";
import { buildBestXiCandidates } from "@/lib/best-xi/candidates";
import { useBestXiProgressionCards } from "@/lib/best-xi/use-candidate-cards";
import { bestXiWithNewCards, pickNewCardIdsForFormation } from "@/lib/best-xi/new-cards-diff";
import type { BestXiCandidate, BestXiSelectionResult, BestXiUnavailableCard } from "@/lib/best-xi/types";
import type { ManagerContext } from "@/lib/progression/types";
import type { MyTeamRecord } from "@/lib/user-cards/types";

/**
 * AI ベスト11: 新しいカードを入れたら（2026-10-17）。ボタンを押したときだけ新しいカードを読み、先発が変わる枠を出す。
 * 新しいカードは「持っている」と仮定するだけ（My Team・保存ビルドは変えない・保存しない）。
 */
export function BestXiNewCardsPanel({
  result,
  candidates,
  unavailableCards,
  ownedIds,
  manager,
  affiliationActive,
  displayName,
  tb,
  fillTb,
}: {
  result: BestXiSelectionResult;
  candidates: readonly BestXiCandidate[];
  unavailableCards: readonly BestXiUnavailableCard[];
  ownedIds: readonly string[];
  manager: ManagerContext | null;
  affiliationActive: boolean;
  displayName: (c: BestXiCandidate) => string;
  tb: (key: string) => string;
  fillTb: (key: string, vars: Record<string, string>) => string;
}) {
  // 選んだ新しいカードは、そのときのフォーメーションの枠に合わせたもの。フォーメーションが変わったら選び直す（ボタンに戻す）
  const [picked, setPicked] = useState<{ formationId: string; ids: string[] } | null>(null);
  const ids = picked && picked.formationId === result.formationId ? picked.ids : null;
  const [requesting, setRequesting] = useState(false);
  const { cards, loading } = useBestXiProgressionCards(ids ?? []);

  const slotPositions = useMemo(() => getFormation(result.formationId).slots.map((s) => s.position), [result.formationId]);
  const start = () => {
    setRequesting(true);
    void fetchNewCardsOnce().then((newCards) => {
      setPicked({ formationId: result.formationId, ids: pickNewCardIdsForFormation({ newCards, slotPositions, ownedIds: new Set(ownedIds) }) });
      setRequesting(false);
    });
  };

  const changes = useMemo(() => {
    if (!ids || ids.length === 0 || loading) return null;
    const records: MyTeamRecord[] = ids.map((id) => ({
      localRecordId: `virtual_${id}`,
      teamCardId: `virtual_${id}`,
      worldCardId: id,
      ownershipStatus: "owned",
      usageStatus: "unused",
      selectedBuildId: null,
      favoriteBuildId: null,
      note: "",
      tags: [],
      addedAt: result.generatedAt,
      updatedAt: result.generatedAt,
      deletedAt: null,
      source: "local",
      syncStatus: "local_only",
    }) as MyTeamRecord);
    const { candidates: newCandidates } = buildBestXiCandidates({ myTeam: records, progressionCards: cards, buildsByWorldCardId: new Map(), manager });
    return bestXiWithNewCards({ formationId: result.formationId, baseResult: result, baseCandidates: candidates, newCandidates, unavailableCards }).changes;
  }, [ids, loading, cards, manager, result, candidates, unavailableCards]);

  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 text-xs sm:p-4" data-testid="best-xi-new-cards">
      <p className="text-sm font-semibold">{tb("newCardsHeading")}</p>
      <p className="text-text-dim">{tb("newCardsIntro")}</p>
      {affiliationActive ? (
        <p className="text-text-muted">{tb("newCardsAffiliationNote")}</p>
      ) : ids == null ? (
        <Button variant="secondary" size="sm" iconLeft="sparkles" className="w-fit" disabled={requesting} onClick={start} data-testid="best-xi-new-cards-run">
          {tb("newCardsButton")}
        </Button>
      ) : ids.length === 0 ? (
        <p className="text-text-muted" data-testid="best-xi-new-cards-none">
          {tb("newCardsNone")}
        </p>
      ) : changes == null ? (
        <p className="text-text-muted">{tb("newCardsLoading")}</p>
      ) : changes.length === 0 ? (
        <p className="text-text-muted" data-testid="best-xi-new-cards-no-change">
          {tb("newCardsNoChange")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" data-testid="best-xi-new-cards-list">
          {changes.map((c) => (
            <li key={c.slotId} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
              <span className="w-10 shrink-0 font-bold text-text-dim">{c.position}</span>
              <span>
                {fillTb("newCardsChangeTemplate", { before: c.before ? displayName(c.before.candidate) : tb("newCardsEmptyBefore"), after: "" }).replace(/\s*$/, "")}{" "}
                <Link href={`/players/world/${c.after.candidate.worldCardId}`} className="font-semibold text-accent hover:underline">
                  {displayName(c.after.candidate)}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
      {requesting ? <p className="text-text-muted">{tb("newCardsLoading")}</p> : null}
    </section>
  );
}
