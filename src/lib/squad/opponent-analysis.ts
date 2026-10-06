/**
 * 相手の分析（ローカルの入力だけ・2026-10-07・決定的・規則）。相手の情報は利用者が手で入れる（保存しない・送らない）。
 * 自然言語の AI は使わない。出力は ID と数値（表示の文は画面の辞書で作る）。
 */
export const OPPONENT_ANALYSIS_VERSION = "opponent-analysis/2026-10-07.v1";

export type Side = "left" | "center" | "right";
export type Line = "DF" | "MF" | "FW";

/** 利用者が入れる相手の主な選手（任意・最大 5 人）。値は 40〜99 の目安。 */
export interface OpponentKeyPlayer {
  line: Line;
  side: Side;
  pace: number | null;
  aerial: number | null;
  technique: number | null;
}

export interface OpponentInput {
  formationId: string;
  keyPlayers: OpponentKeyPlayer[];
  /** 相手の傾向（利用者の観察）。 */
  style: { possession: boolean; pressing: boolean; counter: boolean };
  /** 自分のスカッドの要約（診断のカテゴリの点）。 */
  mine: { pace: number | null; aerial: number | null; defense: number | null; pressResistance: number | null };
}

export type ThreatId = "pace_in_behind" | "aerial_threat" | "technical_midfield" | "pressing_threat" | "counter_risk";
export type AdjustmentId = "deeper_defensive_line" | "protect_weak_side" | "tall_center_backs" | "extra_holding_midfielder" | "quick_release_passing" | "keep_rest_defense";

export interface OpponentAnalysis {
  version: string;
  strongSide: Side | null;
  weakSide: Side | null;
  threats: { id: ThreatId; level: 1 | 2 | 3; basis: string }[];
  adjustments: AdjustmentId[];
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const level = (gap: number): 1 | 2 | 3 => (gap >= 15 ? 3 : gap >= 7 ? 2 : 1);

export function analyzeOpponent(input: OpponentInput): OpponentAnalysis {
  const kp = input.keyPlayers.slice(0, 5);
  const sideScore = (s: Side) => avg(kp.filter((p) => p.side === s).flatMap((p) => [p.pace, p.technique]));
  const sides = (["left", "center", "right"] as Side[]).map((s) => ({ s, v: sideScore(s) })).filter((x) => x.v !== null) as { s: Side; v: number }[];
  sides.sort((a, b) => b.v - a.v || a.s.localeCompare(b.s));
  const strongSide = sides.length ? sides[0].s : null;
  const weakSide = sides.length >= 2 ? sides[sides.length - 1].s : null;

  const threats: OpponentAnalysis["threats"] = [];
  const fwPace = avg(kp.filter((p) => p.line === "FW").map((p) => p.pace));
  if (fwPace !== null && input.mine.pace !== null && fwPace > input.mine.pace) threats.push({ id: "pace_in_behind", level: level(fwPace - input.mine.pace), basis: `opponentFwPace=${Math.round(fwPace)} > myPace=${input.mine.pace}` });
  const aerial = avg(kp.filter((p) => p.line === "FW").map((p) => p.aerial));
  if (aerial !== null && input.mine.aerial !== null && aerial > input.mine.aerial) threats.push({ id: "aerial_threat", level: level(aerial - input.mine.aerial), basis: `opponentFwAerial=${Math.round(aerial)} > myAerial=${input.mine.aerial}` });
  const mfTech = avg(kp.filter((p) => p.line === "MF").map((p) => p.technique));
  if (mfTech !== null && input.mine.defense !== null && mfTech > input.mine.defense) threats.push({ id: "technical_midfield", level: level(mfTech - input.mine.defense), basis: `opponentMfTechnique=${Math.round(mfTech)} > myDefense=${input.mine.defense}` });
  if (input.style.pressing && (input.mine.pressResistance === null || input.mine.pressResistance < 70)) threats.push({ id: "pressing_threat", level: input.mine.pressResistance === null ? 1 : level(70 - input.mine.pressResistance), basis: `pressing && myPressResistance=${input.mine.pressResistance ?? "unknown"}` });
  if (input.style.counter) threats.push({ id: "counter_risk", level: 2, basis: "counter observed" });
  threats.sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));

  const adj = new Set<AdjustmentId>();
  for (const t of threats) {
    if (t.id === "pace_in_behind") adj.add("deeper_defensive_line");
    if (t.id === "aerial_threat") adj.add("tall_center_backs");
    if (t.id === "technical_midfield") adj.add("extra_holding_midfielder");
    if (t.id === "pressing_threat") adj.add("quick_release_passing");
    if (t.id === "counter_risk") adj.add("keep_rest_defense");
  }
  if (strongSide && strongSide !== "center") adj.add("protect_weak_side");
  return { version: OPPONENT_ANALYSIS_VERSION, strongSide, weakSide, threats, adjustments: [...adj].sort() };
}
