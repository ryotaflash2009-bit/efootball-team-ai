/**
 * F-045 診断の追加観点（暫定 / 比較検証用）。
 *
 * 本人の判断（2026-10-02 A）: 観点は独立に評価し、総合点にまとめない。根拠・原因の選手/ポジション・改善したときの
 * 変化・規則の版を示す。重みと総合式は、ここで並べた計算式の候補を比べてから決める。
 *
 * - ここでの値は**公式の点数・順位・パーセンタイル・称号・公開統計に使わない**（`purpose: "comparison-only"`）。
 * - 1 つの観点に複数の計算式の候補（A: 事実だけ / B 以降: 暫定の点数化）を並べ、どれも採用済みとは扱わない。
 * - データが無いものは推測で埋めず、`missingData` に書いて値を null にする。
 * - 純関数（外部アクセス・保存なし）。
 */
import { normalizePlayingStyle } from "@/lib/world/playing-style";
import { X_LEFT_MAX, X_RIGHT_MIN } from "./role-inference";

export const PERSPECTIVES_RULES_VERSION = "squad-perspectives/2026-10-02.provisional.v1";

export type PerspectiveId =
  | "squadDepth"
  | "sideBalance"
  | "roleOverlap"
  | "managerFit"
  | "formationFit"
  | "gkCategory"
  | "aerialHeight"
  | "aerialFootPosition";

export type PerspectiveConfidence = "high" | "medium" | "low" | "insufficient";
export type LineRole = "GK" | "DF" | "MF" | "FW";

export interface PerspectivePlayer {
  key: string;
  name: string;
  slot: "starter" | "bench";
  /** 先発は配置ポジション、ベンチは登録ポジション。 */
  position: string | null;
  role: LineRole | null;
  /** 0(左)〜100(右)。ベンチ・不明は null。 */
  x: number | null;
  playingStyle: string | null;
  /** 適性の段階（先発のみ）。 */
  compatibility: "exact" | "related" | "unresolved" | "gkMismatch" | "empty" | null;
  heightCm: number | null;
  strongFoot: "left" | "right" | null;
  /** 最終能力値（キー → 値）。カード未解決は null。 */
  stats: Readonly<Record<string, number>> | null;
}

export interface PerspectiveInput {
  players: readonly PerspectivePlayer[];
  /** 監督の戦術適性（possessionGame 等 → 値）。監督なし・未解決は null。 */
  managerTactics: Readonly<Record<string, number | null>> | null;
}

export interface PerspectiveFormula {
  id: string;
  label: string;
  /** null = データ不足で計算しない。 */
  value: number | null;
  unit: string;
  /** "fact" は事実の集計、"provisional" は暫定の点数化（重み・閾値が恣意的）。 */
  kind: "fact" | "provisional";
  description: string;
}

export interface PerspectiveCause {
  key: string;
  name: string;
  position: string | null;
  detail: string;
}

export interface PerspectiveResult {
  id: PerspectiveId;
  label: string;
  status: "provisional";
  purpose: "comparison-only";
  facts: string[];
  formulas: PerspectiveFormula[];
  causes: PerspectiveCause[];
  missingData: string[];
  improvements: string[];
  confidence: PerspectiveConfidence;
  rulesVersion: string;
}

const ROLES: LineRole[] = ["GK", "DF", "MF", "FW"];
const GK_KEYS = ["gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach"];
const AERIAL_KEYS = ["heading", "jumping", "physicalContact"];
const ATTACK_KEYS = ["offensiveAwareness", "finishing", "heading", "setPieceTaking", "curl"];
const DEFENSE_KEYS = ["defensiveAwareness", "tackling", "aggression", "defensiveEngagement"];
/** 空中戦の比重が大きいとみなす配置（暫定）。 */
const AERIAL_FOCUS_POSITIONS = new Set(["CB", "CF"]);

/**
 * 監督の戦術と、関係が深いとみなすプレースタイル（暫定の対応表。公式の根拠はない）。
 * 比較検証用で、採用の判断は本人。
 */
export const PROVISIONAL_TACTIC_STYLES: Readonly<Record<string, readonly string[]>> = {
  possessionGame: ["orchestrator", "creativePlaymaker", "holePlayer", "classicNo10", "buildUp"],
  quickCounter: ["goalPoacher", "prolificWinger", "boxToBox", "foxInTheBox", "roamingFlank"],
  longBallCounter: ["targetMan", "goalPoacher", "prolificWinger", "deepLyingForward"],
  outWide: ["prolificWinger", "crossSpecialist", "attackingFullBack", "roamingFlank", "targetMan"],
  longBall: ["targetMan", "deepLyingForward", "boxToBox", "buildUp"],
  overload: ["holePlayer", "creativePlaymaker", "roamingFlank", "boxToBox", "extraFrontman"],
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** 指定キーの平均（キーが 1 つも無ければ null）。 */
export function statMean(stats: PerspectivePlayer["stats"], keys: readonly string[]): number | null {
  if (!stats) return null;
  return mean(keys.map((k) => stats[k]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)));
}

function confidenceFrom(resolved: number, total: number): PerspectiveConfidence {
  if (total === 0 || resolved === 0) return "insufficient";
  const r = resolved / total;
  return r >= 0.9 ? "high" : r >= 0.6 ? "medium" : "low";
}

function result(id: PerspectiveId, label: string, r: Omit<PerspectiveResult, "id" | "label" | "status" | "purpose" | "rulesVersion">): PerspectiveResult {
  return { id, label, status: "provisional", purpose: "comparison-only", rulesVersion: PERSPECTIVES_RULES_VERSION, ...r };
}

const cause = (p: PerspectivePlayer, detail: string): PerspectiveCause => ({ key: p.key, name: p.name, position: p.position, detail });

// ---------------------------------------------------------------------------
// 各観点
// ---------------------------------------------------------------------------

function squadDepth(starters: PerspectivePlayer[], bench: PerspectivePlayer[]): PerspectiveResult {
  const byRole = (list: PerspectivePlayer[], r: LineRole) => list.filter((p) => p.role === r);
  const covered = ROLES.filter((r) => byRole(bench, r).length > 0);
  const gaps: { role: LineRole; diff: number }[] = [];
  for (const r of ROLES) {
    const s = mean(byRole(starters, r).map((p) => statMean(p.stats, Object.keys(p.stats ?? {}))).filter((v): v is number => v !== null));
    const b = mean(byRole(bench, r).map((p) => statMean(p.stats, Object.keys(p.stats ?? {}))).filter((v): v is number => v !== null));
    if (s !== null && b !== null) gaps.push({ role: r, diff: b - s });
  }
  const missingRoles = ROLES.filter((r) => !covered.includes(r) && byRole(starters, r).length > 0);
  return result("squadDepth", "控えの厚み", {
    facts: [`ベンチ ${bench.length} 人`, ...ROLES.map((r) => `${r}: 先発 ${byRole(starters, r).length} 人・控え ${byRole(bench, r).length} 人`)],
    formulas: [
      { id: "A", label: "控えがいるライン数", value: covered.length, unit: "/4", kind: "fact", description: "GK・DF・MF・FW のうち控えが 1 人以上いるライン数" },
      { id: "B", label: "控えと先発の能力差の平均", value: gaps.length ? round1(mean(gaps.map((g) => g.diff)) as number) : null, unit: "pt", kind: "provisional", description: "ラインごとに（控えの全能力平均 − 先発の全能力平均）を出し、その平均。GK 能力も含むため値の意味は暫定" },
    ],
    causes: missingRoles.map((r) => ({ key: `role:${r}`, name: r, position: r, detail: "控えがいない" })),
    missingData: bench.some((p) => !p.stats) ? ["カードを解決できない控えがいる（能力差の計算から除外）"] : [],
    improvements: missingRoles.map((r) => `${r} の控えを 1 人加えると、A は ${covered.length + 1}/4 になる`),
    confidence: bench.length === 0 ? "insufficient" : confidenceFrom(bench.filter((p) => p.stats).length, bench.length),
  });
}

function sideBalance(starters: PerspectivePlayer[]): PerspectiveResult {
  const field = starters.filter((p) => p.role !== "GK" && p.role !== null);
  const placed = field.filter((p) => p.x !== null);
  const left = placed.filter((p) => (p.x as number) < X_LEFT_MAX);
  const right = placed.filter((p) => (p.x as number) > X_RIGHT_MIN);
  const sideScore = (list: PerspectivePlayer[]) => mean(list.map((p) => mean([statMean(p.stats, ATTACK_KEYS), statMean(p.stats, DEFENSE_KEYS)].filter((v): v is number => v !== null))).filter((v): v is number => v !== null));
  const l = sideScore(left);
  const r = sideScore(right);
  const fewer = left.length < right.length ? left : right.length < left.length ? right : null;
  const fewerName = fewer === left ? "左" : "右";
  return result("sideBalance", "左右バランス", {
    facts: [`左サイド ${left.length} 人・右サイド ${right.length} 人（中央 ${placed.length - left.length - right.length} 人）`],
    formulas: [
      { id: "A", label: "左右の人数の差", value: Math.abs(left.length - right.length), unit: "人", kind: "fact", description: "左右の外側のレーンにいるフィールドプレーヤーの人数の差（評価しない）" },
      { id: "B", label: "左右の攻守能力の差", value: l !== null && r !== null ? round1(Math.abs(l - r)) : null, unit: "pt", kind: "provisional", description: "サイドごとの（攻撃平均と守備平均の平均）の差。重みは暫定。差が大きい＝弱いとは限らない" },
    ],
    causes: fewer ? fewer.length === 0 ? [{ key: `side:${fewerName}`, name: `${fewerName}サイド`, position: null, detail: "外側のレーンに選手がいない" }] : fewer.map((p) => cause(p, `${fewerName}サイドの選手`)) : [],
    missingData: placed.length < field.length ? ["配置座標が無い選手がいる"] : [],
    improvements: fewer ? [`${fewerName}サイドに 1 人寄せると A は ${Math.max(0, Math.abs(left.length - right.length) - 1)} 人になる（戦術上の意図があれば変える必要はない）`] : [],
    confidence: confidenceFrom(placed.length, field.length),
  });
}

function roleOverlap(starters: PerspectivePlayer[], bench: PerspectivePlayer[]): PerspectiveResult {
  const count = (list: PerspectivePlayer[]) => {
    const m = new Map<string, PerspectivePlayer[]>();
    for (const p of list) if (p.playingStyle && p.playingStyle !== "basic") m.set(p.playingStyle, [...(m.get(p.playingStyle) ?? []), p]);
    return [...m.entries()].filter(([, ps]) => ps.length > 1);
  };
  const dupStarters = count(starters);
  const dupAll = count([...starters, ...bench]);
  return result("roleOverlap", "役割の重複（控えを含む）", {
    facts: dupAll.length ? dupAll.map(([s, ps]) => `${s}: ${ps.length} 人（先発 ${ps.filter((p) => p.slot === "starter").length}）`) : ["同じプレースタイルの選手は 2 人以上いない"],
    formulas: [
      { id: "A", label: "先発で重複するプレースタイル数", value: dupStarters.length, unit: "種類", kind: "fact", description: "先発 11 人で 2 人以上いるプレースタイルの種類数（basic を除く）" },
      { id: "B", label: "控えを含めた重複数", value: dupAll.length, unit: "種類", kind: "fact", description: "先発と控えを合わせた重複の種類数。重複が悪いとは言えない（控えは同じ役割の交代要員でもある）" },
    ],
    causes: dupStarters.flatMap(([s, ps]) => ps.map((p) => cause(p, `プレースタイル ${s} が重複`))),
    missingData: [...starters, ...bench].some((p) => !p.playingStyle) ? ["プレースタイルが不明な選手がいる"] : [],
    improvements: [],
    confidence: confidenceFrom([...starters, ...bench].filter((p) => p.playingStyle).length, starters.length + bench.length),
  });
}

function managerFit(starters: PerspectivePlayer[], tactics: PerspectiveInput["managerTactics"]): PerspectiveResult {
  const entries = Object.entries(tactics ?? {}).filter((e): e is [string, number] => typeof e[1] === "number");
  if (entries.length === 0) {
    return result("managerFit", "監督適合", {
      facts: ["監督が設定されていないか、戦術適性を読めない"],
      formulas: [
        { id: "A", label: "得意戦術と一致するプレースタイルの人数", value: null, unit: "人", kind: "provisional", description: "監督の最も高い戦術適性に対応するプレースタイルの先発人数（対応表は暫定）" },
        { id: "B", label: "公式の補正量で補正", value: null, unit: "", kind: "provisional", description: "公式の補正量は未確認のため計算しない" },
      ],
      causes: [],
      missingData: ["監督の戦術適性", "戦術ごとの公式の補正量（未確認）"],
      improvements: [],
      confidence: "insufficient",
    });
  }
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const styles = new Set(PROVISIONAL_TACTIC_STYLES[top[0]] ?? []);
  const match = starters.filter((p) => p.playingStyle && styles.has(p.playingStyle));
  const known = starters.filter((p) => p.playingStyle);
  return result("managerFit", "監督適合", {
    facts: [`監督の最も高い戦術適性: ${top[0]}（${top[1]}）`, `対応するとみなすプレースタイル（暫定）: ${[...styles].join(", ") || "なし"}`],
    formulas: [
      { id: "A", label: "得意戦術と一致するプレースタイルの人数", value: match.length, unit: "人", kind: "provisional", description: "暫定の対応表（PROVISIONAL_TACTIC_STYLES）による一致数。公式の根拠はない" },
      { id: "B", label: "公式の補正量で補正", value: null, unit: "", kind: "provisional", description: "公式の補正量は未確認のため計算しない" },
    ],
    causes: match.map((p) => cause(p, `${p.playingStyle} が ${top[0]} と一致（暫定）`)),
    missingData: ["戦術ごとの公式の補正量（未確認）", ...(known.length < starters.length ? ["プレースタイルが不明な先発がいる"] : [])],
    improvements: [],
    confidence: known.length === 0 ? "insufficient" : "low",
  });
}

function formationFit(starters: PerspectivePlayer[]): PerspectiveResult {
  const filled = starters.filter((p) => p.compatibility && p.compatibility !== "empty");
  const exact = filled.filter((p) => p.compatibility === "exact");
  const related = filled.filter((p) => p.compatibility === "related");
  const off = filled.filter((p) => p.compatibility === "unresolved" || p.compatibility === "gkMismatch");
  return result("formationFit", "フォーメーション適合", {
    facts: [`本職 ${exact.length} 人・近いポジション ${related.length} 人・適性外 ${off.length} 人（配置 ${filled.length}/${starters.length}）`],
    formulas: [
      { id: "A", label: "本職の人数", value: exact.length, unit: "人", kind: "fact", description: "登録ポジションと配置ポジションが一致する先発の人数" },
      { id: "B", label: "適性の段階の重み付き", value: filled.length ? round1(((exact.length + related.length * 0.5) / starters.length) * 100) : null, unit: "/100", kind: "provisional", description: "本職 1・近いポジション 0.5・適性外 0 の平均（重み 0.5 は暫定）" },
    ],
    causes: off.map((p) => cause(p, "配置ポジションへの適性が確認できない")),
    missingData: ["副ポジションの適性の段階（一部しか無い）"],
    improvements: off.length ? [`適性外の ${off.length} 人を本職の選手に替えると A は ${exact.length + off.length} 人になる`] : [],
    confidence: confidenceFrom(filled.length, starters.length),
  });
}

function gkCategory(starters: PerspectivePlayer[]): PerspectiveResult {
  const gk = starters.find((p) => p.role === "GK") ?? null;
  const avg = gk ? statMean(gk.stats, GK_KEYS) : null;
  const values = gk?.stats ? GK_KEYS.map((k) => [k, gk.stats?.[k]] as const).filter((e): e is readonly [string, number] => typeof e[1] === "number") : [];
  const weakest = values.length ? values.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
  return result("gkCategory", "GK", {
    facts: gk ? [`先発 GK: ${gk.name}`, ...values.map(([k, v]) => `${k}: ${v}`)] : ["先発 GK がいない"],
    formulas: [
      { id: "A", label: "GK 能力の平均", value: avg !== null ? round1(avg) : null, unit: "", kind: "fact", description: "GK 専用 5 能力の平均（フィールドの能力は含めない）" },
      { id: "B", label: "GK 能力の最小値", value: weakest ? weakest[1] : null, unit: "", kind: "provisional", description: "最も低い GK 能力（弱点の大きさとして使えるかは比較で判断）" },
    ],
    causes: gk && weakest ? [cause(gk, `最も低い GK 能力: ${weakest[0]}`)] : [],
    missingData: ["F-071 の GK 能力分布での位置（未接続）", ...(gk && !gk.stats ? ["GK のカードを解決できない"] : [])],
    improvements: [],
    confidence: !gk || !gk.stats ? "insufficient" : "high",
  });
}

/** 身長の段階による補正（暫定・公式の根拠なし）。 */
export function provisionalHeightBonus(heightCm: number | null): number | null {
  if (heightCm === null || !Number.isFinite(heightCm)) return null;
  return heightCm >= 190 ? 3 : heightCm >= 185 ? 2 : heightCm >= 180 ? 1 : heightCm < 175 ? -1 : 0;
}

function aerialHeight(starters: PerspectivePlayer[]): PerspectiveResult {
  const field = starters.filter((p) => p.role !== "GK" && p.stats);
  const base = mean(field.map((p) => statMean(p.stats, AERIAL_KEYS)).filter((v): v is number => v !== null));
  const withHeight = field.filter((p) => p.heightCm !== null);
  const corrected = withHeight.length === field.length && field.length > 0
    ? mean(field.map((p) => (statMean(p.stats, AERIAL_KEYS) ?? 0) + (provisionalHeightBonus(p.heightCm) ?? 0)))
    : null;
  const short = withHeight.filter((p) => AERIAL_FOCUS_POSITIONS.has(p.position ?? "") && (p.heightCm as number) < 180);
  return result("aerialHeight", "空中戦（身長の補正）", {
    facts: [`身長が分かる先発 ${withHeight.length}/${field.length} 人`],
    formulas: [
      { id: "A", label: "補正なし（現状）", value: base !== null ? round1(base) : null, unit: "", kind: "fact", description: "ヘディング・ジャンプ・フィジカルコンタクトの平均（既存の空中戦と同じ能力集合）" },
      { id: "B", label: "身長の段階で加点", value: corrected !== null ? round1(corrected) : null, unit: "", kind: "provisional", description: "190cm 以上 +3・185 以上 +2・180 以上 +1・175 未満 −1（公式の根拠なし）" },
    ],
    causes: short.map((p) => cause(p, `${p.position} で身長 ${p.heightCm}cm`)),
    missingData: ["身長が空中戦に与える公式の影響（根拠なし）", ...(withHeight.length < field.length ? ["身長が分からない選手がいる（B は計算しない）"] : [])],
    improvements: [],
    // 補正に公式の根拠が無いため、データが揃っていても low を上限にする。
    confidence: field.length === 0 ? "insufficient" : "low",
  });
}

function aerialFootPosition(starters: PerspectivePlayer[]): PerspectiveResult {
  const field = starters.filter((p) => p.role !== "GK" && p.stats);
  const weighted = field.length
    ? (() => {
        let sum = 0;
        let w = 0;
        for (const p of field) {
          const v = statMean(p.stats, AERIAL_KEYS);
          if (v === null) continue;
          const weight = AERIAL_FOCUS_POSITIONS.has(p.position ?? "") ? 1 : 0.5;
          sum += v * weight;
          w += weight;
        }
        return w ? sum / w : null;
      })()
    : null;
  const base = mean(field.map((p) => statMean(p.stats, AERIAL_KEYS)).filter((v): v is number => v !== null));
  const focus = field.filter((p) => AERIAL_FOCUS_POSITIONS.has(p.position ?? ""));
  const footKnown = field.filter((p) => p.strongFoot !== null).length;
  return result("aerialFootPosition", "空中戦（ポジション・利き足の補正）", {
    facts: [`空中戦の比重が大きいとみなす配置（CB・CF）: ${focus.length} 人`, `利き足が分かる先発 ${footKnown}/${field.length} 人`],
    formulas: [
      { id: "A", label: "補正なし（現状）", value: base !== null ? round1(base) : null, unit: "", kind: "fact", description: "先発フィールドプレーヤーの空中戦の能力の単純平均（空中戦（身長の補正）の A と同じ値）" },
      { id: "B", label: "ポジションの重み付き", value: weighted !== null ? round1(weighted) : null, unit: "", kind: "provisional", description: "CB・CF の重み 1、その他 0.5 の加重平均（重みは暫定）" },
      { id: "C", label: "利き足の補正", value: null, unit: "", kind: "provisional", description: "利き足と空中戦の関係に公式の根拠が無いため計算しない" },
    ],
    causes: focus.filter((p) => (statMean(p.stats, AERIAL_KEYS) ?? 100) < 70).map((p) => cause(p, "空中戦の比重が大きい配置で空中戦の能力が 70 未満")),
    missingData: ["利き足と空中戦の公式の関係（根拠なし）", ...(footKnown < field.length ? ["利き足が分からない選手がいる"] : [])],
    improvements: [],
    confidence: field.length === 0 ? "insufficient" : "low",
  });
}

/** 8 観点をすべて計算する（総合点は作らない）。 */
export function buildDiagnosisPerspectives(input: PerspectiveInput): PerspectiveResult[] {
  const starters = input.players.filter((p) => p.slot === "starter");
  const bench = input.players.filter((p) => p.slot === "bench");
  return [
    squadDepth(starters, bench),
    sideBalance(starters),
    roleOverlap(starters, bench),
    managerFit(starters, input.managerTactics),
    formationFit(starters),
    gkCategory(starters),
    aerialHeight(starters),
    aerialFootPosition(starters),
  ];
}

// ---------------------------------------------------------------------------
// 既存の診断入力からの変換（画面用）
// ---------------------------------------------------------------------------

/** 登録ポジションからラインを決める（ベンチ用。配置が無いため）。 */
export function lineRoleOfPosition(position: string | null): LineRole | null {
  if (!position) return null;
  if (position === "GK") return "GK";
  if (["CB", "LB", "RB"].includes(position)) return "DF";
  if (["DMF", "CMF", "LMF", "RMF", "AMF"].includes(position)) return "MF";
  if (["LWF", "RWF", "SS", "CF"].includes(position)) return "FW";
  return null;
}

interface DiagnosisPlayerLike {
  key: string;
  nameJa: string | null;
  nameEn: string | null;
  registeredPosition: string | null;
  assignedPosition: string | null;
  role: LineRole | null;
  compatibilityStatus: PerspectivePlayer["compatibility"];
  stats: readonly { key: string; finalValue: number }[] | null;
}

/**
 * スカッド診断の入力（SquadDiagnosisInput の先発・ベンチ）と配置（x・プレースタイル）から観点の入力を作る。
 * 身長・利き足はこの経路に無いため null（観点側で「足りないデータ」として表示する）。
 */
export function toPerspectiveInput(params: {
  starters: readonly DiagnosisPlayerLike[];
  bench: readonly DiagnosisPlayerLike[];
  placements: readonly { slotId: string; x: number; playingStyle: string | null; filled: boolean }[];
  managerTactics: PerspectiveInput["managerTactics"];
}): PerspectiveInput {
  const bySlot = new Map(params.placements.map((p) => [p.slotId, p]));
  const toStats = (s: DiagnosisPlayerLike["stats"]) => (s ? Object.fromEntries(s.map((x) => [x.key, x.finalValue])) : null);
  const players: PerspectivePlayer[] = [];
  for (const s of params.starters) {
    const pl = bySlot.get(s.key);
    if (!pl?.filled && !s.stats) continue;
    players.push({
      key: s.key, name: s.nameJa ?? s.nameEn ?? s.key, slot: "starter", position: s.assignedPosition, role: s.role,
      x: pl ? pl.x : null, playingStyle: normalizePlayingStyle(pl?.playingStyle, "offensive", "world").canonicalId, compatibility: s.compatibilityStatus, heightCm: null, strongFoot: null, stats: toStats(s.stats),
    });
  }
  for (const b of params.bench) {
    players.push({
      key: b.key, name: b.nameJa ?? b.nameEn ?? b.key, slot: "bench", position: b.registeredPosition, role: lineRoleOfPosition(b.registeredPosition),
      x: null, playingStyle: null, compatibility: null, heightCm: null, strongFoot: null, stats: toStats(b.stats),
    });
  }
  return { players, managerTactics: params.managerTactics };
}
