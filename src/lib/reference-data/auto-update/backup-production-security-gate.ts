import type { GuardCheck } from "../real-import-guards";
import { evaluateProductionBackupGate, type ProductionBackupGateInput, type ProductionBackupGateResult } from "./backup-gate";

/**
 * Production Backupを実際に取得してよいかどうかの、既存17項目([[backup-gate.ts]])に
 * 加えた追加11項目。既存gateを置き換えず合成する(既存の確定済みロジックはそのまま維持)。
 *
 * このファイルはこのセッションでは常に`false`側の入力でしかテストしていない。
 * 実Secret・実role・実鍵・実保管先のいずれもこのセッションでは作成していないため、
 * 「今のところ現実にreadyになりうる状態」は一切存在しない。
 */

export interface ProductionBackupSecurityGateInput extends ProductionBackupGateInput {
  /** GitHub Environmentでの本人承認(workflow_dispatch実行時の必須承認)が得られているか。 */
  environmentApprovalGranted: boolean;
  /** Backup専用のread-only PostgreSQL role(対象4テーブルSELECTのみ)が確認されているか。管理者資格情報・service role keyの流用ではないこと。 */
  readOnlyRoleConfirmed: boolean;
  /** 各Secretの内容種類・読み取り権限・利用workflowが、このBackup workflow専用のscopeに限定されていることを確認済みか。 */
  secretScopeConfirmed: boolean;
  /** age公開鍵(暗号化専用、復号能力を持たない)がBackup workflowへ設定されているか。 */
  ageRecipientConfigured: boolean;
  /** 暗号化済みBackupの保管先(GitHub Artifact以外を含む、単一障害点を避けた構成)が確認されているか。 */
  storageDestinationConfirmed: boolean;
  /** retention区分・expiresAt・削除主体・削除監査が確定しているか。 */
  retentionPolicyConfirmed: boolean;
  /** 暗号化成功後、平文dumpが確実に削除される手順が確認されているか。 */
  plaintextCleanupConfirmed: boolean;
  /** Restore試験の実行先が、Productionとは別の隔離環境であることが確認されているか。 */
  restoreTestDestinationConfirmed: boolean;
  /** 鍵漏洩・Secret漏洩時の緊急失効(revoke)手順が文書化・確認されているか。 */
  emergencyRevokeProcedureConfirmed: boolean;
  /** Backup専用read-only資格情報の所有者(誰が発行・更新責任を持つか)が明確か。 */
  credentialOwnerConfirmed: boolean;
  /** age鍵ペアの所有者(秘密鍵を保持する本人)が明確か。 */
  keyOwnerConfirmed: boolean;
}

const SECURITY_GATE_ITEMS: { key: keyof Omit<ProductionBackupSecurityGateInput, keyof ProductionBackupGateInput>; label: string }[] = [
  { key: "environmentApprovalGranted", label: "GitHub Environmentの本人承認" },
  { key: "readOnlyRoleConfirmed", label: "read-only role確認済み(管理者資格情報・service role keyの流用ではない)" },
  { key: "secretScopeConfirmed", label: "Secret scope確認済み" },
  { key: "ageRecipientConfigured", label: "age公開鍵(recipient)設定済み" },
  { key: "storageDestinationConfirmed", label: "storage destination確認済み" },
  { key: "retentionPolicyConfirmed", label: "retention policy確認済み" },
  { key: "plaintextCleanupConfirmed", label: "平文削除手順確認済み" },
  { key: "restoreTestDestinationConfirmed", label: "restore-test destination確認済み(Production非依存)" },
  { key: "emergencyRevokeProcedureConfirmed", label: "emergency revoke手順確認済み" },
  { key: "credentialOwnerConfirmed", label: "credential owner確認済み" },
  { key: "keyOwnerConfirmed", label: "key owner確認済み" },
];

/** 既存17項目 + 追加11項目 = 28項目すべてを評価する。 */
export function evaluateProductionBackupSecurityGate(input: ProductionBackupSecurityGateInput): GuardCheck[] {
  const baseChecks = evaluateProductionBackupGate(input);
  const securityChecks = SECURITY_GATE_ITEMS.map(({ key, label }) =>
    input[key] ? { ok: true } : { ok: false, reason: `${label}が未完了` },
  );
  return [...baseChecks, ...securityChecks];
}

export function decideProductionBackupSecurityGate(input: ProductionBackupSecurityGateInput): ProductionBackupGateResult {
  const checks = evaluateProductionBackupSecurityGate(input);
  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { decision: "blocked", reasons: failed.map((c) => c.reason ?? "理由不明") };
  }
  return { decision: "ready", reasons: [] };
}

/**
 * Backup専用read-only資格情報とProduction apply用資格情報が別物であることを確認する。
 * 同一の接続文字列・同一のrole名を使い回す設計を拒否する(責務分離の構造的な強制)。
 */
export function checkBackupCredentialSeparateFromApply(input: {
  backupRoleName: string;
  applyRoleName: string | null;
}): GuardCheck {
  if (input.applyRoleName !== null && input.backupRoleName === input.applyRoleName) {
    return { ok: false, reason: "Backup専用roleがProduction apply用roleと同一(責務分離違反)" };
  }
  if (/service_role|postgres/i.test(input.backupRoleName)) {
    return { ok: false, reason: "Backup roleに管理者資格情報・service role keyらしき名前が使われている" };
  }
  return { ok: true };
}
