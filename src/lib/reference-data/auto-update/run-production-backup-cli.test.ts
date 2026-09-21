import { describe, it, expect } from "vitest";
import { readRequiredEnv, readCategory, REQUIRED_ENV_NAMES } from "./run-production-backup-cli";

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

describe("readCategory(category不正時のblocked、prefixの自由指定は廃止)", () => {
  it("daily/weekly/monthly/pre-applyはすべて許可される(完全一致)", () => {
    for (const c of ["daily", "weekly", "monthly", "pre-apply"]) {
      expect(readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: c })).toBe(c);
    }
  });

  it("未設定はblocked(既定値へフォールバックしない)", () => {
    expect(() => readCategory({})).toThrow(/未設定/);
  });

  it("空文字はblocked", () => {
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "" })).toThrow();
  });

  it("大文字小文字違い(PRE-APPLY)はblocked(暗黙補正しない)", () => {
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "PRE-APPLY" })).toThrow();
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "Daily" })).toThrow();
  });

  it("前後の空白はblocked(暗黙補正しない)", () => {
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: " pre-apply" })).toThrow();
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "pre-apply " })).toThrow();
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "\tdaily\n" })).toThrow();
  });

  it("未知のcategory・prefix文字列そのものの注入はblocked(REFERENCE_DATA_BACKUP_PREFIXはもう読まれない)", () => {
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "yearly" })).toThrow();
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "daily/" })).toThrow();
    expect(() => readCategory({ REFERENCE_DATA_BACKUP_CATEGORY: "../etc/" })).toThrow();
  });
});
