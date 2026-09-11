import { z } from "zod";
import { PLAYER_MODEL_KEYS, STAT_KEYS, type PlayerModelKey, type StatKey } from "./masters";

/**
 * eFHUB 個別選手ページから抽出した「1カード分」の構造化データ。
 * Phase A ではこの形で JSON 保存する（Phase C 以降に SQLite / PostgreSQL へ移す）。
 */

const statValue = z.number().finite().min(0).max(120);
const modelValue = z.number().finite();

const baseStatsShape = {} as Record<StatKey, typeof statValue>;
for (const k of STAT_KEYS) baseStatsShape[k] = statValue;

/** baseStats: 26キーちょうど。各値 0..120。 */
export const baseStatsSchema = z.object(baseStatsShape).strict();

const playerModelShape = {} as Record<PlayerModelKey, typeof modelValue>;
for (const k of PLAYER_MODEL_KEYS) playerModelShape[k] = modelValue;

/** playerModel: 16キーちょうど。float 可。 */
export const playerModelSchema = z.object(playerModelShape).strict();

export const additionalPositionSchema = z.object({
  position: z.string().min(1).max(8),
  /** 1 = 部分適性 / 2 = 高適性（推測） */
  familiarity: z.number().int().min(0).max(9),
});

export const parsedPlayerCardSchema = z.object({
  // --- 識別 ---
  efhubCardId: z.string().regex(/^[0-9]{1,20}$/),
  slug: z.string().min(1),
  nameEn: z.string(),
  nameJa: z.string(),
  nameZh: z.string(),

  // --- 分類 ---
  registeredPosition: z.string().min(1).max(8),
  playingStyleName: z.string(), // 攻撃プレースタイル英語名。数値コードは持たない。
  /**
   * 守備プレースタイル英語名（`player.playingStyleDefensive`）。
   * 一部カードのみ存在する任意項目。値がないカードは null / キー欠落どちらも許容。
   * 意味未確認のコード・値は名称変換しない。
   */
  playingStyleDefensive: z.string().min(1).nullable().optional(),
  /** RSC の player.playerType（数値コード・意味未確認・名称変換しない） */
  playerTypeCode: z.number().int(),

  // --- OVR ---
  /** player.overallRating（= レベル1 基礎 OVR と推測） */
  ovrBase: z.number().int().min(1).max(120),
  /** player-index.json の o（= 最大レベル OVR 候補）。パーサ単体では取得不可のため null。 */
  ovrMax: z.number().int().min(1).max(120).nullable(),

  // --- 基本情報 ---
  age: z.number().int().min(0).max(80),
  heightCm: z.number().int().min(100).max(230),
  weightKg: z.number().int().min(30).max(150),
  preferredFoot: z.string().min(1).max(10), // "Left" / "Right" 等

  // --- 状態値 ---
  weakFootUsage: z.number().int().min(0).max(9),
  weakFootAccuracy: z.number().int().min(0).max(9),
  form: z.number().int().min(0).max(9),
  condition: z.number().int().min(0).max(9),
  injuryResistance: z.number().int().min(0).max(9),

  // --- 育成（このカードの上限） ---
  levelCap: z.number().int().min(1).max(60),

  // --- ブースター（IDのみ。0 = 空スロット。名称・効果は別マスタ） ---
  boostId1: z.number().int().min(0),
  boostId2: z.number().int().min(0),

  // --- 参考 ---
  gpValue: z.number().finite(),
  countryId: z.number().int().min(0),
  leagueId: z.number().int().min(0),
  leagueName: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  imageUrl: z.string().url(),
  datapackId: z.number().int(),

  // --- 能力値・スキル・ポジション・体格 ---
  baseStats: baseStatsSchema,
  playerSkills: z.array(z.string().min(1)).min(1),
  comSkills: z.array(z.string().min(1)),
  additionalPositions: z.array(additionalPositionSchema),
  playerModel: playerModelSchema,

  // --- 来歴 ---
  parserVersion: z.string().min(1),
  source: z.literal("efhub"),
  sourceUrl: z.string().url(),
  fetchedAt: z.string().min(1),
});

export type ParsedPlayerCard = z.infer<typeof parsedPlayerCardSchema>;
export type BaseStats = z.infer<typeof baseStatsSchema>;
export type PlayerModel = z.infer<typeof playerModelSchema>;
