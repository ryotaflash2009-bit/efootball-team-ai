import { statTier, type StatTier } from "@/lib/world/stats";

/**
 * 能力値の数値バッジ。数値帯で色が変わるが、色だけに依存しないよう必ず数値を表示する。
 * 未取得（null）は「—」。
 */
const TIER_CLASS: Record<StatTier, string> = {
  elite: "bg-cyan-400/15 text-cyan-300 ring-cyan-400/40",
  high: "bg-lime-400/15 text-lime-300 ring-lime-400/40",
  mid: "bg-yellow-400/15 text-yellow-300 ring-yellow-400/40",
  low: "bg-orange-400/15 text-orange-300 ring-orange-400/40",
  poor: "bg-red-400/15 text-red-300 ring-red-400/40",
};

export function StatBadge({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-1.5 py-0.5 text-sm font-bold text-text-dim ring-1 ring-border">
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-1.5 py-0.5 text-sm font-bold tabular-nums ring-1 ${TIER_CLASS[statTier(value)]}`}
    >
      {value}
    </span>
  );
}
