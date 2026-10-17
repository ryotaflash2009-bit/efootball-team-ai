/**
 * 最近追加されたカードを「追加された日（日本時間）」ごとにまとめる（2026-10-17）。新しいカードは公開の日にまとめて届くため、
 * 日ごとのまとまりをパック診断（/pack-check?ids=）へそのまま渡せるようにする。パックの中身そのものではない（目安）。
 */
export interface AddedBatchInput {
  worldCardId: string;
  addedAt?: string | null;
  ovrMax: number | null;
  ovrBase: number | null;
}

export interface AddedBatch {
  /** 日本時間の日付（YYYY-MM-DD）。 */
  date: string;
  count: number;
  /** パック診断へ渡すカード（OVR の高い順に最大 limit 枚）。 */
  ids: string[];
  /** その日のすべてのカード（OVR の高い順・表示用）。 */
  allIds: string[];
  truncated: boolean;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addedBatches(cards: readonly AddedBatchInput[], limit = 30): AddedBatch[] {
  const byDate = new Map<string, AddedBatchInput[]>();
  for (const c of cards) {
    const d = c.addedAt ? jstDate(c.addedAt) : null;
    if (!d) continue;
    const list = byDate.get(d) ?? [];
    list.push(c);
    byDate.set(d, list);
  }
  const ovr = (c: AddedBatchInput) => c.ovrMax ?? c.ovrBase ?? -1;
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => ovr(b) - ovr(a) || a.worldCardId.localeCompare(b.worldCardId));
      const allIds = sorted.map((c) => c.worldCardId);
      return { date, count: list.length, ids: allIds.slice(0, limit), allIds, truncated: list.length > limit };
    });
}
