import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveWorldBaseDistribution } from "./world-base-server";
import { buildDistributionArtifact } from "./generate";
import { loadDistributions, checkDistributionArtifact, appliedWorldStateFrom } from "./artifact";
import { cardBasePercentiles, scopeKeyFor } from "./card-percentiles";

const ROWS = Array.from({ length: 200 }, (_, i) => ({ registered_position: i % 10 === 0 ? "GK" : "CF", stats: { speed: 40 + (i % 60), gkReach: i % 10 === 0 ? 80 : 40 } }));
const META = { sourceChecksum12: "abcdefabcdef", generatedAt: "2026-09-28T00:00:00.000Z", datasetVersion: "world_player_cards@abcdefabcdef" };
const applied = (checksum: string, count: number) => ({ datasets: { world_player_cards: { sourceChecksum12: checksum, recordCount: count } } });

describe("F-071 サーバー側の照合", () => {
  const artifact = buildDistributionArtifact(ROWS, ["speed", "gkReach"], META);

  it("成果物が null ならまだ作られていない", () => {
    expect(resolveWorldBaseDistribution(null, applied("abcdefabcdef", 200))).toEqual({ status: "not_generated" });
  });
  it("applied-state と一致すれば valid、違えば stale（中身を渡さない）", () => {
    expect(resolveWorldBaseDistribution(artifact, applied("abcdefabcdef", 200)).status).toBe("valid");
    expect(resolveWorldBaseDistribution(artifact, applied("000000000000", 200))).toEqual({ status: "unavailable", verdict: "DISTRIBUTION_ARTIFACT_STALE" });
    expect(resolveWorldBaseDistribution({ x: 1 }, applied("abcdefabcdef", 200))).toEqual({ status: "unavailable", verdict: "DISTRIBUTION_ARTIFACT_INVALID" });
  });
});

describe("F-071 カード単位", () => {
  const d = loadDistributions(buildDistributionArtifact(ROWS, ["speed", "gkReach"], META));

  it("範囲の選択 → 範囲キー（範囲を混ぜない）", () => {
    expect(scopeKeyFor("all", "CF")).toBe("all");
    expect(scopeKeyFor("position", "CF")).toBe("position:CF");
    expect(scopeKeyFor("role", "CF")).toBe("field");
    expect(scopeKeyFor("role", "GK")).toBe("gk");
    expect(scopeKeyFor("position", null)).toBeNull();
    expect(scopeKeyFor("position", "<b>")).toBeNull();
  });

  it("基礎値の区分。値が無い能力は出さない。母数が少ない範囲は出さない", () => {
    const r = cardBasePercentiles(d.get("all"), [
      { key: "speed", value: 99 },
      { key: "gkReach", value: null },
      { key: "unknown", value: 70 },
    ]);
    expect([...r.keys()]).toEqual(["speed"]);
    expect(r.get("speed")!.bucket).toBe("top1");
    expect(r.get("speed")!.n).toBe(200);
    // GK の範囲は 20 枚（最小の母数ちょうど）→ 表示する。
    expect(cardBasePercentiles(d.get("gk"), [{ key: "gkReach", value: 80 }]).get("gkReach")!.bucket).toBe("top50");
    expect(cardBasePercentiles(undefined, [{ key: "speed", value: 99 }]).size).toBe(0);
  });
});

describe("F-071 リポジトリの成果物", () => {
  it("まだ作られていない（null）か、形が正しく applied-state と照合できる（INVALID / INCOMPLETE はコミットしない）", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const raw = JSON.parse(readFileSync(path.join(root, "src", "lib", "percentiles", "data", "world-base-distribution.json"), "utf8"));
    if (raw === null) return;
    const appliedRaw = JSON.parse(readFileSync(path.join(root, "docs", "production-readiness", "reference-data-applied-state.json"), "utf8"));
    const verdict = checkDistributionArtifact(raw, appliedWorldStateFrom(appliedRaw)).verdict;
    expect(["DISTRIBUTION_ARTIFACT_VALID", "DISTRIBUTION_ARTIFACT_STALE"]).toContain(verdict);
    // 集計値だけ（行データ・URL を含まない）。
    expect(JSON.stringify(raw)).not.toMatch(/https?:|world_card_id|name_(en|ja)/);
  });
});
