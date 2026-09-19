import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ja from "./dictionaries/ja";
import en from "./dictionaries/en";

/**
 * 招待制アルファ本番確認で発見した表示不整合の再発防止テスト。
 * 実Supabase・実ネットワークへは一切接続しない(辞書オブジェクトとソースファイルの文字列確認のみ)。
 */
const REPO_ROOT = resolve(__dirname, "../../..");

describe("トップページ: 内部実装(SQLite)を露出しない", () => {
  it("ja/enともhomePage.heroDescriptionTemplateにSQLiteという語を含まない", () => {
    expect(ja.homePage.heroDescriptionTemplate).not.toMatch(/SQLite/i);
    expect(en.homePage.heroDescriptionTemplate).not.toMatch(/SQLite/i);
  });

  it("件数プレースホルダー{count}は維持されている", () => {
    expect(ja.homePage.heroDescriptionTemplate).toContain("{count}");
    expect(en.homePage.heroDescriptionTemplate).toContain("{count}");
  });
});

describe("マネージャー一覧: 内部ファイルパスを露出しない", () => {
  it("ja/enともmanagersPage.descriptionTemplateに内部ファイルパスを含まない", () => {
    expect(ja.managersPage.descriptionTemplate).not.toMatch(/data\/managers\.json/);
    expect(en.managersPage.descriptionTemplate).not.toMatch(/data\/managers\.json/);
  });

  it("出典表示({source})自体は維持されている", () => {
    expect(ja.managersPage.descriptionTemplate).toContain("{source}");
    expect(en.managersPage.descriptionTemplate).toContain("{source}");
  });
});

describe("マネージャー詳細: 生のraw GitHub URLを本文表示しない", () => {
  const source = readFileSync(resolve(REPO_ROOT, "src/app/managers/[managerId]/page.tsx"), "utf8");

  it("raw.githubusercontent.comのURLを直接埋め込んでいない", () => {
    expect(source).not.toMatch(/raw\.githubusercontent\.com/);
  });

  it("manager.sourceUrlを生のテキストとして表示せず、リンクのhrefとしてのみ使う", () => {
    expect(source).toContain("データ提供: {manager.source}");
    expect(source).toMatch(/href=\{manager\.sourceUrl\}/);
    expect(source).not.toMatch(/\{manager\.sourceUrl\}<\/span>/);
  });
});

describe("My Team: クラウド保存の説明が実装と一致する", () => {
  it("my-team向けの説明は「サーバーへの保存は未対応」という古い断定をしない", () => {
    expect(ja.localStorageNotice.bodySuffixMyTeam).not.toMatch(/サーバーへの保存には未対応/);
    expect(en.localStorageNotice.bodySuffixMyTeam).not.toMatch(/saving to a server, is not yet supported/);
  });

  it("my-team向けの説明は自動同期だと誤解させない(明示操作であることを述べる)", () => {
    expect(ja.localStorageNotice.bodySuffixMyTeam).toMatch(/明示/);
    expect(ja.localStorageNotice.bodySuffixMyTeam).not.toMatch(/自動的にクラウドへ/);
    expect(en.localStorageNotice.bodySuffixMyTeam).toMatch(/explicitly/);
  });

  it("favorites/builds向けの説明は変更しない(実際にクラウド保存が無いため、従来の「未対応」表現を維持)", () => {
    expect(ja.localStorageNotice.bodySuffix).toMatch(/サーバーへの保存には未対応/);
    expect(en.localStorageNotice.bodySuffix).toMatch(/saving to a server, is not yet supported/);
  });
});

describe("アカウント画面: クラウド同期の説明が実装と一致する", () => {
  it("「クラウド同期は未実装」という一律の断定を、My Teamクラウド保存の存在と矛盾しない形に変更している", () => {
    expect(ja.auth.accountCloudSyncNoticeTitle).not.toBe("クラウド同期は未実装です");
    expect(ja.auth.accountCloudSyncNoticeDesc).not.toMatch(/クラウド同期はまだ利用できません/);
  });

  it("My Teamクラウド保存が試験機能(アルファ)として言及されている", () => {
    expect(ja.auth.accountCloudSyncNoticeDesc).toMatch(/アルファ/);
    expect(en.auth.accountCloudSyncNoticeDesc).toMatch(/alpha/i);
  });

  it("myTeamCloudのページタイトルは「開発用PoC」ではなく、アルファ機能として表示される", () => {
    expect(ja.myTeamCloud.pageTitle).not.toMatch(/開発用PoC/);
    expect(en.myTeamCloud.pageTitle).not.toMatch(/Dev PoC/);
  });
});

describe("日英の整合性(キー集合が一致する)", () => {
  it("localStorageNoticeのキー集合がja/enで一致する", () => {
    expect(Object.keys(en.localStorageNotice).sort()).toEqual(Object.keys(ja.localStorageNotice).sort());
  });

  it("myTeamCloudのキー集合がja/enで一致する", () => {
    expect(Object.keys(en.myTeamCloud).sort()).toEqual(Object.keys(ja.myTeamCloud).sort());
  });

  it("authのキー集合がja/enで一致する", () => {
    expect(Object.keys(en.auth).sort()).toEqual(Object.keys(ja.auth).sort());
  });
});
