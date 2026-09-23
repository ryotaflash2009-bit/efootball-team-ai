import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BACKUP_SUMMARY_ARTIFACT_SCHEMA, assertSummaryArtifactPath, buildBackupSummaryArtifact, serializeBackupSummaryArtifact } from "./backup-summary-artifact";

const WORKFLOW = readFileSync(path.resolve(__dirname, "..", "..", "..", "..", ".github", "workflows", "reference-data-production-backup.yml"), "utf8");
const NOW = new Date("2026-09-23T00:00:00.000Z");

describe("backup summary artifact", () => {
  it("許可リストの項目だけを残す(sourcePreflight・未知の項目は落とす)", () => {
    const a = buildBackupSummaryArtifact(
      { ok: true, reasons: [], summary: { phase: "upload", ok: true, rowCounts: { managers: 66 }, totalChecksum: "a".repeat(64), backupVersion: "2", sourcePreflight: [{ x: 1 }], connectionString: "postgres://x" } },
      NOW,
    );
    expect(a.schema).toBe(BACKUP_SUMMARY_ARTIFACT_SCHEMA);
    expect(Object.keys(a.summary).sort()).toEqual(["backupVersion", "ok", "phase", "rowCounts", "totalChecksum"]);
    expect(a.generatedAt).toBe("2026-09-23T00:00:00.000Z");
  });

  it("Secret値(1行・PEMの各行)が含まれていれば書き出さない", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ\n-----END CERTIFICATE-----";
    const leak = buildBackupSummaryArtifact({ ok: false, reasons: ["contains super-secret-token-value"], summary: {} }, NOW);
    expect(() => serializeBackupSummaryArtifact(leak, ["super-secret-token-value"])).toThrow(/Secret/);
    const leakPem = buildBackupSummaryArtifact({ ok: false, reasons: ["MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ"], summary: {} }, NOW);
    expect(() => serializeBackupSummaryArtifact(leakPem, [pem])).toThrow(/Secret/);
    const clean = buildBackupSummaryArtifact({ ok: true, reasons: [], summary: { ok: true } }, NOW);
    expect(serializeBackupSummaryArtifact(clean, ["super-secret-token-value", pem, "", undefined, "short"])).toContain('"ok": true');
  });

  it("出力先は.jsonだけ", () => {
    expect(assertSummaryArtifactPath("/tmp/reference-data-backup-summary.json")).toBe("/tmp/reference-data-backup-summary.json");
    expect(() => assertSummaryArtifactPath("/tmp/out.txt")).toThrow();
    expect(() => assertSummaryArtifactPath("/tmp/a\n.json")).toThrow();
  });

  it("workflowは要約だけをalways()でuploadし、payload・manifest本体・平文をuploadしない", () => {
    expect(WORKFLOW).toContain("REFERENCE_DATA_BACKUP_SUMMARY_PATH: ${{ runner.temp }}/reference-data-backup-summary.json");
    const uploads = WORKFLOW.match(/uses: actions\/upload-artifact@v4[\s\S]*?retention-days: \d+/g) ?? [];
    expect(uploads.length).toBe(1);
    expect(uploads[0]).toContain("path: ${{ runner.temp }}/reference-data-backup-summary.json");
    expect(uploads[0]).not.toMatch(/\*|plaintext|\.age|manifest/);
    expect(WORKFLOW).not.toMatch(/^\s*schedule\s*:/m);
    expect(WORKFLOW).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
  });
});
