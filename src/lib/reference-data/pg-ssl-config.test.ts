import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPgSslConfig, describeSslConfigForLog, loadCaCertificateFromFile, type PgSslConfig } from "./pg-ssl-config";

const FAKE_PEM = "-----BEGIN CERTIFICATE-----\nMIIB...fake...\n-----END CERTIFICATE-----\n";
// プロジェクト外(OS一時ディレクトリ)ではなく、プロジェクト内のGit非追跡領域(data/test-tmp)だけを使う。
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TEST_TMP_ROOT = join(REPO_ROOT, "data", "test-tmp");

describe("buildPgSslConfig", () => {
  it("CA証明書が無くてもrejectUnauthorizedは常にtrue", () => {
    const config = buildPgSslConfig(undefined);
    expect(config.rejectUnauthorized).toBe(true);
    expect(config.ca).toBeUndefined();
  });

  it("CA証明書が空文字でもrejectUnauthorizedはtrueのまま(falseへフォールバックしない)", () => {
    const config = buildPgSslConfig("");
    expect(config.rejectUnauthorized).toBe(true);
    expect(config.ca).toBeUndefined();
  });

  it("CA証明書を渡すとca設定に反映され、rejectUnauthorizedはtrueのまま", () => {
    const config = buildPgSslConfig(FAKE_PEM);
    expect(config.rejectUnauthorized).toBe(true);
    expect(config.ca).toBe(FAKE_PEM);
  });

  it("戻り値の型上、rejectUnauthorized:falseは表現できない(コンパイル時の保証)", () => {
    const config: PgSslConfig = buildPgSslConfig(FAKE_PEM);
    // @ts-expect-error rejectUnauthorizedはtrueリテラル型なのでfalseは代入できない
    config.rejectUnauthorized = false;
  });
});

describe("describeSslConfigForLog", () => {
  it("CA証明書ありの場合、バイト数だけを表示し中身は含めない", () => {
    const description = describeSslConfigForLog(buildPgSslConfig(FAKE_PEM));
    expect(description).toContain(`${FAKE_PEM.length}バイト`);
    expect(description).not.toContain("BEGIN CERTIFICATE");
    expect(description).not.toContain("MIIB");
  });

  it("CA証明書なしの場合、その旨を表示する", () => {
    const description = describeSslConfigForLog(buildPgSslConfig(undefined));
    expect(description).toContain("指定なし");
  });

  it("いかなる場合もrejectUnauthorized=trueと表示する", () => {
    expect(describeSslConfigForLog(buildPgSslConfig(undefined))).toContain("rejectUnauthorized=true");
    expect(describeSslConfigForLog(buildPgSslConfig(FAKE_PEM))).toContain("rejectUnauthorized=true");
  });
});

describe("loadCaCertificateFromFile", () => {
  it("PEM形式のファイルを読み込める", () => {
    const dir = mkdtempSync(join(TEST_TMP_ROOT, "ca-cert-test-"));
    const path = join(dir, "ca.pem");
    try {
      writeFileSync(path, FAKE_PEM, "utf8");
      expect(loadCaCertificateFromFile(path)).toBe(FAKE_PEM);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("PEM形式でないファイルは拒否する", () => {
    const dir = mkdtempSync(join(TEST_TMP_ROOT, "ca-cert-test-"));
    const path = join(dir, "not-a-cert.txt");
    try {
      writeFileSync(path, "this is not a certificate", "utf8");
      expect(() => loadCaCertificateFromFile(path)).toThrow(/PEM形式/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("存在しないファイルは例外を投げる", () => {
    expect(() => loadCaCertificateFromFile("/nonexistent/path/ca.pem")).toThrow();
  });
});
