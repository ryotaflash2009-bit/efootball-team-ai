"use client";

import { useEffect, useRef, useState } from "react";
import { PlayerSilhouette } from "@/components/PlayerSilhouette";

/** 画面の近く（上下 200px）に来たら読み込む。ブラウザー標準の lazy は画面から遠い画像まで読み込むため（2026-10-04 計測）。 */
const NEAR_VIEWPORT_MARGIN = "200px 0px";

/**
 * World カードの画像。3:4 の枠を常に確保する（レイアウトが動かない・CLS 0）。
 *
 * - sources を優先順位順に受け取り、読み込み失敗のたびに次の候補へ切り替える。
 *   すべて失敗（または候補なし）でローカル SVG プレースホルダー。
 * - すべて同一オリジンの内部プロキシ（/api/player-image, /api/world/player-image）。
 * - priority: すぐに読み込む（詳細の主画像・一覧の最初の数枚）。fetchpriority も high。
 * - それ以外: 枠が画面の近くに来てから <img> を置く（2026-10-04: 一覧で画面外の画像まで 4MB 近く読み込んでいた）。
 *   server と client の最初の描画はどちらも枠だけなので hydration は一致する。IntersectionObserver が無い環境ではすぐ読み込む。
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
  const [near, setNear] = useState(priority);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = sources[index];

  useEffect(() => {
    if (near) return;
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: NEAR_VIEWPORT_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (current == null) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-surface-2">
        <PlayerSilhouette className="absolute inset-0 h-full w-full" />
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-surface-2">
      {near ? (
        // eslint-disable-next-line @next/next/no-img-element -- 同一オリジンのプロキシ画像
        <img
          key={current}
          src={current}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          draggable={false}
          onError={() => setIndex((i) => i + 1)}
          className="absolute inset-0 h-full w-full object-cover"
          width={size === "detail" ? 480 : 300}
          height={size === "detail" ? 640 : 400}
        />
      ) : (
        <span role="img" aria-label={alt} className="absolute inset-0" />
      )}
    </div>
  );
}
