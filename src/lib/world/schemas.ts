import { z } from "zod";
import type { WorldListQuery, WorldSortKey } from "./types";

/**
 * 入力検証。SQL へ文字列を連結しないための最初の関門。
 * ここを通った値だけを repository.ts のバインドパラメーターへ渡す。
 */

export const MAX_QUERY_LEN = 100;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 24;
export const ALLOWED_PAGE_SIZES = [24, 50, 100] as const;

export const WORLD_SORT_KEYS: readonly WorldSortKey[] = [
  "ovr_max_desc",
  "ovr_max_asc",
  "ovr_base_desc",
  "ovr_base_asc",
  "name",
  "updated_desc",
] as const;

/** World カード ID: 数字のみ 1〜20 桁（保存値は 14〜15 桁） */
export const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;

export const worldCardIdSchema = z
  .string()
  .trim()
  .regex(WORLD_CARD_ID_RE, "world_card_id は数字のみ");

/** 空白正規化（前後除去 + 連続空白を1つに + 全角スペースを半角に） */
export function normalizeQuery(raw: string): string {
  return raw.replace(/　/g, " ").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LEN);
}

/** フィルタ用の短い識別子（英字・数字・空白・ハイフン・アンド記号・ドットのみ、40 文字まで） */
const filterTokenSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9 .&\-]+$/)
  .nullable()
  .catch(null);

const ovrSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(120)
  .nullable()
  .catch(null);

/**
 * URLSearchParams / プレーンオブジェクトから WorldListQuery を作る。
 * どの値が不正でも例外にせず、安全な既定値へ丸める。
 */
export function parseWorldListQuery(input: {
  page?: string | null;
  pageSize?: string | null;
  query?: string | null;
  q?: string | null;
  sort?: string | null;
  position?: string | null;
  cardType?: string | null;
  playingStyle?: string | null;
  playingStyleDef?: string | null;
  minOvr?: string | null;
  maxOvr?: string | null;
  hasBooster?: string | null;
}): WorldListQuery {
  const pageRaw = Number(input.page);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

  const pageSizeRaw = Number(input.pageSize);
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(Math.trunc(pageSizeRaw), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const rawQuery = input.query ?? input.q ?? "";
  const query = normalizeQuery(typeof rawQuery === "string" ? rawQuery : "");

  const sort: WorldSortKey = (WORLD_SORT_KEYS as readonly string[]).includes(input.sort ?? "")
    ? (input.sort as WorldSortKey)
    : "ovr_max_desc";

  let minOvr = ovrSchema.parse(input.minOvr ?? null);
  let maxOvr = ovrSchema.parse(input.maxOvr ?? null);
  if (minOvr != null && maxOvr != null && minOvr > maxOvr) {
    [minOvr, maxOvr] = [maxOvr, minOvr];
  }

  const hasBooster =
    input.hasBooster === "1" || input.hasBooster === "true"
      ? true
      : input.hasBooster === "0" || input.hasBooster === "false"
        ? false
        : null;

  return {
    page,
    pageSize,
    query,
    sort,
    position: filterTokenSchema.parse(input.position ?? null),
    cardType: filterTokenSchema.parse(input.cardType ?? null),
    playingStyle: filterTokenSchema.parse(input.playingStyle ?? null),
    playingStyleDefensive: filterTokenSchema.parse(input.playingStyleDef ?? null),
    minOvr,
    maxOvr,
    hasBooster,
  };
}

// ---- レスポンス Zod（内部整合性チェック用。返す直前に parse する） ----

export const worldListItemSchema = z.object({
  worldCardId: z.string().regex(WORLD_CARD_ID_RE),
  nameEn: z.string().nullable(),
  nameJa: z.string().nullable(),
  cardType: z.string().nullable(),
  registeredPosition: z.string().nullable(),
  ovrBase: z.number().nullable(),
  ovrMax: z.number().nullable(),
  maximumLevel: z.number().nullable(),
  cardRating: z.string().nullable(),
  playingStyle: z.string().nullable(),
  playingStyleDefensive: z.string().nullable(),
  nationality: z.string().nullable(),
  region: z.string().nullable(),
  league: z.string().nullable(),
  team: z.string().nullable(),
  preferredFoot: z.string().nullable(),
  age: z.number().nullable(),
  height: z.number().nullable(),
  weight: z.number().nullable(),
  boost1: z.number().nullable(),
  boost2: z.number().nullable(),
  appearanceUpdatedAt: z.string().nullable(),
  imageUrlCandidate: z.string().nullable(),
  mobileImageUrlCandidate: z.string().nullable(),
  hasEfhubLink: z.boolean(),
  efhubCardId: z.string().regex(WORLD_CARD_ID_RE).nullable(),
});

export const worldStatValueSchema = z.object({
  key: z.string(),
  nameEn: z.string(),
  group: z.enum(["offense", "defense", "gk", "physical"]),
  value: z.number().nullable(),
});

export const worldPlayerDetailSchema = worldListItemSchema.extend({
  stats: z.array(worldStatValueSchema).length(26),
  playerSkills: z.array(z.string()),
  aiStyles: z.array(z.string()),
  appearance: z
    .object({
      position: z.string().nullable(),
      legCoverageRadius: z.number().nullable(),
      armCoverageRadius: z.number().nullable(),
      torsoCollision: z.number().nullable(),
      jumpingHeight: z.number().nullable(),
      dribbleHeight: z.number().nullable(),
      legLength: z.number().nullable(),
      updatedAt: z.string().nullable(),
    })
    .nullable(),
  source: z.string(),
  sourceUrl: z.string(),
  fetchedAt: z.string().nullable(),
  efhubConflicts: z.array(
    z.object({
      fieldName: z.string(),
      efhubValue: z.string().nullable(),
      worldValue: z.string().nullable(),
    }),
  ),
});
