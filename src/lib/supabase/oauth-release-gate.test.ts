import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeChecks, evaluateOAuthReleaseGate, POST_ENABLE_ITEMS, PRE_ENABLE_ITEMS } from "../../../scripts/lib/oauth-release-gate.mjs";

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

describe("Google OAuth の公開のゲート", () => {
  it("今のリポジトリ: コードの確認はすべて合格・モードは disabled・本人の記録は未着手 → BLOCKED / NOT_STARTED", () => {
    const code = realCode();
    expect(code.oauthMode).toBe("disabled");
    const r = evaluateOAuthReleaseGate({ checklist: realChecklist(), code });
    expect(r.codeFailures).toEqual([]);
    expect(r.preEnableVerdict).toBe("BLOCKED");
    expect(r.postEnableVerdict).toBe("NOT_STARTED");
    expect(r.rollbackRequired).toBe(false);
  });

  it("CI の防御: コードを enabled にするなら、有効化の前の記録がすべて pass であること（設定の前のマージを止める）", () => {
    const code = realCode();
    if (code.oauthMode === "enabled") {
      expect(evaluateOAuthReleaseGate({ checklist: realChecklist(), code }).preEnableVerdict).toBe("READY_TO_ENABLE");
    }
    // 仮に enabled で記録が不足していれば NO_GO・入口を閉じる
    const r = evaluateOAuthReleaseGate({ checklist: realChecklist(), code: { ...code, oauthMode: "enabled" } });
    expect(r).toMatchObject({ postEnableVerdict: "NO_GO", rollbackRequired: true });
  });

  it("有効化の前の記録がすべて pass → READY_TO_ENABLE。有効化の後: すべて pass → GO・RLS の分離の失敗 → NO_GO", () => {
    const code = { ...realCode(), oauthMode: "enabled" };
    const pre = all(PRE_ENABLE_ITEMS, "pass");
    const post = all(POST_ENABLE_ITEMS, "pass");
    post.prodExistingEmailConflictRecorded = { ...post.prodExistingEmailConflictRecorded, observedLinking: "linked" };
    expect(evaluateOAuthReleaseGate({ checklist: { preEnable: pre, postEnable: post }, code })).toMatchObject({ preEnableVerdict: "READY_TO_ENABLE", postEnableVerdict: "GO", rollbackRequired: false });
    const bad = { ...post, prodRlsIsolationAB: { status: "fail", evidence: "B saw A", checkedAt: "2026-10-12" } };
    expect(evaluateOAuthReleaseGate({ checklist: { preEnable: pre, postEnable: bad }, code })).toMatchObject({ postEnableVerdict: "NO_GO", rollbackRequired: true });
  });

  it("同じメールの統合は推測で保証しない: 観測の結果（linked / separate）を記録しない限り GO にしない", () => {
    const code = { ...realCode(), oauthMode: "enabled" };
    const post = all(POST_ENABLE_ITEMS, "pass");
    const r = evaluateOAuthReleaseGate({ checklist: { preEnable: all(PRE_ENABLE_ITEMS, "pass"), postEnable: post }, code });
    expect(r.postEnableVerdict).toBe("PENDING");
    post.prodExistingEmailConflictRecorded = { ...post.prodExistingEmailConflictRecorded, observedLinking: "separate" };
    expect(evaluateOAuthReleaseGate({ checklist: { preEnable: all(PRE_ENABLE_ITEMS, "pass"), postEnable: post }, code }).postEnableVerdict).toBe("GO");
  });

  it("Evidence に個人情報・秘密情報らしい値を書くと不合格（メール・UUID・client ID・secret・JWT）", () => {
    const code = realCode();
    for (const v of ["me@example.com", "a1111111-1111-4111-8111-111111111111", "123-abc.apps.googleusercontent.com", "GOCSPX-xxxx", "eyJhbGciOiJIUzI1NiJ9.e30.x"]) {
      const pre = all(PRE_ENABLE_ITEMS, "pass");
      pre.googleWebClientCreated = { status: "pass", evidence: v, checkedAt: "2026-10-12" };
      const r = evaluateOAuthReleaseGate({ checklist: { preEnable: pre, postEnable: {} }, code });
      expect(r.preEnableVerdict, v).toBe("BLOCKED");
    }
  });

  it("コードの確認が 1 つでも欠ければ BLOCKED（例: アカウントの画面から削除の案内が消えた）", () => {
    const code = { ...realCode(), accountPageLinksDeletion: false };
    expect(evaluateOAuthReleaseGate({ checklist: { preEnable: all(PRE_ENABLE_ITEMS, "pass"), postEnable: {} }, code })).toMatchObject({ preEnableVerdict: "BLOCKED", codeFailures: ["accountPageLinksDeletion"] });
  });
});
