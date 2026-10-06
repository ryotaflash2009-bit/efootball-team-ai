/**
 * 総合の black-box の release gate（2026-10-07・NEW-26）。未ログインの総合 black-box と、ログイン中（テストダブル）の
 * アカウントのデータの分離の rail を続けて実行し、両方が合格したときだけ合格にする。
 *
 *   node scripts/black-box-release-gate.mjs        （next start を localhost:3000 で起動済み。ローカルだけ）
 *
 * - アカウントの rail（`black-box-account-scoped-storage.mjs`）は Supabase のテストダブルで実 Supabase に接続しない。
 *   テストダブルは localhost でだけ有効なため、この gate はローカル専用（本番では未ログインの総合 black-box だけを使う）。
 * - 書き込みはブラウザーの localStorage（架空の ID）と、各 rail の報告のファイルだけ。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("[black-box-release-gate] local only (the auth test double is enabled only on localhost)");
  process.exit(2);
}
const rails = [
  { name: "public (signed out, 8 viewports)", script: "scripts/public-black-box-full.mjs" },
  { name: "account-scoped storage (signed in with test doubles: users A/B and signed out)", script: "scripts/black-box-account-scoped-storage.mjs" },
];
const results = [];
for (const r of rails) {
  const started = Date.now();
  const p = spawnSync(process.execPath, [path.join(ROOT, r.script)], { cwd: ROOT, env: { ...process.env, BASE_URL: BASE }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const summary = (p.stdout ?? "").split("\n").filter((l) => /\d+\/\d+ PASS|FAIL/.test(l)).slice(-5);
  results.push({ name: r.name, exitCode: p.status, seconds: Math.round((Date.now() - started) / 1000), summary });
  console.log(`${p.status === 0 ? "PASS" : "FAIL"}  ${r.name}  (${Math.round((Date.now() - started) / 1000)} s)`);
  for (const l of summary) console.log(`      ${l.trim()}`);
}
const ok = results.every((r) => r.exitCode === 0);
console.log(`[black-box-release-gate] ${ok ? "PASS" : "FAIL"} (${results.filter((r) => r.exitCode === 0).length}/${results.length} rails)`);
process.exit(ok ? 0 : 1);
