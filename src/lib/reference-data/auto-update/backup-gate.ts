import type { GuardCheck } from "../real-import-guards";

/**
 * Production apply前に要求する、Backup関連の最低要件をまとめたgate。
 *
 * **Backupを取得しただけではreadyにしない**: `restoreVerified`(実際に別の空schemaへ
 * Restoreし、Restore後checksumが一致したことの確認)を必須項目にしている。これは
 * [[reference-data-production-backup-design.md]]の設計方針そのものであり、
 * `production-preflight.ts`の`ProductionApplyIntent.backupConfirmed`(接続前preflightの
 * 既存ゲート)へは、このgateの`decision === "ready"`を渡すことを想定している
 * (`deriveBackupConfirmedFromGate`)。このファイル自体は`production-preflight.ts`を
 * 変更しない(既存の確定済みゲート構造はそのまま維持する)。
 */

export interface ProductionBackupGateInput {
  targetAllowlistConfirmed: boolean;
  backupCommandConfirmed: boolean;
  postgresClientVersionCompatible: boolean;
  readOnlySourceConnection: boolean;
  backupChecksumSucceeded: boolean;
  manifestGenerated: boolean;
  encryptionSucceeded: boolean;
  plaintextDeleted: boolean;
  storageUploadSucceeded: boolean;
  storageChecksumSucceeded: boolean;
  restoreTestSucceeded: boolean;
  restoreChecksumMatched: boolean;
  retentionConfigured: boolean;
  decryptionProcedureConfirmed: boolean;
  backupOwnerConfirmed: boolean;
  approvalArtifactMatches: boolean;
  rollbackPlanMatches: boolean;
}

export interface ProductionBackupGateResult {
  decision: "ready" | "blocked";
  reasons: string[];
}

const GATE_ITEMS: { key: keyof ProductionBackupGateInput; label: string }[] = [
  { key: "targetAllowlistConfirmed", label: "Backup target allowlist確定" },
  { key: "backupCommandConfirmed", label: "Backup command確定" },
  { key: "postgresClientVersionCompatible", label: "PostgreSQL client version適合" },
  { key: "readOnlySourceConnection", label: "read-only source connection" },
  { key: "backupChecksumSucceeded", label: "Backup checksum成功" },
  { key: "manifestGenerated", label: "manifest生成成功" },
  { key: "encryptionSucceeded", label: "encryption成功" },
  { key: "plaintextDeleted", label: "平文dump削除成功" },
  { key: "storageUploadSucceeded", label: "storage upload成功" },
  { key: "storageChecksumSucceeded", label: "storage checksum成功" },
  { key: "restoreTestSucceeded", label: "Restore試験成功" },
  { key: "restoreChecksumMatched", label: "Restore後checksum一致" },
  { key: "retentionConfigured", label: "retention設定済み" },
  { key: "decryptionProcedureConfirmed", label: "decryption手順確認済み" },
  { key: "backupOwnerConfirmed", label: "backup owner確認済み" },
  { key: "approvalArtifactMatches", label: "approval artifact一致" },
  { key: "rollbackPlanMatches", label: "rollback plan一致" },
];

export function evaluateProductionBackupGate(input: ProductionBackupGateInput): GuardCheck[] {
  return GATE_ITEMS.map(({ key, label }) => (input[key] ? { ok: true } : { ok: false, reason: `${label}が未完了` }));
}

export function decideProductionBackupGate(input: ProductionBackupGateInput): ProductionBackupGateResult {
  const checks = evaluateProductionBackupGate(input);
  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { decision: "blocked", reasons: failed.map((c) => c.reason ?? "理由不明") };
  }
  return { decision: "ready", reasons: [] };
}

/** このgateの結果を、`ProductionApplyIntent.backupConfirmed`へ渡すためのbooleanへ変換する。 */
export function deriveBackupConfirmedFromGate(result: ProductionBackupGateResult): boolean {
  return result.decision === "ready";
}
