import type { PerspectiveInput } from "./diagnosis-perspectives";
import { ABILITY_CATEGORIES } from "./squad-diagnosis";

/**
 * スカッドの独自性（候補・比較用・2026-10-07）。決定的・説明できる・版つき。
 *
 * - 実際の利用者の統計（人気・採用率）は使わない。使うのは、この入力（スカッド自身）と、**合成の事前分布**（フォーメーション）だけ。
 *   人気の選手・監督の組み合わせ（実利用の統計が必要）は「計算しない」と明示する（将来はオプトインの契約で別に設計）。
 * - 正式な点数としての採用は本人の判断。総合点・順位・称号・共有カードには混ぜない。
 * - 同じ入力からは常に同じ結果（並び順にも依存しない）。
 */
export const SQUAD_UNIQUENESS_VERSION = "squad-uniqueness/2026-10-07.candidate.v1";

/**
 * フォーメーションの合成の事前分布（**SYNTHETIC**: 実際の利用の統計ではない。比較用の仮の値。合計 1）。
 * 「よく使われる」と一般に言われる形を大きく、それ以外を小さくした仮置き。採用する場合は根拠のある分布に置き換える。
 */
export const SYNTHETIC_FORMATION_PRIOR: Readonly<Record<string, number>> = {
  "4-3-3": 0.2,
  "4-2-3-1": 0.18,
  "4-4-2": 0.14,
  "4-2-1-3": 0.12,
  "3-4-3": 0.07,
  "4-1-2-3": 0.07,
  "3-5-2": 0.07,
  "4-2-2-2": 0.06,
  "3-4-2-1": 0.05,
  "5-3-2": 0.04,
};

export type UniquenessComponentId = "formation" | "playstyleDiversity" | "unconventionalPlacement" | "profileSpecialization" | "rarePlayerCombination" | "managerRarity";

export interface UniquenessComponent {
  id: UniquenessComponentId;
  /** 0〜100（大きいほど独自）。計算しない・データ不足は null。 */
  score: number | null;
  basis: "self" | "synthetic-prior" | "not-computed";
  /** 判定の根拠（表示用の短い事実。言語に依存しない値の組）。 */
  facts: Record<string, string | number>;
}

export interface SquadUniquenessResult {
  version: string;
  /** 計算できた要素の単純平均（候補）。2 要素未満なら null。 */
  candidateScore: number | null;
  components: UniquenessComponent[];
  mostUnique: UniquenessComponentId | null;
  mostCommon: UniquenessComponentId | null;
  limitations: string[];
}

export interface SquadUniquenessInput {
  formationId: string;
  perspective: PerspectiveInput;
}

const round = (n: number) => Math.round(n);
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function formationComponent(formationId: string): UniquenessComponent {
  const share = SYNTHETIC_FORMATION_PRIOR[formationId];
  const max = Math.max(...Object.values(SYNTHETIC_FORMATION_PRIOR));
  if (share === undefined) return { id: "formation", score: null, basis: "synthetic-prior", facts: { formationId, reason: "not in prior" } };
  return { id: "formation", score: clamp(round((1 - share / max) * 100)), basis: "synthetic-prior", facts: { formationId, syntheticShare: share } };
}

function playstyleDiversity(input: PerspectiveInput): UniquenessComponent {
  const styles = input.players.filter((p) => p.slot === "starter" && p.playingStyle && p.playingStyle !== "basic").map((p) => p.playingStyle as string);
  if (styles.length < 5) return { id: "playstyleDiversity", score: null, basis: "self", facts: { knownStyles: styles.length, reason: "fewer than 5 starters with a known playstyle" } };
  const distinct = new Set(styles).size;
  return { id: "playstyleDiversity", score: clamp(round(((distinct - 1) / Math.max(1, styles.length - 1)) * 100)), basis: "self", facts: { distinct, knownStyles: styles.length } };
}

function unconventionalPlacement(input: PerspectiveInput): UniquenessComponent {
  const starters = input.players.filter((p) => p.slot === "starter" && p.compatibility && p.compatibility !== "empty");
  if (starters.length < 5) return { id: "unconventionalPlacement", score: null, basis: "self", facts: { placed: starters.length, reason: "fewer than 5 placed starters" } };
  const off = starters.filter((p) => p.compatibility !== "exact").length;
  // 全員が本職でない極端な配置でも 100 で頭打ち（4 人以上の本職以外で 100）
  return { id: "unconventionalPlacement", score: clamp(round((off / 4) * 100)), basis: "self", facts: { offRegisteredPosition: off, placed: starters.length } };
}

function profileSpecialization(input: PerspectiveInput): UniquenessComponent {
  const starters = input.players.filter((p) => p.slot === "starter" && p.stats && p.role !== "GK");
  if (starters.length < 5) return { id: "profileSpecialization", score: null, basis: "self", facts: { withStats: starters.length, reason: "fewer than 5 outfield starters with stats" } };
  const cats = ABILITY_CATEGORIES.filter((c) => c.statKeys.every((k) => !k.startsWith("gk")));
  const means = cats
    .map((c) => {
      const vals = starters.flatMap((p) => c.statKeys.map((k) => p.stats![k]).filter((v): v is number => typeof v === "number"));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })
    .filter((v): v is number => v !== null);
  if (means.length < 3) return { id: "profileSpecialization", score: null, basis: "self", facts: { categories: means.length, reason: "fewer than 3 categories" } };
  const avg = means.reduce((a, b) => a + b, 0) / means.length;
  const sd = Math.sqrt(means.reduce((a, b) => a + (b - avg) ** 2, 0) / means.length);
  // 標準偏差 10 pt 以上で 100（極端に偏った能力の構成）
  return { id: "profileSpecialization", score: clamp(round((sd / 10) * 100)), basis: "self", facts: { categoryStdDev: Math.round(sd * 10) / 10, categories: means.length } };
}

const ORDER: UniquenessComponentId[] = ["formation", "playstyleDiversity", "unconventionalPlacement", "profileSpecialization", "rarePlayerCombination", "managerRarity"];

export function evaluateSquadUniqueness(input: SquadUniquenessInput): SquadUniquenessResult {
  const components: UniquenessComponent[] = [
    formationComponent(input.formationId),
    playstyleDiversity(input.perspective),
    unconventionalPlacement(input.perspective),
    profileSpecialization(input.perspective),
    { id: "rarePlayerCombination", score: null, basis: "not-computed", facts: { reason: "requires opt-in usage statistics (not collected)" } },
    { id: "managerRarity", score: null, basis: "not-computed", facts: { reason: "requires opt-in usage statistics (not collected)" } },
  ];
  const scored = components.filter((c) => c.score !== null) as (UniquenessComponent & { score: number })[];
  const candidateScore = scored.length >= 2 ? round(scored.reduce((a, c) => a + c.score, 0) / scored.length) : null;
  // 同点は ORDER の順（決定的）
  const byScore = [...scored].sort((a, b) => b.score - a.score || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const limitations = [
    "formation uses a synthetic prior, not real usage statistics",
    "player and manager popularity are not computed (no usage statistics)",
    ...components.filter((c) => c.score === null && c.basis !== "not-computed").map((c) => `${c.id}: ${c.facts.reason}`),
  ];
  return {
    version: SQUAD_UNIQUENESS_VERSION,
    candidateScore,
    components,
    // 比べる相手が無い（計算できた要素が 1 つ以下）ときは示さない
    mostUnique: byScore.length >= 2 ? byScore[0].id : null,
    mostCommon: byScore.length >= 2 ? byScore[byScore.length - 1].id : null,
    limitations,
  };
}
