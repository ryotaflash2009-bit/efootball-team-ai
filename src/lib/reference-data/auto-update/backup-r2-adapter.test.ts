import { describe, it, expect } from "vitest";
import {
  putEncryptedBackup,
  headEncryptedBackup,
  getEncryptedBackupForIsolatedRestore,
  listBackupManifests,
  deleteExpiredBackup,
  verifyRemoteChecksum,
  computeSha256Hex,
  evaluatePutEncryptedBackupGates,
  type PutEncryptedBackupInput,
} from "./backup-r2-adapter";
import { FakeR2Client } from "./backup-r2-client";
import { buildBackupManifest, markManifestEncrypted, markManifestRestoreVerified, type BuildBackupManifestInput } from "./backup-manifest";
import { BACKUP_TARGET_TABLES } from "./backup-target";

function baseManifestInput(): BuildBackupManifestInput {
  return {
    backupVersion: "1",
    schemaVersion: "2026-09-21",
    jobId: "job-1",
    createdAt: "2026-09-21T00:00:00.000Z",
    postgresMajorVersion: 16,
    tableAllowlist: [...BACKUP_TARGET_TABLES],
    rowCounts: { world_player_cards: 3, managers: 1, player_card_analysis: 1, import_batches: 1 },
    tableChecksums: { world_player_cards: "a", managers: "b", player_card_analysis: "c", import_batches: "d" },
    totalChecksum: "total",
    sourceMetadataChecksum: "meta",
    compression: "none",
    encryptionAlgorithm: "aes-256-gcm",
    retentionCategory: "production-short-term",
    expiresAt: "2026-09-29T00:00:00.000Z",
    applicationCommitSha: "0".repeat(40),
  };
}

function verifiedManifest() {
  return markManifestRestoreVerified(markManifestEncrypted(buildBackupManifest(baseManifestInput())));
}

function validPutInput(overrides: Partial<PutEncryptedBackupInput> = {}): PutEncryptedBackupInput {
  const payload = Buffer.from("encrypted-bytes-not-plaintext", "utf8");
  return {
    manifest: verifiedManifest(),
    encryptedPayload: payload,
    localEncryptedChecksum: computeSha256Hex(payload),
    prefix: "daily/",
    jobId: "job-1",
    utcDate: "2026-09-21",
    ...overrides,
  };
}

describe("evaluatePutEncryptedBackupGates", () => {
  it("正常な入力はすべて合格する", () => {
    expect(evaluatePutEncryptedBackupGates(validPutInput()).filter((c) => !c.ok)).toEqual([]);
  });

  it("encrypted=falseを拒否する", () => {
    const input = validPutInput({ manifest: { ...verifiedManifest(), encrypted: false } });
    expect(evaluatePutEncryptedBackupGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("restoreVerified=falseを拒否する", () => {
    const input = validPutInput({ manifest: { ...verifiedManifest(), restoreVerified: false } });
    expect(evaluatePutEncryptedBackupGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("allowlist外テーブルを含むmanifestを拒否する", () => {
    const input = validPutInput({ manifest: { ...verifiedManifest(), tableAllowlist: [...BACKUP_TARGET_TABLES, "my_team_snapshots"] } });
    expect(evaluatePutEncryptedBackupGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("Secretを含む疑いのあるmanifestを拒否する", () => {
    const input = validPutInput({ manifest: { ...verifiedManifest(), applicationCommitSha: "postgres://user:pass@host/db" } });
    expect(evaluatePutEncryptedBackupGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("許可されていないprefixを拒否する", () => {
    const input = validPutInput({ prefix: "yearly/" as never });
    expect(evaluatePutEncryptedBackupGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("localEncryptedChecksumが実際のpayloadと一致しない場合を拒否する", () => {
    const input = validPutInput({ localEncryptedChecksum: "0".repeat(64) });
    expect(evaluatePutEncryptedBackupGates(input).some((c) => !c.ok)).toBe(true);
  });

  it("空のencryptedPayload(平文相当の疑い)を拒否する", () => {
    const empty = Buffer.alloc(0);
    const input = validPutInput({ encryptedPayload: empty, localEncryptedChecksum: computeSha256Hex(empty) });
    expect(evaluatePutEncryptedBackupGates(input).some((c) => !c.ok)).toBe(true);
  });
});

describe("putEncryptedBackup", () => {
  it("正常系: uploadに成功し、storageVerified=trueとなる", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput());
    expect(result.ok).toBe(true);
    expect(result.storageVerified).toBe(true);
    expect(result.objectKey).toBe(`daily/2026-09-21/job-1/${computeSha256Hex(Buffer.from("encrypted-bytes-not-plaintext", "utf8")).slice(0, 12)}.age`);
    expect(client.putCalls).toBe(2); // 暗号化payload + manifest
  });

  it("plaintext相当(空payload)を拒否する", async () => {
    const client = new FakeR2Client();
    const empty = Buffer.alloc(0);
    const result = await putEncryptedBackup(client, validPutInput({ encryptedPayload: empty, localEncryptedChecksum: computeSha256Hex(empty) }));
    expect(result.ok).toBe(false);
    expect(client.putCalls).toBe(0);
  });

  it("wrong prefix(allowlist外)を拒否する", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput({ prefix: "yearly/" as never }));
    expect(result.ok).toBe(false);
    expect(client.putCalls).toBe(0);
  });

  it("path traversalを含むjobIdを拒否する", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput({ jobId: "../secret" }));
    expect(result.ok).toBe(false);
    expect(client.putCalls).toBe(0);
  });

  it("checksum不一致(呼び出し側の計算ミス)を拒否する", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput({ localEncryptedChecksum: "0".repeat(64) }));
    expect(result.ok).toBe(false);
    expect(client.putCalls).toBe(0);
  });

  it("sanitizeされていないmanifest(Secret疑い)を拒否する", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput({ manifest: { ...verifiedManifest(), jobId: "someone@example.com" } }));
    expect(result.ok).toBe(false);
    expect(client.putCalls).toBe(0);
  });

  it("user data table(allowlist外)を含むmanifestを拒否する", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput({ manifest: { ...verifiedManifest(), tableAllowlist: ["my_team_snapshots"] } }));
    expect(result.ok).toBe(false);
    expect(client.putCalls).toBe(0);
  });

  it("duplicate object(同一key)を拒否する", async () => {
    const client = new FakeR2Client();
    const first = await putEncryptedBackup(client, validPutInput());
    expect(first.ok).toBe(true);
    const second = await putEncryptedBackup(client, validPutInput());
    expect(second.ok).toBe(false);
    expect(second.reasons.some((r) => r.includes("重複"))).toBe(true);
  });

  it("overwrite拒否: 異なるpayloadでも、既存object keyと衝突する場合は内容を確認せず拒否する", async () => {
    // object keyはchecksum由来のcontent-addressed設計のため、通常は異なるpayloadなら
    // 異なるkeyになる。ここでは同一jobId・日付・checksumを再度指定し、意図的にkeyを
    // 衝突させて、既存objectの中身を一切上書きしないことを確認する。
    const client = new FakeR2Client();
    const input = validPutInput();
    await putEncryptedBackup(client, input);
    const result = await putEncryptedBackup(client, input);
    expect(result.ok).toBe(false);
    expect(client.putCalls).toBe(2); // 1回目のuploadだけがcount(暗号化payload+manifest)、2回目は書込み前に拒否
  });

  it("daily/weekly/monthly/pre-apply/はいずれも許可される", async () => {
    for (const prefix of ["daily/", "weekly/", "monthly/", "pre-apply/"] as const) {
      const client = new FakeR2Client();
      const result = await putEncryptedBackup(client, validPutInput({ prefix }));
      expect(result.ok).toBe(true);
    }
  });

  it("upload後のremote checksumが一致する", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    const result = await putEncryptedBackup(client, input);
    const verify = await verifyRemoteChecksum(client, result.objectKey!, input.localEncryptedChecksum, input.encryptedPayload.length);
    expect(verify.ok).toBe(true);
  });

  it("upload後にobjectが改ざんされていた場合、remote checksum不一致を検出する(storage upload未確認)", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    const result = await putEncryptedBackup(client, input);
    client.corruptForTest(result.objectKey!, () => Buffer.from("tampered-bytes"));
    const verify = await verifyRemoteChecksum(client, result.objectKey!, input.localEncryptedChecksum, input.encryptedPayload.length);
    expect(verify.ok).toBe(false);
  });
});

describe("headEncryptedBackup", () => {
  it("存在しないobjectはexists=falseを返す", async () => {
    const client = new FakeR2Client();
    const result = await headEncryptedBackup(client, "daily/2026-09-21/job-1/abc123456789.age");
    expect(result.exists).toBe(false);
  });

  it("uploadしたobjectのsize/checksumを返す", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    const put = await putEncryptedBackup(client, input);
    const head = await headEncryptedBackup(client, put.objectKey!);
    expect(head.exists).toBe(true);
    expect(head.size).toBe(input.encryptedPayload.length);
    expect(head.checksum).toBe(input.localEncryptedChecksum);
  });

  it("不正なkey形式は例外を投げる", async () => {
    const client = new FakeR2Client();
    await expect(headEncryptedBackup(client, "../secret")).rejects.toThrow();
  });
});

describe("getEncryptedBackupForIsolatedRestore", () => {
  it("正しいchecksumならpayloadを返す", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    const put = await putEncryptedBackup(client, input);
    const result = await getEncryptedBackupForIsolatedRestore(client, put.objectKey!, input.localEncryptedChecksum);
    expect(result.ok).toBe(true);
    expect(result.payload?.toString("utf8")).toBe("encrypted-bytes-not-plaintext");
  });

  it("改ざんされたobjectはchecksum不一致で拒否する", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    const put = await putEncryptedBackup(client, input);
    client.corruptForTest(put.objectKey!, () => Buffer.from("tampered"));
    const result = await getEncryptedBackupForIsolatedRestore(client, put.objectKey!, input.localEncryptedChecksum);
    expect(result.ok).toBe(false);
    expect(result.payload).toBeNull();
  });

  it("存在しないobjectを拒否する", async () => {
    const client = new FakeR2Client();
    const result = await getEncryptedBackupForIsolatedRestore(client, "daily/2026-09-21/job-1/abc123456789.age", "0".repeat(64));
    expect(result.ok).toBe(false);
  });
});

describe("listBackupManifests", () => {
  it("対象prefix配下のmanifestだけを返す(暗号化payloadは含めない)", async () => {
    const client = new FakeR2Client();
    await putEncryptedBackup(client, validPutInput({ prefix: "daily/" }));
    await putEncryptedBackup(client, validPutInput({ prefix: "weekly/", jobId: "job-2" }));
    const dailyEntries = await listBackupManifests(client, "daily/");
    expect(dailyEntries.length).toBe(1);
    expect(dailyEntries[0].manifestKey).toMatch(/\.manifest\.json$/);
    expect(dailyEntries[0].manifest.jobId).toBe("job-1");
  });

  it("許可されていないprefixは例外を投げる", async () => {
    const client = new FakeR2Client();
    await expect(listBackupManifests(client, "yearly/" as never)).rejects.toThrow();
  });
});

describe("deleteExpiredBackup", () => {
  it("期限切れのdaily/objectを削除できる", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    const put = await putEncryptedBackup(client, input);
    const pastExpiry = { ...input.manifest, expiresAt: "2020-01-01T00:00:00.000Z" };
    const result = await deleteExpiredBackup(client, {
      objectKey: put.objectKey!,
      manifestKey: put.manifestKey!,
      manifest: pastExpiry,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    expect(client.deleteCalls).toBe(2);
  });

  it("pre-apply/は削除を拒否する(自動削除対象外prefix)", async () => {
    const client = new FakeR2Client();
    const input = validPutInput({ prefix: "pre-apply/" });
    const put = await putEncryptedBackup(client, input);
    const pastExpiry = { ...input.manifest, expiresAt: "2020-01-01T00:00:00.000Z" };
    const result = await deleteExpiredBackup(client, {
      objectKey: put.objectKey!,
      manifestKey: put.manifestKey!,
      manifest: pastExpiry,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
  });

  it("未到来のexpiresAtは削除を拒否する", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    const put = await putEncryptedBackup(client, input);
    const result = await deleteExpiredBackup(client, {
      objectKey: put.objectKey!,
      manifestKey: put.manifestKey!,
      manifest: input.manifest,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
  });
});

describe("Secretがログ・エラー理由へ出力されないことの確認", () => {
  const SECRET_LIKE_PATTERNS = [
    /postgres(?:ql)?:\/\//i,
    /AKIA[0-9A-Z]{16}/, // AWS/R2 access key ID様パターン
    /r2\.cloudflarestorage\.com/i,
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  ];

  function assertNoSecretLikeReasons(reasons: readonly string[]): void {
    const joined = reasons.join(" ");
    for (const pattern of SECRET_LIKE_PATTERNS) {
      expect(joined).not.toMatch(pattern);
    }
  }

  it("plaintext拒否時の理由にSecretらしき値が含まれない", async () => {
    const client = new FakeR2Client();
    const empty = Buffer.alloc(0);
    const result = await putEncryptedBackup(client, validPutInput({ encryptedPayload: empty, localEncryptedChecksum: computeSha256Hex(empty) }));
    assertNoSecretLikeReasons(result.reasons);
  });

  it("重複object拒否時の理由にSecretらしき値が含まれない", async () => {
    const client = new FakeR2Client();
    const input = validPutInput();
    await putEncryptedBackup(client, input);
    const result = await putEncryptedBackup(client, input);
    assertNoSecretLikeReasons(result.reasons);
  });

  it("checksum不一致拒否時の理由にSecretらしき値が含まれない", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput({ localEncryptedChecksum: "0".repeat(64) }));
    assertNoSecretLikeReasons(result.reasons);
  });

  it("wrong prefix拒否時の理由にSecretらしき値が含まれない", async () => {
    const client = new FakeR2Client();
    const result = await putEncryptedBackup(client, validPutInput({ prefix: "yearly/" as never }));
    assertNoSecretLikeReasons(result.reasons);
  });
});
