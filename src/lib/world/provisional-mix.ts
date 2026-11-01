import type { WorldListQuery, WorldPlayerListItem } from "./types";

/**
 * 暫定のカード（正式なデータの反映前・2026-10-15〜）を、トップと選手一覧にも混ぜて出すための純関数（2026-11-01）。
 * 正式なデータ（World）の取り込みが止まっている間（2026-10-20〜 HTTP 429）も、新しいカードがサイト全体に出るようにする。
 * 同じ ID は World を優先する（正式なデータが届いたら暫定は消える）。
 */

const ovrOf = (p: WorldPlayerListItem) => p.ovrMax ?? p.ovrBase ?? -1;
const timeOf = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(t) ? t : -Infinity;
};
/** World のカードは見た目の更新の時刻、暫定のカードは最初に見つけた時刻。 */
const recencyOf = (p: WorldPlayerListItem) => timeOf(p.provisional?.firstSeenAt ?? p.appearanceUpdatedAt);

function dedupe(world: readonly WorldPlayerListItem[], provisional: readonly WorldPlayerListItem[]): WorldPlayerListItem[] {
  const ids = new Set(world.map((p) => p.worldCardId));
  return [...world, ...provisional.filter((p) => !ids.has(p.worldCardId))];
}

/** 最大 OVR（無ければ基本の OVR）の高い順に混ぜる。同じ値は World を先・World ID の順。 */
export function mixByOvr(world: readonly WorldPlayerListItem[], provisional: readonly WorldPlayerListItem[], limit: number): WorldPlayerListItem[] {
  return dedupe(world, provisional)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => ovrOf(b.p) - ovrOf(a.p) || (a.p.provisional ? 1 : 0) - (b.p.provisional ? 1 : 0) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/** 新しい順に混ぜる（World は見た目の更新の時刻・暫定は最初に見つけた時刻）。同じ時刻は元の順。 */
export function mixByRecency(world: readonly WorldPlayerListItem[], provisional: readonly WorldPlayerListItem[], limit: number): WorldPlayerListItem[] {
  return dedupe(world, provisional)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => recencyOf(b.p) - recencyOf(a.p) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * 選手一覧の絞り込み（検索語以外）に合う暫定のカード。OVR の範囲は最大 OVR で見る（暫定は最大 OVR が無いことがあるため、
 * 下限は基本の OVR が下限以上なら合う＝最大はそれ以上・上限は最大 OVR が分からなければ合わないとする）。並びは一覧の並びに合わせる。
 */
export function filterProvisionalForList(rows: readonly WorldPlayerListItem[], q: Omit<WorldListQuery, "page" | "pageSize" | "query">): WorldPlayerListItem[] {
  const out = rows.filter((p) => {
    if (q.position && p.registeredPosition !== q.position) return false;
    if (q.cardType && p.cardType !== q.cardType) return false;
    if (q.playingStyle && p.playingStyle !== q.playingStyle) return false;
    if (q.playingStyleDefensive && p.playingStyleDefensive !== q.playingStyleDefensive) return false;
    if (q.nationality && p.nationality !== q.nationality) return false;
    if (q.league && p.league !== q.league) return false;
    if (q.team && p.team !== q.team) return false;
    if (q.minOvr != null && !((p.ovrMax ?? p.ovrBase ?? -1) >= q.minOvr)) return false;
    if (q.maxOvr != null && !(p.ovrMax != null && p.ovrMax <= q.maxOvr)) return false;
    if (q.hasBooster === true && !((p.boost1 ?? 0) !== 0 || (p.boost2 ?? 0) !== 0)) return false;
    if (q.hasBooster === false && ((p.boost1 ?? 0) !== 0 || (p.boost2 ?? 0) !== 0)) return false;
    return true;
  });
  const byId = (a: WorldPlayerListItem, b: WorldPlayerListItem) => a.worldCardId.localeCompare(b.worldCardId);
  switch (q.sort) {
    case "ovr_max_asc":
    case "ovr_base_asc":
      return out.sort((a, b) => (q.sort === "ovr_base_asc" ? (a.ovrBase ?? -1) - (b.ovrBase ?? -1) : ovrOf(a) - ovrOf(b)) || byId(a, b));
    case "ovr_base_desc":
      return out.sort((a, b) => (b.ovrBase ?? -1) - (a.ovrBase ?? -1) || byId(a, b));
    case "name":
      return out.sort((a, b) => (a.nameEn ?? "").localeCompare(b.nameEn ?? "") || byId(a, b));
    case "updated_desc":
    case "added_desc":
      return out.sort((a, b) => recencyOf(b) - recencyOf(a) || byId(a, b));
    case "ovr_max_desc":
    default:
      return out.sort((a, b) => ovrOf(b) - ovrOf(a) || byId(a, b));
  }
}
