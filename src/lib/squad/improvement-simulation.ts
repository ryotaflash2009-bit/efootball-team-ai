import { diagnoseSquad, type SquadDiagnosisCategoryId, type SquadDiagnosisInput, type SquadDiagnosisPlayerInput, type SquadDiagnosisResult } from "./squad-diagnosis";
import { evaluateCompatibility, roleOfPosition } from "./position";
import { evaluateDiagnosisTitles, type DiagnosisTitleResult } from "@/lib/titles/diagnosis-titles";
import { FORMATIONS, getFormation } from "./formations";
import { inferFreshRole } from "./role-inference";
import { MAX_SUBSTITUTES } from "./types";

/**
 * 改善シミュレーション（2026-10-07・決定的・ルールベース・保存しない）。
 *
 * 診断の入力に仮の変更を当てて、同じ診断エンジン（`diagnoseSquad`）で変更の前後を比べる。生成 AI・主観は使わない。
 * - 対応する変更: 先発と控えの入れ替え（`swap`）・先発の配置ポジションの変更（`move`）・フォーメーションの変更（2026-10-09・下）。
 * - 対応しない変更（能力値の再計算が必要なため・別の版）: 監督の変更（監督の補正が能力値に含まれる）・育成の変更。
 * - 元の入力は書き換えない。同じ入力と変更からは常に同じ結果。
 */
export const IMPROVEMENT_SIMULATION_VERSION = "squad-improvement-simulation/2026-10-07.v1";

export type SquadChange =
  | { kind: "swap"; starterKey: string; benchKey: string }
  | { kind: "move"; starterKey: string; position: string };

export interface CategoryDelta {
  id: SquadDiagnosisCategoryId;
  before: number | null;
  after: number | null;
  /** 両方に値があるときだけ（after − before）。 */
  delta: number | null;
}

export interface SimulationResult {
  version: string;
  changes: readonly SquadChange[];
  /** 適用できなかった変更の理由（キーが無い・GK とフィールドの入れ替え等）。空なら全部適用。 */
  rejected: string[];
  before: SquadDiagnosisResult;
  after: SquadDiagnosisResult;
  overall: { before: number | null; after: number | null; delta: number | null };
  categories: CategoryDelta[];
  /** 弱点（finding の id）の増減。 */
  weaknessesAdded: string[];
  weaknessesRemoved: string[];
  titles: { before: DiagnosisTitleResult; after: DiagnosisTitleResult };
}

function asStarter(p: SquadDiagnosisPlayerInput, slot: SquadDiagnosisPlayerInput): SquadDiagnosisPlayerInput {
  const position = slot.assignedPosition;
  return {
    ...p,
    key: slot.key,
    role: slot.role,
    assignedPosition: position,
    compatibilityStatus: position ? evaluateCompatibility(p.registeredPosition, position).status : null,
  };
}

function asBench(p: SquadDiagnosisPlayerInput, benchSlot: SquadDiagnosisPlayerInput): SquadDiagnosisPlayerInput {
  return { ...p, key: benchSlot.key, role: null, assignedPosition: null, compatibilityStatus: null, isCaptain: false };
}

/** 変更を当てた新しい入力（元は書き換えない）と、適用できなかった理由。 */
export function applySquadChanges(input: SquadDiagnosisInput, changes: readonly SquadChange[]): { input: SquadDiagnosisInput; rejected: string[] } {
  let starters = [...input.starters];
  let bench = [...input.bench];
  const rejected: string[] = [];
  for (const c of changes) {
    const si = starters.findIndex((s) => s.key === c.starterKey);
    if (si < 0) {
      rejected.push(`${c.kind}: starter ${c.starterKey} not found`);
      continue;
    }
    if (c.kind === "swap") {
      const bi = bench.findIndex((b) => b.key === c.benchKey);
      if (bi < 0) {
        rejected.push(`swap: bench ${c.benchKey} not found`);
        continue;
      }
      const s = starters[si];
      const b = bench[bi];
      if (!b.cardResolved) {
        rejected.push(`swap: bench ${c.benchKey} has no resolved card`);
        continue;
      }
      starters = starters.map((x, i) => (i === si ? asStarter(b, s) : x));
      bench = bench.map((x, i) => (i === bi ? asBench(s, b) : x));
    } else {
      const s = starters[si];
      const role = roleOfPosition(c.position);
      if (!role) {
        rejected.push(`move: unknown position ${c.position}`);
        continue;
      }
      if ((role === "GK") !== (s.role === "GK")) {
        rejected.push(`move: ${c.starterKey} cannot move between GK and the field`);
        continue;
      }
      starters = starters.map((x, i) =>
        i === si ? { ...x, role, assignedPosition: c.position, compatibilityStatus: x.cardResolved ? evaluateCompatibility(x.registeredPosition, c.position).status : x.compatibilityStatus } : x,
      );
    }
  }
  return { input: { ...input, starters, bench }, rejected };
}

const titlesOf = (r: SquadDiagnosisResult) => evaluateDiagnosisTitles(Object.fromEntries(r.categories.map((c) => [c.id, { score: c.score, tier: c.tier }])));
const minus = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

/** 変更の前後を同じ診断エンジンで比べる。 */
export function simulateSquadChanges(input: SquadDiagnosisInput, changes: readonly SquadChange[], before: SquadDiagnosisResult = diagnoseSquad(input)): SimulationResult {
  const applied = applySquadChanges(input, changes);
  const after = diagnoseSquad(applied.input);
  const afterById = new Map(after.categories.map((c) => [c.id, c]));
  const beforeWeak = new Set(before.weaknesses.map((w) => w.id));
  const afterWeak = new Set(after.weaknesses.map((w) => w.id));
  return {
    version: IMPROVEMENT_SIMULATION_VERSION,
    changes,
    rejected: applied.rejected,
    before,
    after,
    overall: { before: before.overall.score, after: after.overall.score, delta: minus(after.overall.score, before.overall.score) },
    categories: before.categories.map((c) => {
      const a = afterById.get(c.id) ?? null;
      return { id: c.id, before: c.score, after: a?.score ?? null, delta: minus(a?.score ?? null, c.score) };
    }),
    weaknessesAdded: [...afterWeak].filter((id) => !beforeWeak.has(id)).sort(),
    weaknessesRemoved: [...beforeWeak].filter((id) => !afterWeak.has(id)).sort(),
    titles: { before: titlesOf(before), after: titlesOf(after) },
  };
}

export interface SwapCandidate {
  starterKey: string;
  benchKey: string;
  overallDelta: number;
  /** 改善したカテゴリ（大きい順）。 */
  improved: CategoryDelta[];
  /** 悪化したカテゴリ（大きい順）。 */
  worsened: CategoryDelta[];
  simulation: SimulationResult;
}

/**
 * 先発と控えの入れ替えを全部試し、総合の改善が大きい順に返す（改善 0 以下は返さない）。
 * 同点の並び: 総合の差（大きい順）→ 悪化したカテゴリの数（少ない順）→ 先発のキー → 控えのキー（文字列の昇順）。
 * GK とフィールドの入れ替え・カードの無い枠は試さない。
 */
export function rankBenchSwaps(input: SquadDiagnosisInput, limit = 3): SwapCandidate[] {
  const before = diagnoseSquad(input);
  if (before.overall.score === null) return [];
  const out: SwapCandidate[] = [];
  for (const s of input.starters) {
    if (!s.cardResolved || !s.role) continue;
    for (const b of input.bench) {
      if (!b.cardResolved) continue;
      const benchRole = roleOfPosition(b.registeredPosition);
      if ((s.role === "GK") !== (benchRole === "GK")) continue;
      const sim = simulateSquadChanges(input, [{ kind: "swap", starterKey: s.key, benchKey: b.key }], before);
      const d = sim.overall.delta;
      if (d === null || d <= 0) continue;
      const changed = sim.categories.filter((c) => c.delta !== null && c.delta !== 0 && c.id !== "squadCompleteness");
      out.push({
        starterKey: s.key,
        benchKey: b.key,
        overallDelta: d,
        improved: changed.filter((c) => c.delta! > 0).sort((x, y) => y.delta! - x.delta! || x.id.localeCompare(y.id)),
        worsened: changed.filter((c) => c.delta! < 0).sort((x, y) => x.delta! - y.delta! || x.id.localeCompare(y.id)),
        simulation: sim,
      });
    }
  }
  out.sort((x, y) => y.overallDelta - x.overallDelta || x.worsened.length - y.worsened.length || x.starterKey.localeCompare(y.starterKey) || x.benchKey.localeCompare(y.benchKey));
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// フォーメーションの変更（2026-10-09・v2）
// ---------------------------------------------------------------------------

/**
 * フォーメーションを変えたときの診断（保存しない）。アプリの実際の変更（`formation-change.ts` の `changeFormation`）と同じ規則で
 * 選手を新しい枠へ割り当てる: 同じポジション → 同じ役割（GK/DF/MF/FW）→ 残りの空き枠。あふれた選手は控えへ（控えが満員なら外れる）。
 * 新しい枠のポジションは既定の座標から推定する（変更の直後は配置の上書きが無いため。`inferFreshRole`）。
 * 能力値は配置に依存しない（育成・ブースター・監督の補正は選手ごと）ため、能力値を作り直す必要はない。
 * キャプテンは同じ枠 ID が新しいフォーメーションにあって選手がいるときだけ残る（アプリと同じ・選手が入れ替わっても枠のまま）。
 */
export interface FormationChangeSimulation {
  formationId: string;
  overall: { before: number | null; after: number | null; delta: number | null };
  categories: CategoryDelta[];
  movedToBench: string[];
  dropped: string[];
  after: SquadDiagnosisResult;
}

export function applyFormationChange(input: SquadDiagnosisInput, newFormationId: string): { input: SquadDiagnosisInput; movedToBench: string[]; dropped: string[] } {
  const target = getFormation(newFormationId);
  // アプリと同じ: 元のフォーメーションの既定のポジション（配置の上書きではない）で割り当てる。
  const sourcePos = new Map(getFormation(input.formationId).slots.map((s) => [s.slotId, s.position]));
  const remaining = input.starters.filter((s) => s.cardResolved);
  const captainKey = input.starters.find((s) => s.isCaptain && s.cardResolved)?.key ?? null;
  const slots = target.slots.map((fs) => ({ fs, position: inferFreshRole(fs.x, fs.y) as string, player: null as SquadDiagnosisPlayerInput | null }));
  const take = (match: (slotPos: string, playerPos: string | null) => boolean) => {
    for (const sl of slots) {
      if (sl.player) continue;
      const i = remaining.findIndex((p) => match(sl.fs.position, sourcePos.get(p.key) ?? null));
      if (i >= 0) sl.player = remaining.splice(i, 1)[0];
    }
  };
  take((sp, pp) => pp != null && sp === pp);
  take((sp, pp) => pp != null && roleOfPosition(sp) != null && roleOfPosition(sp) === roleOfPosition(pp));
  for (const sl of slots) if (!sl.player && remaining.length) sl.player = remaining.shift()!;

  const starters: SquadDiagnosisPlayerInput[] = slots.map(({ fs, position, player }) => {
    if (!player) {
      // 空きの枠は配置の推定をしない（アプリと同じ・既定のポジション）。
      return { key: fs.slotId, worldCardId: null, nameJa: null, nameEn: null, registeredPosition: null, role: fs.role, assignedPosition: fs.position, compatibilityStatus: null, isCaptain: false, cardResolved: false, stats: null, savedBuildId: null, savedBuildStatus: "none" as SquadDiagnosisPlayerInput["savedBuildStatus"] };
    }
    return {
      ...player,
      key: fs.slotId,
      role: roleOfPosition(position) ?? fs.role,
      assignedPosition: position,
      compatibilityStatus: evaluateCompatibility(player.registeredPosition, position).status,
      // アプリと同じ: 同じ枠 ID が残り、そこに選手がいればキャプテンの枠のまま（選手が入れ替わっても）。
      isCaptain: captainKey != null && captainKey === fs.slotId,
    };
  });
  const bench = [...input.bench];
  const movedToBench: string[] = [];
  const dropped: string[] = [];
  for (const p of remaining) {
    if (bench.length < MAX_SUBSTITUTES) {
      bench.push({ ...p, key: `sim-bench-${p.key}`, role: null, assignedPosition: null, compatibilityStatus: null, isCaptain: false });
      movedToBench.push(p.worldCardId ?? p.key);
    } else dropped.push(p.worldCardId ?? p.key);
  }
  return { input: { ...input, formationId: target.id, starters, bench }, movedToBench, dropped };
}

export function simulateFormationChange(input: SquadDiagnosisInput, newFormationId: string, before: SquadDiagnosisResult = diagnoseSquad(input)): FormationChangeSimulation {
  const applied = applyFormationChange(input, newFormationId);
  const after = diagnoseSquad(applied.input);
  const afterById = new Map(after.categories.map((c) => [c.id, c]));
  return {
    formationId: applied.input.formationId,
    overall: { before: before.overall.score, after: after.overall.score, delta: minus(after.overall.score, before.overall.score) },
    categories: before.categories.map((c) => {
      const a = afterById.get(c.id) ?? null;
      return { id: c.id, before: c.score, after: a?.score ?? null, delta: minus(a?.score ?? null, c.score) };
    }),
    movedToBench: applied.movedToBench,
    dropped: applied.dropped,
    after,
  };
}

/** 全てのフォーメーションを試し、総合の改善が大きい順に返す（改善 0 以下・今のフォーメーションは返さない）。同点はフォーメーション ID の昇順。 */
export function rankFormationChanges(input: SquadDiagnosisInput, limit = 3): FormationChangeSimulation[] {
  const before = diagnoseSquad(input);
  if (before.overall.score === null) return [];
  return FORMATIONS.filter((f) => f.id !== input.formationId)
    .map((f) => simulateFormationChange(input, f.id, before))
    .filter((s) => s.overall.delta !== null && s.overall.delta > 0 && s.dropped.length === 0)
    .sort((a, b) => b.overall.delta! - a.overall.delta! || a.formationId.localeCompare(b.formationId))
    .slice(0, limit);
}
