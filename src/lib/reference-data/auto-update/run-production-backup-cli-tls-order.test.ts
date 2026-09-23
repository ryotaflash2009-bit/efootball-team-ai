import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * workflow Run #2は、Production PostgreSQLとのTLSハンドシェイクに失敗した時点で
 * 安全に停止し、SQL・export・age・R2通信のいずれにも到達しなかった。この構造
 * (`prodPgClient.connect()`が失敗すればcatchブロックへ直行し、R2Client構築や
 * `runProductionBackup`呼び出しに到達しない)は`main()`の`try`ブロック内の実行順序
 * そのものによって保証されている。このテストは、その順序保証が将来のリファクタで
 * 崩れていないことを、実接続を伴わず静的に確認する回帰テスト。
 */

const SOURCE = readFileSync(resolve(__dirname, "run-production-backup-cli.ts"), "utf8");

describe("run-production-backup-cli.ts: TLS/DB接続失敗時にSQL/R2へ到達しない実行順序", () => {
  it("prodPgClient.connect()が、R2Client構築・runProductionBackup呼び出しより前にある", () => {
    const connectIndex = SOURCE.indexOf("await prodPgClient.connect()");
    const r2ConstructIndex = SOURCE.indexOf("new R2RealClient(");
    const runBackupIndex = SOURCE.indexOf("await runProductionBackup(");
    expect(connectIndex).toBeGreaterThan(-1);
    expect(r2ConstructIndex).toBeGreaterThan(-1);
    expect(runBackupIndex).toBeGreaterThan(-1);
    expect(connectIndex).toBeLessThan(r2ConstructIndex);
    expect(connectIndex).toBeLessThan(runBackupIndex);
  });

  it("prodPgClient/verifyPgClientのconnect()呼び出しは同じtryブロック内にあり、失敗すれば直接catchへ渡る(zero SQL / zero R2の保証)", () => {
    const tryIndex = SOURCE.indexOf("try {");
    const catchIndex = SOURCE.indexOf("} catch (err) {");
    const connectIndex = SOURCE.indexOf("await prodPgClient.connect()");
    expect(tryIndex).toBeGreaterThan(-1);
    expect(catchIndex).toBeGreaterThan(-1);
    expect(connectIndex).toBeGreaterThan(tryIndex);
    expect(connectIndex).toBeLessThan(catchIndex);
  });

  it("prodPgClientの構築にbuildProductionPgClientConfig(単一の真実源)を使っている(connectionStringを直接渡していない)", () => {
    expect(SOURCE).toMatch(/buildProductionPgClientConfig\(/);
    expect(SOURCE).not.toMatch(/new Client\(\{\s*connectionString/);
  });

  it("catchブロックはsanitizeErrorMessageを経由してから出力する(DB URL/password/CA証明書本文が漏れない)", () => {
    const catchBlock = SOURCE.slice(SOURCE.indexOf("} catch (err) {"), SOURCE.indexOf("} finally {"));
    expect(catchBlock).toMatch(/sanitizeErrorMessage/);
  });

  it("finallyブロックでprodPgClient/verifyPgClientの両方を必ずend()する(接続失敗時もリークしない)", () => {
    const finallyBlock = SOURCE.slice(SOURCE.indexOf("} finally {"));
    expect(finallyBlock).toMatch(/prodPgClient\?\.end\(\)/);
    expect(finallyBlock).toMatch(/verifyPgClient\?\.end\(\)/);
  });
});

describe("run-production-backup-cli.ts: 空Backupを成功扱いしない(workflow Run #6の回帰テスト、2026-09-23)", () => {
  it("exit codeはrunProductionBackupのok(内容妥当性gateを含む総合判定)からのみ決まり、okでなければ1になる", () => {
    expect(SOURCE).toMatch(/exitCode = result\.ok \? 0 : 1;/);
    expect(SOURCE).not.toMatch(/exitCode = 0;/);
  });

  it("接続先identity preflightの期待値(PRODUCTION_EXPECTED_SOURCE_IDENTITY)をrunProductionBackupへ渡している", () => {
    expect(SOURCE).toMatch(/expectedSourceIdentity: PRODUCTION_EXPECTED_SOURCE_IDENTITY/);
  });

  it("Production接続のquery clientにはテスト用search_pathを設定しない", () => {
    expect(SOURCE).toMatch(/createPostgresQueryClient\(prodPgClient, \{ setTestSearchPath: false \}\)/);
  });
});
