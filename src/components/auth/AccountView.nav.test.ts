import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * `/account/rls-test`(Row Level Security分離検証専用の開発向けPoC画面)を、
 * 招待制アルファ公開前に一般利用者向けアカウント画面のナビゲーションから除外したことを
 * ソーステキストで確認する。ページ自体は削除していない(直接URLアクセス・
 * ログイン済み利用者による利用は引き続き可能)。
 *
 * このプロジェクトのVitest環境は"node"(jsdom不使用、`*.test.ts`のみ対象)のため、
 * コンポーネントを実際に描画するテストは行わず、ソーステキストの静的検証にとどめる。
 */
const ACCOUNT_VIEW_PATH = path.resolve(__dirname, "AccountView.tsx");

function readAccountViewSource(): string {
  return readFileSync(ACCOUNT_VIEW_PATH, "utf8");
}

describe("AccountView: 一般利用者向けナビゲーション", () => {
  it("/account/rls-testへのリンクを含まない", () => {
    const source = readAccountViewSource();
    expect(source).not.toContain("/account/rls-test");
  });

  it("既存の通常アカウント導線(My Teamクラウド・ローカルデータ移行)は維持されている", () => {
    const source = readAccountViewSource();
    expect(source).toContain("/account/my-team-cloud");
    expect(source).toContain("/account/local-data-migration");
  });

  it("ログイン・ログアウト導線は維持されている", () => {
    const source = readAccountViewSource();
    expect(source).toContain("/auth/sign-in");
    expect(source).toContain("/auth/sign-up");
    expect(source).toContain("handleLogout");
  });
});
