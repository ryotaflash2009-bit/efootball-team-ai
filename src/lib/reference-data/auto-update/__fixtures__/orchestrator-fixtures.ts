import { buildBackupSummaryArtifact, serializeBackupSummaryArtifact } from "../backup-summary-artifact";

export const SHA = "0c48f5933af5b7700ec2f68345ddfdde4649cbf4";
export const SRC = "ed068757c5558d3f56b93e257e77735782833c871674bd6ff182a81e119237cd";
export const PLAN = "99fecb17517b79d0b4f63d1ad1abc7eecebe5259bca3ee27da7cfc7b9ba79b8b";

/** 2026-09-26 の World Plan Run #11 の要約と同じ形（値は同じ・行データなし）。 */
export function planSummary(patch: (p: Record<string, unknown>, f: Record<string, unknown>, s: Record<string, unknown>) => void = () => undefined): string {
  const plan: Record<string, unknown> = {
    targetTables: ["world_player_cards"], pageCount: 444, receivedRecordCount: 13297, beforeCount: 13297, afterCount: 13297,
    addedCount: 0, changedCount: 2, cardRatingOnlyChangedCount: 0, structuralChangedCount: 2, removedCount: 0, unchangedCount: 13295,
    duplicateCount: 0, invalidCount: 0, changedFieldFrequency: { ovr_max: 2, maximum_level: 2 }, sourceChecksum: SRC, planChecksum: PLAN,
    sourceTimestamps: { futureCount: 0, regression: false },
    policySeverity: "manual_review", findings: [{ severity: "manual_review", code: "baseline_missing" }, { severity: "warning", code: "preserved_column_drift" }],
    manualReviewCodes: ["baseline_missing"], planProblems: [],
  };
  const facts: Record<string, unknown> = { dataset: "world", commitSha: SHA, productionCounts: { world_player_cards: 13297, managers: 67, import_batches: 10 }, plan };
  const s: Record<string, unknown> = { ok: true, phase: "plan", reasons: [], facts };
  patch(plan, facts, s);
  return JSON.stringify(s);
}

export function backupSummary(patch: (s: Record<string, unknown>) => void = () => undefined, runId = "36248197028"): string {
  const s: Record<string, unknown> = {
    phase: "upload", ok: true, storageVerified: true,
    objectKey: `pre-apply/2026-09-26/gha-${runId}-1/34caddbe5571.age`, manifestKey: `pre-apply/2026-09-26/gha-${runId}-1/34caddbe5571.manifest.json`,
    jobId: `gha-${runId}-1`, category: "pre-apply", prefix: "pre-apply/", retentionCategory: "production-pre-apply", retentionDays: null, expiresAt: null,
    rowCounts: { world_player_cards: 13297, managers: 67, player_card_analysis: 19, import_batches: 10 },
    totalChecksum: "a".repeat(64), restoreVerified: true, encryptionAlgorithm: "age-x25519", backupVersion: "2",
    columnCoverage: {
      formatVersion: "2",
      columnCounts: { world_player_cards: 38, managers: 30, player_card_analysis: 18, import_batches: 13 },
      addedColumns: {
        "world_player_cards.appearance_updated_at": { included: true, rows: 13297, nonNullRows: 13297 },
        "world_player_cards.import_batch_id": { included: true, rows: 13297, nonNullRows: 13297 },
        "managers.import_batch_id": { included: true, rows: 67, nonNullRows: 67 },
        "player_card_analysis.import_batch_id": { included: true, rows: 19, nonNullRows: 19 },
      },
    },
  };
  patch(s);
  return serializeBackupSummaryArtifact(buildBackupSummaryArtifact({ ok: true, reasons: [], summary: s }, new Date("2026-09-26T14:28:00.000Z")), []);
}

export function dryRunSummary(patch: (f: Record<string, unknown>) => void = () => undefined): string {
  const facts: Record<string, unknown> = {
    dataset: "world", plan: { sourceChecksum: SRC, planChecksum: PLAN }, backupRunId: "36248197028",
    isolated: { verified: true, problems: [], dryRun: { verified: true, rediffChanges: 0, observedAfterChecksumMatches: true }, executor: { applyOk: true, auditBatchVerified: true, postVerifyOk: true }, undo: { ok: true } },
  };
  patch(facts);
  return JSON.stringify({ ok: true, phase: "dry-run", reasons: [], facts });
}
