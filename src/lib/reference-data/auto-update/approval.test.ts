import { describe, it, expect } from "vitest";
import { validateApproval, computeDiffChecksum, type ApprovalArtifact } from "./approval";
import { createPendingJob } from "./job";
import { computeRecordChecksum, computeDiff } from "./diff";
import type { PreviousSnapshot, StagingRecord } from "./types";

function buildDiff() {
  const previous: PreviousSnapshot = { table: "world_player_cards", records: [{ id: "wc-1", checksum: computeRecordChecksum({ a: 1 }) }] };
  const candidate: StagingRecord[] = [
    { id: "wc-1", fields: { a: 1 } },
    { id: "wc-2", fields: { a: 2 } },
  ];
  return computeDiff(previous, candidate);
}

function buildJob() {
  return createPendingJob({
    jobId: "job-1",
    table: "world_player_cards",
    source: "efootball-world.com",
    schemaVersion: "v1",
    datasetChecksum: "checksum-abc",
    previousChecksum: null,
    expectedTables: ["world_player_cards"],
    fetchedTables: ["world_player_cards"],
  });
}

function buildValidApproval(job = buildJob(), diff = buildDiff()): ApprovalArtifact {
  return {
    jobId: job.jobId,
    datasetChecksum: job.datasetChecksum,
    diffChecksum: computeDiffChecksum(diff),
    schemaVersion: job.schemaVersion,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: "nonce-123",
    expiresAt: "2026-01-02T00:00:00.000Z",
    expectedCounts: { added: diff.addedCount, updated: diff.updatedCount, removedCandidate: diff.removedCount },
  };
}

const NOW = new Date("2026-01-01T12:00:00.000Z");

describe("validateApproval", () => {
  it("すべて一致する承認は全チェック合格", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = buildValidApproval(job, diff);
    const checks = validateApproval(approval, job, diff, NOW);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("jobIdが異なれば拒否", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = { ...buildValidApproval(job, diff), jobId: "other-job" };
    const checks = validateApproval(approval, job, diff, NOW);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("datasetChecksumが承認後に変化していれば拒否(承認後のデータ変更を検出)", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = buildValidApproval(job, diff);
    const changedJob = { ...job, datasetChecksum: "different-checksum" };
    const checks = validateApproval(approval, changedJob, diff, NOW);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("diffChecksumが一致しなければ拒否(承認後に差分内容が変わった場合)", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = { ...buildValidApproval(job, diff), diffChecksum: "bogus" };
    const checks = validateApproval(approval, job, diff, NOW);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("期待件数が一致しなければ拒否", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = { ...buildValidApproval(job, diff), expectedCounts: { added: 999, updated: 0, removedCandidate: 0 } };
    const checks = validateApproval(approval, job, diff, NOW);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("有効期限切れは拒否", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = { ...buildValidApproval(job, diff), expiresAt: "2025-01-01T00:00:00.000Z" };
    const checks = validateApproval(approval, job, diff, NOW);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("approvedByが空なら拒否", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = { ...buildValidApproval(job, diff), approvedBy: "" };
    const checks = validateApproval(approval, job, diff, NOW);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("nonceが空なら拒否(単なるフラグでの承認を防ぐ)", () => {
    const job = buildJob();
    const diff = buildDiff();
    const approval = { ...buildValidApproval(job, diff), nonce: "" };
    const checks = validateApproval(approval, job, diff, NOW);
    expect(checks.some((c) => !c.ok)).toBe(true);
  });
});

describe("computeDiffChecksum", () => {
  it("同じ差分内容なら同じchecksum", () => {
    const diff = buildDiff();
    expect(computeDiffChecksum(diff)).toBe(computeDiffChecksum(diff));
  });
  it("差分内容が変われば別のchecksum", () => {
    const diff1 = buildDiff();
    const diff2 = { ...diff1, addedIds: [...diff1.addedIds, "extra"] };
    expect(computeDiffChecksum(diff1)).not.toBe(computeDiffChecksum(diff2));
  });
});
