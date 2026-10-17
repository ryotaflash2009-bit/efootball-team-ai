/**
 * 新しいカードとあなたの My Team の比較（2026-10-17）。同じ登録ポジションで所持しているカードの最高の OVR と比べ、上回る新しいカードを出す。
 *
 * - 比べる OVR: 両方に最大 OVR（レベル最大）があれば最大 OVR、どちらかに無ければ基本の OVR どうし（暫定のカードは最大 OVR を持たない）。
 * - 所持として数えるのは ownershipStatus が owned のカードだけ（欲しい・放出済み・不明は数えない）。
 * - 新しいカードを既に持っていれば出さない。
 * - ブラウザーの中だけで計算する（My Team は端末の保存・サーバーへ送らない）。
 */
export interface ImpactCard {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  registeredPosition: string | null;
  ovrBase: number | null;
  ovrMax: number | null;
}

export interface TeamImpact {
  card: ImpactCard;
  position: string;
  /** 同じポジションで所持している最高のカード（無ければ null = そのポジションを持っていない）。 */
  bestOwned: ImpactCard | null;
  basis: "max" | "base";
  newOvr: number;
  ownedOvr: number | null;
  /** newOvr − ownedOvr（持っていないポジションは null）。 */
  delta: number | null;
}

const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 2 枚を同じ物差しで比べる OVR（最大 OVR が両方にあれば最大、無ければ基本）。 */
export function comparableOvr(a: ImpactCard, b: ImpactCard | null): { basis: "max" | "base"; a: number | null; b: number | null } {
  if (b && num(a.ovrMax) != null && num(b.ovrMax) != null) return { basis: "max", a: a.ovrMax, b: b.ovrMax };
  return { basis: "base", a: num(a.ovrBase), b: b ? num(b.ovrBase) : null };
}

/**
 * @param newCards 新しいカード（最近追加された正式なカード・暫定のカード）
 * @param owned 所持しているカード（ownershipStatus = owned）
 * @returns 所持の最高を上回るもの（delta > 0）と、持っていないポジションのもの（delta = null）。delta の大きい順・同じなら新しいカードの OVR の順。
 */
export function newCardTeamImpact(newCards: readonly ImpactCard[], owned: readonly ImpactCard[]): TeamImpact[] {
  const ownedIds = new Set(owned.map((c) => c.worldCardId));
  const byPos = new Map<string, ImpactCard[]>();
  for (const c of owned) {
    if (!c.registeredPosition) continue;
    const list = byPos.get(c.registeredPosition) ?? [];
    list.push(c);
    byPos.set(c.registeredPosition, list);
  }
  const out: TeamImpact[] = [];
  for (const card of newCards) {
    if (!card.registeredPosition || ownedIds.has(card.worldCardId)) continue;
    const same = byPos.get(card.registeredPosition) ?? [];
    let best: ImpactCard | null = null;
    let bestOvr: number | null = null;
    let basis: "max" | "base" = "base";
    let newOvr: number | null = null;
    for (const o of same) {
      const c = comparableOvr(card, o);
      if (c.b == null || c.a == null) continue;
      if (bestOvr == null || c.b > bestOvr) {
        best = o;
        bestOvr = c.b;
        basis = c.basis;
        newOvr = c.a;
      }
    }
    if (best == null) {
      const own = num(card.ovrMax) ?? num(card.ovrBase);
      if (own == null) continue;
      if (same.length === 0) out.push({ card, position: card.registeredPosition, bestOwned: null, basis: num(card.ovrMax) != null ? "max" : "base", newOvr: own, ownedOvr: null, delta: null });
      continue;
    }
    const delta = (newOvr as number) - (bestOvr as number);
    if (delta > 0) out.push({ card, position: card.registeredPosition, bestOwned: best, basis, newOvr: newOvr as number, ownedOvr: bestOvr, delta });
  }
  return out.sort((x, y) => (y.delta ?? -1) - (x.delta ?? -1) || y.newOvr - x.newOvr || x.card.worldCardId.localeCompare(y.card.worldCardId));
}
