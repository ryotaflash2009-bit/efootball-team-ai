import { describe, it, expect } from "vitest";
import { buildRollbackPlan, executeRollback } from "./rollback";
import type { QueryClient } from "./apply-orchestrator";

class FakeQueryClient implements QueryClient {
  calls: string[] = [];
  table: Record<string, string> = {};
  jobs: Record<string, { status: string }> = { "job-1": { status: "completed" } };
  appliedChecksums = new Set(["checksum-1"]);

  async query(sql: string, params: readonly unknown[] = []) {
    this.calls.push(sql.trim().split(/\s+/)[0].toLowerCase());
    if (/^insert into target_records/i.test(sql)) {
      const [id, fieldsJson] = params as [string, string];
      this.table[id] = fieldsJson;
    }
    if (/^delete from target_records/i.test(sql)) {
      const [id] = params as [string];
      delete this.table[id];
    }
    if (/^update update_jobs set status = 'rolled_back'/i.test(sql)) {
      const [, jobId] = params as [string, string];
      this.jobs[jobId] = { status: "rolled_back" };
    }
    if (/^delete from applied_checksums/i.test(sql)) {
      const [jobId] = params as [string];
      for (const c of this.appliedChecksums) if (jobId) this.appliedChecksums.delete(c);
    }
    return { rows: [] };
  }
}

describe("executeRollback", () => {
  it("beforeスナップショットへ復元し、追加行を削除し、jobをrolled_backにする", async () => {
    const client = new FakeQueryClient();
    client.table["wc-1"] = JSON.stringify({ ovrMax: 999 }); // 適用後の(誤った)状態
    client.table["wc-2"] = JSON.stringify({ ovrMax: 50 }); // このジョブが新規追加した行

    const plan = buildRollbackPlan("job-1", [{ id: "wc-1", fields: { ovrMax: 80 } }], ["wc-2"]);
    const result = await executeRollback(client, plan, new Date("2026-01-02T00:00:00.000Z"));

    expect(result.ok).toBe(true);
    expect(result.restoredCount).toBe(1);
    expect(result.removedCount).toBe(1);
    expect(JSON.parse(client.table["wc-1"])).toEqual({ ovrMax: 80 });
    expect(client.table["wc-2"]).toBeUndefined();
    expect(client.jobs["job-1"].status).toBe("rolled_back");
    expect(client.calls).toContain("commit");
    expect(client.calls).not.toContain("rollback");
  });

  it("失敗時はROLLBACKし、ok:falseを返す", async () => {
    const failingClient: QueryClient = {
      async query(sql: string) {
        if (/^insert into target_records/i.test(sql)) throw new Error("synthetic failure");
        return { rows: [] };
      },
    };
    const plan = buildRollbackPlan("job-1", [{ id: "wc-1", fields: { ovrMax: 80 } }], []);
    const result = await executeRollback(failingClient, plan, new Date());
    expect(result.ok).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
