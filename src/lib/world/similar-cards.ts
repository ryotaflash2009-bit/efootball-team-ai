import { personKeyOf } from "./person-identity";
import type { OtherCardSummary } from "./same-player-cards";

export interface SimilarCardSummary extends OtherCardSummary {
  playingStyle: string | null;
}

/** 似ているカードの OVR の幅（最大 OVR の ±）。 */
export const SIMILAR_OVR_RANGE = 3;
export const SIMILAR_LIMIT = 6;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * 似ているカードを探す一覧の API の条件（2026-10-25）。同じ登録ポジション・同じプレースタイル・最大 OVR が ±3。
 * ポジションか最大 OVR が無いカード（暫定のカード等）は探さない（null）。
 */
export function similarCardsQuery(card: { registeredPosition: string | null; playingStyle: string | null; ovrMax: number | null }): string | null {
  if (!card.registeredPosition || card.ovrMax == null) return null;
  const p = new URLSearchParams({
    position: card.registeredPosition,
    minOvr: String(card.ovrMax - SIMILAR_OVR_RANGE),
    maxOvr: String(card.ovrMax + SIMILAR_OVR_RANGE),
    sort: "ovr_max_desc",
    pageSize: "40",
  });
  if (card.playingStyle) p.set("playingStyle", card.playingStyle);
  return p.toString();
}

/**
 * 検索の結果から似ているカードを選ぶ。自分自身と同じ選手の別のカード（人物のキーが同じ）は除く（それは「同じ選手の別のカード」に出る）。
 * 並びは最大 OVR の差の小さい順 → 最大 OVR の高い順 → カード ID の順（決定的）。
 */
export function pickSimilarCards(worldCardId: string, ovrMax: number, results: readonly unknown[], limit = SIMILAR_LIMIT): SimilarCardSummary[] {
  const key = personKeyOf(worldCardId);
  const seen = new Set<string>([worldCardId]);
  const out: SimilarCardSummary[] = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = str(o.worldCardId);
    if (!id || seen.has(id) || (key && personKeyOf(id) === key)) continue;
    seen.add(id);
    out.push({ worldCardId: id, nameEn: str(o.nameEn), nameJa: str(o.nameJa), cardType: str(o.cardType), ovrMax: num(o.ovrMax), playingStyle: str(o.playingStyle) });
  }
  const diff = (c: SimilarCardSummary) => (c.ovrMax == null ? Number.POSITIVE_INFINITY : Math.abs(c.ovrMax - ovrMax));
  return out
    .sort((a, b) => diff(a) - diff(b) || (b.ovrMax ?? -1) - (a.ovrMax ?? -1) || a.worldCardId.localeCompare(b.worldCardId))
    .slice(0, limit);
}
