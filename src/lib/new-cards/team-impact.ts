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

/** カード自身の強さ（最大 OVR、無ければ基本の OVR）。 */
export function ownStrength(c: ImpactCard): number | null {
  return num(c.ovrMax) ?? num(c.ovrBase);
}

/**
 * 同じ登録ポジションで所持している「最も強い」カード（2026-10-18・ページ間で判定をそろえる）。
 * 所持のカードどうしはそれぞれの強さ（最大 OVR、無ければ基本）で選び、新しいカードとの比べは `comparableOvr` の物差しで行う。
 */
export function bestOwnedAt(card: ImpactCard, owned: readonly ImpactCard[]): ImpactCard | null {
  let best: ImpactCard | null = null;
  let bestStrength = Number.NEGATIVE_INFINITY;
  for (const o of owned) {
    if (!card.registeredPosition || o.registeredPosition !== card.registeredPosition || o.worldCardId === card.worldCardId) continue;
    const st = ownStrength(o);
    if (st == null) continue;
    if (st > bestStrength || (st === bestStrength && best && o.worldCardId < best.worldCardId)) {
      best = o;
      bestStrength = st;
    }
  }
  return best;
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
    const best = bestOwnedAt(card, same);
    if (best == null) {
      const own = ownStrength(card);
      if (own == null) continue;
      if (same.length === 0) out.push({ card, position: card.registeredPosition, bestOwned: null, basis: num(card.ovrMax) != null ? "max" : "base", newOvr: own, ownedOvr: null, delta: null });
      continue;
    }
    const c = comparableOvr(card, best);
    if (c.a == null || c.b == null) continue;
    const basis = c.basis;
    const newOvr = c.a;
    const bestOvr = c.b;
    const delta = (newOvr as number) - (bestOvr as number);
    if (delta > 0) out.push({ card, position: card.registeredPosition, bestOwned: best, basis, newOvr: newOvr as number, ownedOvr: bestOvr, delta });
  }
  return out.sort((x, y) => (y.delta ?? -1) - (x.delta ?? -1) || y.newOvr - x.newOvr || x.card.worldCardId.localeCompare(y.card.worldCardId));
}
