import { personKeyOf } from "@/lib/world/person-identity";
import { comparableOvr, type ImpactCard } from "./team-impact";

/**
 * パックの診断（F-092 の自前の版・2026-10-17）: 利用者が選んだ「パックのカード」を、その端末の My Team（所持）と比べる。
 *
 * - パックの中身は利用者が選ぶ（外部のパックのデータは取り込まない・権利の確認の対象にならない）。
 * - 比べる OVR は新しいカードとの比較と同じ物差し（`comparableOvr`）。同じ登録ポジションで所持している最高のカードと比べる。
 * - 確率・コインの効率・0〜100 の点数は出さない（排出率の公式のデータが無いため推測になる）。数えられる事実だけ。
 */
export type PackCardVerdict = "already_owned" | "upgrade" | "new_position" | "no_upgrade" | "unknown";

export interface PackCardResult {
  card: ImpactCard;
  verdict: PackCardVerdict;
  /** 同じポジションで所持している最高のカード（無ければ null）。 */
  bestOwned: ImpactCard | null;
  basis: "max" | "base";
  newOvr: number | null;
  ownedOvr: number | null;
  /** newOvr − ownedOvr（比べられないときは null）。 */
  delta: number | null;
  /** 同じ選手（別のカード）を所持している場合、そのカード（目印だけ。強ければ強化として数える・同じスカッドには 2 枚入れられない）。 */
  samePlayerOwned: ImpactCard | null;
}

export interface PackCheckSummary {
  total: number;
  upgrades: number;
  newPositions: number;
  /** 同じカードを所持（already_owned）。 */
  alreadyOwned: number;
  /** 同じ選手の別のカードを所持（目印）。 */
  samePlayer: number;
  /** 最も大きい OVR の差（強化が無ければ null）。 */
  bestDelta: number | null;
}

const VERDICT_ORDER: Record<PackCardVerdict, number> = { upgrade: 0, new_position: 1, no_upgrade: 2, already_owned: 3, unknown: 4 };

export function packCheck(pack: readonly ImpactCard[], owned: readonly ImpactCard[]): { results: PackCardResult[]; summary: PackCheckSummary } {
  const ownedIds = new Set(owned.map((c) => c.worldCardId));
  const ownedByPerson = new Map<string, ImpactCard>();
  for (const o of owned) {
    const k = personKeyOf(o.worldCardId);
    if (k && !ownedByPerson.has(k)) ownedByPerson.set(k, o);
  }
  const results: PackCardResult[] = [];
  const seen = new Set<string>();
  for (const card of pack) {
    if (seen.has(card.worldCardId)) continue;
    seen.add(card.worldCardId);
    const k = personKeyOf(card.worldCardId);
    const sp = k ? (ownedByPerson.get(k) ?? null) : null;
    const samePlayerOwned = sp && sp.worldCardId !== card.worldCardId ? sp : null;
    // 同じポジションで所持している最高（比べる物差しは 1 枚ごとに決まるため、差が最も小さい＝最も強いものを選ぶ）
    let bestOwned: ImpactCard | null = null;
    let cmp = comparableOvr(card, null);
    for (const o of owned) {
      if (!card.registeredPosition || o.registeredPosition !== card.registeredPosition || o.worldCardId === card.worldCardId) continue;
      const c = comparableOvr(card, o);
      if (c.b == null) continue;
      if (!bestOwned || cmp.b == null || (c.a ?? 0) - c.b < (cmp.a ?? 0) - cmp.b) {
        bestOwned = o;
        cmp = c;
      }
    }
    const newOvr = cmp.a;
    const ownedOvr = bestOwned ? cmp.b : null;
    const delta = newOvr != null && ownedOvr != null ? newOvr - ownedOvr : null;
    let verdict: PackCardVerdict;
    if (ownedIds.has(card.worldCardId)) verdict = "already_owned";
    else if (!card.registeredPosition || newOvr == null) verdict = "unknown";
    else if (!bestOwned) verdict = "new_position";
    else verdict = delta != null && delta > 0 ? "upgrade" : "no_upgrade";
    results.push({ card, verdict, bestOwned, basis: cmp.basis, newOvr, ownedOvr, delta, samePlayerOwned });
  }
  results.sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || (b.delta ?? -Infinity) - (a.delta ?? -Infinity) || (b.newOvr ?? 0) - (a.newOvr ?? 0));
  const upgrades = results.filter((r) => r.verdict === "upgrade");
  return {
    results,
    summary: {
      total: results.length,
      upgrades: upgrades.length,
      newPositions: results.filter((r) => r.verdict === "new_position").length,
      alreadyOwned: results.filter((r) => r.verdict === "already_owned").length,
      samePlayer: results.filter((r) => r.verdict !== "already_owned" && r.samePlayerOwned).length,
      bestDelta: upgrades.length ? Math.max(...upgrades.map((r) => r.delta as number)) : null,
    },
  };
}
