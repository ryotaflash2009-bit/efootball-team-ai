import { evaluateAutoApplyPolicy, type AutoApplyPolicyInput, type AutoApplyPolicyResult } from "./auto-apply-policy";
import { AUTO_APPLY_POLICY } from "./auto-apply-policy-config";
import { evaluateBackupGate, evaluateDryRunGate, evaluatePlanGate, type Dataset } from "./update-orchestrator";

/**
 * run の非秘密の要約 artifact から自動 Apply の判定を作る（orchestrator と、自動の Apply job の中の再確認で同じものを使う）。
 * Plan・Backup・Dry run の関門のどれかが不合格なら、その理由で AUTO_APPLY_BLOCKED にする（policy には進めない）。
 */
export interface ArtifactInputs {
  dataset: Dataset;
  bindingSha: string;
  currentMainSha: string;
  detectionChecksum12: string | null;
  appliedChecksum12: string | null;
  planSummaryText: string;
  backupSummaryText: string;
  backupRunId: string;
  backupCompletedAt: string;
  dryRunSummaryText: string;
  dryRunRunId: string;
  now: string;
  readiness?: AutoApplyPolicyInput["readiness"];
}

const READY = { postVerifier: true, evidence: true, notification: true, cleanup: true } as const;

function blockedByGate(dataset: Dataset, reasons: string[], a: ArtifactInputs): AutoApplyPolicyResult {
  return {
    contractVersion: AUTO_APPLY_POLICY.version, dataset, decision: "AUTO_APPLY_BLOCKED", reasonCodes: reasons, thresholdResults: [],
    allowedOperations: [], blockedOperations: ["all writes"], expectedWrites: "none", expectedAfterCount: null,
    bindingSha: a.bindingSha, sourceChecksum: null, planChecksum: null, backupRunId: a.backupRunId, dryRunRunId: a.dryRunRunId, evaluatedAt: a.now,
  };
}

export function evaluateAutoApplyFromArtifacts(a: ArtifactInputs): AutoApplyPolicyResult {
  const pg = evaluatePlanGate(a.planSummaryText, a.dataset, a.bindingSha);
  if (!pg.ok) return blockedByGate(a.dataset, pg.reasons.map((r) => `gate:${r}`), a);
  const plan = pg.value;
  const bg = evaluateBackupGate(a.backupSummaryText, a.backupRunId, plan.productionCounts);
  if (!bg.ok) return blockedByGate(a.dataset, bg.reasons.map((r) => `gate:${r}`), a);
  const dg = evaluateDryRunGate(a.dryRunSummaryText, plan, a.backupRunId);
  if (!dg.ok) return blockedByGate(a.dataset, dg.reasons.map((r) => `gate:${r}`), a);
  let encrypted = false;
  try {
    const s = JSON.parse(a.backupSummaryText) as { summary?: { encryptionAlgorithm?: unknown } };
    encrypted = s.summary?.encryptionAlgorithm === "age-x25519";
  } catch {
    encrypted = false;
  }
  return evaluateAutoApplyPolicy({
    dataset: a.dataset,
    bindingSha: a.bindingSha,
    currentMainSha: a.currentMainSha,
    detectionChecksum12: a.detectionChecksum12,
    appliedChecksum12: a.appliedChecksum12,
    plan: {
      commitSha: plan.commitSha, sourceChecksum: plan.sourceChecksum, planChecksum: plan.planChecksum, targetTables: plan.targetTables,
      beforeCount: plan.beforeCount, afterCount: plan.afterCount, added: plan.added, changed: plan.changed, removed: plan.removed,
      duplicate: plan.duplicate, invalid: plan.invalid, cardRatingOnlyChanged: plan.cardRatingOnlyChanged, structuralChanged: plan.structuralChanged,
      changedFields: plan.changedFields, manualReviewCodes: plan.manualReviewCodes, futureTimestamps: plan.futureTimestamps,
      timestampRegression: plan.timestampRegression, findings: plan.findings, productionCounts: plan.productionCounts,
    },
    backup: {
      runId: a.backupRunId, valid: true, encrypted, restoreVerified: bg.value.restoreVerified, storageVerified: bg.value.storageVerified,
      rowCounts: bg.value.rowCounts, completedAt: a.backupCompletedAt,
    },
    // Dry run の関門を通った = verified・re-diff 0・after checksum 一致・source / plan checksum が Plan と一致。
    dryRun: { runId: a.dryRunRunId, ok: true, rediff: dg.value.rediffChanges, sourceChecksum: plan.sourceChecksum, planChecksum: plan.planChecksum },
    readiness: a.readiness ?? READY,
    now: a.now,
  });
}
