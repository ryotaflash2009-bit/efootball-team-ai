import { describe, it, expect } from "vitest";
import {
  buildPromotionPlan,
  validatePromotionPlanAgainstApproval,
  checkPromotionPlanNotExpired,
  checkPromotionPlanTablesAllowed,
  checkStagingChecksumUnchanged,
  computeRecordSetChecksum,
  computeApprovalArtifactId,
  type BuildPromotionPlanInput,
} from "./promotion";
import type { ApprovalArtifact } from "./approval";
import type { StagingRecord } from "./types";

function buildApproval(overrides: Partial<ApprovalArtifact> = {}): ApprovalArtifact {
  return {
    jobId: "job-1",
    datasetChecksum: "dataset-checksum-1",
    diffChecksum: "diff-checksum-1",
    schemaVersion: "v1",
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: "nonce-1",
    expiresAt: "2026-01-02T00:00:00.000Z",
    expectedCounts: { added: 1, updated: 1, removedCandidate: 0 },
    ...overrides,
  };
}

function buildPlanInput(overrides: Partial<BuildPromotionPlanInput> = {}): BuildPromotionPlanInput {
  const approval = overrides.approval ?? buildApproval();
  const beforeRecords: StagingRecord[] = [{ id: "wc-1", fields: { name_en: "A", ovr_max: 80 } }];
  const expectedAfterRecords: StagingRecord[] = [
    { id: "wc-1", fields: { name_en: "A2", ovr_max: 81 } },
    { id: "wc-2", fields: { name_en: "B", ovr_max: 70 } },
  ];
  return {
    jobId: "job-1",
    schemaVersion: "v1",
    sourceIdentifier: "efootball-world.com",
    sourceTable: "staging_world_player_cards",
    targetTable: "world_player_cards",
    datasetChecksum: "dataset-checksum-1",
    diffChecksum: "diff-checksum-1",
    beforeRecords,
    expectedAfterRecords,
    expectedCounts: { added: 1, updated: 1, unchanged: 0, removedCandidate: 0 },
    approval,
    generatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeRecordSetChecksum", () => {
  it("順序に依存しない(並べ替えても同じchecksum)", () => {
    const a: StagingRecord[] = [
      { id: "1", fields: { x: 1 } },
      { id: "2", fields: { x: 2 } },
    ];
    const b: StagingRecord[] = [
      { id: "2", fields: { x: 2 } },
      { id: "1", fields: { x: 1 } },
    ];
    expect(computeRecordSetChecksum(a)).toBe(computeRecordSetChecksum(b));
  });

  it("内容が変われば異なるchecksumになる", () => {
    const a: StagingRecord[] = [{ id: "1", fields: { x: 1 } }];
    const b: StagingRecord[] = [{ id: "1", fields: { x: 2 } }];
    expect(computeRecordSetChecksum(a)).not.toBe(computeRecordSetChecksum(b));
  });

  it("空配列は決定的なchecksumを返す", () => {
    expect(computeRecordSetChecksum([])).toBe(computeRecordSetChecksum([]));
  });
});

describe("buildPromotionPlan / validatePromotionPlanAgainstApproval", () => {
  it("正常系: approvalと完全一致するplanはすべての検証に合格する", () => {
    const input = buildPlanInput();
    const plan = buildPromotionPlan(input);
    const checks = validatePromotionPlanAgainstApproval(plan, input.approval);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("jobId不一致は拒否", () => {
    const input = buildPlanInput();
    const plan = { ...buildPromotionPlan(input), jobId: "other-job" };
    expect(validatePromotionPlanAgainstApproval(plan, input.approval).some((c) => !c.ok)).toBe(true);
  });

  it("datasetChecksum不一致は拒否", () => {
    const input = buildPlanInput();
    const plan = { ...buildPromotionPlan(input), datasetChecksum: "different" };
    expect(validatePromotionPlanAgainstApproval(plan, input.approval).some((c) => !c.ok)).toBe(true);
  });

  it("diffChecksum不一致は拒否", () => {
    const input = buildPlanInput();
    const plan = { ...buildPromotionPlan(input), diffChecksum: "different" };
    expect(validatePromotionPlanAgainstApproval(plan, input.approval).some((c) => !c.ok)).toBe(true);
  });

  it("schemaVersion不一致は拒否", () => {
    const input = buildPlanInput();
    const plan = { ...buildPromotionPlan(input), schemaVersion: "v2" };
    expect(validatePromotionPlanAgainstApproval(plan, input.approval).some((c) => !c.ok)).toBe(true);
  });

  it("approvalArtifactIdが再計算値と不一致なら拒否(単純flagでの昇格を防ぐ)", () => {
    const input = buildPlanInput();
    const plan = { ...buildPromotionPlan(input), approvalArtifactId: "forged-id" };
    expect(validatePromotionPlanAgainstApproval(plan, input.approval).some((c) => !c.ok)).toBe(true);
  });

  it("approvalArtifactIdはapproval内容から決定的に計算される(推測不能な乱数ではない)", () => {
    const approval = buildApproval();
    expect(computeApprovalArtifactId(approval)).toBe(computeApprovalArtifactId(approval));
    expect(computeApprovalArtifactId(approval)).not.toBe(computeApprovalArtifactId({ ...approval, nonce: "different" }));
  });

  it("rollbackPlanIdはjobIdから決定的に導出される", () => {
    const input = buildPlanInput();
    const plan = buildPromotionPlan(input);
    expect(plan.rollbackPlanId).toBe(`rollback-${input.jobId}`);
  });
});

describe("checkPromotionPlanNotExpired", () => {
  it("期限内は合格", () => {
    const plan = buildPromotionPlan(buildPlanInput());
    expect(checkPromotionPlanNotExpired(plan, new Date("2026-01-01T12:00:00.000Z")).ok).toBe(true);
  });

  it("期限切れは拒否", () => {
    const plan = buildPromotionPlan(buildPlanInput());
    expect(checkPromotionPlanNotExpired(plan, new Date("2026-01-03T00:00:00.000Z")).ok).toBe(false);
  });
});

describe("checkPromotionPlanTablesAllowed", () => {
  it("正しいsourceTable/targetTableの組は合格する", () => {
    const plan = buildPromotionPlan(buildPlanInput());
    expect(checkPromotionPlanTablesAllowed(plan).every((c) => c.ok)).toBe(true);
  });

  it("許可されていないtargetTableは拒否される", () => {
    const plan = { ...buildPromotionPlan(buildPlanInput()), targetTable: "auth.users" };
    expect(checkPromotionPlanTablesAllowed(plan).some((c) => !c.ok)).toBe(true);
  });

  it("promotionOrderが改変されていれば拒否される", () => {
    const plan = { ...buildPromotionPlan(buildPlanInput()), promotionOrder: ["managers", "world_player_cards", "player_card_analysis"] };
    expect(checkPromotionPlanTablesAllowed(plan).some((c) => !c.ok)).toBe(true);
  });

  it("allowedSourceTables/allowedTargetTablesが改変されていれば拒否される", () => {
    const plan = { ...buildPromotionPlan(buildPlanInput()), allowedTargetTables: ["my_team_snapshots", "managers", "player_card_analysis"] };
    expect(checkPromotionPlanTablesAllowed(plan).some((c) => !c.ok)).toBe(true);
  });
});

describe("checkStagingChecksumUnchanged", () => {
  it("datasetChecksumと一致すれば合格", () => {
    const plan = buildPromotionPlan(buildPlanInput());
    expect(checkStagingChecksumUnchanged(plan, plan.datasetChecksum).ok).toBe(true);
  });

  it("承認後にstagingが変化していれば拒否", () => {
    const plan = buildPromotionPlan(buildPlanInput());
    expect(checkStagingChecksumUnchanged(plan, "changed-checksum").ok).toBe(false);
  });
});
