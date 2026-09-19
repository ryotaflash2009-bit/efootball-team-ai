import { describe, it, expect } from "vitest";
import { applyUpdateJob, evaluatePreApplyGates, type QueryClient, type ApplyJobInput } from "./apply-orchestrator";
import { createPendingJob } from "./job";
import { computeDiffChecksum, type ApprovalArtifact } from "./approval";
import { generateUpdatePlan } from "./plan";
import { computeRecordChecksum } from "./diff";
import type { PreviousSnapshot, StagingDataset } from "./types";

/**
 * `QueryClient`の合成フェイク実装(実DB・実ネットワーク接続なし)。呼び出されたSQLを
 * すべて記録し、gate失敗時に一切呼ばれないこと(BEGINへ到達しないこと)を検証できるようにする。
 */
class FakeQueryClient implements QueryClient {
  calls: string[] = [];
  private table: Record<string, { fields_json: string }> = {};

  async query(sql: string, params: readonly unknown[] = []) {
    this.calls.push(sql.trim().split(/\s+/)[0].toLowerCase());
    if (/^insert into target_records/i.test(sql)) {
      const [id, fieldsJson] = params as [string, string];
      this.table[id] = { fields_json: fieldsJson };
      return { rows: [] };
    }
    if (/^select record_id/i.test(sql)) {
      return { rows: Object.entries(this.table).map(([id, v]) => ({ id, fields_json: v.fields_json })) };
    }
    return { rows: [] };
  }
}

function buildStaging(): StagingDataset {
  return {
    table: "world_player_cards",
    sourceMeta: {
      source: "efootball-world.com",
      sourceUrl: "https://efootball-world.com/x",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      httpStatus: 200,
      contentType: "application/json",
      contentLength: 10,
    },
    records: [{ id: "wc-1", fields: { nameEn: "A", ovrMax: 80 } }],
  };
}

function buildScenario() {
  const staging = buildStaging();
  // 初回投入ではなく既存レコードの更新シナリオにするため、前回スナップショットにも
  // 同じIDを含める(checkCountDeltaは前回0件→今回N件を「初回投入相当」として別途拒否するため)。
  const previous: PreviousSnapshot = {
    table: staging.table,
    records: [{ id: "wc-1", checksum: computeRecordChecksum({ nameEn: "A", ovrMax: 79 }) }],
  };
  const schemaConfig = { idPattern: /^wc-\d+$/, requiredFields: ["nameEn"], knownFields: ["nameEn", "ovrMax"] };
  const plan = generateUpdatePlan({
    staging,
    previous,
    schemaConfig,
    diffThresholds: { maxDecreaseRatio: 0.05, maxIncreaseRatio: 1, maxRemovedCount: 9999 },
  });
  const job = createPendingJob({
    jobId: "job-1",
    table: staging.table,
    source: staging.sourceMeta.source,
    schemaVersion: "v1",
    datasetChecksum: "checksum-1",
    previousChecksum: null,
    expectedTables: [staging.table],
    fetchedTables: [staging.table],
  });
  const approval: ApprovalArtifact = {
    jobId: job.jobId,
    datasetChecksum: job.datasetChecksum,
    diffChecksum: computeDiffChecksum(plan.diff),
    schemaVersion: job.schemaVersion,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: "nonce-1",
    expiresAt: "2026-01-02T00:00:00.000Z",
    expectedCounts: { added: plan.diff.addedCount, updated: plan.diff.updatedCount, removedCandidate: plan.diff.removedCount },
  };
  const input: ApplyJobInput = {
    job,
    plan,
    approval,
    stagingRecords: staging.records,
    appliedChecksumHistory: new Set(),
    previousJobStatus: "idle",
    lockAcquired: true,
    now: new Date("2026-01-01T12:00:00.000Z"),
  };
  return input;
}

describe("evaluatePreApplyGates", () => {
  it("正常なシナリオは全ゲート合格", () => {
    const checks = evaluatePreApplyGates(buildScenario());
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("lock未取得なら拒否", () => {
    const input = { ...buildScenario(), lockAcquired: false };
    expect(evaluatePreApplyGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("直前ジョブ実行中なら拒否", () => {
    const input: ApplyJobInput = { ...buildScenario(), previousJobStatus: "running" };
    expect(evaluatePreApplyGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("同一checksumが適用済みなら拒否(冪等性)", () => {
    const scenario = buildScenario();
    const input = { ...scenario, appliedChecksumHistory: new Set([scenario.job.datasetChecksum]) };
    expect(evaluatePreApplyGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("承認artifactが不一致なら拒否", () => {
    const scenario = buildScenario();
    const input = { ...scenario, approval: { ...scenario.approval, nonce: "" } };
    expect(evaluatePreApplyGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("許可リストに無いテーブル(利用者データ)は構造的に拒否される", () => {
    for (const forbiddenTable of ["auth.users", "my_team_snapshots", "rls_probe_records"]) {
      const scenario = buildScenario();
      const input = { ...scenario, job: { ...scenario.job, table: forbiddenTable } };
      expect(evaluatePreApplyGates(input).some((c) => !c.ok)).toBe(true);
    }
  });

  it("許可リストにある参照データテーブルは対象にできる", () => {
    for (const allowedTable of ["world_player_cards", "managers", "player_card_analysis"]) {
      const scenario = buildScenario();
      const input = { ...scenario, job: { ...scenario.job, table: allowedTable } };
      // テーブル許可ゲート以外の理由でrejectされないことだけを確認する(テーブル名要因の拒否がない)。
      const tableCheckOnly = evaluatePreApplyGates(input);
      expect(tableCheckOnly[0].ok).toBe(true);
    }
  });
});

describe("applyUpdateJob", () => {
  it("正常なシナリオはcommitし、実際にtarget_recordsへ反映される", async () => {
    const client = new FakeQueryClient();
    const result = await applyUpdateJob(client, buildScenario());
    expect(result.decision).toBe("commit");
    expect(result.appliedCount).toBe(1);
    expect(client.calls).toContain("begin");
    expect(client.calls).toContain("commit");
    expect(client.calls).not.toContain("rollback");
  });

  it("事前ゲート失敗時はBEGINへ到達しない(トランザクションを開始しない)", async () => {
    const client = new FakeQueryClient();
    const input = { ...buildScenario(), lockAcquired: false };
    const result = await applyUpdateJob(client, input);
    expect(result.decision).toBe("rollback");
    expect(client.calls).toEqual([]);
  });

  it("plan自体がreject判定の場合は適用しない", async () => {
    const client = new FakeQueryClient();
    const scenario = buildScenario();
    const rejectedPlan = { ...scenario.plan, decision: "reject" as const, reasons: ["合成テスト用の強制reject"] };
    const input = { ...scenario, plan: rejectedPlan, approval: { ...scenario.approval, diffChecksum: computeDiffChecksum(scenario.plan.diff) } };
    const result = await applyUpdateJob(client, input);
    expect(result.decision).toBe("rollback");
    expect(client.calls).toEqual([]);
  });
});
