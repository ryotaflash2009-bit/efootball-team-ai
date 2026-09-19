import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * `scripts/migration/reference-data-auto-update-dry-run.mjs`を実際に子プロセスとして起動し、
 * 「dry-run固定(--executeが存在しない)」「安全な候補はapply-candidateと判定」
 * 「schema異常・件数急減はrejectと判定」「いずれの場合も書込みを一切行わない」ことを確認する。
 *
 * 実Supabase・実ネットワークへは一切接続しない(すべてローカルの合成JSONフィクスチャのみ)。
 */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "migration", "reference-data-auto-update-dry-run.mjs");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "efb-auto-update-cli-"));
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

const SCHEMA = {
  idPattern: "^wc-\\d+$",
  requiredFields: ["nameEn"],
  numericRanges: [{ field: "ovrMax", min: 40, max: 99 }],
  knownFields: ["nameEn", "ovrMax"],
};

describe("reference-data-auto-update-dry-run.mjs(実CLI起動、実Supabase接続なし)", () => {
  it("--executeは存在せず、指定すると拒否して終了する", () => {
    const result = runCli(["--execute"]);
    expect(result.status).not.toBe(0);
  });

  it("安全な候補データはapply-candidateと判定し、writesPerformed:0を出力する", () => {
    const previous = { table: "world_player_cards", records: [{ id: "wc-1", checksum: "irrelevant-because-fields-differ" }] };
    const staging = {
      table: "world_player_cards",
      sourceMeta: { source: "efootball-world.com", sourceUrl: "https://efootball-world.com/x", fetchedAt: "2026-09-19T00:00:00.000Z", httpStatus: 200, contentType: "application/json", contentLength: 10 },
      records: [{ id: "wc-1", fields: { nameEn: "A", ovrMax: 80 } }],
    };
    const stagingPath = writeJson("staging-ok.json", staging);
    const previousPath = writeJson("previous-ok.json", previous);
    const schemaPath = writeJson("schema-ok.json", SCHEMA);

    const result = runCli(["--staging", stagingPath, "--previous", previousPath, "--schema", schemaPath]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("decision: apply-candidate");
    expect(result.stdout).toContain("writesPerformed: 0");
  });

  it("OVR異常(範囲外)を含む候補はrejectと判定し、非ゼロで終了する", () => {
    const previous = { table: "world_player_cards", records: [] };
    const staging = {
      table: "world_player_cards",
      sourceMeta: { source: "efootball-world.com", sourceUrl: "https://efootball-world.com/x", fetchedAt: "2026-09-19T00:00:00.000Z", httpStatus: 200, contentType: "application/json", contentLength: 10 },
      records: [{ id: "wc-1", fields: { nameEn: "A", ovrMax: 999 } }],
    };
    const stagingPath = writeJson("staging-bad-ovr.json", staging);
    const previousPath = writeJson("previous-empty.json", previous);
    const schemaPath = writeJson("schema-bad-ovr.json", SCHEMA);

    const result = runCli(["--staging", stagingPath, "--previous", previousPath, "--schema", schemaPath]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("decision: reject");
  });

  it("件数急減(大量削除相当)はrejectと判定する", () => {
    const previous = {
      table: "world_player_cards",
      records: Array.from({ length: 100 }, (_, i) => ({ id: `wc-${i + 1}`, checksum: "c" })),
    };
    const staging = {
      table: "world_player_cards",
      sourceMeta: { source: "efootball-world.com", sourceUrl: "https://efootball-world.com/x", fetchedAt: "2026-09-19T00:00:00.000Z", httpStatus: 200, contentType: "application/json", contentLength: 10 },
      records: [{ id: "wc-1", fields: { nameEn: "A", ovrMax: 80 } }],
    };
    const stagingPath = writeJson("staging-mass-delete.json", staging);
    const previousPath = writeJson("previous-100.json", previous);
    const schemaPath = writeJson("schema-mass-delete.json", SCHEMA);

    const result = runCli(["--staging", stagingPath, "--previous", previousPath, "--schema", schemaPath]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("decision: reject");
  });

  it("必須引数が欠けている場合はエラーで終了し、書込み処理へ到達しない", () => {
    const result = runCli([]);
    expect(result.status).not.toBe(0);
  });
});
