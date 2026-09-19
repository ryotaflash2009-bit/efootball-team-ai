import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { computeDiffChecksum } from "./approval";
import { computeDiff } from "./diff";

/**
 * `scripts/migration/reference-data-auto-update-apply.mjs`を実際に子プロセスとして起動し、
 * 「禁止フラグは即座に拒否される」「Production接続コードが無い(--sqlite-dbのローカル
 * ファイルだけで完結する)」「承認artifactが一致する候補はcommitされ、実際にSQLiteへ
 * 反映される」「rollback-planでのundoが機能する」ことを確認する。
 *
 * 実Supabase・実ネットワークへは一切接続しない(すべてローカルの一時ファイルのみ)。
 */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "migration", "reference-data-auto-update-apply.mjs");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "efb-auto-update-apply-cli-"));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeJson(name: string, data: unknown): string {
  const p = path.join(tmpDir, name);
  writeFileSync(p, JSON.stringify(data), "utf8");
  return p;
}

function runCli(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH, ...args], { encoding: "utf8" });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? "", status: e.status ?? 1 };
  }
}

const SCHEMA = { idPattern: "^wc-\\d+$", requiredFields: ["nameEn"], knownFields: ["nameEn", "ovrMax"] };

function buildFixtures(prefix: string) {
  const previous = { table: "world_player_cards", records: [{ id: "wc-1", checksum: "irrelevant-because-updated" }] };
  const staging = {
    table: "world_player_cards",
    sourceMeta: { source: "efootball-world.com", sourceUrl: "https://efootball-world.com/x", fetchedAt: "2026-01-01T00:00:00.000Z", httpStatus: 200, contentType: "application/json", contentLength: 10 },
    records: [{ id: "wc-1", fields: { nameEn: "A", ovrMax: 80 } }],
  };
  const job = {
    jobId: `${prefix}-job`,
    table: "world_player_cards",
    schemaVersion: "v1",
    datasetChecksum: `${prefix}-checksum`,
  };
  // diffは previous(checksum不一致) → updatedとして扱われる想定。addedCount=0, updatedCount=1, removedCount=0。
  const approval: {
    jobId: string;
    datasetChecksum: string;
    schemaVersion: string;
    approvedAt: string;
    approvedBy: string;
    nonce: string;
    expiresAt: string;
    expectedCounts: { added: number; updated: number; removedCandidate: number };
    diffChecksum: string;
  } = {
    jobId: job.jobId,
    datasetChecksum: job.datasetChecksum,
    schemaVersion: job.schemaVersion,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: `${prefix}-nonce`,
    expiresAt: "2099-01-01T00:00:00.000Z",
    expectedCounts: { added: 0, updated: 1, removedCandidate: 0 },
    // diffChecksumは実行時にplanから計算される値と一致させる必要があるため、
    // テスト側でCLIを一度dry-runして得るのではなく、期待どおりの値をここで直接計算する。
    diffChecksum: "",
  };
  return { previous, staging, job, approval };
}

describe("reference-data-auto-update-apply.mjs(実CLI起動、実SQLite、実Supabase接続なし)", () => {
  it("禁止フラグ(--production)は即座に拒否される", () => {
    const result = runCli(["--production", "--sqlite-db", path.join(tmpDir, "x.sqlite")]);
    expect(result.status).not.toBe(0);
  });

  it("禁止フラグ(--force/--skip-validation/--no-lock/--no-rollback/--execute/--yes)は存在しない", () => {
    for (const flag of ["--force", "--skip-validation", "--no-lock", "--no-rollback", "--execute", "--yes"]) {
      const result = runCli([flag, "--sqlite-db", path.join(tmpDir, "x.sqlite")]);
      expect(result.status).not.toBe(0);
    }
  });

  it("--sqlite-dbが無ければ拒否される(Production接続経路が存在しないことの裏返し)", () => {
    const result = runCli(["--staging", "a", "--previous", "b", "--schema", "c", "--job", "d", "--approval", "e"]);
    expect(result.status).not.toBe(0);
  });

  it("承認artifactが正しく一致する候補はcommitされ、実際にSQLiteへ反映される", () => {
    const fixtures = buildFixtures("ok");
    const diff = computeDiff(fixtures.previous, fixtures.staging.records);
    fixtures.approval.diffChecksum = computeDiffChecksum(diff);

    const dbPath = path.join(tmpDir, "apply-ok.sqlite");
    const args = [
      "--sqlite-db", dbPath,
      "--staging", writeJson("staging-ok.json", fixtures.staging),
      "--previous", writeJson("previous-ok.json", fixtures.previous),
      "--schema", writeJson("schema-ok.json", SCHEMA),
      "--job", writeJson("job-ok.json", fixtures.job),
      "--approval", writeJson("approval-ok.json", fixtures.approval),
      "--max-increase-ratio", "1",
    ];
    const result = runCli(args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("decision: commit");

    const db = new DatabaseSync(dbPath);
    const row = db.prepare("select fields_json from target_records where record_id = 'wc-1'").get() as { fields_json: string };
    expect(JSON.parse(row.fields_json)).toEqual({ nameEn: "A", ovrMax: 80 });
    const jobRow = db.prepare("select status from update_jobs where job_id = ?").get(fixtures.job.jobId) as { status: string };
    expect(jobRow.status).toBe("completed");
    db.close();
  });

  it("承認artifactのchecksumが一致しない場合はrollbackし、書込みは行われない", () => {
    const fixtures = buildFixtures("bad");
    fixtures.approval.diffChecksum = "bogus-checksum-that-will-never-match";

    const dbPath = path.join(tmpDir, "apply-bad.sqlite");
    const args = [
      "--sqlite-db", dbPath,
      "--staging", writeJson("staging-bad.json", fixtures.staging),
      "--previous", writeJson("previous-bad.json", fixtures.previous),
      "--schema", writeJson("schema-bad.json", SCHEMA),
      "--job", writeJson("job-bad.json", fixtures.job),
      "--approval", writeJson("approval-bad.json", fixtures.approval),
      "--max-increase-ratio", "1",
    ];
    const result = runCli(args);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("decision: rollback");

    const db = new DatabaseSync(dbPath);
    const row = db.prepare("select 1 from target_records where record_id = 'wc-1'").get();
    expect(row).toBeUndefined();
    db.close();
  });

  it("--rollback-planで成功適用後の明示rollbackができる", () => {
    const fixtures = buildFixtures("rb");
    const diff = computeDiff(fixtures.previous, fixtures.staging.records);
    fixtures.approval.diffChecksum = computeDiffChecksum(diff);

    const dbPath = path.join(tmpDir, "apply-rollback.sqlite");
    runCli([
      "--sqlite-db", dbPath,
      "--staging", writeJson("staging-rb.json", fixtures.staging),
      "--previous", writeJson("previous-rb.json", fixtures.previous),
      "--schema", writeJson("schema-rb.json", SCHEMA),
      "--job", writeJson("job-rb.json", fixtures.job),
      "--approval", writeJson("approval-rb.json", fixtures.approval),
      "--max-increase-ratio", "1",
    ]);

    const rollbackPlan = { jobId: fixtures.job.jobId, beforeSnapshot: [], addedIds: ["wc-1"] };
    const result = runCli(["--sqlite-db", dbPath, "--rollback-plan", writeJson("rollback-plan.json", rollbackPlan)]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok: true");

    const db = new DatabaseSync(dbPath);
    const row = db.prepare("select 1 from target_records where record_id = 'wc-1'").get();
    expect(row).toBeUndefined();
    db.close();
  });
});
