import { z } from "zod";

/**
 * eFHUB の player-index.json の1要素。
 * research.txt の推測: i=選手ID, e=英語名, j=日本語名, o=OVR
 * 想定外のキーが増えても壊れないよう passthrough する。
 */
export const rawPlayerEntrySchema = z
  .object({
    i: z.union([z.string(), z.number()]),
    e: z.string(),
    j: z.string(),
    o: z.union([z.number(), z.string()]),
  })
  .passthrough();

export type RawPlayerEntry = z.infer<typeof rawPlayerEntrySchema>;

/** 取得スクリプトが受け取るレスポンス全体（配列であること） */
export const rawPlayerIndexSchema = z.array(rawPlayerEntrySchema);

/** 正規化後の選手（保存形式） */
export const playerSummarySchema = z.object({
  id: z.string(),
  nameJa: z.string(),
  nameEn: z.string(),
  ovr: z.number(),
});

/** src/data/players.sample.json の形式 */
export const storedPlayersSchema = z.object({
  players: z.array(playerSummarySchema),
});

/** src/data/meta.json の形式 */
export const dataMetaSchema = z.object({
  source: z.string(),
  sourceUrl: z.string(),
  method: z.string(),
  fetchedAt: z.string(),
  totalReceived: z.number(),
  savedCount: z.number(),
  note: z.string().optional(),
});

/**
 * 生の1要素をアプリ内部型へ正規化する。
 * - id は文字列化（数値精度の劣化を防ぐ）
 * - o は数値化（文字列で来た場合に備える）
 */
export function normalizeRawEntry(entry: RawPlayerEntry): z.infer<typeof playerSummarySchema> {
  const ovrNum = typeof entry.o === "string" ? Number(entry.o) : entry.o;
  return {
    id: String(entry.i),
    nameJa: entry.j,
    nameEn: entry.e,
    ovr: Number.isFinite(ovrNum) ? ovrNum : 0,
  };
}
