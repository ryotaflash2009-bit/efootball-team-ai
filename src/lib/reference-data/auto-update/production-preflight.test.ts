import { describe, it, expect } from "vitest";
import {
  fingerprintIdentifier,
  createProductionAdapter,
  checkProductionModeExplicit,
  checkCalledFromAllowedContext,
  checkTargetSchema,
  checkDatabaseFingerprintMatches,
  checkSslRequired,
  checkCertificateValidation,
  checkAllowedOpsTable,
  evaluateProductionPreApplyGates,
  buildProductionPreflightReport,
  PRODUCTION_OPS_ALLOWED_TABLES,
  type ProductionAdapterConfig,
  type ProductionApplyIntent,
} from "./production-preflight";
import { createPendingJob } from "./job";
import { computeDiff } from "./diff";
import { computeDiffChecksum, type ApprovalArtifact } from "./approval";
import type { PreviousSnapshot } from "./types";

/**
 * 実Supabase・実PostgreSQLへは一切接続しない(合成データのみ、純関数の検証)。
 */
function baseConfig(): ProductionAdapterConfig {
  return {
    productionModeExplicitlyEnabled: true,
    calledFrom: "cli",
    targetSchema: "reference_data_ops",
    databaseFingerprint: "abc123",
    expectedDatabaseFingerprint: "abc123",
    ssl: true,
    certificateValidationEnabled: true,
  };
}

describe("createProductionAdapter", () => {
  it("常に例外を投げる(意図的な未実装、Production接続は今回有効化しない)", () => {
    expect(() => createProductionAdapter()).toThrow(/実装されていない/);
  });
});

describe("fingerprintIdentifier", () => {
  it("同じ入力なら同じfingerprintを返す(決定的)", () => {
    expect(fingerprintIdentifier("example-host")).toBe(fingerprintIdentifier("example-host"));
  });
  it("生の入力文字列をそのまま含まない(ログ出力しても安全な長さ・形式)", () => {
    const fp = fingerprintIdentifier("db.example.supabase.co");
    expect(fp).not.toContain("supabase");
    expect(fp.length).toBe(16);
  });
});

describe("個別ゲート", () => {
  it("Production mode未有効化は拒否", () => {
    expect(checkProductionModeExplicit({ ...baseConfig(), productionModeExplicitlyEnabled: false }).ok).toBe(false);
  });
  it("cli以外からの呼び出しは拒否(vercel-runtime/client/public-endpoint/cron)", () => {
    for (const from of ["vercel-runtime", "client", "public-endpoint", "cron"] as const) {
      expect(checkCalledFromAllowedContext({ ...baseConfig(), calledFrom: from }).ok).toBe(false);
    }
  });
  it("cliからの呼び出しは許可", () => {
    expect(checkCalledFromAllowedContext(baseConfig()).ok).toBe(true);
  });
  it("targetSchemaがreference_data_ops以外なら拒否", () => {
    expect(checkTargetSchema({ ...baseConfig(), targetSchema: "public" }).ok).toBe(false);
  });
  it("databaseFingerprintが一致しなければ拒否", () => {
    expect(checkDatabaseFingerprintMatches({ ...baseConfig(), databaseFingerprint: "different" }).ok).toBe(false);
  });
  it("SSL無効なら拒否", () => {
    expect(checkSslRequired({ ...baseConfig(), ssl: false }).ok).toBe(false);
  });
  it("certificate validation無効なら拒否", () => {
    expect(checkCertificateValidation({ ...baseConfig(), certificateValidationEnabled: false }).ok).toBe(false);
  });
});

describe("checkAllowedOpsTable", () => {
  it("許可リスト内のテーブルは許可", () => {
    for (const t of PRODUCTION_OPS_ALLOWED_TABLES) {
      expect(checkAllowedOpsTable(t).ok).toBe(true);
    }
  });
  it("auth.users/my_team_snapshots/rls_probe_recordsは拒否", () => {
    for (const t of ["auth.users", "my_team_snapshots", "public.my_team_snapshots", "rls_probe_records"]) {
      expect(checkAllowedOpsTable(t).ok).toBe(false);
    }
  });
  it("許可リスト外の任意テーブル名も拒否", () => {
    expect(checkAllowedOpsTable("world_player_cards").ok).toBe(false);
  });
});

function buildIntent(overrides?: Partial<ProductionApplyIntent>): ProductionApplyIntent {
  const previous: PreviousSnapshot = { table: "staging_world_player_cards", records: [] };
  const diff = computeDiff(previous, []);
  const job = createPendingJob({
    jobId: "prod-job-1",
    table: "staging_world_player_cards",
    source: "efootball-world.com",
    schemaVersion: "v1",
    datasetChecksum: "checksum-1",
    previousChecksum: null,
    expectedTables: ["world_player_cards"],
    fetchedTables: ["world_player_cards"],
  });
  const approval: ApprovalArtifact = {
    jobId: job.jobId,
    datasetChecksum: job.datasetChecksum,
    diffChecksum: computeDiffChecksum(diff),
    schemaVersion: job.schemaVersion,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: "nonce-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
    expectedCounts: { added: diff.addedCount, updated: diff.updatedCount, removedCandidate: diff.removedCount },
  };
  return {
    adapterConfig: baseConfig(),
    targetTable: "staging_world_player_cards",
    job,
    approval,
    now: new Date("2026-01-01T12:00:00.000Z"),
    diff,
    rollbackPlanPrepared: true,
    backupConfirmed: true,
    shadowComparisonPlanPrepared: true,
    lockAvailable: true,
    currentJobStatus: "idle",
    bypassFlagsDetected: [],
    ...overrides,
  };
}

describe("evaluateProductionPreApplyGates", () => {
  it("すべての条件を満たせば全ゲート合格", () => {
    const checks = evaluateProductionPreApplyGates(buildIntent());
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("承認artifactが無ければ拒否", () => {
    const checks = evaluateProductionPreApplyGates(buildIntent({ approval: null }));
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("rollback planが未準備なら拒否", () => {
    expect(evaluateProductionPreApplyGates(buildIntent({ rollbackPlanPrepared: false })).some((c) => !c.ok)).toBe(true);
  });

  it("backup未確認なら拒否", () => {
    expect(evaluateProductionPreApplyGates(buildIntent({ backupConfirmed: false })).some((c) => !c.ok)).toBe(true);
  });

  it("shadow comparison plan未準備なら拒否", () => {
    expect(evaluateProductionPreApplyGates(buildIntent({ shadowComparisonPlanPrepared: false })).some((c) => !c.ok)).toBe(true);
  });

  it("直前のジョブが実行中なら拒否", () => {
    expect(evaluateProductionPreApplyGates(buildIntent({ currentJobStatus: "running" })).some((c) => !c.ok)).toBe(true);
  });

  it("lockが利用可能と確認できていなければ拒否(unknownを含む)", () => {
    expect(evaluateProductionPreApplyGates(buildIntent({ lockAvailable: false })).some((c) => !c.ok)).toBe(true);
    expect(evaluateProductionPreApplyGates(buildIntent({ lockAvailable: "unknown" })).some((c) => !c.ok)).toBe(true);
  });

  it("bypass/forceフラグが検出されたら拒否", () => {
    expect(evaluateProductionPreApplyGates(buildIntent({ bypassFlagsDetected: ["--force"] })).some((c) => !c.ok)).toBe(true);
  });

  it("対象テーブルが利用者データなら拒否", () => {
    expect(evaluateProductionPreApplyGates(buildIntent({ targetTable: "my_team_snapshots" })).some((c) => !c.ok)).toBe(true);
  });
});

describe("buildProductionPreflightReport", () => {
  it("すべて満たせばready、実値(ホスト等)を含まない", () => {
    const report = buildProductionPreflightReport(buildIntent());
    expect(report.decision).toBe("ready");
    expect(report.blockingReasons).toEqual([]);
    expect(JSON.stringify(report)).not.toMatch(/supabase|postgres:\/\//i);
  });

  it("承認欠如や条件未達ならblockedとblockingReasonsが返る", () => {
    const report = buildProductionPreflightReport(buildIntent({ approval: null, backupConfirmed: false }));
    expect(report.decision).toBe("blocked");
    expect(report.blockingReasons.length).toBeGreaterThan(0);
    expect(report.approvalStatus).toBe("missing");
    expect(report.backupStatus).toBe("unconfirmed");
  });

  it("forbiddenUserDataTablesに利用者データテーブルが明記される", () => {
    const report = buildProductionPreflightReport(buildIntent());
    expect(report.forbiddenUserDataTables).toContain("auth.users");
    expect(report.forbiddenUserDataTables).toContain("my_team_snapshots");
    expect(report.forbiddenUserDataTables).toContain("rls_probe_records");
  });
});
