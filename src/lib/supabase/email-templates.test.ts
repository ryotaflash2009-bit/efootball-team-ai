import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Supabase Auth のメールテンプレート（docs/production-readiness/email-templates/*.html）の静的監査。
 * 本人が Supabase Dashboard > Authentication > Emails へ貼り付ける前提の内容。
 */
const DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "email-templates");
const files = readdirSync(DIR).filter((f) => f.endsWith(".html"));
const subjects = JSON.parse(readFileSync(path.join(DIR, "subjects.json"), "utf8")) as { file: string; subject: string }[];
const read = (f: string) => readFileSync(path.join(DIR, f), "utf8");

describe("認証メールテンプレート", () => {
  it("6種類（登録確認・マジックリンク・パスワード再設定・メール変更・招待・再認証）がそろい、件名がある", () => {
    expect(files.sort()).toEqual(["change-email.html", "confirm-signup.html", "invite.html", "magic-link.html", "reauthentication.html", "reset-password.html"]);
    expect(subjects.map((s) => s.file).sort()).toEqual(files.sort());
  });

  for (const f of ["change-email.html", "confirm-signup.html", "invite.html", "magic-link.html", "reauthentication.html", "reset-password.html"]) {
    it(`${f}: 日本語と英語、目的、有効期限、心当たりがない場合、コードを共有しない、サポート、非公式の説明`, () => {
      const h = read(f);
      expect(h).toMatch(/[぀-ヿ]/);
      expect(h).toMatch(/[A-Za-z]{4,} [A-Za-z]{4,}/);
      expect(h).toContain("有効期限");
      expect(h).toMatch(/expires?/);
      expect(h).toContain("心当たりがない場合");
      expect(h).toContain("If you did not request this");
      expect(h).toContain("他の人に送らないでください");
      expect(h).toContain("Never share");
      expect(h).toContain('href="{{ .SiteURL }}/support"');
      expect(h).toContain("非公式");
      expect(h).toContain("not affiliated with KONAMI");
      // 必要な変数（リンクまたはコード）
      if (f === "reauthentication.html") expect(h).toContain("{{ .Token }}");
      else expect(h).toContain('href="{{ .ConfirmationURL }}"');
    });

    it(`${f}: 画像・スクリプト・外部 URL・利用者の個人データ・内部情報を含まない`, () => {
      const h = read(f);
      expect(h).not.toMatch(/<script|<img|<iframe|<form|<link|javascript:|onclick=|onerror=/i);
      // リンクは Supabase のテンプレート変数だけ（任意の外部 URL を埋め込まない）
      const hrefs = [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      for (const u of hrefs) expect(u, u).toMatch(/^\{\{ \.(ConfirmationURL|SiteURL) \}\}(\/support)?$/);
      expect(h).not.toMatch(/https?:\/\//);
      // Supabase 推奨: 利用者が入力したデータ（メールアドレス等）をメールに含めない
      expect(h).not.toMatch(/\{\{ \.(Email|NewEmail|Data|RedirectTo|TokenHash) \}\}/);
      expect(h).not.toMatch(/supabase\.co|project[_ -]?ref|service_role|checksum|batch|object ?key|stack|debug|user[_ ]?id/i);
      expect(h.length).toBeLessThan(10_000);
    });
  }

  it("件名: ブランド名・日英・短い・過剰な宣伝表現なし", () => {
    for (const { subject } of subjects) {
      expect(subject).toContain("eFootball Team AI");
      expect(subject).toMatch(/[぀-ヿ]/);
      expect(subject).toMatch(/[A-Za-z]+ [a-z]+/);
      expect(subject.length).toBeLessThanOrEqual(60);
      expect(subject).not.toMatch(/無料|今すぐ|!!|FREE|WIN|URGENT|緊急/i);
    }
  });
});
