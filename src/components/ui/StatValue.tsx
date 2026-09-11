import { statTier, type StatTier } from "@/lib/world/stats";

/**
 * 能力値の数値バッジ。数値帯で色が変わるが、色だけに依存しないよう必ず数値を表示する。
 * 未取得（null）は「—」。size で大小。
 * 色は Tailwind パレットの固定クラス（不透明度修飾が確実に効く）。
 */
const TIER_CLASS: Record<StatTier, string> = {
  elite: "bg-cyan-400/15 text-cyan-300 ring-cyan-400/40",
  high: "bg-lime-400/15 text-lime-300 ring-lime-400/40",
  mid: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  low: "bg-orange-400/15 text-orange-300 ring-orange-400/40",
  poor: "bg-red-400/15 text-red-300 ring-red-400/35",
};

const SIZE = {
  sm: "min-w-[2rem] px-1.5 py-0.5 text-xs",
  md: "min-w-[2.25rem] px-1.5 py-0.5 text-sm",
  lg: "min-w-[2.75rem] px-2 py-1 text-base",
};

export function StatValue({
  value,
  size = "md",
}: {
  value: number | null | undefined;
  size?: keyof typeof SIZE;
}) {
  if (value == null) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md font-bold text-text-muted ring-1 ring-border ${SIZE[size]}`}
      >
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums ring-1 ${SIZE[size]} ${TIER_CLASS[statTier(value)]}`}
    >
      {value}
    </span>
  );
}

/** 育成デルタ等の増減表示。0 は淡色。 */
export function DeltaValue({
  value,
  provisional,
  prefix,
}: {
  value: number;
  provisional?: boolean;
  prefix?: string;
}) {
  if (value === 0) return <span className="text-text-muted">±0</span>;
  const pos = value > 0;
  return (
    <span className={pos ? "text-success" : "text-danger"}>
      {prefix}
      {pos ? "+" : ""}
      {value}
      {provisional ? <span className="ml-0.5 text-2xs text-warning/70">?</span> : null}
    </span>
  );
}
