import { describe, it, expect } from "vitest";
import { readRequiredEnv, readPrefix, REQUIRED_ENV_NAMES } from "./run-production-backup-cli";

/**
 * CLIエントリーポイントの純粋な部分(環境変数読み取り・検証)だけを検証する。
 * `main()`自体は実pg接続・実R2接続・実age実行を要するため、このファイルでは
 * 呼び出さない(importするだけではmain()は起動しない、`import.meta.url`ガードで確認済み)。
 */

const ALL_SECRETS_PRESENT: Record<string, string> = Object.fromEntries(REQUIRED_ENV_NAMES.map((name) => [name, `dummy-${name}`]));

describe("readRequiredEnv(missing Secret rejection)", () => {
  it("6項目すべて揃っていれば成功する", () => {
    const result = readRequiredEnv(ALL_SECRETS_PRESENT);
    for (const name of REQUIRED_ENV_NAMES) expect(result[name]).toBe(`dummy-${name}`);
  });

  it("1項目でも欠けていればblocked(例外)になる", () => {
    for (const missing of REQUIRED_ENV_NAMES) {
      const env = { ...ALL_SECRETS_PRESENT };
      delete env[missing];
      expect(() => readRequiredEnv(env)).toThrow(new RegExp(missing));
    }
  });

  it("全項目欠けている場合も例外になる(実接続を試みない)", () => {
    expect(() => readRequiredEnv({})).toThrow();
  });
});

describe("readPrefix(prefix不正時のblocked)", () => {
  it("daily/weekly/monthly/pre-apply/はすべて許可される", () => {
    for (const p of ["daily/", "weekly/", "monthly/", "pre-apply/"]) {
      expect(readPrefix({ REFERENCE_DATA_BACKUP_PREFIX: p })).toBe(p);
    }
  });

  it("未指定時は既定でdaily/になる", () => {
    expect(readPrefix({})).toBe("daily/");
  });

  it("allowlist外のprefixはblocked(例外)になる", () => {
    for (const bad of ["yearly/", "../etc/", "/etc/passwd", "public/", ""]) {
      expect(() => readPrefix({ REFERENCE_DATA_BACKUP_PREFIX: bad })).toThrow();
    }
  });
});
