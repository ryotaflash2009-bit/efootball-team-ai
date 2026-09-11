"use client";

import { useState } from "react";
import { PlayerSilhouette } from "./PlayerSilhouette";

/**
 * 選手画像。常に 3:4 の枠を確保するのでレイアウトが動かない（CLS 0）。
 * src は同一オリジンの内部プロキシ /api/player-image/{id}。
 * 読み込み失敗時は画面側でもシルエットへ差し替える（プロキシ到達不可などの保険）。
 */
export function PlayerImage({
  playerId,
  alt,
  size = "card",
  priority = false,
}: {
  playerId: string;
  alt: string;
  size?: "card" | "detail";
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-surface-2">
      {failed ? (
        <PlayerSilhouette className="absolute inset-0 h-full w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- 同一オリジンのプロキシ画像。next/image の最適化は不要
        <img
          src={`/api/player-image/${encodeURIComponent(playerId)}`}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          width={size === "detail" ? 480 : 300}
          height={size === "detail" ? 640 : 400}
        />
      )}
    </div>
  );
}
