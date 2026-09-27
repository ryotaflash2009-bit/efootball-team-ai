import artifactJson from "./data/world-base-distribution.json";
import appliedStateJson from "../../../docs/production-readiness/reference-data-applied-state.json";
import { appliedWorldStateFrom, checkDistributionArtifact, type ArtifactVerdict, type DistributionArtifact } from "./artifact";

/**
 * サーバー側: main にコミットされた分布の成果物を、同じ main の applied-state と照合する（1回だけ）。
 * - 成果物が null: まだ作られていない（最初の定期検出の後の PR で入る）。
 * - VALID のときだけ画面へ渡す。それ以外は理由のコードだけ（中身は渡さない）。
 */
export type WorldBaseDistributionStatus =
  | { status: "valid"; artifact: DistributionArtifact }
  | { status: "not_generated" }
  | { status: "unavailable"; verdict: Exclude<ArtifactVerdict, "DISTRIBUTION_ARTIFACT_VALID"> };

let cached: WorldBaseDistributionStatus | null = null;

export function resolveWorldBaseDistribution(raw: unknown = artifactJson, appliedRaw: unknown = appliedStateJson): WorldBaseDistributionStatus {
  if (raw == null) return { status: "not_generated" };
  const check = checkDistributionArtifact(raw, appliedWorldStateFrom(appliedRaw));
  if (check.verdict === "DISTRIBUTION_ARTIFACT_VALID") return { status: "valid", artifact: raw as DistributionArtifact };
  return { status: "unavailable", verdict: check.verdict };
}

export function getWorldBaseDistribution(): WorldBaseDistributionStatus {
  if (!cached) cached = resolveWorldBaseDistribution();
  return cached;
}
