import { personKeyOf } from "./person-identity";

export interface OtherCardSummary {
  worldCardId: string;
  nameEn: string | null;
  nameJa: string | null;
  cardType: string | null;
  ovrMax: number | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * 検索の結果から、同じ選手（人物のキーが同じ）の別のカードだけを選ぶ（2026-10-11）。自分自身・重複・人物のキーが無いものは除く。
 * 並びは最大の OVR の高い順 → カード ID の順（決定的）。
 */
export function otherCardsOfSamePlayer(worldCardId: string, results: readonly unknown[]): OtherCardSummary[] {
  const key = personKeyOf(worldCardId);
  if (!key) return [];
  const seen = new Set<string>([worldCardId]);
  const out: OtherCardSummary[] = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = str(o.worldCardId);
    if (!id || seen.has(id) || personKeyOf(id) !== key) continue;
    seen.add(id);
    out.push({ worldCardId: id, nameEn: str(o.nameEn), nameJa: str(o.nameJa), cardType: str(o.cardType), ovrMax: num(o.ovrMax) });
  }
  return out.sort((a, b) => (b.ovrMax ?? -1) - (a.ovrMax ?? -1) || a.worldCardId.localeCompare(b.worldCardId));
}
