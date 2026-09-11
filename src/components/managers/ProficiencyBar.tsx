import type { TacticalProficiencies } from "@/lib/managers/types";
import { TACTICS, tacticTier, TACTIC_BAR, TACTIC_TEXT } from "./tactics";

/**
 * 戦術適性6項目。数値・バー・色・（詳細では順位）を組み合わせ、色だけに依存しない。
 * compact: 一覧カード用のコンパクト表示。
 */
export function ProficiencyBar({
  proficiencies,
  compact = false,
  showRank = false,
}: {
  proficiencies: TacticalProficiencies;
  compact?: boolean;
  showRank?: boolean;
}) {
  const ranked = [...TACTICS]
    .map((t) => ({ ...t, value: proficiencies[t.key] }))
    .filter((t) => t.value != null)
    .sort((a, b) => (b.value as number) - (a.value as number));
  const rankMap = new Map(ranked.map((t, i) => [t.key, i + 1]));

  if (compact) {
    return (
      <ul className="flex flex-wrap gap-1">
        {TACTICS.map((t) => {
          const v = proficiencies[t.key];
          const tier = tacticTier(v);
          return (
            <li key={t.key} title={`${t.en}（${t.ja}）`}>
              <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-2xs">
                <span className="text-text-muted">{t.abbr}</span>
                <span className={`font-bold tabular-nums ${TACTIC_TEXT[tier]}`}>{v ?? "—"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <dl className="flex flex-col gap-2">
      {TACTICS.map((t) => {
        const v = proficiencies[t.key];
        const tier = tacticTier(v);
        const pct = v == null ? 0 : Math.min(100, Math.max(4, v));
        return (
          <div key={t.key} className="grid grid-cols-[minmax(120px,1fr)_2.5rem] items-center gap-3">
            <div>
              <dt className="flex items-baseline gap-1.5 text-sm">
                <span className="font-medium">{t.en}</span>
                <span className="text-2xs text-text-muted">{t.ja}</span>
                {showRank && rankMap.has(t.key) ? (
                  <span className="text-2xs text-text-muted">#{rankMap.get(t.key)}</span>
                ) : null}
              </dt>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-surface-2">
                <div className={`h-full rounded-pill ${TACTIC_BAR[tier]}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <dd className={`text-right text-sm font-bold tabular-nums ${TACTIC_TEXT[tier]}`}>{v ?? "—"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** 略称の凡例。 */
export function TacticsLegend() {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-text-muted">
      {TACTICS.map((t) => (
        <span key={t.key}>
          <span className="font-semibold text-text-dim">{t.abbr}</span> {t.en}（{t.ja}）
        </span>
      ))}
    </p>
  );
}
