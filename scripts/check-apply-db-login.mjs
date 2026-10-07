#!/usr/bin/env node
/**
 * 自動 Apply 用の DB 接続（URL）で、ログインと必要な権限を確かめる（2026-10-07・本人の端末で一度限りの確認に使う）。
 * - 入力は標準入力の JSON {"url": "...", "caPath": "..."} だけ（引数・環境変数・ファイルに URL を書かない）。
 * - TLS は CA 証明書で検証する（rejectUnauthorized: true）。sslmode などの query parameter は受け付けない（workflow と同じ契約）。
 * - 実行する SQL は `select 1` と system catalog の読み取りだけ（`scripts/lib/db-login-probe.mjs`）。書き込みはしない。
 * - 出力は 1 行の分類（`RESULT <分類> ...`）。URL・パスワード・ホスト名・エラー文は出さない。
 * 終了コード: 0 = LOGIN_OK_AND_PRIVILEGES_OK、1 = それ以外の分類、2 = 入力の誤り。
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { formatProbeResult, probeDatabaseLogin } from "./lib/db-login-probe.mjs";
import { UPDATER_EXPECTED_ROLE, UPDATER_PROBE_SPEC } from "./lib/updater-probe-spec.mjs";

/** URL と CA から pg の接続設定を作る（テストからも使う）。 */
export function buildClientConfig(url, ca) {
  const u = new URL(url);
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error("URL_PROTOCOL");
  if (u.search) throw new Error("URL_QUERY_NOT_ALLOWED");
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: ca === null ? false : { ca, rejectUnauthorized: true, servername: u.hostname },
    connectionTimeoutMillis: 15000,
    statement_timeout: 10000,
    application_name: "apply-db-login-check",
  };
}

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    console.log("RESULT INPUT_INVALID stage=input");
    return 2;
  }
  let ca;
  try {
    ca = readFileSync(String(input.caPath), "utf8");
  } catch {
    console.log("RESULT CA_UNREADABLE stage=input");
    return 2;
  }
  let config;
  try {
    config = buildClientConfig(String(input.url), ca);
  } catch (e) {
    console.log(`RESULT URL_INVALID stage=input reason=${e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : "PARSE"}`);
    return 2;
  }
  input = null;
  const result = await probeDatabaseLogin({
    connect: async () => {
      const client = new pg.Client(config);
      // 接続の途中のエラーで process が落ちないようにする（分類は connect の reject で行う）。
      client.on("error", () => {});
      await client.connect();
      return client;
    },
    expectedRole: UPDATER_EXPECTED_ROLE,
    spec: UPDATER_PROBE_SPEC,
  });
  config = null;
  console.log(formatProbeResult(result));
  return result.classification === "LOGIN_OK_AND_PRIVILEGES_OK" ? 0 : 1;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  main().then((code) => process.exit(code));
}
