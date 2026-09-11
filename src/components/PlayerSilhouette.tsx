/**
 * 画像取得に失敗したときの画面側フォールバック。
 * public/player-placeholder.svg と同じ見た目のインライン SVG。
 * 親要素いっぱいに広がる（親側で aspect-[3/4] の枠を用意する）。
 */
export function PlayerSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 400"
      role="img"
      aria-label="選手画像なし"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="300" height="400" fill="#0b0f12" />
      <rect x="4" y="4" width="292" height="392" fill="none" stroke="#c7f000" strokeWidth="2" opacity="0.5" />
      <circle cx="150" cy="150" r="55" fill="#c7f000" opacity="0.18" />
      <path d="M60 360c0-55 40-96 90-96s90 41 90 96z" fill="#c7f000" opacity="0.18" />
      <text
        x="150"
        y="332"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="26"
        fontWeight="700"
        fill="#c7f000"
        opacity="0.85"
      >
        NO IMAGE
      </text>
    </svg>
  );
}
