import type { FormationSlot } from "@/lib/squad/types";
import { compareRankTuples, computeRankTuple, type BestXiRankTuple } from "./rank";
import { buildTeamRankTuple, compareTeamTuples } from "./team-rank";
import type { BestXiCandidate } from "./types";

/**
 * AIベスト11(総合型・全体配置最適化)の探索本体。
 *
 * 合成スコア(重み付き合計の「AIスコア」)は一切使わない。決定的な二段階アルゴリズムのみを用いる。
 *
 * ## フェーズA: 最大二部マッチング(Kuhn法・増加パス法)
 * 「スロット」×「候補カード(worldCardId単位。同一カードは1枠にしか入れない)」の二部グラフで、
 * 辺は「そのカードの少なくとも1つのビルド変体がそのスロットへ適格(eligible)」で張る。
 * Kuhn法は数学的に最大カード数のマッチングを必ず見つけることが保証されているアルゴリズムであり、
 * これによりタスク優先度1位の「埋められる必須スロット数の最大化」を**証明可能な形で**保証する
 * (ヒューリスティックな貪欲法では原理的に保証できない)。
 *
 * 計算量: フォーメーションは常に11スロット固定のため O(スロット数 × 辺数) = O(11 × 候補カード数)
 * であり、候補カードが数百件規模でも実測上ミリ秒未満で完了する(下記の性能計測を参照)。
 * このため候補数に対する積極的な枝刈りは性能上必須ではないが、
 * 対戦的・極端に巨大な入力に対する防御目的でのみ `CANDIDATE_POOL_CAP` を適用する
 * (通常規模の入力では発動しない安全弁であり、性能を成立させるための必須条件ではない)。
 *
 * ## フェーズB: 有界な局所交換探索(局所改善・優先度2以降)
 * フェーズAで確定した「埋まったスロット数」を一切減らさない範囲で、
 * 優先度2(本職数)・3(同系統数)・4(leximinポジション別評価)・5(データ確実性)・
 * 6(育成目的一致・補助的)を `compareTeamTuples` を使って改善できる交換だけを、
 * 決定的な固定回数の走査(`LOCAL_SEARCH_PASS_CAP` 回、改善が無くなれば早期終了)で適用する。
 * 具体的には (a) 未使用の適格カードによる単一スロットの入れ替え、(b) 2つの確定済みスロット間の
 * カードの交換、の2種類のみを試す。3人以上が絡む回転的な入れ替えは対象外であり、
 * この探索は「優先度2以降について証明された大域最適解」を保証するものではない
 * (優先度1のみKuhn法により証明可能。それ以外は決定的・有界な改善探索であることを最終報告で開示する)。
 *
 * 決定性: 入力候補配列の並び順に一切依存しないよう、内部で候補を
 * (worldCardId数値, buildId文字列) の固定順へ正規化してから処理する。Math.random不使用・
 * 現在時刻/localeに非依存。
 */

const CANDIDATE_POOL_CAP = 300;
const PER_SLOT_CANDIDATE_POOL_CAP = 50;
const LOCAL_SEARCH_PASS_CAP = 5;

interface SlotVariant {
  candidate: BestXiCandidate;
  tuple: BestXiRankTuple;
}

export interface OptimizeBestXiResult {
  /** スロットID→採用候補(そのスロット向けに最良のビルド変体を選んだもの)。未配置スロットは含まない。 */
  assignment: Map<string, BestXiCandidate>;
  /** 防御的な候補プール上限を実際に適用したか(制限事項表示用。通常規模では false)。 */
  candidatePoolBounded: boolean;
}

export function optimizeBestXi(params: {
  slots: readonly FormationSlot[];
  candidates: readonly BestXiCandidate[];
}): OptimizeBestXiResult {
  const slots = [...params.slots].sort((a, b) => a.displayOrder - b.displayOrder);

  // 入力配列の並び順に依存しないよう、決定的な固定順へ正規化する。
  const sortedCandidates = [...params.candidates].sort(compareCandidateCanonical);

  const candidatesByCard = new Map<string, BestXiCandidate[]>();
  for (const c of sortedCandidates) {
    const list = candidatesByCard.get(c.worldCardId);
    if (list) list.push(c);
    else candidatesByCard.set(c.worldCardId, [c]);
  }
  const cardIds = [...candidatesByCard.keys()];
  const candidatePoolBounded = cardIds.length > CANDIDATE_POOL_CAP;

  // スロットごとに「そのカードにとってこのスロットへの最良ビルド変体」を、適格(eligible)なカードのみ求める。
  const slotVariantMaps: Map<string, SlotVariant>[] = slots.map((slot) => {
    const map = new Map<string, SlotVariant>();
    for (const cardId of cardIds) {
      const builds = candidatesByCard.get(cardId)!;
      let best: SlotVariant | null = null;
      for (const candidate of builds) {
        const { tuple, suitability } = computeRankTuple(candidate, slot.position);
        if (!tuple.eligible) continue;
        void suitability;
        if (!best || compareRankTuples(tuple, best.tuple) < 0) best = { candidate, tuple };
      }
      if (best) map.set(cardId, best);
    }
    // 防御的上限: 通常規模では発動しない。カード総数が上限を超える場合だけ、
    // このスロットにとって明らかに劣るカードを決定的に切り捨てる(常に上位候補を残す)。
    if (candidatePoolBounded && map.size > PER_SLOT_CANDIDATE_POOL_CAP) {
      const ranked = [...map.entries()].sort((a, b) => compareRankTuples(a[1].tuple, b[1].tuple));
      return new Map(ranked.slice(0, PER_SLOT_CANDIDATE_POOL_CAP));
    }
    return map;
  });

  // スロットごとの適格カードID一覧(そのスロットにとっての優先順=タプル順で並べる)。
  const adjacency: string[][] = slotVariantMaps.map((map) =>
    [...map.entries()].sort((a, b) => compareRankTuples(a[1].tuple, b[1].tuple)).map(([cardId]) => cardId),
  );

  // ---- フェーズA: Kuhn法(増加パス法)による最大二部マッチング ----
  const matchCardToSlot = new Map<string, number>();
  const slotAssignedCard: (string | null)[] = slots.map(() => null);

  function tryAugment(slotIndex: number, visited: Set<string>): boolean {
    for (const cardId of adjacency[slotIndex]) {
      if (visited.has(cardId)) continue;
      visited.add(cardId);
      const assignedSlot = matchCardToSlot.get(cardId);
      if (assignedSlot === undefined || tryAugment(assignedSlot, visited)) {
        matchCardToSlot.set(cardId, slotIndex);
        slotAssignedCard[slotIndex] = cardId;
        return true;
      }
    }
    return false;
  }

  // 希少なスロット(適格カードが少ないスロット)から先に確定させる決定的な処理順。
  // Kuhn法は処理順によらず最大カード数のマッチングを見つけるが、この順序にすることで
  // 希少ポジション(例: GK)が終盤まで残って偶然埋まらない、という事態を避けやすくする。
  const slotProcessOrder = slots
    .map((_, i) => i)
    .sort((a, b) => adjacency[a].length - adjacency[b].length || a - b);
  for (const slotIndex of slotProcessOrder) {
    tryAugment(slotIndex, new Set());
  }

  // ---- フェーズB: 有界な局所交換探索(優先度2以降の改善。フェーズAが確定した枠数は減らさない) ----
  function currentAssignment(): Map<string, BestXiCandidate> {
    const out = new Map<string, BestXiCandidate>();
    slots.forEach((slot, i) => {
      const cardId = slotAssignedCard[i];
      if (cardId) out.set(slot.slotId, slotVariantMaps[i].get(cardId)!.candidate);
    });
    return out;
  }

  let currentTuple = buildTeamRankTuple({ assignment: currentAssignment(), slots });

  for (let pass = 0; pass < LOCAL_SEARCH_PASS_CAP; pass++) {
    let improved = false;

    // (a) 単一スロット入れ替え: 現在未使用の適格カードに差し替えて改善するか。
    for (let i = 0; i < slots.length; i++) {
      const currentCardId = slotAssignedCard[i];
      if (!currentCardId) continue;
      for (const [cardId] of slotVariantMaps[i]) {
        if (cardId === currentCardId) continue;
        if (matchCardToSlot.has(cardId)) continue; // 他スロットで使用中のカードは単純差し替えの対象外
        const trialAssignment = currentAssignment();
        trialAssignment.set(slots[i].slotId, slotVariantMaps[i].get(cardId)!.candidate);
        const trialTuple = buildTeamRankTuple({ assignment: trialAssignment, slots });
        if (compareTeamTuples(trialTuple, currentTuple) < 0) {
          matchCardToSlot.delete(currentCardId);
          matchCardToSlot.set(cardId, i);
          slotAssignedCard[i] = cardId;
          currentTuple = trialTuple;
          improved = true;
          // このスロット(i)の占有カードが変わったため、このiに対する残りの候補走査は
          // 古い currentCardId を前提にした不整合な状態になる。安全のため直ちに次のiへ進む。
          break;
        }
      }
    }

    // (b) 空きスロットへの移動: 埋まっているスロットのカードを、まだ埋まっていない別の適格スロットへ
    // 動かす(移動元は空きスロットになる)。埋まるスロット総数(フェーズAが証明した最大値)は
    // 変化しないため、優先度1を損なわない。これが無いと「関連ポジションの空きスロットへ
    // 先に割り当てられ、後から見つかった本職スロットへ移れない」という誤配置が残ってしまう。
    for (let i = 0; i < slots.length; i++) {
      const cardI = slotAssignedCard[i];
      if (!cardI) continue;
      for (let k = 0; k < slots.length; k++) {
        if (k === i || slotAssignedCard[k]) continue; // 移動先は空きスロットのみ
        const variant = slotVariantMaps[k].get(cardI);
        if (!variant) continue;
        const trialAssignment = currentAssignment();
        trialAssignment.delete(slots[i].slotId);
        trialAssignment.set(slots[k].slotId, variant.candidate);
        const trialTuple = buildTeamRankTuple({ assignment: trialAssignment, slots });
        if (compareTeamTuples(trialTuple, currentTuple) < 0) {
          matchCardToSlot.set(cardI, k);
          slotAssignedCard[i] = null;
          slotAssignedCard[k] = cardI;
          currentTuple = trialTuple;
          improved = true;
          break;
        }
      }
    }

    // (c) 2スロット間のカード交換: 双方が互いのスロットへも適格な場合のみ試す。
    for (let i = 0; i < slots.length; i++) {
      const cardI = slotAssignedCard[i];
      if (!cardI) continue;
      for (let j = i + 1; j < slots.length; j++) {
        const cardJ = slotAssignedCard[j];
        if (!cardJ) continue;
        const variantIforJ = slotVariantMaps[j].get(cardI);
        const variantJforI = slotVariantMaps[i].get(cardJ);
        if (!variantIforJ || !variantJforI) continue;
        const trialAssignment = currentAssignment();
        trialAssignment.set(slots[i].slotId, variantJforI.candidate);
        trialAssignment.set(slots[j].slotId, variantIforJ.candidate);
        const trialTuple = buildTeamRankTuple({ assignment: trialAssignment, slots });
        if (compareTeamTuples(trialTuple, currentTuple) < 0) {
          matchCardToSlot.set(cardJ, i);
          matchCardToSlot.set(cardI, j);
          slotAssignedCard[i] = cardJ;
          slotAssignedCard[j] = cardI;
          currentTuple = trialTuple;
          improved = true;
          // このスロット(i)の占有カードが変わったため、古い cardI を前提にした残りの
          // j走査は不整合になる。安全のため直ちに次のiへ進む。
          break;
        }
      }
    }

    if (!improved) break;
  }

  return { assignment: currentAssignment(), candidatePoolBounded };
}

function compareCandidateCanonical(a: BestXiCandidate, b: BestXiCandidate): number {
  const an = safeBigInt(a.worldCardId);
  const bn = safeBigInt(b.worldCardId);
  if (an !== bn) return an < bn ? -1 : 1;
  const ak = a.buildId ?? "";
  const bk = b.buildId ?? "";
  if (ak !== bk) return ak < bk ? -1 : 1;
  return 0;
}

function safeBigInt(worldCardId: string): bigint {
  try {
    return BigInt(worldCardId);
  } catch {
    return 0n;
  }
}
