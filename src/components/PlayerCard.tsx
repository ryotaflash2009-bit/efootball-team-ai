import Link from "next/link";
import type { PlayerSummary } from "@/lib/types";
import { PlayerImage } from "./PlayerImage";

/**
 * 選手カード（eFHUB のカードを簡略化したもの）。
 * 画像の左上に OVR、その下に名前（日本語・英語）と選手ID。
 */
export function PlayerCard({ player }: { player: PlayerSummary }) {
  return (
    <Link
      href={`/players/${encodeURIComponent(player.id)}`}
      className="block overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-accent"
    >
      {/* --- player image (revertable) --- */}
      <div className="relative">
        <PlayerImage
          playerId={player.id}
          alt={player.nameJa || player.nameEn || `選手 ${player.id}`}
          size="card"
        />
        <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-lg font-black leading-none text-accent">
          {player.ovr}
          <span className="ml-1 align-top text-[9px] font-semibold text-text-dim">OVR</span>
        </span>
      </div>
      {/* --- /player image --- */}

      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-text" title={player.nameJa}>
          {player.nameJa || "（日本語名なし）"}
        </p>
        <p className="truncate text-xs text-text-dim" title={player.nameEn}>
          {player.nameEn || "（英語名なし）"}
        </p>
        <p className="mt-1 truncate text-[10px] text-text-dim/70">ID: {player.id}</p>
      </div>
    </Link>
  );
}
