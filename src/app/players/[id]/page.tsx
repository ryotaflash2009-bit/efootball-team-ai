import { notFound } from "next/navigation";
import { getPlayerById } from "@/lib/players";
import { LegacyPlayerDetailView } from "@/components/LegacyPlayerDetailView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const dynamic = "force-dynamic";

/** 旧形式の選手の画面（正式は /players/world/[id]）。検索に出さない。 */
export const metadata = { robots: PRIVATE_PAGE_ROBOTS };

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { player, meta } = await getPlayerById(decodedId);

  if (!player) {
    notFound();
  }

  return <LegacyPlayerDetailView player={player} meta={meta} />;
}
