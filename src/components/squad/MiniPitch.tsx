import { getFormation } from "@/lib/squad/formations";

/** フォーメーションの簡易プレビュー（CSS のみ・選手なし）。 */
export function MiniPitch({
  formationId,
  className = "",
  filledSlotIds = [],
}: {
  formationId: string;
  className?: string;
  filledSlotIds?: string[];
}) {
  const f = getFormation(formationId);
  const filled = new Set(filledSlotIds);
  return (
    <div
      className={`pitch-turf relative aspect-[68/105] w-full overflow-hidden rounded-md border border-border ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-2 rounded border border-white/15" />
      <div className="absolute left-2 right-2 top-1/2 h-px bg-white/15" />
      {f.slots.map((s) => (
        <span
          key={s.slotId}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            filled.has(s.slotId) ? "bg-accent" : "bg-white/45"
          }`}
        />
      ))}
    </div>
  );
}
