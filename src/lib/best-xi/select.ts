import { getFormation } from "@/lib/squad/formations";
import type { FormationSlot } from "@/lib/squad/types";
import { compareRankTuples, computeRankTuple, type BestXiRankTuple } from "./rank";
import { evaluateSlotSuitability } from "./eligibility";
import { optimizeBestXi } from "./optimize";
import type {
  BestXiCandidate,
  BestXiExclusion,
  BestXiExclusionReasonCode,
  BestXiLimitationCode,
  BestXiSelectedSlot,
  BestXiSelectionReasonCode,
  BestXiSelectionResult,
  BestXiSuitability,
  BestXiUnavailableCard,
  BestXiUnfilledSlot,
} from "./types";

const MAX_REASON_CODES = 3;
const MAX_EXCLUSIONS_PER_SLOT = 2;
const MAX_TOTAL_EXCLUSIONS = 5;

interface ScoredCandidate {
  candidate: BestXiCandidate;
  tuple: BestXiRankTuple;
  suitability: BestXiSuitability;
}

/**
 * AIベスト11(第1段階・総合型)の選考本体。純関数・決定的・Math.random不使用・現在時刻に依存しない
 * (generatedAtは呼び出し側が渡した固定文字列をそのまま記録するだけで、選考結果そのものには影響しない)。
 *
 * アルゴリズム: `optimizeBestXi`(Kuhn法による最大二部マッチング+有界な局所交換探索)による
 * 全体配置最適化。合成スコア(重み付き合計)は使わない。優先度1(埋まる必須スロット数の最大化)は
 * Kuhn法により証明可能な形で保証し、優先度2以降(本職優先・同系統最小化・leximinポジション別評価・
 * データ確実性・育成目的の補助的一致)は有界な決定的局所探索で改善する(証明された大域最適ではない
 * ことをここに明記する。詳細は `optimize.ts` を参照)。
 * この関数自体は `optimizeBestXi` が返した配置を元に、選考理由・空きスロット・選外候補を
 * 実際の比較条件と一致させて組み立てる。
 */
export function selectBestXi(params: {
  formationId: string;
  candidates: BestXiCandidate[];
  unavailableCards: BestXiUnavailableCard[];
  generatedAt: string;
}): BestXiSelectionResult {
  const { formationId, candidates, unavailableCards, generatedAt } = params;
  const formation = getFormation(formationId);
  const slots = [...formation.slots].sort((a, b) => a.displayOrder - b.displayOrder);

  // worldCardId ごとに候補をまとめる(同一カードは最終的に1スロットにしか配置しない)。
  const candidatesByCard = new Map<string, BestXiCandidate[]>();
  for (const c of candidates) {
    const list = candidatesByCard.get(c.worldCardId);
    if (list) list.push(c);
    else candidatesByCard.set(c.worldCardId, [c]);
  }

  const { assignment, candidatePoolBounded } = optimizeBestXi({ slots, candidates });

  const selectedBySlot = new Map<string, ScoredCandidate>();
  for (const slot of slots) {
    const candidate = assignment.get(slot.slotId);
    if (!candidate) continue;
    const { tuple, suitability } = computeRankTuple(candidate, slot.position);
    selectedBySlot.set(slot.slotId, { candidate, tuple, suitability });
  }

  // ---- 選考理由・空きスロット・選外候補の組み立て ----
  const slotByPosition = new Map(slots.map((s) => [s.slotId, s]));
  const cardToSelectedSlotId = new Map<string, string>();
  for (const [slotId, sc] of selectedBySlot) cardToSelectedSlotId.set(sc.candidate.worldCardId, slotId);

  const resultSlots: BestXiSelectedSlot[] = [];
  const unfilledSlots: BestXiUnfilledSlot[] = [];

  for (const slot of slots) {
    const sc = selectedBySlot.get(slot.slotId);
    if (!sc) {
      const anyCandidateForPosition = candidates.some(
        (c) => evaluateSlotSuitability(c.registeredPosition, slot.position).tier !== "excluded" && c.abilityStatus === "available",
      );
      unfilledSlots.push({
        slotId: slot.slotId,
        position: slot.position,
        reason: anyCandidateForPosition ? "onlyIneligibleCandidates" : "noCandidate",
      });
      continue;
    }

    // このスロットに対する全適格候補(選出者を除く)を数えて、理由コードの判定に使う。
    const eligibleForSlot: ScoredCandidate[] = [];
    for (const list of candidatesByCard.values()) {
      for (const candidate of list) {
        const { tuple, suitability } = computeRankTuple(candidate, slot.position);
        if (tuple.eligible) eligibleForSlot.push({ candidate, tuple, suitability });
      }
    }
    eligibleForSlot.sort((a, b) => compareRankTuples(a.tuple, b.tuple));

    const ownBuildCount = (candidatesByCard.get(sc.candidate.worldCardId) ?? []).length;
    const reasonCodes: BestXiSelectionReasonCode[] = [];
    if (sc.suitability.tier === "exact") reasonCodes.push("exactPosition");
    if (eligibleForSlot.length === 1) reasonCodes.push("onlyEligibleCandidate");
    else if (reasonCodes.length < MAX_REASON_CODES) reasonCodes.push("topPositionRating");
    if (reasonCodes.length < MAX_REASON_CODES && ownBuildCount > 1) reasonCodes.push("bestBuildAmongOwnBuilds");
    if (reasonCodes.length < MAX_REASON_CODES && sc.candidate.source === "base") reasonCodes.push("noSavedBuildUsesBaseStats");
    if (reasonCodes.length < MAX_REASON_CODES && sc.candidate.source === "build") reasonCodes.push("fullAbilityDataConfirmed");
    // 保存済み育成目的(SavedBuild.buildIntent)は補助的根拠のみ: 実際の適性・評価より優先度を下げ、
    // 既存理由で枠が埋まっていなければ追加する。
    if (reasonCodes.length < MAX_REASON_CODES && sc.tuple.intentMatchRank === 0) reasonCodes.push("intentPositionMatch");
    // このスロットが、この候補にとって個別に最も評価の高い適格スロットではない場合
    // (=全体最適化のためにあえてこの配置を選んだことが事実として確認できる場合)のみ表示する。
    if (
      reasonCodes.length < MAX_REASON_CODES &&
      isNotIndividuallyBestSlot(sc.candidate, slot.slotId, slots)
    ) {
      reasonCodes.push("optimalOverallPlacement");
    }

    resultSlots.push({
      slotId: slot.slotId,
      position: slot.position,
      candidate: sc.candidate,
      suitability: sc.suitability,
      positionRating: sc.tuple.positionRating,
      reasonCodes: reasonCodes.slice(0, MAX_REASON_CODES),
      alternativeCandidateCount: Math.max(0, eligibleForSlot.length - 1),
    });
  }

  // ---- 有力な選外候補 ----
  // 同じ候補(candidateKey)が複数のスロットで「惜しい候補」になり得る場合、
  // 最も説明価値の高い1文脈だけを選んでから、各スロット最大2件・全体最大5件程度に絞り込む。
  // 「同一カードの別ビルドが採用済み」は本機能の中核保証(同一カード重複防止)を最も具体的に
  // 示す情報のため、他の理由より優先して残す(スロット処理順だけで枠が埋まらないようにする)。
  interface ExclusionCandidateEntry {
    slotId: string;
    slotIndex: number;
    candidate: BestXiCandidate;
    tuple: BestXiRankTuple;
    reason: BestXiExclusionReasonCode;
    selectedInsteadCandidateKey: string | null;
  }
  const entriesByCandidateKey = new Map<string, ExclusionCandidateEntry[]>();
  slots.forEach((slot, slotIndex) => {
    const sc = selectedBySlot.get(slot.slotId);
    for (const list of candidatesByCard.values()) {
      for (const candidate of list) {
        if (sc && candidate.candidateKey === sc.candidate.candidateKey) continue;
        const { tuple, suitability } = computeRankTuple(candidate, slot.position);
        // considered(能力データを確認できる候補すべて。gkMismatch/unresolvedも含む)を対象にする。
        // どちらも自動選出はしないが、「GKとフィールドが不一致」「適性を確認できないため対象外」
        // という選外理由を示すために選外候補一覧では検討する。
        if (!tuple.considered) continue;
        const reason = exclusionReasonFor({
          runner: { candidate, tuple, suitability },
          slotId: slot.slotId,
          selected: sc ?? null,
          cardToSelectedSlotId,
        });
        if (!reason) continue;
        const entry: ExclusionCandidateEntry = {
          slotId: slot.slotId,
          slotIndex,
          candidate,
          tuple,
          reason,
          selectedInsteadCandidateKey: sc?.candidate.candidateKey ?? null,
        };
        const list2 = entriesByCandidateKey.get(candidate.candidateKey);
        if (list2) list2.push(entry);
        else entriesByCandidateKey.set(candidate.candidateKey, [entry]);
      }
    }
  });

  // 選外理由コードの優先度(小さいほど優先して残す)。
  // 「同一カードの別ビルドが採用済み」(重複防止という中核保証)と「適性を確認できないため対象外」
  // (不具合Aの再発防止として明示すべき理由)を、単なる僅差の順位比較より優先して残す。
  // これをしないと、たまたま別スロットで既に採用済みの候補(usedInOtherRequiredSlot)が
  // tierRank上位というだけで枠を占有し、unresolvedのために自動選出から外れた候補の理由が
  // 選外候補一覧に一切表示されなくなり得るため。
  function reasonPriority(reason: BestXiExclusionReasonCode): number {
    if (reason === "sameCardBuildUsedElsewhere") return 0;
    // positionSuitabilityUnresolved(系統不明)とgkFieldMismatch(GK⇔フィールド)は、
    // どちらも「そもそも配置が成立しない」ことを示す点で、単なる僅差の順位比較(lowerSuitability等)
    // より優先して残す。
    if (reason === "positionSuitabilityUnresolved" || reason === "gkFieldMismatch") return 1;
    return 2;
  }
  // 優先度が同点(1)の場合、系統不明(unresolved)の方がGK⇔フィールド不一致より一般的で
  // 説明価値が高いとみなし、同じ候補が両方の文脈を持つ場合はunresolvedを優先して残す
  // (不具合Aの再発防止テストが要求する具体的な挙動)。
  function reasonSubPriority(reason: BestXiExclusionReasonCode): number {
    return reason === "gkFieldMismatch" ? 1 : 0;
  }

  // 候補1件につき、最も説明価値の高い1文脈だけを残す。
  const bestEntryPerCandidate: ExclusionCandidateEntry[] = [];
  for (const entries of entriesByCandidateKey.values()) {
    entries.sort((a, b) => {
      const ap = reasonPriority(a.reason);
      const bp = reasonPriority(b.reason);
      if (ap !== bp) return ap - bp;
      const asp = reasonSubPriority(a.reason);
      const bsp = reasonSubPriority(b.reason);
      if (asp !== bsp) return asp - bsp;
      return a.slotIndex - b.slotIndex;
    });
    bestEntryPerCandidate.push(entries[0]);
  }

  // スロットごとに最大2件、理由の優先度→適合度の順が良いものを残す。
  const bySlot = new Map<string, ExclusionCandidateEntry[]>();
  for (const entry of bestEntryPerCandidate) {
    const list3 = bySlot.get(entry.slotId);
    if (list3) list3.push(entry);
    else bySlot.set(entry.slotId, [entry]);
  }
  const trimmedPerSlot: ExclusionCandidateEntry[] = [];
  for (const slot of slots) {
    const list4 = bySlot.get(slot.slotId);
    if (!list4) continue;
    list4.sort(
      (a, b) =>
        reasonPriority(a.reason) - reasonPriority(b.reason) ||
        reasonSubPriority(a.reason) - reasonSubPriority(b.reason) ||
        compareRankTuples(a.tuple, b.tuple),
    );
    trimmedPerSlot.push(...list4.slice(0, MAX_EXCLUSIONS_PER_SLOT));
  }

  // 全体上限: 理由の優先度を優先し、次にスロット順で決定的に選ぶ。
  const orderedExclusions = [...trimmedPerSlot].sort(
    (a, b) =>
      reasonPriority(a.reason) - reasonPriority(b.reason) ||
      reasonSubPriority(a.reason) - reasonSubPriority(b.reason) ||
      a.slotIndex - b.slotIndex,
  );
  const notableExclusions: BestXiExclusion[] = orderedExclusions.slice(0, MAX_TOTAL_EXCLUSIONS).map((e) => ({
    candidateKey: e.candidate.candidateKey,
    candidate: e.candidate,
    relatedSlotId: e.slotId,
    reasonCode: e.reason,
    selectedInsteadCandidateKey: e.selectedInsteadCandidateKey,
  }));

  // ---- 集計・制限事項 ----
  const distinctCardsWithAvailableCandidate = new Set(
    candidates.filter((c) => c.abilityStatus === "available").map((c) => c.worldCardId),
  );
  const availableBuildCount = candidates.filter((c) => c.source === "build" && c.abilityStatus === "available").length;
  const excludedCandidateCount = candidates.length - resultSlots.length;

  const limitationCodes: BestXiLimitationCode[] = [
    "singleFormationOnly",
    "noBenchSelection",
    "noManagerSelection",
    "personIdentityUnavailable",
    "additionalPositionAptitudeLimited",
  ];
  if (candidatePoolBounded) limitationCodes.push("largeCandidatePoolBounded");

  const exactSelectionCount = resultSlots.filter((s) => s.suitability.tier === "exact").length;
  const relatedSelectionCount = resultSlots.filter((s) => s.suitability.tier === "related").length;

  return {
    formationId: formation.id,
    mode: "overall",
    slots: resultSlots,
    unfilledSlots,
    candidateCount: distinctCardsWithAvailableCandidate.size,
    availableBuildCount,
    excludedCandidateCount: Math.max(0, excludedCandidateCount),
    filledRequiredSlotCount: resultSlots.length,
    exactSelectionCount,
    relatedSelectionCount,
    notableExclusions,
    limitationCodes,
    unavailableCards,
    generatedAt,
  };
}

function exclusionReasonFor(params: {
  runner: ScoredCandidate;
  slotId: string;
  selected: ScoredCandidate | null;
  cardToSelectedSlotId: Map<string, string>;
}): BestXiExclusionReasonCode | null {
  const { runner, slotId, selected, cardToSelectedSlotId } = params;

  if (selected && runner.candidate.worldCardId === selected.candidate.worldCardId) {
    return "sameCardBuildUsedElsewhere";
  }
  const usedSlotId = cardToSelectedSlotId.get(runner.candidate.worldCardId);
  if (usedSlotId && usedSlotId !== slotId) {
    return "usedInOtherRequiredSlot";
  }
  // GK⇔フィールドの不一致(tier==="excluded")は、系統不明(unresolved)とは別の、
  // 確実に区別できる不適性として明示する。
  if (runner.suitability.tier === "excluded") {
    return "gkFieldMismatch";
  }
  // unresolved(系統が異なる、または登録ポジション不明)は自動選出の対象外。
  // ポジション別推定評価を計算できていても、配置可能性の根拠にはしない。
  if (!runner.tuple.eligible) {
    return "positionSuitabilityUnresolved";
  }
  if (!selected) return null;
  if (runner.suitability.tier !== selected.suitability.tier) {
    return "lowerSuitability";
  }
  return "lowerPositionRating";
}

/**
 * この候補(特定のビルド変体)にとって、割り当てられたスロットが個別に見て最も評価の高い
 * 適格スロットではない場合に true を返す。true の場合、この配置は候補個人にとっての
 * 最適スロットではなく、チーム全体の最適化のためにあえて選ばれたことが事実として確認できる。
 */
function isNotIndividuallyBestSlot(
  candidate: BestXiCandidate,
  assignedSlotId: string,
  slots: FormationSlot[],
): boolean {
  let bestSlotId: string | null = null;
  let bestTuple: BestXiRankTuple | null = null;
  for (const slot of slots) {
    const { tuple } = computeRankTuple(candidate, slot.position);
    if (!tuple.eligible) continue;
    if (!bestTuple || compareRankTuples(tuple, bestTuple) < 0) {
      bestTuple = tuple;
      bestSlotId = slot.slotId;
    }
  }
  return bestSlotId !== null && bestSlotId !== assignedSlotId;
}
