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
 * 能力値上限のレイヤー別確認状態。
 * - base: 99 / confirmed（保存済み基礎能力値 338,234件に99超過なし + 外部記述 "40-99"）
 * - progression / playerBooster / managerBooster / final: 99 は暫定値。
 *   「育成・ブースター・監督補正を含む最終値の上限が99」という証拠はまだ無い（unresolved）。
 *
 * 将来 100以上 が確認されたら、この表と rule-registry の値だけ変更すればよい
 * （calculate-final-stats.ts はこの表を参照するだけ）。
 */
export type CapConfidence = "confirmed" | "unresolved";
export interface StatCapRule {
  value: number;
  confidence: CapConfidence;
  note: string;
}
export const STAT_CAPS: {
  base: StatCapRule;
  progression: StatCapRule;
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
    confidence: "unresolved",
    note: "育成適用時の能力値上限は未確認。暫定で99を使用。",
  },
  playerBooster: {
    value: 99,
    confidence: "unresolved",
    note: "選手ブースター適用後の上限は未確認。暫定で99を使用。",
  },
  managerBooster: {
    value: 99,
    confidence: "unresolved",
    note: "監督補正適用後の上限は未確認。暫定で99を使用。",
  },
  final: {
    value: 99,
    confidence: "unresolved",
    note: "全レイヤー合成後の最終上限は未確認。暫定で99にクランプ（100以上が確認されたら STAT_CAPS.final のみ変更）。",
  },
};

/** 後方互換の別名（= 最終上限の暫定値 99） */
export const STAT_CAP = STAT_CAPS.final.value;

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
 * 段階コストのブロックサイズ。**provisional**。
 * 確認済みなのは pesmastery の実例（0-4段階は1pt、5段階目は2pt）だけ。
 * 「5段階ごとに +1」および 9段階/13段階以降は**外挿**であり confirmed ではない。
 */
export const COST_BLOCK_SIZE = 5;

/** 既定ルールセット ID（v2）。 */
export const DEFAULT_RULESET_ID = "staged-2026-08-28";
/** 旧ルールセット ID（v1） */
export const RULESET_ID_V1 = "provisional-linear";

/** ビルド保存のスキーマバージョン（localStorage 移行用）。 */
export const BUILD_SCHEMA_VERSION = 1;

/** localStorage のキー。 */
export const BUILD_STORAGE_KEY = "efootball-team-ai:progression-builds:v1";
