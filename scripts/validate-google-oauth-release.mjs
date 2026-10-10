/**
 * Google OAuth の公開のゲートを判定する（読み取りだけ・通信なし）。
 *
 *   node scripts/validate-google-oauth-release.mjs
 *   EVIDENCE_PATH=./docs/production-readiness/evidence/google-oauth-release-gate-YYYY-MM-DD.json node scripts/validate-google-oauth-release.mjs
 *
 * 入力: docs/production-readiness/google-oauth-release-checklist.json（本人の記録）とコード（oauth.ts・辞書・アカウントの画面・callback）。
 * 出力: 判定（READY_TO_ENABLE / BLOCKED、GO / NO_GO / PENDING / NOT_STARTED）。EVIDENCE_PATH を指定したときだけ、
 *       個人情報・秘密情報を含まない要約をワークスペースの中に書く。終了コード: rollbackRequired なら 2、BLOCKED なら 1、それ以外 0。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { codeChecks, evaluateOAuthReleaseGate } from "./lib/oauth-release-gate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const checklist = JSON.parse(read("docs/production-readiness/google-oauth-release-checklist.json"));
const code = codeChecks({
  oauthSource: read("src/lib/supabase/oauth.ts"),
  dictJa: read("src/lib/i18n/dictionaries/ja-ns/auth.ts"),
  dictEn: read("src/lib/i18n/dictionaries/en.ts"),
  accountViewSource: read("src/components/auth/AccountView.tsx"),
  callbackSource: read("src/app/auth/callback/route.ts"),
});
const result = evaluateOAuthReleaseGate({ checklist, code });

console.log(`[google-oauth-release] code mode: ${code.oauthMode}`);
console.log(`[google-oauth-release] pre-enable: ${result.preEnableVerdict} (pass ${result.preEnable.counts.pass} / pending ${result.preEnable.counts.pending} / fail ${result.preEnable.counts.fail})`);
console.log(`[google-oauth-release] post-enable: ${result.postEnableVerdict} (pass ${result.postEnable.counts.pass} / pending ${result.postEnable.counts.pending} / fail ${result.postEnable.counts.fail})`);
for (const f of result.codeFailures) console.log(`  code check failed: ${f}`);
for (const p of [...result.preEnable.problems, ...result.postEnable.problems]) console.log(`  ${p}`);
if (result.rollbackRequired) console.log("[google-oauth-release] ROLLBACK REQUIRED: close the entry (Supabase Google provider Disable, or GOOGLE_OAUTH_MODE = disabled).");

if (process.env.EVIDENCE_PATH) {
  const out = path.resolve(ROOT, process.env.EVIDENCE_PATH);
  if (!out.startsWith(ROOT + path.sep)) throw new Error("EVIDENCE_PATH must be inside the workspace");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        schema: "google-oauth-release-gate-evidence/v1",
        generatedAt: new Date().toISOString(),
        codeMode: code.oauthMode,
        codeChecks: code,
        preEnableVerdict: result.preEnableVerdict,
        postEnableVerdict: result.postEnableVerdict,
        rollbackRequired: result.rollbackRequired,
        counts: { preEnable: result.preEnable.counts, postEnable: result.postEnable.counts },
        problems: [...result.preEnable.problems, ...result.postEnable.problems],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`[google-oauth-release] evidence: ${path.relative(ROOT, out)}`);
}
process.exitCode = result.rollbackRequired ? 2 : result.preEnableVerdict === "BLOCKED" ? 1 : 0;
