import { describe, it, expect } from "vitest";
import {
  evaluateProductionBackupSecurityGate,
  decideProductionBackupSecurityGate,
  checkBackupCredentialSeparateFromApply,
  type ProductionBackupSecurityGateInput,
} from "./backup-production-security-gate";
import type { ProductionBackupGateInput } from "./backup-gate";

function baseGateTrue(): ProductionBackupGateInput {
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

/** 純粋にgateロジックを検証するための、全項目trueの合成fixture(Productionの現実の状態を主張するものではない)。 */
function allTrue(): ProductionBackupSecurityGateInput {
  return {
    ...baseGateTrue(),
    environmentApprovalGranted: true,
    readOnlyRoleConfirmed: true,
    secretScopeConfirmed: true,
    ageRecipientConfigured: true,
    storageDestinationConfirmed: true,
    retentionPolicyConfirmed: true,
    plaintextCleanupConfirmed: true,
    restoreTestDestinationConfirmed: true,
    emergencyRevokeProcedureConfirmed: true,
    credentialOwnerConfirmed: true,
    keyOwnerConfirmed: true,
  };
}

/**
 * このセッション終了時点の実際の状態(Secret・role・鍵・保管先のいずれも作成していない)を
 * そのまま表す fixture。新規11項目はすべてfalse。これがreadyにならないことを確認する。
 */
function currentActualState(): ProductionBackupSecurityGateInput {
  return {
    ...baseGateTrue(),
    environmentApprovalGranted: false,
    readOnlyRoleConfirmed: false,
    secretScopeConfirmed: false,
    ageRecipientConfigured: false,
    storageDestinationConfirmed: false,
    retentionPolicyConfirmed: false,
    plaintextCleanupConfirmed: false,
    restoreTestDestinationConfirmed: false,
    emergencyRevokeProcedureConfirmed: false,
    credentialOwnerConfirmed: false,
    keyOwnerConfirmed: false,
  };
}

describe("decideProductionBackupSecurityGate", () => {
  it("全28項目trueならready(純粋なゲートロジックの検証、Productionの現実を主張するものではない)", () => {
    expect(decideProductionBackupSecurityGate(allTrue())).toEqual({ decision: "ready", reasons: [] });
  });

  it("2026-09-20時点の実際の状態(Secret・role・鍵・保管先いずれも未作成)は必ずblockedになる", () => {
    const result = decideProductionBackupSecurityGate(currentActualState());
    expect(result.decision).toBe("blocked");
    expect(result.reasons.length).toBeGreaterThanOrEqual(11);
  });

  it("GitHub Environment承認が無ければblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), environmentApprovalGranted: false });
    expect(result.decision).toBe("blocked");
    expect(result.reasons.some((r) => r.includes("Environment"))).toBe(true);
  });

  it("read-only role未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), readOnlyRoleConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("Secret scope未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), secretScopeConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("age recipient未設定ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), ageRecipientConfigured: false });
    expect(result.decision).toBe("blocked");
  });

  it("storage destination未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), storageDestinationConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("retention policy未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), retentionPolicyConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("平文削除手順未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), plaintextCleanupConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("restore-test destination未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), restoreTestDestinationConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("emergency revoke手順未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), emergencyRevokeProcedureConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("credential owner未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), credentialOwnerConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("key owner未確認ならblocked", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), keyOwnerConfirmed: false });
    expect(result.decision).toBe("blocked");
  });

  it("既存17項目のいずれか(例: restoreTestSucceeded)が欠けていても引き続きblocked(既存ゲートを弱めていない)", () => {
    const result = decideProductionBackupSecurityGate({ ...allTrue(), restoreTestSucceeded: false });
    expect(result.decision).toBe("blocked");
  });

  it("評価される項目数は28件(既存17 + 追加11)", () => {
    expect(evaluateProductionBackupSecurityGate(allTrue()).length).toBe(28);
  });
});

describe("checkBackupCredentialSeparateFromApply", () => {
  it("Backup roleとapply roleが別名なら合格", () => {
    expect(checkBackupCredentialSeparateFromApply({ backupRoleName: "reference_data_backup_reader", applyRoleName: "reference_data_apply_writer" }).ok).toBe(true);
  });

  it("apply role未設定(null)でも、Backup role名が安全なら合格", () => {
    expect(checkBackupCredentialSeparateFromApply({ backupRoleName: "reference_data_backup_reader", applyRoleName: null }).ok).toBe(true);
  });

  it("Backup roleとapply roleが同一なら不合格", () => {
    expect(checkBackupCredentialSeparateFromApply({ backupRoleName: "shared_role", applyRoleName: "shared_role" }).ok).toBe(false);
  });

  it("Backup role名にpostgres(管理者)が含まれていれば不合格", () => {
    expect(checkBackupCredentialSeparateFromApply({ backupRoleName: "postgres", applyRoleName: null }).ok).toBe(false);
  });

  it("Backup role名にservice_roleが含まれていれば不合格", () => {
    expect(checkBackupCredentialSeparateFromApply({ backupRoleName: "service_role", applyRoleName: null }).ok).toBe(false);
  });
});
