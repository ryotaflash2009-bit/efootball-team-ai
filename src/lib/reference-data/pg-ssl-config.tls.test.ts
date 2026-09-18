import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { connect as tlsConnect, createServer as createTlsServer, type Server, type TLSSocket } from "node:tls";
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPgSslConfig } from "./pg-ssl-config";

/**
 * `buildPgSslConfig`が実際のTLSハンドシェイクで意図どおりに機能するかを、
 * 127.0.0.1上のローカルTLSサーバーだけを使って検証する(外部ネットワークへは一切接続しない)。
 *
 * "self-signed certificate in certificate chain"エラーの再現・解消を、
 * 設定オブジェクトの形だけでなく実際のTLS検証結果で確認するための統合テスト。
 * 証明書のほとんどはテスト実行のたびにopensslでその場生成し、プロジェクト内のGit非追跡領域
 * (data/test-tmp配下)へ書き出し、テスト終了後に削除する。
 *
 * 例外: 「期限切れの証明書」だけは、`__fixtures__/tls/`配下のGit管理対象の静的fixtureを使う
 * (`-not_before`/`-not_after`で過去日付を強制するopensslのx509オプションが、環境によって
 * サポート状況が異なり、実際にGitHub Actions上のOpenSSLビルドで
 * `x509: Use -help for summary.`として失敗することを確認した。詳細は
 * `__fixtures__/tls/README.md`)。証明書の検証自体はNodeのTLSスタックが行うため、
 * 事前生成した証明書でも毎回動的生成した場合と同じ検証結果になる。
 */

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXTURE_DIR = join(REPO_ROOT, "data", "test-tmp", "tls-fixtures");
const STATIC_FIXTURE_DIR = join(REPO_ROOT, "src", "lib", "reference-data", "__fixtures__", "tls");

function opensslQuiet(args: string[]): void {
  execFileSync("openssl", args, { cwd: FIXTURE_DIR, stdio: "pipe" });
}

let caKeyPath: string, caCertPath: string;
let wrongCaCertPath: string;
let serverKeyPath: string, serverCertPath: string;
let mismatchCertPath: string;

let validCaCert: string;
let wrongCaCert: string;
let serverKey: string, serverCert: string;
let expiredCert: string;
let expiredCertCa: string;
let expiredCertKey: string;
let mismatchCert: string;
let mismatchKey: string;

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });

  caKeyPath = join(FIXTURE_DIR, "ca-key.pem");
  caCertPath = join(FIXTURE_DIR, "ca-cert.pem");
  execFileSync("openssl", ["genrsa", "-out", caKeyPath, "2048"], { stdio: "pipe" });
  opensslQuiet(["req", "-x509", "-new", "-nodes", "-key", "ca-key.pem", "-sha256", "-days", "3650", "-out", "ca-cert.pem", "-subj", "/CN=Test Root CA"]);

  const wrongCaKeyPath = join(FIXTURE_DIR, "wrong-ca-key.pem");
  wrongCaCertPath = join(FIXTURE_DIR, "wrong-ca-cert.pem");
  execFileSync("openssl", ["genrsa", "-out", wrongCaKeyPath, "2048"], { stdio: "pipe" });
  opensslQuiet(["req", "-x509", "-new", "-nodes", "-key", "wrong-ca-key.pem", "-sha256", "-days", "3650", "-out", "wrong-ca-cert.pem", "-subj", "/CN=Wrong Root CA"]);

  serverKeyPath = join(FIXTURE_DIR, "server-key.pem");
  serverCertPath = join(FIXTURE_DIR, "server-cert.pem");
  const csrPath = join(FIXTURE_DIR, "server.csr");
  const sanExtPath = join(FIXTURE_DIR, "san.ext");
  writeFileSync(sanExtPath, "subjectAltName=DNS:localhost\n", "utf8");
  execFileSync("openssl", ["genrsa", "-out", serverKeyPath, "2048"], { stdio: "pipe" });
  opensslQuiet(["req", "-new", "-key", "server-key.pem", "-out", "server.csr", "-subj", "/CN=localhost"]);
  opensslQuiet([
    "x509", "-req", "-in", "server.csr", "-CA", "ca-cert.pem", "-CAkey", "ca-key.pem", "-CAcreateserial",
    "-out", "server-cert.pem", "-days", "825", "-sha256", "-extfile", "san.ext",
  ]);

  const mismatchKeyPath = join(FIXTURE_DIR, "mismatch-key.pem");
  const mismatchCsrPath = join(FIXTURE_DIR, "mismatch.csr");
  const mismatchExtPath = join(FIXTURE_DIR, "san-mismatch.ext");
  mismatchCertPath = join(FIXTURE_DIR, "mismatch-cert.pem");
  writeFileSync(mismatchExtPath, "subjectAltName=DNS:other.invalid\n", "utf8");
  execFileSync("openssl", ["genrsa", "-out", mismatchKeyPath, "2048"], { stdio: "pipe" });
  opensslQuiet(["req", "-new", "-key", "mismatch-key.pem", "-out", "mismatch.csr", "-subj", "/CN=other.invalid"]);
  opensslQuiet([
    "x509", "-req", "-in", "mismatch.csr", "-CA", "ca-cert.pem", "-CAkey", "ca-key.pem", "-CAcreateserial",
    "-out", "mismatch-cert.pem", "-days", "825", "-sha256", "-extfile", "san-mismatch.ext",
  ]);

  validCaCert = readFileSync(caCertPath, "utf8");
  wrongCaCert = readFileSync(wrongCaCertPath, "utf8");
  serverKey = readFileSync(serverKeyPath, "utf8");
  serverCert = readFileSync(serverCertPath, "utf8");
  mismatchCert = readFileSync(mismatchCertPath, "utf8");
  mismatchKey = readFileSync(mismatchKeyPath, "utf8");

  // 期限切れ証明書だけは静的fixture(Git管理対象、TEST ONLY)から読む(ファイル先頭のコメント参照)。
  expiredCert = readFileSync(join(STATIC_FIXTURE_DIR, "expired-test-server-cert.pem"), "utf8");
  expiredCertKey = readFileSync(join(STATIC_FIXTURE_DIR, "expired-test-server-key.pem"), "utf8");
  expiredCertCa = readFileSync(join(STATIC_FIXTURE_DIR, "expired-test-ca-cert.pem"), "utf8");
}, 30_000);

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

function startTestServer(cert: string, key: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createTlsServer({ cert, key }, (socket: TLSSocket) => {
      socket.end();
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve({ server, port: address.port });
      } else {
        reject(new Error("failed to determine test server port"));
      }
    });
  });
}

function attemptHandshake(port: number, ca: string | undefined): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  return new Promise((resolve) => {
    const socket = tlsConnect({
      host: "127.0.0.1",
      port,
      servername: "localhost",
      ...buildPgSslConfig(ca),
    });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, code: "TIMEOUT", message: "handshake timed out" });
    }, 5000);
    socket.once("secureConnect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve({ ok: true });
    });
    socket.once("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      resolve({ ok: false, code: err.code ?? "UNKNOWN", message: err.message });
    });
  });
}

describe("buildPgSslConfigの実TLSハンドシェイク検証(127.0.0.1のみ、外部接続なし)", () => {
  it("正しいCA(サーバー証明書の発行元)を渡すと接続に成功する", async () => {
    const { server, port } = await startTestServer(serverCert, serverKey);
    try {
      const result = await attemptHandshake(port, validCaCert);
      expect(result.ok).toBe(true);
    } finally {
      server.close();
    }
  });

  it("CAを渡さない場合、Node既定のCAストアには無い自己署名チェーンとして拒否される(rejectUnauthorizedを緩めていないことの再現)", async () => {
    const { server, port } = await startTestServer(serverCert, serverKey);
    try {
      const result = await attemptHandshake(port, undefined);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toMatch(/SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|CERT/);
      }
    } finally {
      server.close();
    }
  });

  it("誤った(無関係な)CAを渡すと接続を拒否する", async () => {
    const { server, port } = await startTestServer(serverCert, serverKey);
    try {
      const result = await attemptHandshake(port, wrongCaCert);
      expect(result.ok).toBe(false);
    } finally {
      server.close();
    }
  });

  it("期限切れの証明書は、正しいCAを渡していても拒否される", async () => {
    const { server, port } = await startTestServer(expiredCert, expiredCertKey);
    try {
      const result = await attemptHandshake(port, expiredCertCa);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toMatch(/EXPIRED/i);
      }
    } finally {
      server.close();
    }
  });

  it("ホスト名不一致の証明書は、正しいCAを渡していても拒否される", async () => {
    const { server, port } = await startTestServer(mismatchCert, mismatchKey);
    try {
      const result = await attemptHandshake(port, validCaCert);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toMatch(/ALTNAME|HOSTNAME|CERT/i);
      }
    } finally {
      server.close();
    }
  });
});
