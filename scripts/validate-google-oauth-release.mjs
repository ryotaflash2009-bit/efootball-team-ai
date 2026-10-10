/**
 * Google OAuth の公開のゲートを判定する（読み取りだけ・通信なし）。
 *
 *   node scripts/validate-google-oauth-release.mjs
 *   EVIDENCE_PATH=./docs/production-readiness/evidence/google-oauth-release-gate-YYYY-MM-DD.json node scripts/validate-google-oauth-release.mjs
 *
 * 入力: docs/production-readiness/google-oauth-release-checklist.json（本人の記録）とコード（oauth.ts・辞書・アカウントの画面・callback）。
 * 出力: 判定（A. LIMITED_OAUTH_TEST_READY / BLOCKED・限定テストの結果 GO / NO_GO / PENDING / NOT_STARTED・B. PUBLIC_GOOGLE_OAUTH_READY / BLOCKED）。EVIDENCE_PATH を指定したときだけ、
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

// モードは公開の値（"disabled" | "enabled"）。秘密ではないが、決まった語だけを出す。
console.log(`[google-oauth-release] code mode: ${["disabled", "limited", "enabled"].includes(code.entryMode) ? code.entryMode : "invalid"}`);
console.log(`[google-oauth-release] A. limited test: ${result.limitedVerdict} (pass ${result.limitedTest.counts.pass} / pending ${result.limitedTest.counts.pending} / fail ${result.limitedTest.counts.fail})`);
console.log(`[google-oauth-release] limited test results: ${result.postEnableVerdict} (pass ${result.postEnable.counts.pass} / pending ${result.postEnable.counts.pending} / fail ${result.postEnable.counts.fail})`);
console.log(`[google-oauth-release] B. public: ${result.publicVerdict}`);
for (const f of result.codeFailures) console.log(`  code check failed: ${f}`);
for (const p of [...result.limitedTest.problems, ...result.postEnable.problems, ...result.publicRelease.problems]) console.log(`  ${p}`);
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
        codeMode: code.entryMode,
        codeChecks: code,
        limitedVerdict: result.limitedVerdict,
        postEnableVerdict: result.postEnableVerdict,
        publicVerdict: result.publicVerdict,
        rollbackRequired: result.rollbackRequired,
        counts: { limitedTest: result.limitedTest.counts, postEnable: result.postEnable.counts, publicRelease: result.publicRelease.counts },
        problems: [...result.limitedTest.problems, ...result.postEnable.problems, ...result.publicRelease.problems],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`[google-oauth-release] evidence: ${path.relative(ROOT, out)}`);
}
process.exitCode = result.rollbackRequired ? 2 : result.limitedVerdict === "BLOCKED" ? 1 : 0;
