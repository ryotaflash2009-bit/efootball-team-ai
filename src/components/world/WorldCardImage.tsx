"use client";

import { useState } from "react";
import { PlayerSilhouette } from "@/components/PlayerSilhouette";

/**
 * World カードの画像。3:4 の枠を常に確保する（レイアウトが動かない・CLS 0）。
 *
 * - sources を優先順位順に受け取り、読み込み失敗のたびに次の候補へ切り替える。
 *   すべて失敗（または候補なし）でローカル SVG プレースホルダー。
 * - すべて同一オリジンの内部プロキシ（/api/player-image, /api/world/player-image）。
 * - 一覧では loading="lazy"。
 */
export function WorldCardImage({
  sources,
  alt,
  size = "card",
  priority = false,
}: {
  sources: string[];
  alt: string;
  size?: "card" | "detail";
  priority?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const current = sources[index];

  if (current == null) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-surface-2">
        <PlayerSilhouette className="absolute inset-0 h-full w-full" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- 同一オリジンのプロキシ画像 */}
      <img
        key={current}
        src={current}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onError={() => setIndex((i) => i + 1)}
        className="absolute inset-0 h-full w-full object-cover"
        width={size === "detail" ? 480 : 300}
        height={size === "detail" ? 640 : 400}
      />
    </div>
  );
}
