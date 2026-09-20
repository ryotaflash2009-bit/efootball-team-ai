import { describe, it, expect } from "vitest";
import {
  buildBackupManifest,
  markManifestEncrypted,
  markManifestRestoreVerified,
  markManifestFailed,
  assertManifestHasNoSecrets,
  type BuildBackupManifestInput,
} from "./backup-manifest";

function baseInput(): BuildBackupManifestInput {
  return {
    backupVersion: "1",
    schemaVersion: "2026-09-20",
    jobId: "job-1",
    createdAt: "2026-09-20T00:00:00.000Z",
    postgresMajorVersion: 16,
    tableAllowlist: ["world_player_cards", "managers", "player_card_analysis", "import_batches"],
    rowCounts: { world_player_cards: 3, managers: 1, player_card_analysis: 1, import_batches: 1 },
    tableChecksums: { world_player_cards: "abc", managers: "def", player_card_analysis: "ghi", import_batches: "jkl" },
    totalChecksum: "total",
    sourceMetadataChecksum: "meta",
    compression: "none",
    encryptionAlgorithm: "aes-256-gcm",
    retentionCategory: "isolated-test-ephemeral",
    expiresAt: "2026-10-20T00:00:00.000Z",
    applicationCommitSha: "0123456789abcdef0123456789abcdef01234567",
  };
}

describe("buildBackupManifest", () => {
  it("初期状態はencrypted=false, restoreVerified=false, backupStatus=pending", () => {
    const manifest = buildBackupManifest(baseInput());
    expect(manifest.encrypted).toBe(false);
    expect(manifest.restoreVerified).toBe(false);
    expect(manifest.backupStatus).toBe("pending");
    expect(manifest.sourceCategory).toBe("reference_data_full_table_backup");
  });

  it("markManifestEncryptedはencrypted=true, backupStatus=encryptedへ遷移する", () => {
    const manifest = markManifestEncrypted(buildBackupManifest(baseInput()));
    expect(manifest.encrypted).toBe(true);
    expect(manifest.backupStatus).toBe("encrypted");
  });

  it("markManifestRestoreVerifiedはrestoreVerified=trueへ遷移する", () => {
    const manifest = markManifestRestoreVerified(markManifestEncrypted(buildBackupManifest(baseInput())));
    expect(manifest.restoreVerified).toBe(true);
    expect(manifest.backupStatus).toBe("restore_verified");
  });

  it("markManifestFailedはbackupStatus=failedへ遷移する", () => {
    const manifest = markManifestFailed(buildBackupManifest(baseInput()));
    expect(manifest.backupStatus).toBe("failed");
  });
});

describe("assertManifestHasNoSecrets", () => {
  it("正常なmanifestは合格する", () => {
    const manifest = buildBackupManifest(baseInput());
    expect(assertManifestHasNoSecrets(manifest as unknown as Record<string, unknown>).ok).toBe(true);
  });

  it("禁止フィールド名(password)が混入していれば不合格", () => {
    const manifest = { ...buildBackupManifest(baseInput()), password: "x" };
    expect(assertManifestHasNoSecrets(manifest).ok).toBe(false);
  });

  it("禁止フィールド名(connectionString)が混入していれば不合格", () => {
    const manifest = { ...buildBackupManifest(baseInput()), connectionString: "x" };
    expect(assertManifestHasNoSecrets(manifest).ok).toBe(false);
  });

  it("値の中にpostgres接続文字列らしき文字列が含まれていれば不合格", () => {
    const manifest = { ...buildBackupManifest(baseInput()), applicationCommitSha: "postgres://user:pass@host/db" };
    expect(assertManifestHasNoSecrets(manifest).ok).toBe(false);
  });

  it("値の中にメールアドレスらしき文字列が含まれていれば不合格", () => {
    const manifest = { ...buildBackupManifest(baseInput()), jobId: "someone@example.com" };
    expect(assertManifestHasNoSecrets(manifest).ok).toBe(false);
  });

  it("値の中にSupabaseホスト名が含まれていれば不合格", () => {
    const manifest = { ...buildBackupManifest(baseInput()), jobId: "xyz.supabase.co" };
    expect(assertManifestHasNoSecrets(manifest).ok).toBe(false);
  });
});
