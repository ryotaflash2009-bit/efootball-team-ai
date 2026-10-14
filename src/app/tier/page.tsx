import { cachedGetFacets, cachedGetSourceMeta, cachedListPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { WorldDataUnavailableError } from "@/lib/world/db";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { buildOwnTier, sortPositions, pagesNeeded, OWN_TIER_PAGE_SIZE } from "@/lib/tier/own-tier";
import { TierListView, TierListUnavailableView, type TierListEntryView } from "@/components/tier/TierListView";

export const metadata = pageMetadata({
  path: "/tier",
  title: "ポジション別 Tier（最大 OVR の上位） | TeamAIXI",
  description: "イーフト（eFootball™）の選手カードを、登録ポジションの中での最大 OVR の順位から S・A・B・C に分けた一覧です（自前のデータから計算・ゲーム内の強さの評価ではありません）。",
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const DEFAULT_POSITION = "CF";

export default async function TierPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let positions: string[];
  try {
    positions = sortPositions((await cachedGetFacets()).positions);
  } catch (err) {
    if (err instanceof WorldDataUnavailableError) return <TierListUnavailableView />;
    throw err;
  }
  const requested = typeof sp.position === "string" ? sp.position.toUpperCase() : DEFAULT_POSITION;
  const position = positions.includes(requested) ? requested : positions.includes(DEFAULT_POSITION) ? DEFAULT_POSITION : (positions[0] ?? DEFAULT_POSITION);

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
    if (err instanceof WorldDataUnavailableError) return <TierListUnavailableView />;
    throw err;
  }

  const tier = buildOwnTier(players, population);
  const entries: TierListEntryView[] = tier.ok
    ? tier.entries.map((e) => ({ worldCardId: e.card.worldCardId, nameJa: e.card.nameJa, nameEn: e.card.nameEn, cardType: e.card.cardType, ovrMax: e.card.ovrMax, tier: e.tier, rank: e.rank, topPercent: e.topPercent }))
    : [];
  return <TierListView positions={positions} position={position} population={population} entries={entries} unavailableReason={tier.ok ? null : tier.reason} syncFinishedAt={syncFinishedAt} />;
}
