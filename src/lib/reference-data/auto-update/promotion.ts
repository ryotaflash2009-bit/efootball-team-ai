import { createHash } from "node:crypto";
import type { GuardCheck } from "../real-import-guards";
import { computeRecordChecksum } from "./diff";
import type { ApprovalArtifact } from "./approval";
import type { StagingRecord } from "./types";
import { checkAllowedPromotionPair, checkPromotionOrderValid, PROMOTION_ORDER, PROMOTION_TABLE_SPECS } from "./promotion-sql";

/**
 * Phase 3(promotion検証): stagingデータセットを確定相当テーブルへ昇格するための
 * PromotionPlan(純関数、副作用なし)。
 *
 * `ApprovalArtifact`(人間の明示承認)とは別物として設計している理由: 承認artifactは
 * 「差分内容そのもの」への承認であり、PromotionPlanは「その承認内容を、どのテーブルへ
 * どの順序で、どのbackup/rollback手順とともに反映するか」という実行計画である。
 * 両者は`jobId`・`datasetChecksum`・`diffChecksum`・`schemaVersion`が完全一致しなければ
 * 拒否する(`validatePromotionPlanAgainstApproval`)。単純な`--yes`/`--force`のような
 * フラグだけでの昇格は、この一致検証そのものが存在しない設計を許可しない。
 */

export interface PromotionExpectedCounts {
  added: number;
  updated: number;
  unchanged: number;
  removedCandidate: number;
}

export interface PromotionPlan {
  jobId: string;
  schemaVersion: string;
  sourceIdentifier: string;
  /** この昇格ジョブが対象とする1本のstaging→確定テーブルの組(job.tsの1テーブル=1ジョブという既存モデルと一致させる)。 */
  sourceTable: string;
  targetTable: string;
  datasetChecksum: string;
  diffChecksum: string;
  /** 確定テーブル側で「更新される」行の、昇格前の状態に対するchecksum(追加される行は含まない)。明示rollback後にこの値と再一致することを確認する。 */
  beforeChecksum: string;
  expectedAfterChecksum: string;
  expectedCounts: PromotionExpectedCounts;
  /** 実装が許可している全テーブルの静的allowlist(このジョブ固有のsourceTable/targetTableとは別、防御的な自己申告)。 */
  allowedSourceTables: readonly string[];
  allowedTargetTables: readonly string[];
  promotionOrder: readonly string[];
  snapshotRequired: true;
  rollbackPlanId: string;
  approvalArtifactId: string;
  generatedAt: string;
  expiresAt: string;
}

/** データセット全体(複数レコード)から、安定した1つのchecksumを計算する(順序非依存)。 */
export function computeRecordSetChecksum(records: readonly StagingRecord[]): string {
  const perRecord = records
    .map((r) => ({ id: r.id, checksum: computeRecordChecksum(r.fields) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(perRecord)).digest("hex");
}

/**
 * `beforeChecksum`専用: `updated_at`列を除外してからchecksumを計算する。
 * `updated_at`はpromotion実行時・明示rollback実行時それぞれ別の`now`で上書きされる
 * orchestrator管理列であり、値そのものの一致を「正確な復元」の判定基準に含めると、
 * 実行タイミングの違いだけで常に不一致になってしまう(業務データ自体は正しく復元されていても)。
 */
export function computeBeforeStateChecksum(records: readonly StagingRecord[]): string {
  const stripped = records.map((r) => {
    const { updated_at: _updatedAt, ...rest } = r.fields as Record<string, unknown> & { updated_at?: unknown };
    return { id: r.id, fields: rest };
  });
  return computeRecordSetChecksum(stripped);
}

/** 承認artifactの内容から、PromotionPlanと突き合わせるための識別子を計算する(推測不可能な値ではなく、内容に対する決定的なfingerprint)。 */
export function computeApprovalArtifactId(approval: ApprovalArtifact): string {
  const stable = { jobId: approval.jobId, nonce: approval.nonce, approvedAt: approval.approvedAt, approvedBy: approval.approvedBy };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export interface BuildPromotionPlanInput {
  jobId: string;
  schemaVersion: string;
  sourceIdentifier: string;
  sourceTable: string;
  targetTable: string;
  datasetChecksum: string;
  diffChecksum: string;
  /** 確定テーブル側で「更新される」行(updated対象のみ、addedは含まない)の昇格前の状態。 */
  beforeRecords: readonly StagingRecord[];
  expectedAfterRecords: readonly StagingRecord[];
  expectedCounts: PromotionExpectedCounts;
  approval: ApprovalArtifact;
  generatedAt: string;
  expiresAt: string;
}

/** PromotionPlanを組み立てる(純関数)。rollbackPlanIdはjobIdから決定的に導出する(推測や乱数に依存しない)。 */
export function buildPromotionPlan(input: BuildPromotionPlanInput): PromotionPlan {
  return {
    jobId: input.jobId,
    schemaVersion: input.schemaVersion,
    sourceIdentifier: input.sourceIdentifier,
    sourceTable: input.sourceTable,
    targetTable: input.targetTable,
    datasetChecksum: input.datasetChecksum,
    diffChecksum: input.diffChecksum,
    beforeChecksum: computeBeforeStateChecksum(input.beforeRecords),
    expectedAfterChecksum: computeRecordSetChecksum(input.expectedAfterRecords),
    expectedCounts: input.expectedCounts,
    allowedSourceTables: PROMOTION_TABLE_SPECS.map((s) => s.sourceTable),
    allowedTargetTables: PROMOTION_TABLE_SPECS.map((s) => s.targetTable),
    promotionOrder: PROMOTION_ORDER,
    snapshotRequired: true,
    rollbackPlanId: `rollback-${input.jobId}`,
    approvalArtifactId: computeApprovalArtifactId(input.approval),
    generatedAt: input.generatedAt,
    expiresAt: input.expiresAt,
  };
}

/**
 * PromotionPlanとApprovalArtifactが完全一致しなければ拒否する(タスクの明示的要求)。
 * `--yes`/`--force`のような単純フラグでの昇格を防ぐための、内容ベースの多項目一致検証。
 */
export function validatePromotionPlanAgainstApproval(plan: PromotionPlan, approval: ApprovalArtifact): GuardCheck[] {
  const checks: GuardCheck[] = [];
  checks.push(
    plan.jobId === approval.jobId
      ? { ok: true }
      : { ok: false, reason: `PromotionPlanのjobIdが承認artifactと一致しない(plan:${plan.jobId}, approval:${approval.jobId})` },
  );
  checks.push(
    plan.datasetChecksum === approval.datasetChecksum
      ? { ok: true }
      : { ok: false, reason: "PromotionPlanのdatasetChecksumが承認artifactと一致しない" },
  );
  checks.push(
    plan.diffChecksum === approval.diffChecksum
      ? { ok: true }
      : { ok: false, reason: "PromotionPlanのdiffChecksumが承認artifactと一致しない" },
  );
  checks.push(
    plan.schemaVersion === approval.schemaVersion
      ? { ok: true }
      : { ok: false, reason: "PromotionPlanのschemaVersionが承認artifactと一致しない" },
  );
  const expectedArtifactId = computeApprovalArtifactId(approval);
  checks.push(
    plan.approvalArtifactId === expectedArtifactId
      ? { ok: true }
      : { ok: false, reason: "PromotionPlanのapprovalArtifactIdが承認artifactの内容から再計算した値と一致しない(承認後にplanが改変された可能性)" },
  );
  return checks;
}

export function checkPromotionPlanNotExpired(plan: PromotionPlan, now: Date): GuardCheck {
  const expiresAt = new Date(plan.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || now.getTime() >= expiresAt) {
    return { ok: false, reason: `PromotionPlanの有効期限が切れている(期限:${plan.expiresAt}, 現在:${now.toISOString()})` };
  }
  return { ok: true };
}

/**
 * PromotionPlanが宣言する対象テーブル一覧・順序・このジョブ固有のsourceTable/targetTableが、
 * 実装の許可リストと完全一致することを確認する(planの自己申告を信用しない)。
 */
export function checkPromotionPlanTablesAllowed(plan: PromotionPlan): GuardCheck[] {
  const checks: GuardCheck[] = [];
  checks.push(checkAllowedPromotionPair(plan.sourceTable, plan.targetTable));
  for (let i = 0; i < plan.allowedSourceTables.length; i += 1) {
    checks.push(checkAllowedPromotionPair(plan.allowedSourceTables[i], plan.allowedTargetTables[i]));
  }
  checks.push(checkPromotionOrderValid(plan.promotionOrder));
  return checks;
}

/**
 * stagingデータセットを実際に再計算したchecksumが、PromotionPlan生成時のdatasetChecksumと
 * 一致するかを確認する(承認後、promotion実行までの間にstagingが変化していないかの検出)。
 * `beforeChecksum`(確定テーブル側の昇格前状態)とは別物であることに注意。
 */
export function checkStagingChecksumUnchanged(plan: PromotionPlan, currentStagingChecksum: string): GuardCheck {
  if (plan.datasetChecksum !== currentStagingChecksum) {
    return { ok: false, reason: "stagingデータの現在のchecksumがPromotionPlanのdatasetChecksumと一致しない(承認後にデータが変化した可能性)" };
  }
  return { ok: true };
}
