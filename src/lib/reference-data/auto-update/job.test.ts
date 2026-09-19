import { describe, it, expect } from "vitest";
import { createPendingJob, transitionJob, toSafetyGateJobStatus } from "./job";

function baseJob() {
  return createPendingJob({
    jobId: "job-1",
    table: "world_player_cards",
    source: "efootball-world.com",
    schemaVersion: "v1",
    datasetChecksum: "abc",
    previousChecksum: null,
    expectedTables: ["world_player_cards"],
    fetchedTables: ["world_player_cards"],
  });
}

describe("createPendingJob", () => {
  it("pending状態で作成される", () => {
    const job = baseJob();
    expect(job.status).toBe("pending");
    expect(job.startedAt).toBeNull();
    expect(job.completedAt).toBeNull();
  });
});

describe("transitionJob", () => {
  it("pending→runningへ遷移できる", () => {
    const result = transitionJob(baseJob(), "running", "2026-01-01T00:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.job?.status).toBe("running");
    expect(result.job?.startedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("running→completedへ遷移できる", () => {
    const running = transitionJob(baseJob(), "running", "t1").job!;
    const result = transitionJob(running, "completed", "t2");
    expect(result.ok).toBe(true);
    expect(result.job?.completedAt).toBe("t2");
  });

  it("pending→completedへ直接遷移することは許可しない(runningを経由する)", () => {
    const result = transitionJob(baseJob(), "completed", "t1");
    expect(result.ok).toBe(false);
  });

  it("completed→rolled_backへ遷移できる", () => {
    const running = transitionJob(baseJob(), "running", "t1").job!;
    const completed = transitionJob(running, "completed", "t2").job!;
    const result = transitionJob(completed, "rolled_back", "t3");
    expect(result.ok).toBe(true);
  });

  it("failedからはどこにも遷移できない", () => {
    const running = transitionJob(baseJob(), "running", "t1").job!;
    const failed = transitionJob(running, "failed", "t2").job!;
    expect(transitionJob(failed, "running", "t3").ok).toBe(false);
    expect(transitionJob(failed, "rolled_back", "t3").ok).toBe(false);
  });
});

describe("toSafetyGateJobStatus", () => {
  it("ジョブが無い場合はidle", () => {
    expect(toSafetyGateJobStatus(null)).toBe("idle");
  });
  it("pendingはidle扱い", () => {
    expect(toSafetyGateJobStatus(baseJob())).toBe("idle");
  });
  it("runningはrunning", () => {
    const running = transitionJob(baseJob(), "running", "t1").job!;
    expect(toSafetyGateJobStatus(running)).toBe("running");
  });
  it("rolled_backはcompleted扱い(既に決着したジョブとして二重実行防止の対象にしない)", () => {
    const running = transitionJob(baseJob(), "running", "t1").job!;
    const completed = transitionJob(running, "completed", "t2").job!;
    const rolledBack = transitionJob(completed, "rolled_back", "t3").job!;
    expect(toSafetyGateJobStatus(rolledBack)).toBe("completed");
  });
});
