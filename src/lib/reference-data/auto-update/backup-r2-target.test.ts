import { describe, it, expect } from "vitest";
import {
  BACKUP_OBJECT_PREFIXES,
  checkObjectPrefixAllowed,
  checkSafeKeySegment,
  buildBackupObjectKeyBase,
  buildEncryptedPayloadKey,
  buildManifestKey,
  checkObjectKeyWellFormed,
} from "./backup-r2-target";

describe("BACKUP_OBJECT_PREFIXES / checkObjectPrefixAllowed", () => {
  it("daily/weekly/monthly/pre-apply/の4件だけを許可する", () => {
    expect([...BACKUP_OBJECT_PREFIXES].sort()).toEqual(["daily/", "monthly/", "pre-apply/", "weekly/"].sort());
  });

  it("許可されたprefixはすべて合格する", () => {
    for (const p of BACKUP_OBJECT_PREFIXES) expect(checkObjectPrefixAllowed(p).ok).toBe(true);
  });

  it("許可されていないprefixを拒否する", () => {
    expect(checkObjectPrefixAllowed("yearly/").ok).toBe(false);
    expect(checkObjectPrefixAllowed("").ok).toBe(false);
    expect(checkObjectPrefixAllowed("daily").ok).toBe(false); // 末尾/が無い
    expect(checkObjectPrefixAllowed("/daily/").ok).toBe(false);
  });
});

describe("checkSafeKeySegment", () => {
  it("英数字・ハイフン・アンダースコアだけの値は合格する", () => {
    expect(checkSafeKeySegment("job-123_abc", "jobId").ok).toBe(true);
  });

  it("path traversalを拒否する", () => {
    expect(checkSafeKeySegment("../etc/passwd", "jobId").ok).toBe(false);
    expect(checkSafeKeySegment("a/b", "jobId").ok).toBe(false);
    expect(checkSafeKeySegment("a\\b", "jobId").ok).toBe(false);
  });

  it("制御文字を拒否する", () => {
    expect(checkSafeKeySegment("job\x00id", "jobId").ok).toBe(false);
  });

  it("空文字・許可されない記号を拒否する", () => {
    expect(checkSafeKeySegment("", "jobId").ok).toBe(false);
    expect(checkSafeKeySegment("job id", "jobId").ok).toBe(false);
    expect(checkSafeKeySegment("job@id", "jobId").ok).toBe(false);
  });
});

describe("buildBackupObjectKeyBase / buildEncryptedPayloadKey / buildManifestKey", () => {
  const validInput = { prefix: "daily/" as const, utcDate: "2026-09-21", jobId: "job-1", datasetChecksumShort: "abc123def456" };

  it("決定的なkeyを組み立てる", () => {
    const key = buildBackupObjectKeyBase(validInput);
    expect(key).toBe("daily/2026-09-21/job-1/abc123def456");
  });

  it("同じ入力からは常に同じkeyになる", () => {
    expect(buildBackupObjectKeyBase(validInput)).toBe(buildBackupObjectKeyBase({ ...validInput }));
  });

  it("暗号化payload用とmanifest用で拡張子だけが異なる", () => {
    expect(buildEncryptedPayloadKey(validInput)).toBe("daily/2026-09-21/job-1/abc123def456.age");
    expect(buildManifestKey(validInput)).toBe("daily/2026-09-21/job-1/abc123def456.manifest.json");
  });

  it("許可されていないprefixは例外を投げる", () => {
    expect(() => buildBackupObjectKeyBase({ ...validInput, prefix: "yearly/" as never })).toThrow();
  });

  it("utcDateの形式が不正なら例外を投げる", () => {
    expect(() => buildBackupObjectKeyBase({ ...validInput, utcDate: "2026/09/21" })).toThrow();
    expect(() => buildBackupObjectKeyBase({ ...validInput, utcDate: "not-a-date" })).toThrow();
  });

  it("jobIdにpath traversalが含まれる場合は例外を投げる", () => {
    expect(() => buildBackupObjectKeyBase({ ...validInput, jobId: "../secret" })).toThrow();
  });

  it("datasetChecksumShortが不正な場合は例外を投げる", () => {
    expect(() => buildBackupObjectKeyBase({ ...validInput, datasetChecksumShort: "" })).toThrow();
  });
});

describe("checkObjectKeyWellFormed", () => {
  it("許可prefixで始まる正常なkeyは合格する", () => {
    expect(checkObjectKeyWellFormed("daily/2026-09-21/job-1/abc123.age").ok).toBe(true);
  });

  it("空keyを拒否する", () => {
    expect(checkObjectKeyWellFormed("").ok).toBe(false);
  });

  it("絶対パス(先頭/)を拒否する", () => {
    expect(checkObjectKeyWellFormed("/daily/2026-09-21/job-1/abc.age").ok).toBe(false);
  });

  it("URL形式を拒否する", () => {
    expect(checkObjectKeyWellFormed("https://example.com/daily/x").ok).toBe(false);
  });

  it("path traversalを拒否する", () => {
    expect(checkObjectKeyWellFormed("daily/../monthly/x.age").ok).toBe(false);
  });

  it("重複区切り(//)を拒否する", () => {
    expect(checkObjectKeyWellFormed("daily//2026-09-21/job-1/abc.age").ok).toBe(false);
  });

  it("許可prefixで始まらないkeyを拒否する", () => {
    expect(checkObjectKeyWellFormed("yearly/2026/job-1/abc.age").ok).toBe(false);
  });

  it("制御文字を拒否する", () => {
    expect(checkObjectKeyWellFormed("daily/2026-09-21/job\x00-1/abc.age").ok).toBe(false);
  });
});
