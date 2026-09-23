import { describe, it, expect } from "vitest";
import {
  BACKUP_TABLE_SPECS,
  BACKUP_TABLE_SPECS_BY_VERSION,
  CURRENT_BACKUP_FORMAT_VERSION,
  assertBackupFormatVersion,
  getBackupTableSpec,
} from "./backup-schema";
import { buildBackupDumpSelectSql, buildBackupRestoreInsertSql } from "./backup-sql";
import { evaluateRestorePreflightGates } from "./backup-restore";
import { UPDATE_TABLE_CONTRACTS } from "./update-contract";

/** 版"1"の列集合(Run #7のBackupが収録している列)。既存Backupの検証に使うため変更してはならない。 */
const V1_COLUMN_COUNTS = { world_player_cards: 36, managers: 29, player_card_analysis: 17, import_batches: 13 } as const;

describe("Backup形式の版", () => {
  it("現行は\"2\"、未知の版はblocked", () => {
    expect(CURRENT_BACKUP_FORMAT_VERSION).toBe("2");
    expect(BACKUP_TABLE_SPECS).toBe(BACKUP_TABLE_SPECS_BY_VERSION["2"]);
    expect(assertBackupFormatVersion("1")).toBe("1");
    for (const v of ["0", "3", "", null, 2]) expect(() => assertBackupFormatVersion(v)).toThrow(/未対応/);
  });

  it("版\"1\"の列集合は変更されていない(Run #7と同じ)", () => {
    for (const [table, n] of Object.entries(V1_COLUMN_COUNTS)) {
      const cols = getBackupTableSpec(table, "1").columns;
      expect(cols.length, table).toBe(n);
      expect(cols).not.toContain("import_batch_id");
      expect(cols).not.toContain("appearance_updated_at");
    }
  });

  it("版\"2\"は版\"1\"に欠落していた列だけを加え、DDL基準のProduction列と一致する", () => {
    const added: Record<string, string[]> = {};
    for (const spec of BACKUP_TABLE_SPECS_BY_VERSION["2"]) {
      const v1 = getBackupTableSpec(spec.table, "1").columns;
      added[spec.table] = spec.columns.filter((c) => !v1.includes(c));
      expect(v1.every((c) => spec.columns.includes(c))).toBe(true);
      expect([...spec.columns].sort()).toEqual([...UPDATE_TABLE_CONTRACTS[spec.table as keyof typeof UPDATE_TABLE_CONTRACTS].productionColumns].sort());
    }
    expect(added).toEqual({
      world_player_cards: ["appearance_updated_at", "import_batch_id"],
      managers: ["import_batch_id"],
      player_card_analysis: ["import_batch_id"],
      import_batches: [],
    });
  });

  it("SQLは版の列集合で組み立てる(既定は現行版)", () => {
    expect(buildBackupDumpSelectSql("reference_data", "managers")).toContain("import_batch_id");
    expect(buildBackupDumpSelectSql("reference_data", "managers", "1")).not.toContain("import_batch_id");
    expect(buildBackupRestoreInsertSql("world_player_cards", 1, "1")).not.toContain("appearance_updated_at");
    expect(buildBackupRestoreInsertSql("world_player_cards", 1)).toContain("appearance_updated_at");
  });

  it("Restoreの事前検査は未対応の版を拒否する", () => {
    const manifest = {
      backupVersion: "9", schemaVersion: "s", jobId: "j", sourceCategory: "reference_data_full_table_backup", createdAt: "2026-01-01T00:00:00Z",
      postgresMajorVersion: 16, tableAllowlist: ["world_player_cards", "managers", "player_card_analysis", "import_batches"], rowCounts: {}, tableChecksums: {},
      totalChecksum: "0".repeat(64), sourceMetadataChecksum: "0".repeat(64), dumpFormat: "jsonl-per-table", compression: "none", encryptionAlgorithm: "a",
      encrypted: true, restoreVerified: false, retentionCategory: "isolated-test-ephemeral", expiresAt: null, applicationCommitSha: "0".repeat(40), backupStatus: "encrypted",
    };
    const checks = evaluateRestorePreflightGates({
      artifact: { manifest, encryptedPayload: Buffer.alloc(0) },
      decryptor: { algorithmId: "a", encrypt: async (b: Buffer) => b, decrypt: async (b: Buffer) => b },
      expectedSchemaVersion: "s",
      expectedPostgresMajorVersion: 16,
      now: new Date("2026-01-02T00:00:00Z"),
    } as unknown as Parameters<typeof evaluateRestorePreflightGates>[0]);
    expect(checks.filter((c) => !c.ok).map((c) => c.reason).join()).toMatch(/backupVersionが未対応/);
  });
});
