/**
 * Power of Many 方式ブースター（金色）の**手動段階指定**の共通ルール。純関数のみ。
 *
 * KONAMI 公式「The Power of Many」= Game Plan に登録した対象リーグの選手数で効果量が変わる発動方式。
 * **複数の効果名に付く**（Total Package = 対象は全26能力、Ball Protection = 対象はそのブースターの4能力 …）。
 * 段階（UI 上）: 未指定 / 1〜13人相当 / 14〜19人相当 / 20人以上相当 → その効果名の対象能力へ +0/+1/+2/+3。
 *
 * アプリはこの人数を自動判定できない（カードごとの対象リーグの公式対応表がない・
 * Game Plan の正確な集計範囲が未確認・現状のスカッドは Game Plan と一致しない）。
 * そのため **ユーザーが自分の Game Plan を見て段階を手動指定する**。自動評価には使わない。
 *
 * ここで扱うのは:
 *  - 段階の列挙値（`ConditionalBoosterSelection`）とレベル（0..3）の対応
 *  - 保存値・URL 値の検証（不正は "none"）
 *  - 段階 → その効果名の対象能力への delta（`def.affectedStats × level`）
 *  - 表示用の説明文
 *  - `levelForRegisteredPlayers`（将来の Game Plan 自動対応用の純関数・現状は UI から呼ばない）
 *
 * 「このカードのこのスロットが Power of Many か」は解決層（`resolveAttachedBooster().activation`）が決める。
 */

import { getBoosterDef, type BoosterDef } from "./booster-catalog";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";

/** 条件手動指定機能の規則バージョン（育成規則・ブースター効果規則とは別軸）。 */
export const CONDITIONAL_BOOSTER_RULES_VERSION = "conditional-booster/2026-08-28.v2";

/** 段階の列挙値。保存・URL でもこの文字列を使う。 */
export type ConditionalBoosterSelection =
  | "none"
  | "league_1_13"
  | "league_14_19"
  | "league_20_plus";

export const CONDITIONAL_BOOSTER_SELECTIONS: readonly ConditionalBoosterSelection[] = [
  "none",
  "league_1_13",
  "league_14_19",
  "league_20_plus",
];

export interface ConditionalBoosterTier {
  selection: ConditionalBoosterSelection;
  /** 全対象能力へ加算する値（0..3）。 */
  level: number;
  /** 対象リーグ人数の下限（none は 0）。 */
  minPlayers: number;
  /** 対象リーグ人数の上限（20 人以上は null）。 */
  maxPlayers: number | null;
  /** 「14〜19人」等の人数レンジ表記。 */
  playerRangeLabel: string;
  /** 「対象リーグ14〜19人相当、全26能力+2」等の要約。 */
  label: string;
}

/** Total Package の段階表（KONAMI 公式「The Power of Many」の閾値）。 */
export const TOTAL_PACKAGE_TIERS: readonly ConditionalBoosterTier[] = [
  {
    selection: "none",
    level: 0,
    minPlayers: 0,
    maxPlayers: 0,
    playerRangeLabel: "未指定",
    label: "適用なし（+0）",
  },
  {
    selection: "league_1_13",
    level: 1,
    minPlayers: 1,
    maxPlayers: 13,
    playerRangeLabel: "対象リーグ 1〜13 人",
    label: "対象リーグ 1〜13 人相当、対象能力 +1",
  },
  {
    selection: "league_14_19",
    level: 2,
    minPlayers: 14,
    maxPlayers: 19,
    playerRangeLabel: "対象リーグ 14〜19 人",
    label: "対象リーグ 14〜19 人相当、対象能力 +2",
  },
  {
    selection: "league_20_plus",
    level: 3,
    minPlayers: 20,
    maxPlayers: null,
    playerRangeLabel: "対象リーグ 20 人以上",
    label: "対象リーグ 20 人以上相当、対象能力 +3",
  },
];

/** `TOTAL_PACKAGE_TIERS` の一般名（Power of Many 方式の段階表）。 */
export const POWER_OF_MANY_TIERS = TOTAL_PACKAGE_TIERS;

const TIER_BY_SELECTION = new Map(TOTAL_PACKAGE_TIERS.map((t) => [t.selection, t]));
const SELECTION_SET = new Set<string>(CONDITIONAL_BOOSTER_SELECTIONS);

/**
 * @deprecated key だけでは「このカードのこのスロットが Power of Many か」は判定できない
 * （同じ効果名でも fixed 版と power_of_many 版がある）。解決層の `resolveAttachedBooster().activation` を使うこと。
 * カタログ上 `conditional: true`（＝ total-package）の key だけを返す。保存キーの妥当性チェックには使わない。
 */
export function isManualConditionalBooster(key: string | null | undefined): boolean {
  const def = getBoosterDef(key);
  return !!def && def.conditional === true && def.conditionEvaluable === false;
}

/** key が有効なカタログブースターか（段階指定の保存キーの妥当性チェック用・per-card 判定はしない）。 */
export function isKnownBoosterKey(key: unknown): key is string {
  return typeof key === "string" && /^[a-z0-9-]{1,48}$/.test(key) && getBoosterDef(key) != null;
}

/**
 * 任意の値を安全な段階へ正規化する。文字列でも数値でもない・列挙外・不正なら "none"。
 * 数値 0..3 も受け付ける（level 経由の保存・古いデータ対策）。
 */
export function parseTotalPackageSelection(value: unknown): ConditionalBoosterSelection {
  if (typeof value === "string") {
    return SELECTION_SET.has(value) ? (value as ConditionalBoosterSelection) : "none";
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    const hit = TOTAL_PACKAGE_TIERS.find((t) => t.level === value);
    return hit ? hit.selection : "none";
  }
  return "none";
}

/** 段階 → レベル（0..3）。不正は 0。 */
export function levelForConditionalSelection(selection: unknown): 0 | 1 | 2 | 3 {
  const s = parseTotalPackageSelection(selection);
  return (TIER_BY_SELECTION.get(s)?.level ?? 0) as 0 | 1 | 2 | 3;
}

/**
 * **将来の Game Plan 自動対応用**の純関数。対象リーグの登録人数 → レベル（0..3）。
 * 現状は UI から呼ばない（自動評価に使わない）。不正な入力（負数・小数・NaN・Infinity・文字列）は 0。
 */
export function levelForRegisteredPlayers(count: unknown): 0 | 1 | 2 | 3 {
  if (typeof count !== "number" || !Number.isFinite(count) || !Number.isInteger(count) || count < 0) {
    return 0;
  }
  if (count === 0) return 0;
  if (count <= 13) return 1;
  if (count <= 19) return 2;
  return 3;
}

/** 段階 → その段階と対応する tier（不正は "none" の tier）。 */
export function tierForSelection(selection: unknown): ConditionalBoosterTier {
  return TIER_BY_SELECTION.get(parseTotalPackageSelection(selection)) ?? TOTAL_PACKAGE_TIERS[0];
}

export interface ConditionalBoosterSelectionInput {
  boosterKey: string;
  selection: ConditionalBoosterSelection;
}

/**
 * 保存・URL・入力から来た段階指定の配列を検証・正規化する。
 * - boosterKey が有効なカタログキーでないものは捨てる（per-card の Power of Many 判定は解決層が行う）
 * - selection は列挙値以外なら "none"
 * - 同じ boosterKey は最後のものを採用
 * - "none" は保持しない（＝未指定と同義）
 */
export function validateConditionalBoosterSelection(
  raw: unknown,
): ConditionalBoosterSelectionInput[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, ConditionalBoosterSelection>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const key = (item as { boosterKey?: unknown }).boosterKey;
    if (!isKnownBoosterKey(key)) continue;
    const selection = parseTotalPackageSelection((item as { selection?: unknown }).selection);
    byKey.set(key, selection);
  }
  return [...byKey.entries()]
    .filter(([, sel]) => sel !== "none")
    .map(([boosterKey, selection]) => ({ boosterKey, selection }));
}

/**
 * 段階 → その効果名の対象能力ごとの delta（`def.affectedStats × level`・World 26 キーのみ）。
 * "none" / 不正 / 無効な def なら `{}`。
 * 「このスロットが Power of Many か」の判定は呼び出し側（解決層の `activation`）で行う。
 */
export function calculateConditionalBoosterDeltas(
  boosterKeyOrDef: string | BoosterDef | null | undefined,
  selection: unknown,
): Record<string, number> {
  const def =
    typeof boosterKeyOrDef === "string" || boosterKeyOrDef == null
      ? getBoosterDef(boosterKeyOrDef ?? undefined)
      : boosterKeyOrDef;
  if (!def) return {};
  const level = levelForConditionalSelection(selection);
  if (level === 0) return {};
  const validKeys = new Set<string>(WORLD_STAT_KEYS);
  const out: Record<string, number> = {};
  for (const k of def.affectedStats) {
    if (validKeys.has(k)) out[k] = level;
  }
  return out;
}

/** 表示用の説明文（選択後）。"none" は空文字。 */
export function describeConditionalSelection(selection: unknown): string {
  const tier = tierForSelection(selection);
  if (tier.selection === "none") return "";
  return `ユーザー指定条件: ${tier.label}`;
}

/** 手動指定であることを必ず添える補足文（自動判定と誤認させない）。 */
export const CONDITIONAL_SELECTION_DISCLAIMER =
  "この値はユーザーが自身の Game Plan を確認して指定したものです。アプリが編成人数を自動検証した値ではありません。";

/** 未選択時の説明文。 */
export const CONDITIONAL_UNSELECTED_NOTE =
  "Game Plan 依存の可変ブースター（金色）です。現在のアプリでは対象リーグ人数を自動判定できないため、能力値へ未適用です。";
