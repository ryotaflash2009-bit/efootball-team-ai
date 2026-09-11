import { getFormation } from "@/lib/squad/formations";
import type { CompareCardUnit } from "@/lib/squad/compare-squads";

/**
 * 比較用ミニピッチ。保存済み x/y 座標に選手ドットを置き、配置ロール・キャプテン・
 * 共通 / この側だけ を **色 + 形 + テキスト** で区別する（色だけに頼らない）。
 * 旧スカッドで座標が無い場合は formation 既定座標（呼び出し側が CompareCardUnit に補完済み）。
 */
export function CompareMiniPitch({
  side,
  formationId,
  units,
  isCommon,
  className = "",
}: {
  side: "A" | "B";
  formationId: string;
  units: CompareCardUnit[];
  /** worldCardId が両スカッド共通か。 */
  isCommon: (worldCardId: string) => boolean;
  className?: string;
}) {
  const f = getFormation(formationId);
  const starters = units.filter((u) => u.area === "starter");
  const accent = side === "A" ? "var(--accent, #37f)" : "#e0a43b";

  return (
    <figure className={`flex flex-col gap-1 ${className}`}>
      <figcaption className="text-xs font-semibold text-text-dim">
        比較対象{side}: {f.name}
        <span className="ml-1 font-normal text-text-muted">先発 {starters.length}/11</span>
      </figcaption>
      <div
        className="pitch-turf relative aspect-[68/105] w-full overflow-hidden rounded-md border border-border"
        role="img"
        aria-label={`比較対象${side}（${f.name}）の配置。先発 ${starters.length} 人。${starters
          .map(
            (u) =>
              `${u.nameJa || u.nameEn || `カード${u.worldCardId}`}: ${u.placementRole ?? "?"}${
                u.isCaptain ? "・キャプテン" : ""
              }${isCommon(u.worldCardId) ? "・共通カード" : "・この側だけ"}`,
          )
          .join(" / ")}`}
      >
        <div className="absolute inset-2 rounded border border-white/15" />
        <div className="absolute left-2 right-2 top-1/2 h-px bg-white/15" />
        {starters.map((u) => {
          const common = isCommon(u.worldCardId);
          const x = u.x ?? 50;
          const y = u.y ?? 50;
          return (
            <span
              key={u.worldCardId + (u.slotId ?? "")}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            >
              <span
                aria-hidden="true"
                style={{ background: common ? accent : "transparent", borderColor: accent }}
                className={`grid h-3.5 w-3.5 place-items-center border text-[7px] font-bold text-white ${
                  common ? "rounded-full" : "rounded-[2px]"
                }`}
              >
                {u.isCaptain ? "C" : ""}
              </span>
              <span className="mt-0.5 whitespace-nowrap rounded bg-black/55 px-1 text-[8px] font-semibold leading-tight text-white">
                {u.placementRole ?? "?"}
              </span>
            </span>
          );
        })}
      </div>
      <p className="text-[10px] leading-tight text-text-muted">
        <span aria-hidden="true">●</span> 共通カード / <span aria-hidden="true">▫</span> この側だけ /
        「C」= キャプテン。座標は正規化値（ピッチ幅比 0–100）。
      </p>
    </figure>
  );
}
