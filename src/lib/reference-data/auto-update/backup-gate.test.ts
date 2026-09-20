import { describe, it, expect } from "vitest";
import { evaluateProductionBackupGate, decideProductionBackupGate, deriveBackupConfirmedFromGate, type ProductionBackupGateInput } from "./backup-gate";

function allTrue(): ProductionBackupGateInput {
  return {
    targetAllowlistConfirmed: true,
    backupCommandConfirmed: true,
    postgresClientVersionCompatible: true,
    readOnlySourceConnection: true,
    backupChecksumSucceeded: true,
    manifestGenerated: true,
    encryptionSucceeded: true,
    plaintextDeleted: true,
    storageUploadSucceeded: true,
    storageChecksumSucceeded: true,
    restoreTestSucceeded: true,
    restoreChecksumMatched: true,
    retentionConfigured: true,
    decryptionProcedureConfirmed: true,
    backupOwnerConfirmed: true,
    approvalArtifactMatches: true,
    rollbackPlanMatches: true,
  };
}

describe("decideProductionBackupGate", () => {
  it("全項目trueならready", () => {
    expect(decideProductionBackupGate(allTrue())).toEqual({ decision: "ready", reasons: [] });
  });

  it("Backupを取得しただけ(restoreTestSucceeded/restoreChecksumMatchedが未実施)ではreadyにしない", () => {
    const input = { ...allTrue(), restoreTestSucceeded: false, restoreChecksumMatched: false };
    const result = decideProductionBackupGate(input);
    expect(result.decision).toBe("blocked");
    expect(result.reasons.some((r) => r.includes("Restore試験"))).toBe(true);
  });

  it("暗号化未完了ならblocked", () => {
    const result = decideProductionBackupGate({ ...allTrue(), encryptionSucceeded: false });
    expect(result.decision).toBe("blocked");
  });

  it("平文dump削除未完了ならblocked", () => {
    const result = decideProductionBackupGate({ ...allTrue(), plaintextDeleted: false });
    expect(result.decision).toBe("blocked");
  });

  it("1項目でも不足していればblockedとなり、理由に含まれる", () => {
    const result = decideProductionBackupGate({ ...allTrue(), backupOwnerConfirmed: false });
    expect(result.decision).toBe("blocked");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("評価される項目数は17件", () => {
    const checks = evaluateProductionBackupGate(allTrue());
    expect(checks.length).toBe(17);
  });
});

describe("deriveBackupConfirmedFromGate", () => {
  it("ready -> true", () => {
    expect(deriveBackupConfirmedFromGate({ decision: "ready", reasons: [] })).toBe(true);
  });

  it("blocked -> false", () => {
    expect(deriveBackupConfirmedFromGate({ decision: "blocked", reasons: ["x"] })).toBe(false);
  });
});
