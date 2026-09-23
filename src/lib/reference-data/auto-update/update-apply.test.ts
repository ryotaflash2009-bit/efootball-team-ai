import { describe, it, expect } from "vitest";
import { applyUpdatePlans, applyUndoPlan, productionWriteLockKey, type ApplyInput, type ApplyPgClient } from "./update-apply";
import type { UpdateDiffPlan } from "./update-diff";

function recordingClient(user = "reference_data_updater"): ApplyPgClient & { sql: string[] } {
  const sql: string[] = [];
  return {
    sql,
    async query(s: string) {
      sql.push(s);
      if (s.startsWith("select current_user")) return { rows: [{ u: user }] };
      return { rows: [], rowCount: 0 };
    },
  };
}

const plan = { table: "world_player_cards", blockingReasons: [], removedCandidates: [], resurrected: [], inserts: [], updates: [], planChecksum: "0".repeat(64), report: { beforeChecksum: "0".repeat(64), afterChecksum: "0".repeat(64) } } as unknown as UpdateDiffPlan;
const input = (over: Partial<ApplyInput> = {}): ApplyInput =>
  ({
    schema: "reference_data_x_test",
    plans: [plan],
    candidate: { idempotencyKey: "1".repeat(64), sourceChecksum: "2".repeat(64) },
    prerequisites: {
      sourceFetched: false, sourceChecksum: "2".repeat(64), sourceChecksumAlreadyApplied: false, schemaValidated: true, diffGenerated: true, hardBlockCount: 0, manualReviewResolved: true,
      backup: { runId: null, category: null, conclusion: null, restoreVerified: false, storageVerified: false, rowCounts: null, completedAt: null },
      dryRun: { verified: false, startedAt: null, completedAt: null, shadowComparisonPassed: false },
      approval: { present: false, approvedAt: null, expiresAt: null, boundSourceChecksum: null, boundCommitSha: null },
      applyCommitSha: null, candidateIsLatest: true, superseded: false, concurrencyLockAcquired: true, duplicateBatchExists: false,
      rollbackPlanPrepared: true, updaterRoleVerified: true, productionPreflightPassed: true, now: "2026-09-23T00:00:00Z",
    },
    datasetVersion: "v1",
    approvedBy: "owner",
    sourceRowCounts: {},
    ...over,
  }) as ApplyInput;

describe("apply executorの事前ガード(DBへ何も送らない)", () => {
  it("前提条件を満たさなければ、session確認もtransactionも開始しない", async () => {
    const c = recordingClient();
    const r = await applyUpdatePlans(c, input());
    expect(r).toMatchObject({ ok: false, code: "prerequisites_failed" });
    expect(c.sql).toEqual([]);
  });

  it("隔離schema名・Production schema名以外は拒否する", async () => {
    for (const schema of ["public", "auth", "reference_data_ops", "reference_data_prod"]) {
      await expect(applyUpdatePlans(recordingClient(), input({ schema }))).rejects.toThrow();
      await expect(applyUndoPlan(recordingClient(), schema, { table: "world_player_cards", batchId: "b", restoreRows: [], insertedIdentities: [], beforeChecksum: "0" })).rejects.toThrow();
    }
  });

  it("updater以外のsessionではundoも書き込まない", async () => {
    const c = recordingClient("postgres");
    const r = await applyUndoPlan(c, "reference_data_x_test", { table: "world_player_cards", batchId: "b", restoreRows: [], insertedIdentities: [], beforeChecksum: "0" });
    expect(r).toMatchObject({ ok: false, code: "wrong_session_role" });
    expect(c.sql).toEqual(["select current_user::text as u"]);
  });

  it("advisory lock keyは決定的でbigint範囲", () => {
    expect(productionWriteLockKey()).toBe(productionWriteLockKey());
    expect(BigInt(productionWriteLockKey()) < 2n ** 63n).toBe(true);
  });
});
