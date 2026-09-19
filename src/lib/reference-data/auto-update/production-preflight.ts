import { createHash } from "node:crypto";
import { decideCommitOrRollback, sanitizeErrorMessage, type GuardCheck } from "../real-import-guards";
import { validateApproval, type ApprovalArtifact } from "./approval";
import type { UpdateJob } from "./job";

/**
 * Production向け参照データ自動更新の安全境界(設計のみ、接続処理は未実装)。
 *
 * **このファイルには実Supabase・実PostgreSQLへの接続コードが一切含まれない。**
 * `createProductionAdapter()`は常に例外を投げる(意図的な未実装)。ここにあるのは、
 * 将来Production接続を有効化する場合に「接続前に必ず拒否できる」ゲート判定と、
 * 判定結果をまとめたpreflightレポートの生成だけである。
 *
 * ログ出力に関する方針: ホスト名・接続文字列・パスワード・トークンは、このファイルの
 * どの関数にも引数として渡さない設計にしている(fingerprint済みの値だけを扱う)。
 */

const REQUIRED_SCHEMA = "reference_data_ops";

/** 生の識別子(ホスト名・DB名等)を、ログへ出しても安全な短いfingerprintへ変換する。 */
export function fingerprintIdentifier(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export type ProductionCallerContext = "cli" | "vercel-runtime" | "client" | "public-endpoint" | "cron";

export interface ProductionAdapterConfig {
  productionModeExplicitlyEnabled: boolean;
  calledFrom: ProductionCallerContext;
  targetSchema: string;
  databaseFingerprint: string;
  expectedDatabaseFingerprint: string;
  ssl: boolean;
  certificateValidationEnabled: boolean;
}

/** Production接続を実際に確立する処理。**意図的に未実装。** */
export function createProductionAdapter(): never {
  throw new Error(
    "createProductionAdapter()は実装されていない(意図的な未実装、設計フェーズのみ)。" +
      "Production接続を有効化するには、別途の独立した承認・実装・レビューが必要。",
  );
}

export function checkProductionModeExplicit(config: ProductionAdapterConfig): GuardCheck {
  if (!config.productionModeExplicitlyEnabled) {
    return { ok: false, reason: "Production modeが明示的に有効化されていない" };
  }
  return { ok: true };
}

/** Vercelランタイム・クライアント・公開エンドポイント・Cronからの直接applyを拒否する。 */
export function checkCalledFromAllowedContext(config: ProductionAdapterConfig): GuardCheck {
  if (config.calledFrom !== "cli") {
    return {
      ok: false,
      reason: `許可されていない呼び出し元: ${config.calledFrom}(Production applyは本人操作のCLIからのみ許可、Vercelランタイム・クライアント・公開エンドポイント・Cronからは呼び出せない設計)`,
    };
  }
  return { ok: true };
}

export function checkTargetSchema(config: ProductionAdapterConfig): GuardCheck {
  if (config.targetSchema !== REQUIRED_SCHEMA) {
    return { ok: false, reason: `対象schemaが${REQUIRED_SCHEMA}と一致しない: ${config.targetSchema}` };
  }
  return { ok: true };
}

/** 接続先が期待したデータベースと一致するかを、fingerprintだけで比較する(生の識別子は扱わない)。 */
export function checkDatabaseFingerprintMatches(config: ProductionAdapterConfig): GuardCheck {
  if (config.databaseFingerprint !== config.expectedDatabaseFingerprint) {
    return { ok: false, reason: "接続先データベースのfingerprintが期待値と一致しない" };
  }
  return { ok: true };
}

export function checkSslRequired(config: ProductionAdapterConfig): GuardCheck {
  if (!config.ssl) return { ok: false, reason: "SSL接続が有効化されていない" };
  return { ok: true };
}

export function checkCertificateValidation(config: ProductionAdapterConfig): GuardCheck {
  if (!config.certificateValidationEnabled) return { ok: false, reason: "certificate validationが無効化されている" };
  return { ok: true };
}

/** reference_data_ops配下で書込みが許可されるテーブルの許可リスト。 */
export const PRODUCTION_OPS_ALLOWED_TABLES = [
  "update_jobs",
  "approvals",
  "applied_checksums",
  "audit_events",
  "staging_world_player_cards",
  "staging_managers",
  "staging_player_card_analysis",
  "before_snapshots",
  "rollback_jobs",
  "source_metadata_snapshots",
] as const;

const FORBIDDEN_USER_DATA_PATTERNS = [/auth\.users/i, /my_team_snapshots/i, /rls_probe_records/i];

export function checkAllowedOpsTable(table: string): GuardCheck {
  if (FORBIDDEN_USER_DATA_PATTERNS.some((re) => re.test(table))) {
    return { ok: false, reason: `利用者データテーブルは対象にできない: ${table}` };
  }
  if (!(PRODUCTION_OPS_ALLOWED_TABLES as readonly string[]).includes(table)) {
    return { ok: false, reason: `reference_data_ops許可リスト外のテーブル: ${table}` };
  }
  return { ok: true };
}

export interface ProductionApplyIntent {
  adapterConfig: ProductionAdapterConfig;
  targetTable: string;
  job: UpdateJob;
  approval: ApprovalArtifact | null;
  now: Date;
  diff: Parameters<typeof validateApproval>[2];
  rollbackPlanPrepared: boolean;
  backupConfirmed: boolean;
  shadowComparisonPlanPrepared: boolean;
  lockAvailable: boolean | "unknown";
  currentJobStatus: "idle" | "running" | "completed" | "failed";
  /** 検出されたbypass/force系フラグ。空配列であることを要求する。 */
  bypassFlagsDetected: readonly string[];
}

/** 接続前preflight: 純粋関数だけで拒否できる項目をすべて評価する。 */
export function evaluateProductionPreApplyGates(intent: ProductionApplyIntent): GuardCheck[] {
  const checks: GuardCheck[] = [
    checkProductionModeExplicit(intent.adapterConfig),
    checkCalledFromAllowedContext(intent.adapterConfig),
    checkTargetSchema(intent.adapterConfig),
    checkDatabaseFingerprintMatches(intent.adapterConfig),
    checkSslRequired(intent.adapterConfig),
    checkCertificateValidation(intent.adapterConfig),
    checkAllowedOpsTable(intent.targetTable),
    {
      ok: intent.approval !== null,
      reason: intent.approval !== null ? undefined : "承認artifactが存在しない",
    },
    {
      ok: intent.rollbackPlanPrepared,
      reason: intent.rollbackPlanPrepared ? undefined : "rollback planが用意されていない",
    },
    {
      ok: intent.backupConfirmed,
      reason: intent.backupConfirmed ? undefined : "backup確認が完了していない",
    },
    {
      ok: intent.shadowComparisonPlanPrepared,
      reason: intent.shadowComparisonPlanPrepared ? undefined : "shadow comparison planが用意されていない",
    },
    {
      ok: intent.currentJobStatus !== "running",
      reason: intent.currentJobStatus !== "running" ? undefined : "直前のジョブが実行中のため中止(二重実行防止)",
    },
    {
      ok: intent.lockAvailable === true,
      reason: intent.lockAvailable === true ? undefined : `lockが利用可能と確認できていない(状態: ${intent.lockAvailable})`,
    },
    {
      ok: intent.bypassFlagsDetected.length === 0,
      reason: intent.bypassFlagsDetected.length === 0 ? undefined : `bypass/force系フラグが検出された: ${intent.bypassFlagsDetected.join(", ")}`,
    },
  ];

  if (intent.approval) {
    checks.push(...validateApproval(intent.approval, intent.job, intent.diff, intent.now));
  }

  return checks;
}

export interface ProductionPreflightReport {
  environment: "production";
  targetSchemaFingerprint: string;
  databaseFingerprint: string;
  schemaVersion: string;
  expectedSchema: string;
  requiredTables: readonly string[];
  forbiddenUserDataTables: readonly string[];
  allowedWriteTables: readonly string[];
  currentJobStatus: ProductionApplyIntent["currentJobStatus"];
  lockAvailable: ProductionApplyIntent["lockAvailable"];
  checksumStatus: "matched" | "mismatched-or-missing";
  approvalStatus: "present" | "missing";
  backupStatus: "confirmed" | "unconfirmed";
  rollbackReadiness: "ready" | "not-ready";
  shadowComparisonReadiness: "ready" | "not-ready";
  decision: "ready" | "blocked";
  blockingReasons: readonly string[];
}

/** 接続前preflightの結果を、実値(ホスト・URL・パスワード等)を含めずにレポート化する。 */
export function buildProductionPreflightReport(intent: ProductionApplyIntent): ProductionPreflightReport {
  const checks = evaluateProductionPreApplyGates(intent);
  const decision = decideCommitOrRollback(checks);
  const approvalChecksOk = intent.approval !== null && checks.every((c) => c.ok);

  return {
    environment: "production",
    targetSchemaFingerprint: fingerprintIdentifier(intent.adapterConfig.targetSchema),
    databaseFingerprint: intent.adapterConfig.databaseFingerprint,
    schemaVersion: intent.job.schemaVersion,
    expectedSchema: REQUIRED_SCHEMA,
    requiredTables: PRODUCTION_OPS_ALLOWED_TABLES,
    forbiddenUserDataTables: ["auth.users", "my_team_snapshots", "rls_probe_records"],
    allowedWriteTables: PRODUCTION_OPS_ALLOWED_TABLES,
    currentJobStatus: intent.currentJobStatus,
    lockAvailable: intent.lockAvailable,
    checksumStatus: intent.approval !== null && approvalChecksOk ? "matched" : "mismatched-or-missing",
    approvalStatus: intent.approval !== null ? "present" : "missing",
    backupStatus: intent.backupConfirmed ? "confirmed" : "unconfirmed",
    rollbackReadiness: intent.rollbackPlanPrepared ? "ready" : "not-ready",
    shadowComparisonReadiness: intent.shadowComparisonPlanPrepared ? "ready" : "not-ready",
    decision: decision.decision === "commit" ? "ready" : "blocked",
    blockingReasons: decision.reasons.map((r) => sanitizeErrorMessage(r)),
  };
}
