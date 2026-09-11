import type { PointsSummary } from "@/lib/progression/types";

/**
 * 育成ポイントの使用状況。育成操作中に常に見える位置へ置く。
 */
export function PointsBar({ points }: { points: PointsSummary }) {
  const total = Math.max(1, points.totalPoints);
  const usedPct = Math.min(100, Math.max(0, (points.usedPoints / total) * 100));
  const over = points.overAllocated;

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">育成ポイント</span>
        <span className="tabular-nums">
          <span className={over ? "text-danger" : "text-accent"}>{points.usedPoints}</span>
          <span className="text-text-dim"> / {points.totalPoints} 使用</span>
          <span className="ml-2 text-text-dim">残り </span>
          <span className={points.remainingPoints < 0 ? "text-danger" : "text-text"}>
            {points.remainingPoints}
          </span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${over ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-text-dim/80">
        {points.totalPointsConfidence === "confirmed"
          ? "ポイント総数 = (最大レベル − 1) × 2（確認済）／ 消費は段階コスト（検証中）"
          : "ポイント総数（検証中）"}
        {points.totalPoints === 0 ? " — このカードは育成ポイントがありません" : ""}
      </p>
    </div>
  );
}
