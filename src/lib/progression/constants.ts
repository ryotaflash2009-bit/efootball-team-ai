/**
 * 育成計算の定数。確認状態は docs/phase-progression-rules.md / rule-registry.ts 参照。
 */

/** 現行の規則バージョン（作成日 2026-08-28）。UI とビルド保存に埋め込む。 */
export const PROGRESSION_RULES_VERSION = "progression/2026-08-28.v2";

/** 過去に誤って未来日付で保存された可能性のあるバージョン名（読込互換のため受理して正規化する）。 */
export const PROGRESSION_RULES_VERSION_MISDATED = "progression/2026-08-29.v2";

/** 旧規則バージョン（v1・移行元） */
export const PROGRESSION_RULES_VERSION_V1 = "progression/2026-08-28.provisional-1";

/**
 * 能力値上限のレイヤー別確認状態（2026-10-09 に確定）。
 * - base: 99 / confirmed（保存済み基礎能力値 338,234件に99超過なし + 外部記述 "40-99"）
 * - progression: 99 / confirmed（基礎＋育成は 99 で止まる。eFHUB の applyProgression・KONAMI v3.00「通常の上限 99」）
 * - playerBooster / managerBooster / final: 上限なし（null）/ confirmed。
 *   KONAMI 公式 v3.00「Boosters … allow players to perform beyond the normal ceiling of 99」・eFHUB もブースターを止めない。
 *   計算は calculate-final-stats.ts（min(99, 基礎＋育成) ＋ ブースター・監督の補正）。
 */
export type CapConfidence = "confirmed" | "unresolved";
export interface StatCapRule {
  /** null = 上限なし */
  value: number | null;
  confidence: CapConfidence;
  note: string;
}
export const STAT_CAPS: {
  base: StatCapRule & { value: number };
  progression: StatCapRule & { value: number };
  playerBooster: StatCapRule;
  managerBooster: StatCapRule;
  final: StatCapRule;
} = {
  base: {
    value: 99,
    confidence: "confirmed",
    note: "保存済み基礎能力値 338,234件の実測（最大99・超過0）+ gamemarket.gg（40-99）。",
  },
  progression: {
    value: 99,
    confidence: "confirmed",
    note: "基礎＋育成は 99 で止まる（eFHUB の育成の計算・KONAMI 公式 v3.00 の「通常の上限 99」）。",
  },
  playerBooster: {
    value: null,
    confidence: "confirmed",
    note: "ブースターは 99 を超えられる（KONAMI 公式 v3.00「beyond the normal ceiling of 99」・eFHUB も止めない）。",
  },
  managerBooster: {
    value: null,
    confidence: "confirmed",
    note: "監督のブースター（+1）も育成の後に足し、99 で止めない（eFHUB と同じ・KONAMI のブースターの説明）。",
  },
  final: {
    value: null,
    confidence: "confirmed",
    note: "最終値 = min(99, 基礎＋育成) ＋ 選手のブースター ＋ 監督のブースター。上限なし（2026-10-09 確定）。",
  },
};

/** 育成の上限（= 基礎＋育成の上限 99）。育成で上げて意味のある範囲の計算に使う。 */
export const STAT_CAP = STAT_CAPS.progression.value;

/** 能力値の下限（表示・計算の安全側）。 */
export const STAT_FLOOR = 1;

/**
 * レベルアップ1につき付与される育成ポイント。
 * confirmed: screenshot（Lv上限34→66=33×2）+ pesmastery + gamingonphone の3ソース一致。
 */
export const POINTS_PER_LEVEL = 2;
/** 後方互換の別名 */
export const PROVISIONAL_POINTS_PER_LEVEL = POINTS_PER_LEVEL;

/**
 * 段階コストのブロックサイズ（**旧規則**・`costRuleId` の無い既存のビルドだけが使う）。
 * pesmastery の実例（0-4段階は1pt、5段階目は2pt）を「5段階ごとに +1」と解釈していたが、2026-10-08 の確認で
 * 正しくは 4 段階ごと（`COST_BLOCK_SIZE_V3`）と分かった。既存のビルドを黙って変えないため、値は残している。
 */
export const COST_BLOCK_SIZE = 5;

/**
 * 段階コストのブロックサイズ（現行・2026-10-08）: 1〜4 段階は 1pt、5〜8 段階は 2pt、9〜12 段階は 3pt … と **4 段階ごとに +1**。
 * 根拠: efootballlab の育成ポイントの計算機と解説（"levels 1–4 cost one point each, 5–8 cost two each, 9–12 cost three each,
 * and the pattern continues every four levels"）と、本人の確認（2026-10-08）。上の 5 段階ごとの規則は pesmastery の実例の解釈の誤り。
 * 既存の保存ビルド（`costRuleId` なし）は保存した時の規則（5 段階ごと）のまま計算し、黙って変えない。
 */
export const COST_BLOCK_SIZE_V3 = 4;

/** 既定ルールセット ID（v2・コストは 5 段階ごと。`costRuleId` の無い既存のビルドはこれで計算する）。 */
export const DEFAULT_RULESET_ID = "staged-2026-08-28";
/** 現行のコストの規則のルールセット ID（4 段階ごと・2026-10-08）。新しいビルドはこれを `costRuleId` に保存する。 */
export const RULESET_ID_COST_V3 = "staged-2026-10-08";
/** 旧ルールセット ID（v1） */
export const RULESET_ID_V1 = "provisional-linear";

/** ビルド保存のスキーマバージョン（localStorage 移行用）。 */
export const BUILD_SCHEMA_VERSION = 1;

/** localStorage のキー。 */
export const BUILD_STORAGE_KEY = "efootball-team-ai:progression-builds:v1";
