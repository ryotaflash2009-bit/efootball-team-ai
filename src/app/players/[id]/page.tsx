import { notFound } from "next/navigation";
import { getPlayerById } from "@/lib/players";
import { LegacyPlayerDetailView } from "@/components/LegacyPlayerDetailView";

export const dynamic = "force-dynamic";

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
