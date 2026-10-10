import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildAppliedStateUpdate, parseCandidate } from "../../../../scripts/lib/applied-state-sync.mjs";

const STATE = {
  schema: "reference-data-applied-state/v1",
  updatedAt: "2026-10-07",
  note: "n",
  datasets: {
    world_player_cards: { sourceChecksum12: "079f9eaf92a0", recordCount: 13372, appliedAt: "2026-10-07T15:26:29.608Z", maxAppearanceUpdatedAt: "2026-10-01T16:42:06.399Z", evidence: "docs/production-readiness/evidence/world-auto-apply-2026-10-07.json" },
    managers: { sourceChecksum12: "62a21bd2086a", recordCount: 69, appliedAt: "2026-10-03T14:26:12.497Z", evidence: "x" },
  },
};
const cand = (dataset: string, cs: string, count: number, at: string, run: string) => ({ schema: "reference-data-applied-state-candidate/v1", dataset, note: "", entry: { sourceChecksum12: cs, recordCount: count, appliedAt: at, applyRunId: run } });
const det = (cs: string, max: string) => ({ world: { sourceChecksum12: cs, timestamps: { max } } });

describe("適用済みの記録の自動の更新（2026-10-11）", () => {
  it("新しい World の適用: 記録を更新し、同じ checksum の検出の timestamps.max を入れ、Evidence の置き場所を決める", () => {
    const r = buildAppliedStateUpdate({ appliedState: STATE, candidates: [cand("world_player_cards", "3c064cdf73ae", 13455, "2026-10-10T21:00:00.000Z", "38080000000")], detections: [det("3c064cdf73ae", "2026-10-08T17:01:43.390Z"), det("079f9eaf92a0", "x")] });
    expect(r.changed).toBe(true);
    expect(r.appliedState.datasets.world_player_cards).toEqual({
      sourceChecksum12: "3c064cdf73ae", recordCount: 13455, appliedAt: "2026-10-10T21:00:00.000Z", maxAppearanceUpdatedAt: "2026-10-08T17:01:43.390Z",
      evidence: "docs/production-readiness/evidence/world-auto-apply-2026-10-10-38080000000.json",
    });
    expect(r.appliedState.updatedAt).toBe("2026-10-10");
    expect(r.appliedState.datasets.managers).toEqual(STATE.datasets.managers);
    expect(STATE.updatedAt).toBe("2026-10-07"); // 入力は変えない
  });
  it("World の timestamps.max が分からなければ更新しない（推測で埋めない）", () => {
    const r = buildAppliedStateUpdate({ appliedState: STATE, candidates: [cand("world_player_cards", "3c064cdf73ae", 13455, "2026-10-10T21:00:00.000Z", "1")], detections: [] });
    expect(r).toMatchObject({ changed: false, skipped: ["world_player_cards:max_timestamp_unknown"] });
  });
  it("古い・同じ checksum・件数の減少・不正な候補は使わない。dataset ごとに最新の 1 件", () => {
    const r = buildAppliedStateUpdate({
      appliedState: STATE,
      candidates: [
        cand("world_player_cards", "aaaaaaaaaaaa", 13300, "2026-10-01T00:00:00.000Z", "1"),
        cand("managers", "62a21bd2086a", 69, "2026-10-09T00:00:00.000Z", "2"),
        cand("managers", "bbbbbbbbbbbb", 68, "2026-10-09T00:00:00.000Z", "3"),
        { schema: "x" },
        cand("managers", "cccccccccccc", 70, "2026-10-08T00:00:00.000Z", "4"),
        cand("managers", "dddddddddddd", 71, "2026-10-09T01:00:00.000Z", "5"),
      ],
      detections: [],
    });
    expect(r.updates).toEqual([{ dataset: "managers", applyRunId: "5", evidencePath: "docs/production-readiness/evidence/managers-auto-apply-2026-10-09-5.json" }]);
    expect(r.appliedState.datasets.managers.recordCount).toBe(71);
    expect(r.skipped).toContain("candidate_invalid");
    expect(parseCandidate(cand("managers", "XYZ", 1, "2026-10-09T00:00:00Z", "1"))).toBeNull();
  });
});

describe("workflow の監査（reference-data-applied-state-sync.yml）", () => {
  const body = readFileSync(path.resolve(__dirname, "..", "..", "..", "..", ".github", "workflows", "reference-data-applied-state-sync.yml"), "utf8")
    .split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n");
  it("Secrets・Environment なし・書き込みの権限は job の contents だけ・Gate は検出の変数と停止の変数", () => {
    expect(body).not.toMatch(/secrets\./);
    expect(body).not.toMatch(/environment\s*:/);
    expect(body.match(/:\s*write/g)).toEqual([": write"]);
    expect(body).toContain("vars.REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED == 'true' && vars.REFERENCE_DATA_APPLIED_STATE_SYNC_DISABLED != 'true'");
  });
  it("実行中の Pipeline があれば何もしない・commit は 2 種類のファイルだけ・push は main の fast-forward だけ", () => {
    expect(body).toContain("Skip while a pipeline run is active");
    expect(body).toMatch(/for wf in reference-data-update-orchestrator\.yml reference-data-production-apply\.yml reference-data-production-backup\.yml/);
    expect(body).toContain("unexpected file in the sync commit");
    expect(body.match(/git push [^\n]+/g)).toEqual(["git push origin HEAD:main"]);
    expect(body).not.toMatch(/--force|-f origin/);
    // F-071 の分布は、World を更新したときだけ・照合（import-world-distribution.mjs）を通して取り込む
    expect(body).toContain("node scripts/import-world-distribution.mjs data/work/distribution/world-base-distribution.candidate.json");
    expect(body).toContain("src/lib/percentiles/data/world-base-distribution\.json");
  });
});
