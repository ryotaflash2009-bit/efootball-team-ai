import { buildValueCounts } from "./distribution";
import { DISTRIBUTION_CONTRACT_VERSION, type DistributionArtifact, type DistributionScope } from "./artifact";

/**
 * F-071 分布の成果物を、World のスナップショットの行（更新検出の staging rows）から作る（純関数・外部アクセスなし）。
 * - 値は各カードの基礎能力値（育成前）。欠けている値は数えない（既定値 40 などで埋めない）。
 * - 範囲: all（全カード）・field（GK 以外）・gk・position:<登録ポジション>。
 */
export interface DistributionSourceRow {
  registered_position?: unknown;
  stats?: unknown;
}

const POSITION_RE = /^[A-Z]{2,3}$/;

export function buildDistributionArtifact(
  rows: readonly DistributionSourceRow[],
  statKeys: readonly string[],
  meta: { sourceChecksum12: string; generatedAt: string; datasetVersion: string },
): DistributionArtifact {
  const scopeRows = new Map<string, DistributionSourceRow[]>();
  const push = (k: string, r: DistributionSourceRow) => {
    const list = scopeRows.get(k);
    if (list) list.push(r);
    else scopeRows.set(k, [r]);
  };
  for (const r of rows) {
    push("all", r);
    const pos = typeof r.registered_position === "string" && POSITION_RE.test(r.registered_position) ? r.registered_position : null;
    if (pos === "GK") push("gk", r);
    else push("field", r);
    if (pos) push(`position:${pos}`, r);
  }

  const scopes: Record<string, DistributionScope> = {};
  for (const [k, list] of [...scopeRows.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const stats: DistributionScope["stats"] = {};
    for (const key of statKeys) {
      const values: number[] = [];
      for (const r of list) {
        const v = r.stats && typeof r.stats === "object" ? (r.stats as Record<string, unknown>)[key] : undefined;
        if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100) values.push(v);
      }
      if (values.length > 0) stats[key] = buildValueCounts(values);
    }
    scopes[k] = { n: list.length, stats };
  }

  return {
    contractVersion: DISTRIBUTION_CONTRACT_VERSION,
    generatedAt: meta.generatedAt,
    datasetVersion: meta.datasetVersion,
    binding: { dataset: "world_player_cards", sourceChecksum12: meta.sourceChecksum12, recordCount: rows.length },
    statKeys: [...statKeys],
    scopes,
  };
}
