import { describe, it, expect } from "vitest";
import path from "node:path";
import { BACKUP_V2_ADDED_COLUMNS, buildColumnCoverageSql } from "./backup-column-coverage";
import { buildBackupSummaryArtifact, serializeBackupSummaryArtifact } from "./backup-summary-artifact";
import { RUN7_BASELINE_ROW_COUNTS, validateBackupV2Summary } from "./backup-v2-summary-validator";
import { parseExpectedCounts, resolveSummaryPath } from "./backup-v2-summary-validator-cli";

/** Backup v2 workflow(category pre-apply)が成功した場合の要約artifactと同じ形(値は架空)。 */
function validSummary(): Record<string, unknown> {
  return {
    phase: "upload",
    ok: true,
    storageVerified: true,
    objectKey: "pre-apply/2026-09-24/gha-36000000000-1/0123456789ab.age",
    manifestKey: "pre-apply/2026-09-24/gha-36000000000-1/0123456789ab.manifest.json",
    jobId: "gha-36000000000-1",
    category: "pre-apply",
    prefix: "pre-apply/",
    retentionCategory: "production-pre-apply",
    retentionDays: null,
    expiresAt: null,
    rowCounts: { ...RUN7_BASELINE_ROW_COUNTS },
    totalChecksum: "a".repeat(64),
    restoreVerified: true,
    encryptionAlgorithm: "age-x25519",
    backupVersion: "2",
    columnCoverage: {
      formatVersion: "2",
      columnCounts: { world_player_cards: 38, managers: 30, player_card_analysis: 18, import_batches: 13 },
      addedColumns: {
        "world_player_cards.appearance_updated_at": { included: true, rows: 13009, nonNullRows: 13009 },
        "world_player_cards.import_batch_id": { included: true, rows: 13009, nonNullRows: 0 },
        "managers.import_batch_id": { included: true, rows: 66, nonNullRows: 0 },
        "player_card_analysis.import_batch_id": { included: true, rows: 19, nonNullRows: 0 },
      },
    },
    // 要約artifactでは許可リスト外として落ちる項目(実際のrun結果に含まれる)。
    sourcePreflight: [{ table: "managers" }],
  };
}

function artifactText(summary: Record<string, unknown> = validSummary(), ok = true, reasons: string[] = []): string {
  return serializeBackupSummaryArtifact(buildBackupSummaryArtifact({ ok, reasons, summary }, new Date("2026-09-24T10:00:00.000Z")), []);
}

function withSummary(patch: (s: Record<string, unknown>) => void): string {
  const s = validSummary();
  patch(s);
  return artifactText(s);
}

describe("Backup v2要約artifactの検証(Stage 3)", () => {
  it("形式\"2\"・pre-apply・restore/storage検証済み・Run #7と同じ行数・追加4列収録なら有効", () => {
    const r = validateBackupV2Summary(artifactText());
    expect(r.problems).toEqual([]);
    expect(r).toMatchObject({ ok: true, verdict: "BACKUP_V2_VALID" });
    expect(r.facts).toMatchObject({ backupVersion: "2", rowCounts: RUN7_BASELINE_ROW_COUNTS });
    expect(Object.keys(r.facts.addedColumnNonNullRows as object).sort()).toEqual([...BACKUP_V2_ADDED_COLUMNS].sort());
  });

  it("追加列は4列ちょうど(appearance_updated_at + 3 tableのimport_batch_id)", () => {
    expect([...BACKUP_V2_ADDED_COLUMNS].sort()).toEqual([
      "managers.import_batch_id", "player_card_analysis.import_batch_id", "world_player_cards.appearance_updated_at", "world_player_cards.import_batch_id",
    ]);
  });

  it("失敗・未検証・旧形式・category違いは無効", () => {
    const cases: Array<[string, string]> = [
      [artifactText(validSummary(), false, ["x"]), "artifact_not_ok"],
      [withSummary((s) => (s.restoreVerified = false)), "restore_not_verified"],
      [withSummary((s) => (s.storageVerified = false)), "storage_not_verified"],
      [withSummary((s) => (s.backupVersion = "1")), "format_version_not_2"],
      [withSummary((s) => (s.phase = "isolated-restore-verification")), "phase_not_upload"],
      [withSummary((s) => (s.category = "daily")), "category"],
      [withSummary((s) => (s.retentionDays = 8)), "retention_days"],
      [withSummary((s) => (s.expiresAt = "2026-10-02T00:00:00.000Z")), "expires_at"],
      [withSummary((s) => (s.objectKey = "daily/2026-09-24/gha-36000000000-1/0123456789ab.age")), "object_key"],
      [withSummary((s) => (s.manifestKey = "pre-apply/2026-09-24/gha-36000000000-1/ffffffffffff.manifest.json")), "manifest_key"],
      [withSummary((s) => (s.totalChecksum = "xyz")), "total_checksum"],
      [withSummary((s) => (s.encryptionAlgorithm = "aes-256-gcm")), "encryption_algorithm"],
      [withSummary((s) => delete s.columnCoverage), "summary_key_missing:columnCoverage"],
    ];
    for (const [text, problem] of cases) {
      const r = validateBackupV2Summary(text);
      expect(r.ok, problem).toBe(false);
      expect(r.verdict).toBe("BACKUP_V2_INVALID");
      expect(r.problems, problem).toContain(problem);
    }
  });

  it("Run #6のような空Backup(0行)と、Run #7からの行数変化は無効", () => {
    const empty = validateBackupV2Summary(withSummary((s) => (s.rowCounts = { world_player_cards: 0, managers: 0, player_card_analysis: 0, import_batches: 0 })));
    expect(empty.ok).toBe(false);
    expect(empty.problems.some((p) => p.startsWith("content_policy:"))).toBe(true);
    const changed = validateBackupV2Summary(withSummary((s) => ((s.rowCounts as Record<string, number>).managers = 67)));
    expect(changed.problems).toContain("row_count_differs_from_run7:managers");
    // 基準照合を明示的に外した場合だけ通る(本人が基準の変化を確認した場合)。
    const s = validSummary();
    (s.rowCounts as Record<string, number>).managers = 67;
    ((s.columnCoverage as { addedColumns: Record<string, { rows: number }> }).addedColumns["managers.import_batch_id"]).rows = 67;
    expect(validateBackupV2Summary(artifactText(s), { baselineRowCounts: null }).ok).toBe(true);
  });

  it("追加4列の未収録・行数不一致・非null件数の範囲外・列数違いは無効", () => {
    const cov = (s: Record<string, unknown>) => s.columnCoverage as { columnCounts: Record<string, number>; addedColumns: Record<string, Record<string, unknown>> };
    const cases: Array<[string, string]> = [
      [withSummary((s) => (cov(s).addedColumns["world_player_cards.appearance_updated_at"].included = false)), "added_column_not_included:world_player_cards.appearance_updated_at"],
      [withSummary((s) => delete cov(s).addedColumns["managers.import_batch_id"]), "added_columns_set"],
      [withSummary((s) => (cov(s).addedColumns["player_card_analysis.import_batch_id"].rows = 18)), "added_column_rows:player_card_analysis.import_batch_id"],
      [withSummary((s) => (cov(s).addedColumns["world_player_cards.import_batch_id"].nonNullRows = 13010)), "added_column_non_null:world_player_cards.import_batch_id"],
      [withSummary((s) => (cov(s).columnCounts.world_player_cards = 36)), "column_count:world_player_cards"],
    ];
    for (const [text, problem] of cases) expect(validateBackupV2Summary(text).problems, problem).toContain(problem);
  });

  it("接続文字列・証明書・鍵・保存先hostらしき文字列を含む要約は内容を読まずに無効", () => {
    for (const leak of ["postgresql://u:p@h/db", "-----BEGIN CERTIFICATE-----", "AGE-SECRET-KEY-1ABC", `age1${"q".repeat(58)}`, "x.r2.cloudflarestorage.com"]) {
      const r = validateBackupV2Summary(withSummary((s) => (s.objectKey = leak)));
      expect(r.ok).toBe(false);
      expect(r.problems[0]).toMatch(/^secret_like_content:/);
      expect(r.facts).toEqual({});
    }
    expect(validateBackupV2Summary("not json").problems).toEqual(["not_json"]);
  });

  it("許可リスト外の項目(sourcePreflight等)は要約artifactに入らず、入っていれば無効", () => {
    expect(artifactText()).not.toContain("sourcePreflight");
    const doc = JSON.parse(artifactText());
    doc.summary.extra = 1;
    expect(validateBackupV2Summary(JSON.stringify(doc)).problems).toContain("summary_key_unexpected:extra");
  });
});

describe("CLI: 期待行数の指定", () => {
  it("4 tableちょうど・0以上の整数だけを受け付け、省略時はnull(行数を照合しない)", () => {
    expect(parseExpectedCounts(undefined)).toBeNull();
    expect(parseExpectedCounts("--expected-counts=world_player_cards:13297,managers:67,player_card_analysis:19,import_batches:10")).toEqual({ world_player_cards: 13297, managers: 67, player_card_analysis: 19, import_batches: 10 });
    for (const bad of ["--expected-counts=managers:67", "--expected-counts=world_player_cards:-1,managers:67,player_card_analysis:19,import_batches:10", "--expected-counts=users:1,managers:67,player_card_analysis:19,import_batches:10", "--counts=x", "--expected-counts=world_player_cards:1,world_player_cards:1,managers:1,player_card_analysis:1"]) {
      expect(() => parseExpectedCounts(bad), bad).toThrow("summary_expected_counts_invalid");
    }
  });

  it("指定した期待行数と違えば無効", () => {
    const text = artifactText();
    expect(validateBackupV2Summary(text, { baselineRowCounts: { ...RUN7_BASELINE_ROW_COUNTS } }).ok).toBe(true);
    expect(validateBackupV2Summary(text, { baselineRowCounts: { ...RUN7_BASELINE_ROW_COUNTS, managers: 67 } }).problems).toContain("row_count_differs_from_run7:managers");
  });
});

describe("coverage SQL・CLIの入力制限", () => {
  it("coverage SQLは隔離Restore先schemaの集計だけで、不正な識別子を拒否する", () => {
    expect(buildColumnCoverageSql("managers", ["import_batch_id"])).toBe(
      'select count(*)::int as "__rows", count("import_batch_id")::int as "import_batch_id" from reference_data_backup_restore_test.managers',
    );
    expect(() => buildColumnCoverageSql("managers; drop", [])).toThrow(/blocked/);
    expect(() => buildColumnCoverageSql("managers", ['x"y'])).toThrow(/blocked/);
  });

  it("CLIは作業フォルダ配下の.jsonだけを受け付ける", () => {
    // 純粋なpath計算だけ(ファイルは作らない・読まない)。
    const cwd = path.resolve("/workspace-for-test");
    {
      expect(resolveSummaryPath("./a/summary.json", cwd)).toBe(path.join(cwd, "a", "summary.json"));
      expect(() => resolveSummaryPath("../outside.json", cwd)).toThrow("summary_path_outside_workspace");
      expect(() => resolveSummaryPath(path.resolve(cwd, "..", "x.json"), cwd)).toThrow("summary_path_outside_workspace");
      expect(() => resolveSummaryPath("./summary.txt", cwd)).toThrow("summary_path_invalid");
      expect(() => resolveSummaryPath(undefined, cwd)).toThrow("summary_path_invalid");
    }
  });
});

describe("Stage 3 Evidence(Backup v2 Run #8)", () => {
  it("Evidenceの要約は契約どおりで、完全なobject key・秘密情報を含まない", async () => {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "evidence", "stage3-production-backup-v2-2026-09-24.json"), "utf8");
    const ev = JSON.parse(text);
    expect(ev.run).toMatchObject({ runNumber: 8, attempt: 1, event: "workflow_dispatch", branch: "main", conclusion: "success", categoryFromStepEnv: "pre-apply" });
    expect(ev.summary).toMatchObject({ ok: true, reasons: [], phase: "upload", backupVersion: "2", category: "pre-apply", restoreVerified: true, storageVerified: true, rowCounts: RUN7_BASELINE_ROW_COUNTS });
    for (const key of BACKUP_V2_ADDED_COLUMNS) {
      const c = ev.summary.columnCoverage.addedColumns[key];
      expect(c.included, key).toBe(true);
      expect(c.rows, key).toBe(ev.summary.rowCounts[key.split(".")[0]]);
    }
    expect(ev.validator.verdict).toBe("BACKUP_V2_VALID");
    expect(ev.summary.objectKeyShape).toBe("pre-apply/2026-09-24/<jobId>/<checksum12>.age");
    expect(text).not.toMatch(/gha-\d+-\d+\/[0-9a-f]{12}|postgres(ql)?:\/\/|-----BEGIN|AGE-SECRET-KEY|age1[0-9a-z]{50,}|cloudflarestorage|supabase\.co/i);
  });
});
