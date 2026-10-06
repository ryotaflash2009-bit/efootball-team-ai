import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import type { PointsSummary } from "@/lib/progression/types";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 育成ポイントの使用状況。育成操作中に常に見える位置へ置く。
 */
export function PointsBar({ points }: { points: PointsSummary }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const total = Math.max(1, points.totalPoints);
  const usedPct = Math.min(100, Math.max(0, (points.usedPoints / total) * 100));
  const over = points.overAllocated;

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{tp("pointsHeading")}</span>
        <span className="tabular-nums">
          <span className={over ? "text-danger" : "text-accent"}>{points.usedPoints}</span>
          <span className="text-text-dim">{tp("pointsUsedSuffix").replace("{total}", String(points.totalPoints))}</span>
          <span className="ms-2 text-text-dim">{tp("pointsRemainingPrefix")}</span>
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
          ? tp("pointsFormulaConfirmed")
          : tp("pointsFormulaUnverified")}
        {points.totalPoints === 0 ? tp("pointsNone") : ""}
      </p>
    </div>
  );
}
