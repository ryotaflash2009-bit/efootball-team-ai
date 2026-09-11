import type { WorldStatValue, WorldStatGroup } from "@/lib/world/types";
import { WORLD_STAT_GROUP_LABELS } from "@/lib/world/stats";
import { statLabelJa } from "@/lib/world/stat-labels";
import { StatBadge } from "./StatBadge";

/**
 * 26 能力値を 攻撃 / 守備 / GK / 身体能力 のセクションに分けて表示。
 * PC は 2〜3 列、モバイルは 1 列で折り返す。値は元の World 値（育成後・監督補正は含まない）。
 */
const GROUP_ORDER: WorldStatGroup[] = ["offense", "defense", "physical", "gk"];

export function WorldStatGrid({ stats }: { stats: WorldStatValue[] }) {
  const byGroup = new Map<WorldStatGroup, WorldStatValue[]>();
  for (const s of stats) {
    const list = byGroup.get(s.group) ?? [];
    list.push(s);
    byGroup.set(s.group, list);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {GROUP_ORDER.map((group) => {
        const list = byGroup.get(group);
        if (!list || list.length === 0) return null;
        return (
          <section key={group} className="rounded-md border border-border bg-surface-2/40 p-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-dim">
              {WORLD_STAT_GROUP_LABELS[group]}
            </h3>
            <dl className="flex flex-col gap-1">
              {list.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between gap-2 rounded px-1.5 py-1 odd:bg-black/10"
                >
                  <dt className="min-w-0 truncate text-sm text-text" title={s.nameEn}>
                    {statLabelJa(s.key)}
                  </dt>
                  <dd className="shrink-0">
                    <StatBadge value={s.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
