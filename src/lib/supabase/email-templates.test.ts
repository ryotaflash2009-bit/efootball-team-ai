import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { EMAIL_LINK_TYPES, parseConfirmParams } from "./email-link";

/**
 * Supabase Auth のメールテンプレート（docs/production-readiness/email-templates）の静的監査と、
 * 実 SMTP を使わない描画の模擬（テンプレート変数を見本値へ置き換え、リンクがアプリの検証を通るか）。
 */
const DIR = path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "email-templates");
const NAMES = ["change-email", "confirm-signup", "invite", "magic-link", "reauthentication", "reset-password"];
const subjects = JSON.parse(readFileSync(path.join(DIR, "subjects.json"), "utf8")) as { file: string; text: string; subject: string; verifyType: string | null }[];
const read = (f: string) => readFileSync(path.join(DIR, f), "utf8");

/** Supabase 公式のテンプレート変数のうち、このテンプレートで使ってよいもの（利用者のデータ系は使わない）。 */
const ALLOWED_VARS = new Set(["SiteURL", "TokenHash", "Token"]);
const OFFICIAL_VARS = new Set(["ConfirmationURL", "Token", "TokenHash", "SiteURL", "RedirectTo", "Data", "Email", "NewEmail", "OldEmail", "Phone", "OldPhone", "Provider", "FactorType"]);

/** 見本値で描画する（実 SMTP・実トークンなし）。 */
function render(tpl: string): string {
  return tpl.replaceAll("{{ .SiteURL }}", "https://example.app").replaceAll("{{ .TokenHash }}", "a".repeat(56)).replaceAll("{{ .Token }}", "123456");
}

describe("認証メールテンプレート（HTML・プレーンテキスト）", () => {
  it("6種類の HTML とプレーンテキストがそろい、件名とリンクの種類が台帳にある", () => {
    const files = readdirSync(DIR);
    for (const n of NAMES) {
      expect(files).toContain(`${n}.html`);
      expect(files).toContain(`${n}.txt`);
    }
    expect(subjects.map((s) => s.file).sort()).toEqual(NAMES.map((n) => `${n}.html`));
  });

  for (const n of NAMES) {
    const html = () => read(`${n}.html`);
    const text = () => read(`${n}.txt`);
    const meta = () => subjects.find((s) => s.file === `${n}.html`)!;

    it(`${n}: 日本語と英語・目的・有効期限・心当たりがない場合・共有しない注意・サポート・非公式の説明（HTML とテキスト）`, () => {
      for (const body of [html(), text()]) {
        expect(body).toMatch(/[぀-ヿ]/);
        expect(body).toContain("有効期限");
        expect(body).toMatch(/expires?/);
        expect(body).toContain("心当たりがない場合");
        expect(body).toContain("If you did not request this");
        expect(body).toContain("他の人に送らないでください");
        expect(body).toContain("Never share");
        expect(body).toContain("{{ .SiteURL }}/support");
        expect(body).toContain("非公式");
        expect(body).toContain("not affiliated with KONAMI");
      }
      expect(text()).not.toMatch(/<[a-z][^>]*>/i);
      expect(html()).toContain("color-scheme:light");
    });

    it(`${n}: Supabase 公式の変数だけ・利用者のデータを使わない・リンクはアプリの許可リストの種類`, () => {
      for (const body of [html(), text()]) {
        const vars = [...body.matchAll(/\{\{\s*\.([A-Za-z]+)\s*\}\}/g)].map((m) => m[1]);
        for (const v of vars) {
          expect(OFFICIAL_VARS.has(v), v).toBe(true);
          expect(ALLOWED_VARS.has(v), v).toBe(true);
        }
        expect(body).not.toMatch(/\{\{[^}]*\|/); // テンプレート関数・パイプを使わない
      }
      const t = meta().verifyType;
      if (n === "reauthentication") {
        expect(t).toBeNull();
        expect(html()).toContain("{{ .Token }}");
      } else {
        expect((EMAIL_LINK_TYPES as readonly string[]).includes(t!)).toBe(true);
        expect(html()).toContain(`href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${t}"`);
        expect(text()).toContain(`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${t}`);
      }
    });

    it(`${n}: 画像・スクリプト・外部 URL・追跡・内部情報を含まない`, () => {
      const h = html();
      expect(h).not.toMatch(/<script|<img|<iframe|<form|<link|<style|javascript:|onclick=|onerror=|onload=/i);
      const hrefs = [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
      for (const u of hrefs) expect(u, u).toMatch(/^\{\{ \.SiteURL \}\}\/(support|auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&amp;type=[a-z_]+)$/);
      expect(h).not.toMatch(/https?:\/\//);
      expect(h).not.toMatch(/supabase\.co|project[_ -]?ref|service_role|checksum|batch|object ?key|stack|debug|user[_ ]?id|utm_/i);
      expect(h.length).toBeLessThan(10_000);
    });

    it(`${n}: 描画の模擬 — リンクは同じサイトの /auth/confirm か /support だけで、アプリの検証を通り、戻り先は固定`, () => {
      const out = render(html());
      const hrefs = [...out.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
      for (const href of hrefs) {
        const u = new URL(href);
        expect(u.origin).toBe("https://example.app");
        if (u.pathname === "/auth/confirm") {
          const p = parseConfirmParams(u.search);
          expect(p.ok, href).toBe(true);
          if (p.ok) expect(p.next.startsWith("/")).toBe(true);
        } else {
          expect(u.pathname).toBe("/support");
        }
      }
      if (n === "reauthentication") expect(out).toContain("123456");
    });
  }

  it("件名: ブランド名・日英・短い・改行なし（ヘッダーインジェクション防止）・過剰な宣伝表現なし", () => {
    for (const { subject } of subjects) {
      expect(subject).toContain("TeamAIXI");
      expect(subject).toMatch(/[぀-ヿ]/);
      expect(subject).toMatch(/[A-Za-z]+ [a-z]+/);
      expect(subject.length).toBeLessThanOrEqual(60);
      expect(subject).not.toMatch(/[\r\n]/);
      expect(subject).not.toMatch(/無料|今すぐ|!!|FREE|WIN|URGENT|緊急/i);
    }
  });
});
