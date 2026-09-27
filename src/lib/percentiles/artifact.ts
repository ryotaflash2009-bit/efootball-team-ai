import { isValidValueCounts, toCumulative, type CumulativeDistribution, type ValueCounts } from "./distribution";

/**
 * F-071 分布の成果物（静的 JSON）と、その検証。
 *
 * - 成果物は週1回の更新検出が作る候補（World の最新スナップショットから・読み取り専用）で、Production Apply の後の
 *   Evidence / applied-state の PR で main へ入る。
 * - 画面は、成果物の binding が docs/production-readiness/reference-data-applied-state.json の
 *   world_player_cards（checksum・件数）と一致するときだけ使う（STALE / INVALID / INCOMPLETE なら表示しない）。
 * - 新しい DB テーブルは作らない。
 */
export const DISTRIBUTION_CONTRACT_VERSION = "world-base-distribution/v1";

/** 必須の範囲は all。position / field / gk は任意（範囲どうしを混ぜない）。 */
export type ScopeKey = "all" | "field" | "gk" | `position:${string}`;

export interface DistributionScope {
  n: number;
  /** 能力キー → 値ごとの件数。 */
  stats: Record<string, ValueCounts>;
}

export interface DistributionArtifact {
  contractVersion: string;
  generatedAt: string;
  datasetVersion: string;
  binding: {
    dataset: "world_player_cards";
    sourceChecksum12: string;
    recordCount: number;
  };
  /** 分布に使った能力キー（all は全キー必須）。 */
  statKeys: string[];
  scopes: Record<string, DistributionScope>;
}

export interface AppliedWorldState {
  sourceChecksum12: string;
  recordCount: number;
}

export type ArtifactVerdict = "DISTRIBUTION_ARTIFACT_VALID" | "DISTRIBUTION_ARTIFACT_STALE" | "DISTRIBUTION_ARTIFACT_INVALID" | "DISTRIBUTION_ARTIFACT_INCOMPLETE";

export interface ArtifactCheck {
  verdict: ArtifactVerdict;
  problems: string[];
}

const CHECKSUM_RE = /^[0-9a-f]{12}$/;
const STAT_KEY_RE = /^[a-zA-Z][a-zA-Z0-9]{1,40}$/;
const SCOPE_RE = /^(all|field|gk|position:[A-Z]{2,3})$/;

/** 成果物の検証。applied が null（applied-state が読めない）なら STALE 扱い（照合できないので使わない）。 */
export function checkDistributionArtifact(raw: unknown, applied: AppliedWorldState | null): ArtifactCheck {
  const problems: string[] = [];
  const invalid = (p: string): ArtifactCheck => ({ verdict: "DISTRIBUTION_ARTIFACT_INVALID", problems: [...problems, p] });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid("not_object");
  const a = raw as Partial<DistributionArtifact>;
  if (a.contractVersion !== DISTRIBUTION_CONTRACT_VERSION) return invalid("contract_version");
  if (typeof a.generatedAt !== "string" || Number.isNaN(Date.parse(a.generatedAt))) return invalid("generated_at");
  if (typeof a.datasetVersion !== "string" || a.datasetVersion.length === 0 || a.datasetVersion.length > 80) return invalid("dataset_version");
  const b = a.binding;
  if (!b || b.dataset !== "world_player_cards" || typeof b.sourceChecksum12 !== "string" || !CHECKSUM_RE.test(b.sourceChecksum12) || !Number.isInteger(b.recordCount) || b.recordCount <= 0) return invalid("binding");
  if (!Array.isArray(a.statKeys) || a.statKeys.length === 0 || !a.statKeys.every((k) => typeof k === "string" && STAT_KEY_RE.test(k)) || new Set(a.statKeys).size !== a.statKeys.length) return invalid("stat_keys");
  if (!a.scopes || typeof a.scopes !== "object" || Array.isArray(a.scopes)) return invalid("scopes");

  for (const [scopeKey, scope] of Object.entries(a.scopes)) {
    if (!SCOPE_RE.test(scopeKey)) return invalid(`scope_key:${scopeKey}`);
    if (!scope || typeof scope !== "object" || !Number.isInteger(scope.n) || scope.n < 0 || scope.n > b.recordCount) return invalid(`scope_n:${scopeKey}`);
    if (!scope.stats || typeof scope.stats !== "object") return invalid(`scope_stats:${scopeKey}`);
    for (const [statKey, vc] of Object.entries(scope.stats)) {
      if (!a.statKeys.includes(statKey)) return invalid(`unknown_stat:${scopeKey}:${statKey}`);
      if (!isValidValueCounts(vc)) return invalid(`value_counts:${scopeKey}:${statKey}`);
      const total = vc.counts.reduce((s, c) => s + c, 0);
      if (total > scope.n) return invalid(`count_exceeds_n:${scopeKey}:${statKey}`);
    }
  }

  const all = a.scopes.all;
  if (!all) problems.push("missing_scope:all");
  else {
    if (all.n !== b.recordCount) problems.push("all_n_mismatch_record_count");
    for (const k of a.statKeys) if (!all.stats[k]) problems.push(`missing_stat:all:${k}`);
  }
  if (problems.length > 0) return { verdict: "DISTRIBUTION_ARTIFACT_INCOMPLETE", problems };

  if (!applied) return { verdict: "DISTRIBUTION_ARTIFACT_STALE", problems: ["applied_state_unavailable"] };
  if (applied.sourceChecksum12 !== b.sourceChecksum12) problems.push("checksum_differs_from_applied_state");
  if (applied.recordCount !== b.recordCount) problems.push("record_count_differs_from_applied_state");
  if (problems.length > 0) return { verdict: "DISTRIBUTION_ARTIFACT_STALE", problems };
  return { verdict: "DISTRIBUTION_ARTIFACT_VALID", problems: [] };
}

/** applied-state の JSON から World の照合情報を取り出す（形が違えば null）。 */
export function appliedWorldStateFrom(raw: unknown): AppliedWorldState | null {
  const w = (raw as { datasets?: { world_player_cards?: { sourceChecksum12?: unknown; recordCount?: unknown } } } | null)?.datasets?.world_player_cards;
  if (!w || typeof w.sourceChecksum12 !== "string" || !CHECKSUM_RE.test(w.sourceChecksum12) || !Number.isInteger(w.recordCount)) return null;
  return { sourceChecksum12: w.sourceChecksum12, recordCount: w.recordCount as number };
}

/** 検証済みの成果物 → 累積分布（範囲ごと・能力ごと）。VALID のときだけ呼ぶ。 */
export function loadDistributions(a: DistributionArtifact): Map<string, Map<string, CumulativeDistribution>> {
  const out = new Map<string, Map<string, CumulativeDistribution>>();
  for (const [scopeKey, scope] of Object.entries(a.scopes)) {
    const m = new Map<string, CumulativeDistribution>();
    for (const [statKey, vc] of Object.entries(scope.stats)) m.set(statKey, toCumulative(vc));
    out.set(scopeKey, m);
  }
  return out;
}
