import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appliedWorldStateFrom, checkDistributionArtifact, loadDistributions, type DistributionArtifact } from "./artifact";
import { buildDistributionArtifact } from "./generate";
import { percentileOf } from "./distribution";

const KEYS = ["speed", "gkReach"];
const ROWS = [
  { registered_position: "CF", stats: { speed: 90, gkReach: 40 } },
  { registered_position: "CF", stats: { speed: 80, gkReach: 41 } },
  { registered_position: "CB", stats: { speed: 70 } }, // gkReach 欠け（既定値で埋めない）
  { registered_position: "GK", stats: { speed: 60, gkReach: 88 } },
];
const META = { sourceChecksum12: "0123456789ab", generatedAt: "2026-09-27T00:00:00.000Z", datasetVersion: "world_player_cards@0123456789ab" };
const APPLIED = { sourceChecksum12: "0123456789ab", recordCount: 4 };

function artifact(): DistributionArtifact {
  return buildDistributionArtifact(ROWS, KEYS, META);
}

describe("F-071 成果物の生成", () => {
  it("範囲 all / field / gk / position ごとの母数と値ごとの件数。欠けた値は数えない", () => {
    const a = artifact();
    expect(Object.keys(a.scopes)).toEqual(["all", "field", "gk", "position:CB", "position:CF", "position:GK"]);
    expect(a.scopes.all.n).toBe(4);
    expect(a.scopes.field.n).toBe(3);
    expect(a.scopes.gk.n).toBe(1);
    expect(a.scopes.all.stats.gkReach.counts.reduce((s, c) => s + c, 0)).toBe(3);
    expect(a.binding).toEqual({ dataset: "world_player_cards", sourceChecksum12: "0123456789ab", recordCount: 4 });
  });

  it("読み込んだ分布でパーセンタイルを出せる（範囲を混ぜない）", () => {
    const d = loadDistributions(artifact());
    expect(percentileOf(d.get("all")!.get("speed")!, 90)!.topPercent).toBe(12.5);
    expect(percentileOf(d.get("position:CF")!.get("speed")!, 90)!.topPercent).toBe(25);
  });
});

describe("F-071 成果物の検証", () => {
  it("applied-state と一致すれば VALID", () => {
    expect(checkDistributionArtifact(artifact(), APPLIED)).toEqual({ verdict: "DISTRIBUTION_ARTIFACT_VALID", problems: [] });
  });

  it("checksum・件数が applied-state と違えば STALE、applied-state が読めなくても STALE", () => {
    expect(checkDistributionArtifact(artifact(), { ...APPLIED, sourceChecksum12: "ffffffffffff" }).verdict).toBe("DISTRIBUTION_ARTIFACT_STALE");
    expect(checkDistributionArtifact(artifact(), { ...APPLIED, recordCount: 5 }).verdict).toBe("DISTRIBUTION_ARTIFACT_STALE");
    expect(checkDistributionArtifact(artifact(), null).verdict).toBe("DISTRIBUTION_ARTIFACT_STALE");
  });

  it("all が欠ける・all の能力が欠ける・母数が件数と違えば INCOMPLETE", () => {
    const noAll = artifact();
    delete (noAll.scopes as Record<string, unknown>).all;
    expect(checkDistributionArtifact(noAll, APPLIED).verdict).toBe("DISTRIBUTION_ARTIFACT_INCOMPLETE");
    const noStat = artifact();
    delete (noStat.scopes.all.stats as Record<string, unknown>).speed;
    expect(checkDistributionArtifact(noStat, APPLIED).verdict).toBe("DISTRIBUTION_ARTIFACT_INCOMPLETE");
  });

  it("形が壊れていれば INVALID", () => {
    const cases: [string, (a: DistributionArtifact) => void][] = [
      ["contract", (a) => (a.contractVersion = "x")],
      ["checksum", (a) => (a.binding.sourceChecksum12 = "XYZ")],
      ["generatedAt", (a) => (a.generatedAt = "yesterday")],
      ["counts", (a) => (a.scopes.all.stats.speed = { min: 60, counts: [1, -1] })],
      ["unknown stat", (a) => (a.scopes.all.stats.power = { min: 60, counts: [1] })],
      ["scope key", (a) => (a.scopes["position:<x>"] = { n: 0, stats: {} })],
      ["count exceeds n", (a) => (a.scopes.gk.n = 0)],
    ];
    for (const [name, mutate] of cases) {
      const a = artifact();
      mutate(a);
      expect(checkDistributionArtifact(a, APPLIED).verdict, name).toBe("DISTRIBUTION_ARTIFACT_INVALID");
    }
    expect(checkDistributionArtifact(null, APPLIED).verdict).toBe("DISTRIBUTION_ARTIFACT_INVALID");
  });

  it("リポジトリの applied-state から World の照合情報を読める", () => {
    const raw = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "reference-data-applied-state.json"), "utf8"));
    const w = appliedWorldStateFrom(raw);
    expect(w?.sourceChecksum12).toMatch(/^[0-9a-f]{12}$/);
    expect(w?.recordCount).toBeGreaterThan(0);
    expect(appliedWorldStateFrom({})).toBeNull();
  });
});
