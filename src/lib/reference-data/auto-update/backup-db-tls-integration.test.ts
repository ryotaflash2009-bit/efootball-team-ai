import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as tls from "node:tls";
import { buildProductionPgClientConfig } from "./backup-db-connection";

/**
 * workflow Run #2は、Production PostgreSQLとのTLSハンドシェイクを
 * 「self-signed certificate in certificate chain」で拒否して安全停止した
 * (`ssl.ca`未指定のまま`rejectUnauthorized: true`だけを渡していたため)。
 *
 * このファイルは、実Supabase/実Production/実R2への接続を一切行わず、
 * このマシン/このCI runner上だけで完結する使い捨ての自己署名CA・サーバー証明書
 * (openssl、テスト専用、Production証明書とは一切無関係)を使って、
 * `buildProductionPgClientConfig`が返す`ssl`設定が実際のTLSハンドシェイクで
 * 正しく機能する(正しいCAでは接続でき、誤ったCA・信頼されていない自己署名証明書・
 * hostname不一致ではいずれも拒否される)ことを、Node標準の`tls`モジュールで直接検証する。
 *
 * ubuntu-latest GitHub Actions runnerにはopensslが標準搭載されている
 * (このリポジトリの他のCIジョブと同様の前提)。opensslが無い環境ではこのファイルの
 * テストはskipされる(型チェック・他のテストには影響しない)。
 */

let opensslAvailable = true;
try {
  execFileSync("openssl", ["version"], { stdio: "ignore" });
} catch {
  opensslAvailable = false;
}

const describeIfOpenssl = opensslAvailable ? describe : describe.skip;

describeIfOpenssl("Production PostgreSQL TLS trust(ローカル使い捨て自己署名CA・サーバーによる実ハンドシェイク検証、Production/Supabase/R2には一切接続しない)", () => {
  let dir: string;
  let correctCaPem: string;
  let wrongCaPem: string;
  let serverKeyPem: string;
  let serverCertSignedByCorrectCaPem: string;
  let untrustedSelfSignedCertPem: string;
  let untrustedSelfSignedKeyPem: string;

  function run(cmd: string, args: string[]): void {
    execFileSync(cmd, args, { cwd: dir, stdio: "pipe" });
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "backup-db-tls-test-"));

    // テスト専用の「正しいCA」(このテストの中だけに存在する使い捨てCA。Production/Supabaseとは無関係)
    run("openssl", ["genrsa", "-out", "correct-ca.key", "2048"]);
    run("openssl", [
      "req",
      "-x509",
      "-new",
      "-key",
      "correct-ca.key",
      "-days",
      "1",
      "-out",
      "correct-ca.crt",
      "-subj",
      "/CN=Test Backup Root CA (correct, local test only)",
    ]);

    // テスト専用の「誤ったCA」(正しいCAとは無関係な、別の自己署名CA)
    run("openssl", ["genrsa", "-out", "wrong-ca.key", "2048"]);
    run("openssl", [
      "req",
      "-x509",
      "-new",
      "-key",
      "wrong-ca.key",
      "-days",
      "1",
      "-out",
      "wrong-ca.crt",
      "-subj",
      "/CN=Test Backup Root CA (wrong, local test only)",
    ]);

    // サーバー証明書(SAN=IP:127.0.0.1)を「正しいCA」で署名する
    run("openssl", ["genrsa", "-out", "server.key", "2048"]);
    run("openssl", [
      "req",
      "-new",
      "-key",
      "server.key",
      "-out",
      "server.csr",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ]);
    run("openssl", [
      "x509",
      "-req",
      "-in",
      "server.csr",
      "-CA",
      "correct-ca.crt",
      "-CAkey",
      "correct-ca.key",
      "-CAcreateserial",
      "-days",
      "1",
      "-out",
      "server.crt",
      "-copy_extensions",
      "copy",
    ]);

    // 信頼されていない自己署名サーバー証明書(どのCAにも署名されていない、workflow Run #2の
    // 実際のエラー「self-signed certificate in certificate chain」を再現するためのもの)
    run("openssl", ["genrsa", "-out", "untrusted-self-signed.key", "2048"]);
    run("openssl", [
      "req",
      "-x509",
      "-new",
      "-key",
      "untrusted-self-signed.key",
      "-days",
      "1",
      "-out",
      "untrusted-self-signed.crt",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ]);

    correctCaPem = readFileSync(join(dir, "correct-ca.crt"), "utf8");
    wrongCaPem = readFileSync(join(dir, "wrong-ca.crt"), "utf8");
    serverKeyPem = readFileSync(join(dir, "server.key"), "utf8");
    serverCertSignedByCorrectCaPem = readFileSync(join(dir, "server.crt"), "utf8");
    untrustedSelfSignedCertPem = readFileSync(join(dir, "untrusted-self-signed.crt"), "utf8");
    untrustedSelfSignedKeyPem = readFileSync(join(dir, "untrusted-self-signed.key"), "utf8");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function startTlsServer(key: string, cert: string): Promise<{ port: number; close: () => Promise<void> }> {
    return new Promise((resolve, reject) => {
      const server = tls.createServer({ key, cert }, (socket) => {
        socket.end();
      });
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address === null || typeof address === "string") {
          reject(new Error("unexpected server address"));
          return;
        }
        resolve({
          port: address.port,
          close: () => new Promise<void>((res) => server.close(() => res())),
        });
      });
    });
  }

  function attemptTlsConnect(opts: { port: number; ca: string; host?: string; servername?: string }): Promise<"success" | { error: string }> {
    return new Promise((resolvePromise) => {
      const socket = tls.connect(
        {
          host: opts.host ?? "127.0.0.1",
          port: opts.port,
          ca: opts.ca,
          rejectUnauthorized: true,
          servername: opts.servername,
        },
        () => {
          socket.end();
          resolvePromise("success");
        },
      );
      socket.on("error", (err) => {
        resolvePromise({ error: err.message });
      });
    });
  }

  it("buildProductionPgClientConfigが返すca(正しいルートCA)で、正しく署名されたサーバー証明書への接続に成功する", async () => {
    const server = await startTlsServer(serverKeyPem, serverCertSignedByCorrectCaPem);
    try {
      const config = buildProductionPgClientConfig(`postgres://u:p@127.0.0.1:${server.port}/db`, correctCaPem);
      const result = await attemptTlsConnect({ port: server.port, ca: config.ssl.ca, host: config.host });
      expect(result).toBe("success");
    } finally {
      await server.close();
    }
  });

  it("誤ったCA(証明書チェーンに無関係なCA)では、正しく署名されたサーバー証明書への接続が失敗する", async () => {
    const server = await startTlsServer(serverKeyPem, serverCertSignedByCorrectCaPem);
    try {
      const config = buildProductionPgClientConfig(`postgres://u:p@127.0.0.1:${server.port}/db`, wrongCaPem);
      const result = await attemptTlsConnect({ port: server.port, ca: config.ssl.ca, host: config.host });
      expect(result).not.toBe("success");
    } finally {
      await server.close();
    }
  });

  it("信頼されていない自己署名証明書への接続は失敗する(Run #2の実際のエラーと同じ失敗モードの再現)", async () => {
    const server = await startTlsServer(untrustedSelfSignedKeyPem, untrustedSelfSignedCertPem);
    try {
      const config = buildProductionPgClientConfig(`postgres://u:p@127.0.0.1:${server.port}/db`, correctCaPem);
      const result = await attemptTlsConnect({ port: server.port, ca: config.ssl.ca, host: config.host });
      expect(result).not.toBe("success");
      if (result !== "success") {
        expect(result.error.toLowerCase()).toMatch(/self.signed|unable to verify|certificate/);
      }
    } finally {
      await server.close();
    }
  });

  it("hostname検証: 証明書のSANと異なるservernameでは、CAが正しくても接続が失敗する", async () => {
    const server = await startTlsServer(serverKeyPem, serverCertSignedByCorrectCaPem);
    try {
      const config = buildProductionPgClientConfig(`postgres://u:p@127.0.0.1:${server.port}/db`, correctCaPem);
      const result = await attemptTlsConnect({
        port: server.port,
        ca: config.ssl.ca,
        host: config.host,
        servername: "not-in-the-certificate.invalid",
      });
      expect(result).not.toBe("success");
      if (result !== "success") {
        expect(result.error.toUpperCase()).toMatch(/ALTNAME|HOSTNAME|IP ADDRESS/);
      }
    } finally {
      await server.close();
    }
  });

  it("rejectUnauthorizedは常にtrueであり、この統合テスト自身もfalseを一切使わない(型定義上falseは代入不可)", () => {
    const config = buildProductionPgClientConfig("postgres://u:p@127.0.0.1:5432/db", correctCaPem);
    expect(config.ssl.rejectUnauthorized).toBe(true);
  });
});
