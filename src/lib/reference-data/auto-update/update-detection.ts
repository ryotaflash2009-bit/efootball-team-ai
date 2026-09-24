import { buildStagingDataset } from "./source-snapshot";
import type { SourceTransport } from "./source-transport";
import { analyzeSourceTimestamps } from "./stage1-verification";
import { collectManagersSnapshot, collectWorldFullSnapshot } from "./update-dry-run";
import { UPDATE_POLICY_THRESHOLDS } from "./update-policy";
import { WORLD_LIMITS } from "./stage4-world";

/**
 * 定期検出(Secretなし・Environmentなし・Productionへ接続しない)。
 *
 * upstream(World全件・managers.json)を取得して正規化し、source checksumを、リポジトリに記録した
 * 「最後にProductionへ適用した状態」(applied-state)と比べる。結果は要約だけ(件数・checksum先頭12文字・判定・signal)。
 * Productionのplan・Backup・dry run・applyは行わない(常に承認付きの手動run)。
 */

export const APPLIED_STATE_FILE = "docs/production-readiness/reference-data-applied-state.json";
export const APPLIED_STATE_SCHEMA = "reference-data-applied-state/v1";

export interface AppliedDatasetState {
  /** 最後に自動更新で適用したsource checksumの先頭12文字。自動更新で未適用ならnull。 */
  readonly sourceChecksum12: string | null;
  readonly recordCount: number;
  readonly appliedAt: string | null;
  /** Worldだけ: 適用済みデータのappearance_updated_at最大値(逆行検出の基準)。不明ならnull。 */
  readonly maxAppearanceUpdatedAt?: string | null;
  readonly evidence: string | null;
}

export interface AppliedState {
  readonly schema: typeof APPLIED_STATE_SCHEMA;
  readonly updatedAt: string;
  readonly datasets: { readonly world_player_cards: AppliedDatasetState; readonly managers: AppliedDatasetState };
}

export function parseAppliedState(text: string): AppliedState {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("applied_state_not_json");
  }
  const ds = d.datasets as Record<string, Record<string, unknown>> | undefined;
  const okDs = (x: Record<string, unknown> | undefined) =>
    !!x && (x.sourceChecksum12 === null || (typeof x.sourceChecksum12 === "string" && /^[0-9a-f]{12}$/.test(x.sourceChecksum12))) && Number.isInteger(x.recordCount) && (x.recordCount as number) >= 0;
  if (d.schema !== APPLIED_STATE_SCHEMA || !okDs(ds?.world_player_cards) || !okDs(ds?.managers)) throw new Error("applied_state_shape");
  return d as unknown as AppliedState;
}

export type DetectionDecision = "no_change" | "update_available" | "attention_required";

export interface DatasetDetection {
  readonly decision: DetectionDecision;
  readonly recordCount: number;
  readonly appliedRecordCount: number;
  readonly sourceChecksum12: string;
  readonly signals: readonly string[];
}

export type DetectionResult =
  | { readonly ok: true; readonly world: DatasetDetection & { readonly timestamps: Record<string, unknown> }; readonly managers: DatasetDetection }
  | { readonly ok: false; readonly failure: { readonly table: string; readonly stage: string; readonly code: string } };

function decide(sourceChecksum: string, count: number, applied: AppliedDatasetState, dropRatio: number, signals: string[]): DatasetDetection {
  const drop = applied.recordCount > 0 && count < applied.recordCount ? (applied.recordCount - count) / applied.recordCount : 0;
  if (drop > dropRatio) signals.push("record_count_drop_over_threshold");
  else if (drop > 0) signals.push("record_count_drop");
  const same = applied.sourceChecksum12 !== null && sourceChecksum.slice(0, 12) === applied.sourceChecksum12;
  if (applied.sourceChecksum12 === null) signals.push("no_applied_baseline");
  const decision: DetectionDecision = signals.some((s) => ["record_count_drop_over_threshold", "future_timestamps", "timestamp_regression"].includes(s))
    ? "attention_required"
    : same
      ? "no_change"
      : "update_available";
  return { decision, recordCount: count, appliedRecordCount: applied.recordCount, sourceChecksum12: sourceChecksum.slice(0, 12), signals };
}

/** 定期検出の本体(transportは呼び出し側が上限付きで作る)。 */
export async function runDetection(input: { transport: SourceTransport; fetchedAt: string; sleep: (ms: number) => Promise<void>; applied: AppliedState }): Promise<DetectionResult> {
  const worldRaw: (string | null)[] = [];
  const w = await collectWorldFullSnapshot(input.transport, {
    fetchedAt: input.fetchedAt,
    sleep: input.sleep,
    maxPages: WORLD_LIMITS.maxPages,
    maxRecords: WORLD_LIMITS.maxRecords,
    stopOnDuplicateIdentity: true,
    onRecord: (n) => worldRaw.push(n.appearance_updated_at),
  });
  if (!w.ok) return { ok: false, failure: { table: "world_player_cards", stage: w.failure.stage, code: w.failure.code } };
  if (w.snapshot.completeness.status !== "complete") return { ok: false, failure: { table: "world_player_cards", stage: "normalize", code: "source_incomplete" } };
  const m = await collectManagersSnapshot(input.transport, { fetchedAt: input.fetchedAt, sleep: input.sleep });
  if (!m.ok) return { ok: false, failure: { table: "managers", stage: m.failure.stage, code: m.failure.code } };
  let ws, ms;
  try {
    ws = buildStagingDataset(w.snapshot);
  } catch {
    return { ok: false, failure: { table: "world_player_cards", stage: "normalize", code: "duplicate_or_incomplete" } };
  }
  try {
    ms = buildStagingDataset(m.snapshot);
  } catch {
    return { ok: false, failure: { table: "managers", stage: "normalize", code: "duplicate_or_incomplete" } };
  }
  const normalized = ws.rows.map((r) => {
    const v = (r as Readonly<Record<string, unknown>>).appearance_updated_at;
    return typeof v === "string" ? v : null;
  });
  const ts = analyzeSourceTimestamps(normalized, worldRaw, input.fetchedAt, input.applied.datasets.world_player_cards.maxAppearanceUpdatedAt ?? null);
  const worldSignals = ts.findings.filter((f) => f !== "upstream_timestamp_without_timezone_interpreted_as_utc");
  const world = decide(ws.sourceChecksum, ws.rowCount, input.applied.datasets.world_player_cards, UPDATE_POLICY_THRESHOLDS.worldPlayerCards.countDropHardBlockRatio, worldSignals);
  const managers = decide(ms.sourceChecksum, ms.rowCount, input.applied.datasets.managers, UPDATE_POLICY_THRESHOLDS.managers.countDropHardBlockRatio, []);
  return {
    ok: true,
    world: { ...world, timestamps: { total: ts.total, rawWithoutTimezone: ts.rawWithoutTimezone, min: ts.min, max: ts.max, futureCount: ts.futureCount, regression: ts.regression, mostCommonShare: ts.mostCommonShare } },
    managers,
  };
}
