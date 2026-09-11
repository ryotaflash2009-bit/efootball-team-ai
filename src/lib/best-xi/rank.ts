import { estimateOvr, getPositionAbilityRanking } from "@/lib/progression/calculate-rating";
import { evaluateSlotSuitability, isBestXiAutoSelectableForSlot, suitabilityTierRank } from "./eligibility";
import type { BestXiCandidate, BestXiSuitability } from "./types";

/**
 * 候補1件 × スロット1件の決定的な比較用タプル。
 *
 * 合成スコア(重み付き合計)は使わない。辞書式比較(タプルを先頭要素から順に比較)のみを用いる。
 * - eligible: AIベスト11の自動選出でこのスロットへ配置してよいか(exact/relatedのみtrue。
 *   unresolved/gkMismatchはfalse。「ポジション別推定評価を計算できること」と「配置してよいこと」を
 *   分離するため、ability自体が取得できてもtierがunresolvedならfalseになる)。
 * - considered: 表示・選外理由の生成対象として検討してよいか(能力データを確認できていればtrue。
 *   unresolved/gkMismatchもtrueになる — 自動選出はしないが、「適性を確認できないため対象外」
 *   「GKとフィールドが不一致」という選外理由を生成するために、評価自体は保持しておく必要があるため)。
 * - tierRank: 0=本職(exact) / 1=同系統(related) / 2=系統不明(unresolved)
 * - positionRating: そのスロットのポジションに対する推定OVR(estimateOvr、既存関数)。高いほど良い。
 *   自動選出の可否とは独立に計算する(表示・選外理由用に保持するだけで、配置可否には使わない)。
 * - abilityTieBreak: positionRatingが完全に同点だった場合だけに使う決定的なタイブレーク。
 *   新しい能力重みを作らず、既存のestimateOvrが参照する重み表を再利用した
 *   `getPositionAbilityRanking`(重みが高い能力から順)の順で実際の能力値を並べた配列を、
 *   要素ごとに比較する(先頭=最重要能力から)。値が高いほど良い。
 * - dataAvailableRank: 0=能力データ確認済み / 1=未確認(理論上ここに来る前に除外される想定)
 * - intentMatchRank: 0=保存済み育成目的(SavedBuild.buildIntent.intendedPositions)にこのスロットの
 *   ポジションが含まれる / 1=含まれない・未保存・base候補。実際の適性・評価より優先度を下げた
 *   補助的なタイブレークとしてのみ使う(このタプルの中で最後から2番目=最も優先度が低い位置)。
 * - stableTieBreak: worldCardId(数値)→buildId(文字列)の固定順。localeに依存しない。
 */
export interface BestXiRankTuple {
  eligible: boolean;
  considered: boolean;
  tierRank: number;
  positionRating: number | null;
  abilityTieBreak: number[];
  dataAvailableRank: number;
  intentMatchRank: number;
  worldCardIdNum: bigint;
  buildIdKey: string;
}

export function computeRankTuple(candidate: BestXiCandidate, slotPosition: string): {
  tuple: BestXiRankTuple;
  suitability: BestXiSuitability;
} {
  const suitability = evaluateSlotSuitability(candidate.registeredPosition, slotPosition);
  const dataAvailable = candidate.abilityStatus === "available";
  const eligible = isBestXiAutoSelectableForSlot(suitability.tier) && dataAvailable;
  // gkMismatch(tier==="excluded")も選外理由一覧の検討対象に含める(自動選出は依然として禁止)。
  const considered = dataAvailable;
  // ポジション別推定評価は表示・選外理由のためだけに保持する(自動選出可否には使わない)。
  const positionRating = dataAvailable && candidate.stats ? estimateOvr(candidate.stats, slotPosition) : null;
  const abilityTieBreak = buildAbilityTieBreak(candidate, slotPosition, dataAvailable);
  const intentMatchRank = candidate.intendedPositions?.includes(slotPosition) ? 0 : 1;
  return {
    tuple: {
      eligible,
      considered,
      tierRank: suitabilityTierRank(suitability.tier),
      positionRating,
      abilityTieBreak,
      dataAvailableRank: dataAvailable ? 0 : 1,
      intentMatchRank,
      worldCardIdNum: safeBigInt(candidate.worldCardId),
      buildIdKey: candidate.buildId ?? "",
    },
    suitability,
  };
}

function buildAbilityTieBreak(candidate: BestXiCandidate, slotPosition: string, dataAvailable: boolean): number[] {
  if (!dataAvailable || !candidate.stats) return [];
  const byKey = new Map(candidate.stats.map((s) => [s.key, s.finalValue]));
  return getPositionAbilityRanking(slotPosition).map((key) => byKey.get(key) ?? -Infinity);
}

function safeBigInt(worldCardId: string): bigint {
  try {
    return BigInt(worldCardId);
  } catch {
    return 0n;
  }
}

/**
 * 2つのタプルを比較する(a が b より良ければ負、悪ければ正、同点なら0)。
 * 辞書式比較: eligible(自動選出可否) → tierRank → positionRating(降順) → dataAvailableRank → 安定タイブレーク。
 *
 * 自動選出プール(bestPerCardForSlot等)は事前にeligible=trueだけへ絞り込んだ上でこの関数を使うため、
 * eligibleの比較は実質無効化される。一方、選外候補一覧(有力な選外候補)ではconsidered=trueの
 * (unresolvedを含む)候補も比較対象になるため、eligibleが同じ(共にfalse)場合でも
 * tierRank以降の比較を必ず続け、決定的な順序を保証する(スロット未使用のunresolved同士でも
 * 呼び出し順に依存しない安定した並びにするため、ここで比較を打ち切らない)。
 */
export function compareRankTuples(a: BestXiRankTuple, b: BestXiRankTuple): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
  const ar = a.positionRating ?? -Infinity;
  const br = b.positionRating ?? -Infinity;
  if (ar !== br) return br - ar; // 高い方が良い(降順)
  const abilityCmp = compareAbilityTieBreak(a.abilityTieBreak, b.abilityTieBreak);
  if (abilityCmp !== 0) return abilityCmp;
  if (a.dataAvailableRank !== b.dataAvailableRank) return a.dataAvailableRank - b.dataAvailableRank;
  if (a.intentMatchRank !== b.intentMatchRank) return a.intentMatchRank - b.intentMatchRank;
  if (a.worldCardIdNum !== b.worldCardIdNum) return a.worldCardIdNum < b.worldCardIdNum ? -1 : 1;
  if (a.buildIdKey !== b.buildIdKey) return a.buildIdKey < b.buildIdKey ? -1 : 1;
  return 0;
}

function compareAbilityTieBreak(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? -Infinity;
    const bv = b[i] ?? -Infinity;
    if (av !== bv) return bv - av; // 高い方が良い(降順)
  }
  return 0;
}
