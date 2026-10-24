import { cachedGetFacets, cachedGetSourceMeta, cachedListPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { isRecentlyAdded } from "@/lib/new-cards/constants";
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";
import { buildOwnTier, sortPositions, pagesNeeded, OWN_TIER_PAGE_SIZE, POSITION_ORDER } from "@/lib/tier/own-tier";
import { TierListView, TierListUnavailableView, type TierListEntryView } from "@/components/tier/TierListView";

/** ポジション別 Tier の中身（/tier/[position] で使う・2026-10-24 に /tier から分けた）。position は検査済みの値。 */
/** ビルドの時（前のページが無い）は「読み込めない」の画面を作る。本番の作り直しの時は投げる＝前の正しいページを出し続ける。 */
function unavailableOrThrow(err: unknown) {
  if (err instanceof WorldDataUnavailableError) return <TierListUnavailableView />;
  if (err instanceof WorldQueryError && process.env.NEXT_PHASE === "phase-production-build") return <TierListUnavailableView />;
  throw err;
}

export async function TierContent({ position }: { position: string }) {
  let positions: string[];
  try {
    // ページがある 13 のポジションだけ（それ以外へのリンクは 404 になるため出さない）
    positions = sortPositions((await cachedGetFacets()).positions).filter((p) => POSITION_ORDER.includes(p));
  } catch (err) {
    return unavailableOrThrow(err);
  }

  const base = { page: 1, pageSize: OWN_TIER_PAGE_SIZE, query: "", position, cardType: null, playingStyle: null, playingStyleDefensive: null, nationality: null, league: null, team: null, minOvr: null, maxOvr: null, hasBooster: null, sort: "ovr_max_desc" } as const;
  let players: Awaited<ReturnType<typeof cachedListPlayers>>["players"];
  let population: number;
  let syncFinishedAt: string | null = null;
  try {
    const [first, meta] = await Promise.all([cachedListPlayers(base), cachedGetSourceMeta().catch(() => null)]);
    syncFinishedAt = meta?.syncFinishedAt ?? null;
    population = first.totalCount;
    // 上位 10%（C）まで要るページだけを追加で読む（最大 3 ページ・同じ並び）
    const extra = await Promise.all(Array.from({ length: pagesNeeded(population) - 1 }, (_, i) => cachedListPlayers({ ...base, page: i + 2 })));
    players = [first, ...extra].flatMap((r) => r.players);
  } catch (err) {
    return unavailableOrThrow(err);
  }

  const tier = buildOwnTier(players, population);
  const entries: TierListEntryView[] = tier.ok
    ? tier.entries.map((e) => ({ worldCardId: e.card.worldCardId, nameJa: e.card.nameJa, nameEn: e.card.nameEn, cardType: e.card.cardType, ovrMax: e.card.ovrMax, tier: e.tier, rank: e.rank, topPercent: e.topPercent, isNew: isRecentlyAdded(e.card.addedAt) }))
    : [];
  return <TierListView positions={positions} position={position} population={population} entries={entries} unavailableReason={tier.ok ? null : tier.reason} syncFinishedAt={syncFinishedAt} />;
}
