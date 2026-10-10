import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeChecks, evaluateOAuthReleaseGate, LIMITED_TEST_ITEMS, POST_ENABLE_ITEMS, PUBLIC_RELEASE_ITEMS } from "../../../scripts/lib/oauth-release-gate.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const realCode = () =>
  codeChecks({
    oauthSource: read("src/lib/supabase/oauth.ts"),
    dictJa: read("src/lib/i18n/dictionaries/ja-ns/auth.ts"),
    dictEn: read("src/lib/i18n/dictionaries/en.ts"),
    accountViewSource: read("src/components/auth/AccountView.tsx"),
    callbackSource: read("src/app/auth/callback/route.ts"),
  });
const realChecklist = () => JSON.parse(read("docs/production-readiness/google-oauth-release-checklist.json"));
const all = (items: string[], status: string, extra: Record<string, unknown> = {}): Record<string, Record<string, unknown>> =>
  Object.fromEntries(items.map((k) => [k, { status, evidence: "ok", checkedAt: status === "pass" ? "2026-10-12" : null, ...extra }]));
const passedPost = () => {
  const post = all(POST_ENABLE_ITEMS, "pass");
  post.prodExistingEmailConflictRecorded = { ...post.prodExistingEmailConflictRecorded, observedLinking: "linked" };
  return post;
};

describe("Google OAuth の公開のゲート（2 段階）", () => {
  it("今のリポジトリ: コードの確認はすべて合格・モードは disabled・本人の記録は未着手 → A・B とも BLOCKED", () => {
    const code = realCode();
    expect(code.entryMode).toBe("disabled");
    const r = evaluateOAuthReleaseGate({ checklist: realChecklist(), code });
    expect(r.codeFailures).toEqual([]);
    expect(r).toMatchObject({ limitedVerdict: "BLOCKED", publicVerdict: "BLOCKED", postEnableVerdict: "NOT_STARTED", rollbackRequired: false });
  });

  it("CI の防御: コードを limited にするなら A、enabled にするなら B がそろっていること（設定の前のマージを止める）", () => {
    const code = realCode();
    const r = evaluateOAuthReleaseGate({ checklist: realChecklist(), code });
    if (code.entryMode === "limited") expect(r.limitedVerdict).toBe("LIMITED_OAUTH_TEST_READY");
    if (code.entryMode === "enabled") expect(r.publicVerdict).toBe("PUBLIC_GOOGLE_OAUTH_READY");
    expect(r.rollbackRequired).toBe(false);
    for (const mode of ["limited", "enabled"]) {
      expect(evaluateOAuthReleaseGate({ checklist: realChecklist(), code: { ...code, entryMode: mode } })).toMatchObject({ postEnableVerdict: "NO_GO", rollbackRequired: true });
    }
  });

  it("A: 限定テストの 13 項目がすべて pass → LIMITED_OAUTH_TEST_READY（B はまだ BLOCKED）", () => {
    const code = { ...realCode(), entryMode: "limited" };
    const r = evaluateOAuthReleaseGate({ checklist: { limitedTest: all(LIMITED_TEST_ITEMS, "pass"), postEnable: {}, publicRelease: {} }, code });
    expect(r).toMatchObject({ limitedVerdict: "LIMITED_OAUTH_TEST_READY", publicVerdict: "BLOCKED", postEnableVerdict: "PENDING", rollbackRequired: false });
  });

  it("A: TeamAIXI 専用の Google Cloud プロジェクトの確認が無ければ BLOCKED（他のプロジェクトとの取り違えの防止）", () => {
    const limited = all(LIMITED_TEST_ITEMS, "pass");
    limited.googleProjectDedicatedToTeamAixi = { status: "pending", evidence: "", checkedAt: null };
    expect(evaluateOAuthReleaseGate({ checklist: { limitedTest: limited }, code: realCode() }).limitedVerdict).toBe("BLOCKED");
  });

  it("B: A ＋ 限定テストの 12 項目 ＋ Google 側の本番公開・ポリシーの一般公開 → PUBLIC_GOOGLE_OAUTH_READY。RLS の分離の失敗は NO_GO", () => {
    const code = { ...realCode(), entryMode: "enabled" };
    const checklist = { limitedTest: all(LIMITED_TEST_ITEMS, "pass"), postEnable: passedPost(), publicRelease: all(PUBLIC_RELEASE_ITEMS, "pass") };
    expect(evaluateOAuthReleaseGate({ checklist, code })).toMatchObject({ limitedVerdict: "LIMITED_OAUTH_TEST_READY", postEnableVerdict: "GO", publicVerdict: "PUBLIC_GOOGLE_OAUTH_READY", rollbackRequired: false });
    const bad = { ...checklist, postEnable: { ...checklist.postEnable, prodRlsIsolationAB: { status: "fail", evidence: "B saw A", checkedAt: "2026-10-12" } } };
    expect(evaluateOAuthReleaseGate({ checklist: bad, code })).toMatchObject({ postEnableVerdict: "NO_GO", rollbackRequired: true, publicVerdict: "BLOCKED" });
  });

  it("同じメールの統合は推測で保証しない: 観測の結果（linked / separate）を記録しない限り GO にしない", () => {
    const code = { ...realCode(), entryMode: "limited" };
    const post = all(POST_ENABLE_ITEMS, "pass");
    expect(evaluateOAuthReleaseGate({ checklist: { limitedTest: all(LIMITED_TEST_ITEMS, "pass"), postEnable: post }, code }).postEnableVerdict).toBe("PENDING");
    post.prodExistingEmailConflictRecorded = { ...post.prodExistingEmailConflictRecorded, observedLinking: "separate" };
    expect(evaluateOAuthReleaseGate({ checklist: { limitedTest: all(LIMITED_TEST_ITEMS, "pass"), postEnable: post }, code }).postEnableVerdict).toBe("GO");
  });

  it("Evidence に個人情報・秘密情報らしい値を書くと不合格（メール・UUID・client ID・secret・JWT）", () => {
    for (const v of ["me@example.com", "a1111111-1111-4111-8111-111111111111", "123-abc.apps.googleusercontent.com", "GOCSPX-xxxx", "eyJhbGciOiJIUzI1NiJ9.e30.x"]) {
      const limited = all(LIMITED_TEST_ITEMS, "pass");
      limited.googleWebClientCreated = { status: "pass", evidence: v, checkedAt: "2026-10-12" };
      expect(evaluateOAuthReleaseGate({ checklist: { limitedTest: limited }, code: realCode() }).limitedVerdict, v).toBe("BLOCKED");
    }
  });

  it("コードの確認が 1 つでも欠ければ BLOCKED（例: 限定モードが preview を要求しない・callback が preview を見る）", () => {
    for (const k of ["limitedModeNeedsPreview", "callbackIgnoresPreviewFlag", "accountPageLinksDeletion"]) {
      const code = { ...realCode(), [k]: false };
      expect(evaluateOAuthReleaseGate({ checklist: { limitedTest: all(LIMITED_TEST_ITEMS, "pass") }, code })).toMatchObject({ limitedVerdict: "BLOCKED", codeFailures: [k] });
    }
  });
});
