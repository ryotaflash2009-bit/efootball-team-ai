import { getCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { isFormationId } from "./formations";
import type { StoredSquad } from "./types";
import type { AdjustmentId } from "./opponent-analysis";

/**
 * 完全なゲームプラン（2026-10-07・ローカルだけ）。スカッドの保存の形（StoredSquad）は変えず、スカッドごとに別のキーへ保存する。
 * 先発・控え・フォーメーション・配置・キャプテン・セットプレー・監督・Link-Up はスカッドのまま。ここに足すのは:
 * - チームの指示（攻撃の型・守備のライン・プレスの強さ・メモ）
 * - 交代の計画（最大 6 件: 時間・下げる枠・入れる控え・理由）
 * - 代わりの計画（別のフォーメーションと、切り替える場面）
 * - 相手ごとの計画（最大 5 件: 相手の傾向・調整・メモ）
 * 文字列は表示だけに使う（制御文字・双方向の制御文字を取り除き、長さを制限する）。自由文の AI は使わない。
 */
export const GAME_PLAN_SCHEMA = "game-plan/2026-10-07.v1";
export const GAME_PLAN_EXPORT_SCHEMA = "game-plan-export/2026-10-07.v1";
export const MAX_SUBSTITUTIONS = 6;
export const MAX_OPPONENT_PLANS = 5;
export const NOTE_MAX = 200;
export const LABEL_MAX = 40;

export const ATTACKING_STYLES = ["possession", "quick_counter", "long_ball_counter", "out_wide", "long_ball"] as const;
export const DEFENSIVE_LINES = ["deep", "standard", "high"] as const;
export const PRESSING_LEVELS = ["low", "standard", "high"] as const;
export const SUB_REASONS = ["fatigue", "tactical", "protect_lead", "chase_goal", "injury_cover"] as const;
export const ALT_TRIGGERS = ["losing", "winning", "opponent_change"] as const;
export const ADJUSTMENT_IDS: readonly AdjustmentId[] = [
  "deeper_defensive_line",
  "protect_weak_side",
  "tall_center_backs",
  "extra_holding_midfielder",
  "quick_release_passing",
  "keep_rest_defense",
];

export type AttackingStyle = (typeof ATTACKING_STYLES)[number];
export type DefensiveLine = (typeof DEFENSIVE_LINES)[number];
export type PressingLevel = (typeof PRESSING_LEVELS)[number];
export type SubReason = (typeof SUB_REASONS)[number];
export type AltTrigger = (typeof ALT_TRIGGERS)[number];

export interface GamePlanSubstitution {
  /** 目安の時間（1〜120 分）。未定なら null。 */
  minute: number | null;
  outSlotId: string;
  /** 入れる控えの World のカード ID（スカッドの控えにいること）。 */
  inWorldCardId: string;
  reason: SubReason;
}

export interface GamePlanOpponent {
  label: string;
  style: { possession: boolean; pressing: boolean; counter: boolean };
  adjustments: AdjustmentId[];
  note: string;
}

export interface GamePlan {
  schema: typeof GAME_PLAN_SCHEMA;
  squadId: string;
  updatedAt: string;
  instructions: { attacking: AttackingStyle | null; defensiveLine: DefensiveLine | null; pressing: PressingLevel | null; note: string };
  substitutions: GamePlanSubstitution[];
  alternative: { formationId: string | null; trigger: AltTrigger | null; note: string };
  opponents: GamePlanOpponent[];
}

const SQUAD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SLOT_ID_RE = /^[a-z0-9_-]{1,16}$/;
const WORLD_CARD_ID_RE = /^\d{1,20}$/;

export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const kept = Array.from(v.normalize("NFC")).filter((ch) => {
    const c = ch.codePointAt(0)!;
    if (c === 0x0a) return true;
    return c >= 0x20 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x202a && c <= 0x202e) && !(c >= 0x2066 && c <= 0x2069);
  });
  return kept.slice(0, max).join("").trim();
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);

export function emptyGamePlan(squadId: string, now: string): GamePlan {
  return {
    schema: GAME_PLAN_SCHEMA,
    squadId,
    updatedAt: now,
    instructions: { attacking: null, defensiveLine: null, pressing: null, note: "" },
    substitutions: [],
    alternative: { formationId: null, trigger: null, note: "" },
    opponents: [],
  };
}

/** 外から来た値（localStorage・読み込んだファイル）を検証し、使える形へ整える。形が根本的に違えば null。 */
export function sanitizeGamePlan(raw: unknown, squadId?: string): GamePlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.schema !== GAME_PLAN_SCHEMA) return null;
  const id = squadId ?? r.squadId;
  if (typeof id !== "string" || !SQUAD_ID_RE.test(id)) return null;
  const updatedAt = typeof r.updatedAt === "string" && !Number.isNaN(Date.parse(r.updatedAt)) ? r.updatedAt : new Date(0).toISOString();
  const ins = (r.instructions && typeof r.instructions === "object" ? r.instructions : {}) as Record<string, unknown>;
  const alt = (r.alternative && typeof r.alternative === "object" ? r.alternative : {}) as Record<string, unknown>;
  const subs: GamePlanSubstitution[] = [];
  for (const s of Array.isArray(r.substitutions) ? r.substitutions : []) {
    if (subs.length >= MAX_SUBSTITUTIONS || !s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const minute = typeof o.minute === "number" && Number.isInteger(o.minute) && o.minute >= 1 && o.minute <= 120 ? o.minute : null;
    const reason = oneOf(SUB_REASONS, o.reason);
    if (typeof o.outSlotId !== "string" || !SLOT_ID_RE.test(o.outSlotId)) continue;
    if (typeof o.inWorldCardId !== "string" || !WORLD_CARD_ID_RE.test(o.inWorldCardId) || !reason) continue;
    subs.push({ minute, outSlotId: o.outSlotId, inWorldCardId: o.inWorldCardId, reason });
  }
  const opponents: GamePlanOpponent[] = [];
  for (const p of Array.isArray(r.opponents) ? r.opponents : []) {
    if (opponents.length >= MAX_OPPONENT_PLANS || !p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const st = (o.style && typeof o.style === "object" ? o.style : {}) as Record<string, unknown>;
    const adjustments = (Array.isArray(o.adjustments) ? o.adjustments : []).filter(
      (a, i, arr): a is AdjustmentId => typeof a === "string" && (ADJUSTMENT_IDS as readonly string[]).includes(a) && arr.indexOf(a) === i,
    );
    const label = cleanText(o.label, LABEL_MAX);
    if (!label) continue;
    opponents.push({
      label,
      style: { possession: st.possession === true, pressing: st.pressing === true, counter: st.counter === true },
      adjustments,
      note: cleanText(o.note, NOTE_MAX),
    });
  }
  const altFormation = typeof alt.formationId === "string" && isFormationId(alt.formationId) ? alt.formationId : null;
  return {
    schema: GAME_PLAN_SCHEMA,
    squadId: id,
    updatedAt,
    instructions: {
      attacking: oneOf(ATTACKING_STYLES, ins.attacking),
      defensiveLine: oneOf(DEFENSIVE_LINES, ins.defensiveLine),
      pressing: oneOf(PRESSING_LEVELS, ins.pressing),
      note: cleanText(ins.note, NOTE_MAX),
    },
    substitutions: subs,
    alternative: { formationId: altFormation, trigger: oneOf(ALT_TRIGGERS, alt.trigger), note: cleanText(alt.note, NOTE_MAX) },
    opponents,
  };
}

export type GamePlanIssueId =
  | "sub_out_slot_missing"
  | "sub_out_slot_empty"
  | "sub_in_not_on_bench"
  | "sub_in_used_twice"
  | "sub_out_used_twice"
  | "sub_minutes_not_ordered"
  | "alternative_same_formation"
  | "alternative_trigger_without_formation";

export interface GamePlanIssue {
  id: GamePlanIssueId;
  /** 対象の交代の位置（0 始まり）。交代以外は null。 */
  index: number | null;
}

/** スカッドの今の状態と照らし合わせて、ゲームプランの問題を返す（保存は止めない・画面で知らせる）。 */
export function validateGamePlan(plan: GamePlan, squad: StoredSquad): GamePlanIssue[] {
  const issues: GamePlanIssue[] = [];
  const slots = new Map(squad.slots.map((s) => [s.slotId, s]));
  const bench = new Set(squad.substitutes.map((s) => s.worldCardId).filter((x): x is string => !!x));
  const seenIn = new Set<string>();
  const seenOut = new Set<string>();
  let lastMinute = 0;
  plan.substitutions.forEach((s, i) => {
    const slot = slots.get(s.outSlotId);
    if (!slot) issues.push({ id: "sub_out_slot_missing", index: i });
    else if (!slot.worldCardId) issues.push({ id: "sub_out_slot_empty", index: i });
    if (!bench.has(s.inWorldCardId)) issues.push({ id: "sub_in_not_on_bench", index: i });
    if (seenIn.has(s.inWorldCardId)) issues.push({ id: "sub_in_used_twice", index: i });
    if (seenOut.has(s.outSlotId)) issues.push({ id: "sub_out_used_twice", index: i });
    seenIn.add(s.inWorldCardId);
    seenOut.add(s.outSlotId);
    if (s.minute != null) {
      if (s.minute < lastMinute) issues.push({ id: "sub_minutes_not_ordered", index: i });
      lastMinute = Math.max(lastMinute, s.minute);
    }
  });
  if (plan.alternative.formationId && plan.alternative.formationId === squad.formationId) issues.push({ id: "alternative_same_formation", index: null });
  if (!plan.alternative.formationId && plan.alternative.trigger) issues.push({ id: "alternative_trigger_without_formation", index: null });
  return issues;
}

/** 書き出し（JSON の文字列）。スカッドの ID・名前・選手の名前は含めない（交代はカードの ID と枠の ID だけ）。 */
export function exportGamePlan(plan: GamePlan, formationId: string): string {
  const { squadId: _squadId, ...rest } = plan;
  return `${JSON.stringify({ schema: GAME_PLAN_EXPORT_SCHEMA, formationId, plan: rest }, null, 2)}\n`;
}

export type GamePlanImportResult =
  | { ok: true; plan: GamePlan; formationMismatch: boolean }
  | { ok: false; reason: "too_large" | "invalid_json" | "invalid_schema" };

export const GAME_PLAN_IMPORT_MAX_BYTES = 32 * 1024;

/** 読み込み。サイズ・JSON・形を確かめ、読み込む先のスカッドの ID で作り直す（フォーメーションが違えば知らせる）。 */
export function importGamePlan(text: string, squad: Pick<StoredSquad, "squadId" | "formationId">, now: string): GamePlanImportResult {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > GAME_PLAN_IMPORT_MAX_BYTES) return { ok: false, reason: "too_large" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "invalid_schema" };
  const p = parsed as Record<string, unknown>;
  if (p.schema !== GAME_PLAN_EXPORT_SCHEMA || !p.plan || typeof p.plan !== "object") return { ok: false, reason: "invalid_schema" };
  const plan = sanitizeGamePlan({ ...(p.plan as Record<string, unknown>), schema: GAME_PLAN_SCHEMA, squadId: squad.squadId }, squad.squadId);
  if (!plan) return { ok: false, reason: "invalid_schema" };
  return { ok: true, plan: { ...plan, updatedAt: now }, formationMismatch: typeof p.formationId === "string" && p.formationId !== squad.formationId };
}

/** スカッドの複製に合わせてゲームプランを写す（新しいスカッドの ID・時刻）。 */
export function duplicateGamePlan(plan: GamePlan, newSquadId: string, now: string): GamePlan | null {
  if (!SQUAD_ID_RE.test(newSquadId)) return null;
  return { ...structuredClone(plan), squadId: newSquadId, updatedAt: now };
}

// ---------------------------------------------------------------------------
// 保存（端末の localStorage・アカウントごとのキー）
// ---------------------------------------------------------------------------

/** 今のスコープ（ゲスト・アカウント）のゲームプランのキー。スコープが未確定なら null。 */
export function activeGamePlanStorageKey(): string | null {
  const scope = getCurrentScope();
  return scope ? gamePlanStorageKey(scope) : null;
}

export function gamePlanStorageKey(scope: { kind: "guest" } | { kind: "account"; scopeId: string }): string {
  return scope.kind === "guest" ? "efootball-team-ai:local:guest:game-plans:v1" : `efootball-team-ai:local:account:${scope.scopeId}:game-plans:v1`;
}

interface Store {
  schema: "game-plans/2026-10-07.v1";
  plans: Record<string, unknown>;
}

function readStore(ls: Storage, key: string): Store {
  try {
    const raw = ls.getItem(key);
    if (!raw) return { schema: "game-plans/2026-10-07.v1", plans: {} };
    const d = JSON.parse(raw) as Store;
    if (d?.schema !== "game-plans/2026-10-07.v1" || !d.plans || typeof d.plans !== "object" || Array.isArray(d.plans)) return { schema: "game-plans/2026-10-07.v1", plans: {} };
    return d;
  } catch {
    return { schema: "game-plans/2026-10-07.v1", plans: {} };
  }
}

export function loadGamePlan(ls: Storage | null, key: string, squadId: string): GamePlan | null {
  if (!ls || !SQUAD_ID_RE.test(squadId)) return null;
  return sanitizeGamePlan(readStore(ls, key).plans[squadId], squadId);
}

export function saveGamePlan(ls: Storage | null, key: string, plan: GamePlan): boolean {
  if (!ls) return false;
  const clean = sanitizeGamePlan(plan, plan.squadId);
  if (!clean) return false;
  try {
    const store = readStore(ls, key);
    store.plans[clean.squadId] = clean;
    ls.setItem(key, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function deleteGamePlan(ls: Storage | null, key: string, squadId: string): boolean {
  if (!ls) return false;
  try {
    const store = readStore(ls, key);
    if (!(squadId in store.plans)) return true;
    delete store.plans[squadId];
    ls.setItem(key, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
