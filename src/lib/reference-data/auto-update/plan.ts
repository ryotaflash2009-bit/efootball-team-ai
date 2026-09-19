import { decideCommitOrRollback, type GuardCheck } from "../real-import-guards";
import { findDuplicateIds, validateStagingRecords, type RecordSchemaConfig } from "./schema-validation";
import { computeDiff } from "./diff";
import { evaluateDiffGates, checkNoUnknownFields, type DiffGateThresholds } from "./safety-gates";
import type { PreviousSnapshot, StagingDataset } from "./types";

/**
 * 参照データ自動更新の「更新計画」を生成する純関数(Phase 1: dry-run専用)。
 *
 * この関数自体はネットワーク・DBへ一切接続せず、書込みも行わない(writesPerformedは常に0)。
 * 呼び出し側(将来のPhase 2実装)が、この計画の`decision`が"apply-candidate"の場合に限り、
 * 人の承認を経てから実際の適用処理を別途実行する。
 */
export interface UpdatePlanInput {
  staging: StagingDataset;
  previous: PreviousSnapshot;
  schemaConfig: RecordSchemaConfig;
  diffThresholds: DiffGateThresholds;
  /** 追加の任意ゲート(呼び出し側でロック取得状況・ジョブ実行状況等を判定した結果を渡す)。 */
  extraGates?: readonly GuardCheck[];
}

export interface UpdatePlan {
  table: string;
  decision: "apply-candidate" | "reject";
  reasons: string[];
  schemaValidCount: number;
  schemaInvalidCount: number;
  duplicateIds: string[];
  unknownFields: readonly string[];
  diff: ReturnType<typeof computeDiff>;
  writesPerformed: 0;
}

export function generateUpdatePlan(input: UpdatePlanInput): UpdatePlan {
  const { staging, previous, schemaConfig, diffThresholds, extraGates = [] } = input;

  const schemaResult = validateStagingRecords(staging.records, schemaConfig);
  const duplicateIds = findDuplicateIds(staging.records);
  const diff = computeDiff(previous, staging.records);

  const checks: GuardCheck[] = [
    { ok: schemaResult.ok, reason: schemaResult.ok ? undefined : `schema validation失敗: ${schemaResult.issues.length}件` },
    { ok: duplicateIds.length === 0, reason: duplicateIds.length === 0 ? undefined : `重複IDを検出: ${duplicateIds.length}件` },
    checkNoUnknownFields(schemaResult.unknownFields),
    ...evaluateDiffGates(diff, diffThresholds),
    ...extraGates,
  ];

  const commitDecision = decideCommitOrRollback(checks);

  return {
    table: staging.table,
    decision: commitDecision.decision === "commit" ? "apply-candidate" : "reject",
    reasons: commitDecision.reasons,
    schemaValidCount: schemaResult.validCount,
    schemaInvalidCount: schemaResult.invalidCount,
    duplicateIds,
    unknownFields: schemaResult.unknownFields,
    diff,
    writesPerformed: 0,
  };
}
