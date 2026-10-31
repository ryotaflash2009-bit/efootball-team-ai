"use client";

import "@/lib/i18n/dictionaries/ja-ns/bestXi";
import "@/lib/i18n/dictionaries/ja-ns/manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSquad } from "@/lib/squad/squad-storage";
import { bestXiToSquad } from "@/lib/best-xi/to-squad";
import type { ManagerContext } from "@/lib/progression/types";
import type { ManagerDetail } from "@/lib/managers/types";
import dynamic from "next/dynamic";
import { CurrentManagerCard } from "@/components/managers/CurrentManagerCard";
import { useFavorites, useMyTeam } from "@/lib/user-cards/hooks";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { listBuilds } from "@/lib/progression/build-storage";
import type { SavedBuild } from "@/lib/progression/types";
import { FORMATIONS, getFormation } from "@/lib/squad/formations";
import { useBestXiProgressionCards } from "@/lib/best-xi/use-candidate-cards";
import { buildBestXiCandidates } from "@/lib/best-xi/candidates";
import { samePlayerExcluded } from "@/lib/best-xi/same-player-excluded";
import {
  affiliationOptions,
  applyAffiliationFilter,
  decodeAffiliationFilter,
  encodeAffiliationFilter,
  BEST_XI_AFFILIATION_KINDS,
  type BestXiAffiliationFilter,
} from "@/lib/best-xi/affiliation-filter";
import { selectBestXi } from "@/lib/best-xi/select";
import { selectBestXiBench, type BestXiBenchResult } from "@/lib/best-xi/bench";
import {
  EXCLUSION_REASON_LABEL_KEY,
  LIMITATION_LABEL_KEY,
  SELECTION_REASON_LABEL_KEY,
  UNAVAILABLE_CARD_LABEL_KEY,
  UNFILLED_SLOT_REASON_LABEL_KEY,
} from "@/lib/best-xi/reason-labels";
import type {
  BestXiCandidate,
  BestXiSelectedSlot,
  BestXiSelectionResult,
  BestXiUnfilledSlot,
} from "@/lib/best-xi/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { fillMessage } from "@/lib/i18n/message-format";
import { usePageTitle } from "@/lib/i18n/use-page-title";

// 監督の選択（開いたとき）・新しいカードの欄（結果の後）は後から読み込む（2026-10-30）
const loadManagerPicker = () => import("@/components/managers/ManagerPicker");
const ManagerPicker = dynamic(() => loadManagerPicker().then((m) => m.ManagerPicker), { ssr: false });
const BestXiNewCardsPanel = dynamic(() => import("@/components/best-xi/BestXiNewCardsPanel").then((m) => m.BestXiNewCardsPanel), { ssr: false });

/** 初期のフォーメーション。2026-10-11 から利用者が選べる（選んだフォーメーションだけで選出・比較はしない）。 */
const DEFAULT_FORMATION_ID = "4-3-3";

function fillTemplate(s: string, vars: Record<string, string>): string {
  return fillMessage(s, vars);
}

function candidateSignature(candidates: BestXiCandidate[]): string {
  return candidates
    .map((c) => `${c.candidateKey}:${c.abilityStatus}:${c.buildName ?? ""}:${c.ruleKind}`)
    .sort()
    .join("|");
}

export function BestXiView() {
  const t = useT();
  // 日本語以外の表示言語では、タブの題名も表示言語にする（2026-10-07）。
  usePageTitle(t("bestXi", "pageTitle"));
  const { locale } = useLocale();
  const tb = useCallback((key: string) => t("bestXi", key as keyof Dictionary["bestXi"]), [t]);
  const fillTb = useCallback((key: string, vars: Record<string, string>) => fillTemplate(tb(key), vars), [tb]);

  const { myTeam, available: myTeamAvailable } = useMyTeam();
  const ownedWorldCardIds = useMemo(
    () => [...new Set(myTeam.filter((r) => r.ownershipStatus === "owned").map((r) => r.worldCardId))],
    [myTeam],
  );
  // お気に入りも候補に入れる（2026-11-01・「手に入れたらどうなるか」）。所持でないお気に入りは ☆ を付けて区別する。保存しない
  const [includeFavorites, setIncludeFavorites] = useState(false);
  const { favorites } = useFavorites();
  const ownedSet = useMemo(() => new Set(ownedWorldCardIds), [ownedWorldCardIds]);
  const poolWorldCardIds = useMemo(
    () => (includeFavorites ? [...ownedWorldCardIds, ...favorites.map((f) => f.worldCardId).filter((id) => !ownedSet.has(id))] : ownedWorldCardIds),
    [includeFavorites, ownedWorldCardIds, favorites, ownedSet],
  );
  // 候補は My Team の「所持」の記録から作るため、お気に入りは画面の中だけの記録（保存しない）として足す
  const poolRecords = useMemo<MyTeamRecord[]>(() => {
    if (!includeFavorites) return myTeam;
    const extra = favorites
      .filter((f) => !ownedSet.has(f.worldCardId))
      .map((f) => ({
        localRecordId: `fav_${f.worldCardId}`,
        teamCardId: `fav_${f.worldCardId}`,
        worldCardId: f.worldCardId,
        ownershipStatus: "owned" as const,
        usageStatus: "unknown" as const,
        selectedBuildId: null,
        favoriteBuildId: null,
        note: "",
        tags: [],
        addedAt: f.addedAt,
        updatedAt: f.updatedAt,
        deletedAt: null,
        source: "local" as const,
        syncStatus: "local_only" as const,
      }));
    return [...myTeam, ...extra];
  }, [includeFavorites, myTeam, favorites, ownedSet]);
  const { cards: progressionCards, affiliations, loading: cardsLoading } = useBestXiProgressionCards(poolWorldCardIds);

  // 保存ビルドはクライアントのlocalStorageから読む(build-storageに変更通知イベントが無いため、
  // マウント時と「再選出」操作のタイミングで読み直す)。
  const [buildsByWorldCardId, setBuildsByWorldCardId] = useState<Map<string, SavedBuild[]>>(new Map());
  const reloadBuilds = useCallback(() => {
    const map = new Map<string, SavedBuild[]>();
    for (const id of poolWorldCardIds) map.set(id, listBuilds(id));
    setBuildsByWorldCardId(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolWorldCardIds.join(",")]);
  useEffect(() => {
    reloadBuilds();
  }, [reloadBuilds]);

  // 監督（F-070・2026-10-11）。既定は監督なし（従来と同じ結果）。「順位に含める」を選んだときだけ、確認済みの補正を候補の能力値に加えて選び直す。
  const [manager, setManager] = useState<ManagerContext | null>(null);
  const [managerDetail, setManagerDetail] = useState<ManagerDetail | null>(null);
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [applyManager, setApplyManager] = useState(false);
  const managerInRanking = applyManager && manager != null;
  const managerReasons = useMemo(
    () => (manager ? (managerDetail?.boosters ?? []).filter((b) => b.statKey && b.confirmationStatus === "confirmed").map((b) => ({ statKey: b.statKey!, statNameEn: b.statNameEn, delta: b.delta, managerName: manager.managerName ?? null })) : []),
    [manager, managerDetail],
  );
  // 縛り（国籍・リーグ・チーム・2026-10-11）。選ぶと、その条件に合う自分のカードだけで選び直す。
  const [affiliationFilter, setAffiliationFilter] = useState<BestXiAffiliationFilter | null>(null);
  const options = useMemo(() => affiliationOptions(poolWorldCardIds, affiliations), [poolWorldCardIds, affiliations]);
  const { candidates, unavailableCards } = useMemo(
    () => applyAffiliationFilter(buildBestXiCandidates({ myTeam: poolRecords, progressionCards, buildsByWorldCardId, manager: managerInRanking ? manager : null }), affiliations, affiliationFilter),
    [poolRecords, progressionCards, buildsByWorldCardId, affiliations, affiliationFilter, managerInRanking, manager],
  );

  const poolPlayerCount = useMemo(
    () => new Set(candidates.filter((c) => c.abilityStatus === "available").map((c) => c.worldCardId)).size,
    [candidates],
  );
  const poolBuildCount = useMemo(
    () => candidates.filter((c) => c.source === "build" && c.abilityStatus === "available").length,
    [candidates],
  );

  const [result, setResult] = useState<BestXiSelectionResult | null>(null);
  const [bench, setBench] = useState<BestXiBenchResult | null>(null);
  const [resultSignature, setResultSignature] = useState<string | null>(null);
  // 初回の1回だけは自動生成し(section 23で許可)、以降はユーザーの明示操作(再選出ボタン)でのみ
  // 選考を実行する。ボタン押下時はまず保存ビルドを読み直し(reloadBuilds)、その結果candidatesが
  // 更新されたタイミングで実際の選考を実行する(pendingGenerateRefで「押下直後の1回だけ」に絞る)。
  const autoGeneratedRef = useRef(false);
  const pendingGenerateRef = useRef(false);
  const [formationId, setFormationId] = useState(DEFAULT_FORMATION_ID);
  const router = useRouter();
  const [saveSquadError, setSaveSquadError] = useState(false);

  const runSelection = useCallback(() => {
    const r = selectBestXi({ formationId, candidates, unavailableCards, generatedAt: new Date().toISOString() });
    setResult(r);
    // 控えは先発の選考と同じ候補から、先発の後に決定的な規則で選ぶ（先発の結果は変えない）。
    setBench(selectBestXiBench({ formationId, candidates, selection: r }));
    setResultSignature(candidateSignature(candidates));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, unavailableCards, formationId]);

  useEffect(() => {
    if (cardsLoading) return;
    if (candidates.length === 0 && unavailableCards.length === 0) return;
    if (autoGeneratedRef.current) return;
    autoGeneratedRef.current = true;
    runSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsLoading, candidates, unavailableCards]);

  useEffect(() => {
    if (!pendingGenerateRef.current) return;
    if (cardsLoading) return;
    pendingGenerateRef.current = false;
    runSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, unavailableCards, cardsLoading, formationId]);

  const handleFormationChange = useCallback((id: string) => {
    // 明示の操作なので、フォーメーションが変わった直後に 1 回だけ選び直す。
    if (!FORMATIONS.some((f) => f.id === id)) return;
    pendingGenerateRef.current = true;
    setFormationId(id);
  }, []);

  const handleAffiliationChange = useCallback((raw: string) => {
    // 明示の操作なので、候補が変わった直後に 1 回だけ選び直す（再選出のボタンと同じ経路）。
    pendingGenerateRef.current = true;
    setAffiliationFilter(decodeAffiliationFilter(raw));
  }, []);

  const handleGenerateButton = useCallback(() => {
    pendingGenerateRef.current = true;
    reloadBuilds();
  }, [reloadBuilds]);

  const currentSignature = useMemo(() => candidateSignature(candidates), [candidates]);
  const isStale = result != null && resultSignature != null && currentSignature !== resultSignature;

  const formation = getFormation(result?.formationId ?? formationId);
  const slotsById = new Map(formation.slots.map((s) => [s.slotId, s]));
  const selectedBySlotId = new Map((result?.slots ?? []).map((s) => [s.slotId, s]));
  const unfilledBySlotId = new Map((result?.unfilledSlots ?? []).map((s) => [s.slotId, s]));

  // 同じ選手の別のカードを使ったため選ばなかったカード（説明だけ・選考の結果は変えない・2026-10-11）
  const samePlayerExcludedCards = useMemo(
    () => (result ? samePlayerExcluded(candidates, [...result.slots.map((s) => s.candidate.worldCardId), ...(bench?.entries ?? []).map((e) => e.candidate.worldCardId)]) : []),
    [result, bench, candidates],
  );
  const displayName = useCallback(
    (c: BestXiCandidate) => `${ownedSet.has(c.worldCardId) ? "" : "☆ "}${resolvePlayerDisplayName({ nameJa: c.nameJa, nameEn: c.nameEn }, locale, null)}`,
    [locale, ownedSet],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={tb("heading")}
        icon="trophy"
        description={tb("description")}
        meta={<Badge tone="accent">{tb("modeLabel")}</Badge>}
      />

      <div className="rounded-card border border-border bg-surface p-3 text-xs text-text-dim sm:p-4">
        {/* スマホで長すぎたため、要点（生成AI不使用・フォーメーション）だけ出し、残りは「詳しく」に（2026-10-25 画面の整理） */}
        <p>{tb("disclaimerNotAi")}</p>
        <p className="mt-1 font-semibold text-text">{tb("formationNotice")}</p>
        <details className="mt-2" data-testid="best-xi-about-more">
          <summary className="cursor-pointer font-semibold text-text-dim">{tb("aboutMoreSummary")}</summary>
          <p className="mt-1">{tb("modeDescription")}</p>
          <p className="mt-1">{tb("withinYourCandidatesText")}</p>
          <p className="mt-1">{tb("notAWinPredictionText")}</p>
          <p className="mt-1">{tb("resultsNotSavedText")}</p>
        </details>
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-text-dim">{tb("criteriaHeading")}</summary>
          <ol className="mt-1 list-decimal ps-4">
            <li>{tb("criteriaFilledSlots").replace(/^\d+\.\s*/, "")}</li>
            <li>{tb("criteriaExactPosition").replace(/^\d+\.\s*/, "")}</li>
            <li>{tb("criteriaRelatedMinimized").replace(/^\d+\.\s*/, "")}</li>
            <li>{tb("criteriaPositionRatingBalance").replace(/^\d+\.\s*/, "")}</li>
            <li>{tb("criteriaAbilityDataConfidence").replace(/^\d+\.\s*/, "")}</li>
            <li>{tb("criteriaIntentSupplementary").replace(/^\d+\.\s*/, "")}</li>
          </ol>
        </details>
      </div>

      {!myTeamAvailable ? null : ownedWorldCardIds.length === 0 ? (
        <div role="status" className="rounded-card border border-border bg-surface p-4 text-sm">
          <p className="font-semibold text-text">{tb("emptyMyTeamHeading")}</p>
          <p className="mt-1 text-text-dim">{tb("emptyMyTeamBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/my-team" className="inline-flex min-h-[36px] items-center rounded-md border border-accent bg-accent-soft px-3 text-xs font-semibold text-accent">
              {tb("goToMyTeamLink")}
            </Link>
            <Link href="/build-inventory" className="inline-flex min-h-[36px] items-center rounded-md border border-border px-3 text-xs">
              {tb("goToBuildInventoryLink")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-3 text-xs sm:p-4">
            <p aria-live="polite" className="text-text-dim">
              {fillTb("candidatePoolTemplate", { playerCount: String(poolPlayerCount), buildCount: String(poolBuildCount) })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={formationId}
                onChange={(e) => handleFormationChange(e.target.value)}
                aria-label={tb("formationSelectAriaLabel")}
                data-testid="best-xi-formation"
                disabled={cardsLoading}
                className="min-h-[32px] rounded-md border border-border bg-surface px-2 text-xs text-text"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                value={encodeAffiliationFilter(affiliationFilter)}
                onChange={(e) => handleAffiliationChange(e.target.value)}
                aria-label={tb("affiliationFilterAriaLabel")}
                data-testid="best-xi-affiliation-filter"
                disabled={cardsLoading}
                className="min-h-[32px] max-w-[16rem] rounded-md border border-border bg-surface px-2 text-xs text-text"
              >
                <option value="">{tb("affiliationFilterNone")}</option>
                {BEST_XI_AFFILIATION_KINDS.map((kind) =>
                  options[kind].length > 0 ? (
                    <optgroup key={kind} label={tb(`affiliationKind_${kind}`)}>
                      {options[kind].map((o) => (
                        <option key={o.value} value={encodeAffiliationFilter(o)}>
                          {o.value} ({o.cardCount})
                        </option>
                      ))}
                    </optgroup>
                  ) : null,
                )}
              </select>
              {favorites.length > 0 ? (
                <label className="flex min-h-[32px] cursor-pointer items-center gap-1.5 text-xs text-text-dim">
                  <input type="checkbox" checked={includeFavorites} onChange={(e) => setIncludeFavorites(e.target.checked)} data-testid="best-xi-include-favorites" />
                  {tb("includeFavoritesLabel")}
                </label>
              ) : null}
              {cardsLoading ? (
                <span role="status" aria-live="polite" className="text-2xs text-text-muted">
                  {tb("generatingText")}
                </span>
              ) : null}
              <Button variant="primary" size="sm" iconLeft="sparkles" onClick={handleGenerateButton} disabled={cardsLoading}>
                {result ? tb("regenerateButton") : tb("generateButton")}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 text-xs sm:p-4" data-testid="best-xi-manager">
            <p className="font-semibold text-text-dim">{tb("managerHeading")}</p>
            <CurrentManagerCard
              manager={manager}
              detail={managerDetail}
              reasons={managerReasons}
              onOpenPicker={() => setManagerPickerOpen(true)}
              onClear={() => {
                if (managerInRanking) pendingGenerateRef.current = true;
                setManager(null);
                setManagerDetail(null);
              }}
              onOpenDetailHref={manager?.internalManagerId ? `/managers/${manager.internalManagerId}` : undefined}
              compact
            />
            {manager ? (
              <>
                <label className="inline-flex items-center gap-2 text-text">
                  <input
                    type="checkbox"
                    checked={applyManager}
                    disabled={cardsLoading}
                    data-testid="best-xi-manager-apply"
                    onChange={(e) => {
                      pendingGenerateRef.current = true;
                      setApplyManager(e.target.checked);
                    }}
                  />
                  {tb("managerApplyToggle")}
                </label>
                <p className="text-2xs text-text-muted" data-testid="best-xi-manager-note">
                  {managerInRanking ? tb("managerAppliedNote") : tb("managerNotAppliedNote")}
                </p>
              </>
            ) : null}
            {managerPickerOpen ? (
              <ManagerPicker
                open
                onClose={() => setManagerPickerOpen(false)}
                currentManagerId={manager?.internalManagerId ?? null}
                onSelect={(ctx, d) => {
                  if (applyManager) pendingGenerateRef.current = true;
                  setManager(ctx);
                  setManagerDetail(d);
                  setManagerPickerOpen(false);
                }}
              />
            ) : null}
          </div>

          {affiliationFilter ? (
            <p role="status" className="rounded border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-text" data-testid="best-xi-affiliation-active">
              {fillTb("affiliationActiveTemplate", { kind: tb(`affiliationKind_${affiliationFilter.kind}`), value: affiliationFilter.value })}
            </p>
          ) : null}

          {isStale ? (
            <p role="status" className="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              {tb("staleNoticeText")}
            </p>
          ) : null}

          {unavailableCards.length > 0 ? (
            <details className="rounded-card border border-border bg-surface p-3 text-xs sm:p-4">
              <summary className="cursor-pointer font-semibold text-text-dim">
                {tb("unavailableCardsHeading")} ({unavailableCards.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {unavailableCards.map((u) => (
                  <li key={u.worldCardId} className="text-text-dim">
                    {t("bestXi", UNAVAILABLE_CARD_LABEL_KEY[u.reason] as keyof Dictionary["bestXi"])}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {result ? (
            <>
              <p aria-live="polite" className="rounded-card border border-border bg-surface p-3 text-xs font-semibold text-text sm:p-4">
                {fillTb("resultStatsTemplate", {
                  filled: String(result.filledRequiredSlotCount),
                  exact: String(result.exactSelectionCount),
                  related: String(result.relatedSelectionCount),
                })}
              </p>

              <BestXiPitch
                slots={formation.slots}
                selectedBySlotId={selectedBySlotId}
                unfilledBySlotId={unfilledBySlotId}
                displayName={displayName}
                tb={tb}
              />

              <BestXiSlotList
                slots={formation.slots}
                selectedBySlotId={selectedBySlotId}
                unfilledBySlotId={unfilledBySlotId}
                displayName={displayName}
                tb={tb}
                fillTb={fillTb}
                t={t}
              />

              {result.unfilledSlots.length > 0 ? (
                <div className="rounded-card border border-warning/40 bg-warning/10 p-3 text-xs sm:p-4">
                  <p className="font-semibold text-warning">{tb("unfilledSlotsHeading")}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {result.unfilledSlots.map((u) => (
                      <li key={u.slotId}>
                        <span className="font-semibold">{u.position}</span>: {t("bestXi", UNFILLED_SLOT_REASON_LABEL_KEY[u.reason] as keyof Dictionary["bestXi"])}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    {result.unfilledSlots.length === 1
                      ? tb("needOnePlayerText")
                      : fillTb("needMorePlayersTemplate", { count: String(result.unfilledSlots.length) })}
                  </p>
                  <p className="mt-1 text-text-dim">{tb("addPlayersHint")}</p>
                </div>
              ) : null}

              {bench ? <BestXiBench bench={bench} displayName={displayName} tb={tb} fillTb={fillTb} /> : null}

              <BestXiNewCardsPanel
                result={result}
                candidates={candidates}
                unavailableCards={unavailableCards}
                ownedIds={ownedWorldCardIds}
                manager={managerInRanking ? manager : null}
                affiliationActive={affiliationFilter != null}
                displayName={displayName}
                tb={tb}
                fillTb={fillTb}
              />

              {/* 結果をスカッドとして保存（2026-10-11）: 先発・控え・ビルドを新しいスカッドへ写し、スカッドの画面へ移る */}
              <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <p className="text-text-dim">{tb("saveAsSquadHint")}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft="squad"
                  data-testid="best-xi-save-as-squad"
                  disabled={result.slots.length === 0}
                  onClick={() => {
                    const name = fillTb("saveAsSquadNameTemplate", { formation: getFormation(result.formationId).name });
                    const r = saveSquad(bestXiToSquad(result, bench, name));
                    if (r.ok) {
                      setSaveSquadError(false);
                      router.push(`/squads/${r.squad.squadId}`);
                    } else {
                      setSaveSquadError(true);
                    }
                  }}
                >
                  {tb("saveAsSquadButton")}
                </Button>
              </div>
              {saveSquadError ? (
                <p role="alert" className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger" data-testid="best-xi-save-as-squad-error">
                  {tb("saveAsSquadFailed")}
                </p>
              ) : null}

              {samePlayerExcludedCards.length > 0 ? (
                <p className="rounded-card border border-border bg-surface p-3 text-xs text-text-dim sm:p-4" data-testid="best-xi-same-player-excluded">
                  {fillTb("samePlayerExcludedTemplate", { count: String(samePlayerExcludedCards.length), names: samePlayerExcludedCards.map((c) => displayName(c)).join("、") })}
                </p>
              ) : null}


              <BestXiExclusions result={result} displayName={displayName} tb={tb} fillTb={fillTb} t={t} />

              <div className="rounded-card border border-border bg-surface p-3 text-2xs text-text-muted sm:p-4">
                <p className="font-semibold text-text-dim">{tb("limitationsHeading")}</p>
                <ul className="mt-1 list-disc ps-4">
                  {result.limitationCodes.filter((code) => !(bench && code === "noBenchSelection") && !(managerInRanking && code === "noManagerSelection")).map((code) => (
                    <li key={code}>{t("bestXi", LIMITATION_LABEL_KEY[code] as keyof Dictionary["bestXi"])}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function suitabilityLabelKey(tier: "exact" | "related" | "unresolved" | "excluded"): keyof Dictionary["bestXi"] {
  if (tier === "exact") return "suitabilityExact";
  if (tier === "related") return "suitabilityRelated";
  return "suitabilityUnresolved";
}

function BestXiPitch({
  slots,
  selectedBySlotId,
  unfilledBySlotId,
  displayName,
  tb,
}: {
  slots: { slotId: string; position: string; x: number; y: number }[];
  selectedBySlotId: Map<string, BestXiSelectedSlot>;
  unfilledBySlotId: Map<string, BestXiUnfilledSlot>;
  displayName: (c: BestXiCandidate) => string;
  tb: (key: string) => string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-3 sm:p-4">
      <p className="mb-2 text-xs font-semibold text-text-dim">{tb("pitchViewHeading")}</p>
      <div className="relative mx-auto aspect-[68/105] w-full max-w-sm rounded-md border border-border bg-surface-2/40">
        {slots.map((slot) => {
          const sel = selectedBySlotId.get(slot.slotId);
          const unfilled = unfilledBySlotId.get(slot.slotId);
          return (
            <div
              key={slot.slotId}
              className="absolute flex w-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              data-pitch-position={slot.position}
            >
              <span
                className={`inline-flex min-h-[28px] w-full items-center justify-center rounded-md border px-1 text-2xs font-semibold ${
                  sel
                    ? sel.suitability.tier === "exact"
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-info/60 bg-info/10 text-info"
                    : unfilled
                      ? "border-warning/50 bg-warning/10 text-warning"
                      : "border-border bg-surface text-text-muted"
                }`}
                title={sel ? displayName(sel.candidate) : undefined}
              >
                {sel ? truncateName(displayName(sel.candidate)) : tb("slotEmptyLabel")}
              </span>
              <span className="mt-0.5 text-2xs text-text-muted">{slot.position}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncateName(name: string): string {
  return name.length > 8 ? `${name.slice(0, 7)}…` : name;
}

function BestXiSlotList({
  slots,
  selectedBySlotId,
  unfilledBySlotId,
  displayName,
  tb,
  fillTb,
  t,
}: {
  slots: { slotId: string; position: string; line: number; displayOrder: number }[];
  selectedBySlotId: Map<string, BestXiSelectedSlot>;
  unfilledBySlotId: Map<string, BestXiUnfilledSlot>;
  displayName: (c: BestXiCandidate) => string;
  tb: (key: string) => string;
  fillTb: (key: string, vars: Record<string, string>) => string;
  t: <N extends keyof Dictionary>(namespace: N, key: keyof Dictionary[N]) => string;
}) {
  const ordered = [...slots].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <div className="rounded-card border border-border bg-surface p-3 sm:p-4">
      <p className="mb-2 text-xs font-semibold text-text-dim">{tb("listViewHeading")}</p>
      <ul className="flex flex-col gap-2">
        {ordered.map((slot) => {
          const sel = selectedBySlotId.get(slot.slotId);
          const unfilled = unfilledBySlotId.get(slot.slotId);
          return (
            <li key={slot.slotId} data-world-card-id={sel?.candidate.worldCardId} className="rounded-md border border-border/60 p-2 text-xs">
              {sel ? (
                <details>
                  <summary
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-2"
                    aria-label={fillTb("playerDetailToggleAriaTemplate", { name: displayName(sel.candidate) })}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="outline">{slot.position}</Badge>
                      <span className="font-semibold text-text">{displayName(sel.candidate)}</span>
                      {sel.candidate.ruleKind === "legacy" ? <Badge tone="warning">{tb("legacyRuleBadge")}</Badge> : null}
                    </span>
                    <span className="text-2xs text-text-muted">
                      {sel.candidate.buildName ? `${tb("selectedBuildLabel")}: ${sel.candidate.buildName}` : tb("noSavedBuildLabel")}
                    </span>
                  </summary>
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-border/50 pt-2 text-2xs text-text-dim">
                    <p>
                      {tb("suitabilityLabel")}: {t("bestXi", suitabilityLabelKey(sel.suitability.tier))}
                    </p>
                    <p>
                      {tb("positionRatingLabel")}: {sel.positionRating != null ? sel.positionRating : tb("positionRatingUnavailable")}
                    </p>
                    <div>
                      <p className="font-semibold text-text-dim">{tb("reasonsHeading")}</p>
                      <ul className="list-disc ps-4">
                        {sel.reasonCodes.map((code) => (
                          <li key={code}>{t("bestXi", SELECTION_REASON_LABEL_KEY[code] as keyof Dictionary["bestXi"])}</li>
                        ))}
                      </ul>
                    </div>
                    {sel.alternativeCandidateCount > 0 ? (
                      <p>{fillTb("alternativeCandidateCountTemplate", { count: String(sel.alternativeCandidateCount) })}</p>
                    ) : null}
                  </div>
                </details>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Badge tone="outline">{slot.position}</Badge>
                    <span className="text-text-muted">{tb("slotEmptyLabel")}</span>
                  </span>
                  {unfilled ? (
                    <span className="text-2xs text-warning">{t("bestXi", UNFILLED_SLOT_REASON_LABEL_KEY[unfilled.reason] as keyof Dictionary["bestXi"])}</span>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const BENCH_REASON_KEY: Record<BestXiBenchResult["entries"][number]["reason"], string> = {
  backupGoalkeeper: "benchReasonBackupGoalkeeper",
  positionCover: "benchReasonPositionCover",
  bestRemaining: "benchReasonBestRemaining",
};

function BestXiBench({
  bench,
  displayName,
  tb,
  fillTb,
}: {
  bench: BestXiBenchResult;
  displayName: (c: BestXiCandidate) => string;
  tb: (key: string) => string;
  fillTb: (key: string, vars: Record<string, string>) => string;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-3 text-xs sm:p-4" data-testid="best-xi-bench">
      <h2 className="font-semibold text-text-dim">
        {fillTb("benchHeadingTemplate", { count: String(bench.entries.length), max: String(bench.maxSize) })}
      </h2>
      <p className="mt-1 text-2xs text-text-muted">{tb("benchIntro")}</p>
      {bench.entries.length === 0 ? (
        <p className="mt-2 text-text-dim">{tb("benchEmpty")}</p>
      ) : (
        <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {bench.entries.map((e) => (
            <li key={e.candidate.candidateKey} data-world-card-id={e.candidate.worldCardId} className="flex min-w-0 items-center gap-2 rounded border border-border/60 p-2">
              <span className="w-10 shrink-0 font-semibold text-accent">{e.position}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold text-text">{displayName(e.candidate)}</span>
                <span className="block text-2xs text-text-muted">
                  {tb(BENCH_REASON_KEY[e.reason])}
                  {e.candidate.buildName ? ` · ${e.candidate.buildName}` : ""}
                </span>
              </span>
              {e.positionRating != null ? (
                <span className="shrink-0 tabular-nums text-text-dim">{fillTb("benchRatingTemplate", { rating: String(Math.round(e.positionRating)) })}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {bench.uncoveredPositions.length > 0 ? (
        <p className="mt-2 text-2xs text-text-muted">{fillTb("benchUncoveredTemplate", { positions: bench.uncoveredPositions.join(" / ") })}</p>
      ) : null}
    </section>
  );
}

function BestXiExclusions({
  result,
  displayName,
  tb,
  fillTb,
  t,
}: {
  result: BestXiSelectionResult;
  displayName: (c: BestXiCandidate) => string;
  tb: (key: string) => string;
  fillTb: (key: string, vars: Record<string, string>) => string;
  t: <N extends keyof Dictionary>(namespace: N, key: keyof Dictionary[N]) => string;
}) {
  return (
    <details className="rounded-card border border-border bg-surface p-3 text-xs sm:p-4">
      <summary className="cursor-pointer font-semibold text-text-dim">
        {tb("alternativesHeading")} {result.notableExclusions.length > 0 ? `(${result.notableExclusions.length})` : ""}
      </summary>
      {result.notableExclusions.length === 0 ? (
        <p className="mt-2 text-text-dim">{tb("alternativesEmptyText")}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {result.notableExclusions.map((ex) => (
            <li key={ex.candidateKey} className="rounded border border-border/60 p-2">
              <span className="font-semibold text-text-dim">{fillTb("alternativesSlotPrefixTemplate", { position: ex.relatedSlotId.toUpperCase() })}</span>{" "}
              <span className="font-semibold text-text">{displayName(ex.candidate)}</span>
              {ex.candidate.buildName ? <span className="text-text-muted"> ({ex.candidate.buildName})</span> : null}
              <p className="mt-0.5 text-text-dim">{t("bestXi", EXCLUSION_REASON_LABEL_KEY[ex.reasonCode] as keyof Dictionary["bestXi"])}</p>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
