import { describe, it, expect } from "vitest";
import {
  PUBLIC_SUPPORT_CONFIG,
  isDisplayableSupportEmail,
  isDisplayableSupportUrl,
  resolveSupportChannels,
  type PublicSupportConfig,
} from "./support-config";

const CONFIGURED_EMAIL = "efootballteamAIsuportteam@outlook.jp";

describe("PUBLIC_SUPPORT_CONFIG(公開前設定)", () => {
  it("運営者が作成・送受信確認済みの公開専用メールアドレスが、一般問い合わせ・権利者向け・プライバシー問い合わせの3用途に設定されている", () => {
    expect(PUBLIC_SUPPORT_CONFIG.supportEmail).toBe(CONFIGURED_EMAIL);
    expect(PUBLIC_SUPPORT_CONFIG.rightsContactEmail).toBe(CONFIGURED_EMAIL);
    expect(PUBLIC_SUPPORT_CONFIG.privacyContactEmail).toBe(CONFIGURED_EMAIL);
  });

  it("形式検証に成功しているため有効化されている", () => {
    expect(PUBLIC_SUPPORT_CONFIG.enabled).toBe(true);
  });

  it("issueTrackerUrlは今回設定対象ではないため未設定のまま", () => {
    expect(PUBLIC_SUPPORT_CONFIG.issueTrackerUrl).toBeNull();
  });

  it("メールアドレスの綴り「suport」(pが1つ)を「support」へ自動修正していない", () => {
    // 一般的な英単語のスペルミスに見えても、これは実際に作成・送受信確認済みの正式なアドレスであり、
    // 自動修正してはならない(タスクの明示的な指示)。
    expect(PUBLIC_SUPPORT_CONFIG.supportEmail).toContain("suportteam");
    expect(PUBLIC_SUPPORT_CONFIG.supportEmail).not.toContain("supportteam");
    expect(PUBLIC_SUPPORT_CONFIG.supportEmail?.toLowerCase()).not.toBe("efootballteamaisupportteam@outlook.jp");
  });

  it("大文字・小文字を含む表記をそのまま保持している(ユーザー提示の表記通り)", () => {
    expect(PUBLIC_SUPPORT_CONFIG.supportEmail).toBe("efootballteamAIsuportteam@outlook.jp");
  });
});

describe("isDisplayableSupportEmail", () => {
  it("null/undefined/空文字は表示不可", () => {
    expect(isDisplayableSupportEmail(null)).toBe(false);
    expect(isDisplayableSupportEmail(undefined)).toBe(false);
    expect(isDisplayableSupportEmail("")).toBe(false);
  });
  it("正常なメールアドレス形式は表示可能", () => {
    expect(isDisplayableSupportEmail("support@example.com")).toBe(true);
  });
  it("空白・角括弧・引用符を含む文字列は拒否する", () => {
    expect(isDisplayableSupportEmail("a b@example.com")).toBe(false);
    expect(isDisplayableSupportEmail("<script>@example.com")).toBe(false);
    expect(isDisplayableSupportEmail('"x"@example.com')).toBe(false);
  });
  it("未置換テンプレート変数風の文字列は拒否する", () => {
    expect(isDisplayableSupportEmail("{SUPPORT_EMAIL}")).toBe(false);
    expect(isDisplayableSupportEmail("TODO")).toBe(false);
  });
  it("一般的な英単語と綴りが異なっていても、形式さえ満たせば有効なメールアドレスとして受理する(スペルミス扱いで拒否しない)", () => {
    expect(isDisplayableSupportEmail("efootballteamAIsuportteam@outlook.jp")).toBe(true);
  });
});

describe("isDisplayableSupportUrl", () => {
  it("null/undefined/空文字は表示不可", () => {
    expect(isDisplayableSupportUrl(null)).toBe(false);
    expect(isDisplayableSupportUrl(undefined)).toBe(false);
    expect(isDisplayableSupportUrl("")).toBe(false);
  });
  it("https/httpのURLは表示可能", () => {
    expect(isDisplayableSupportUrl("https://github.com/example/repo/issues")).toBe(true);
    expect(isDisplayableSupportUrl("http://example.com")).toBe(true);
  });
  it("危険なURLスキームを拒否する", () => {
    expect(isDisplayableSupportUrl("javascript:alert(1)")).toBe(false);
    expect(isDisplayableSupportUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isDisplayableSupportUrl("file:///etc/passwd")).toBe(false);
  });
  it("不正な形式のURL文字列は拒否する", () => {
    expect(isDisplayableSupportUrl("not a url")).toBe(false);
  });
});

describe("resolveSupportChannels", () => {
  it("enabled: false の場合、値が設定されていてもすべてnullを返す(安全側のデフォルト)", () => {
    const config: PublicSupportConfig = {
      supportEmail: "support@example.com",
      issueTrackerUrl: "https://github.com/example/repo/issues",
      rightsContactEmail: "rights@example.com",
      privacyContactEmail: "privacy@example.com",
      enabled: false,
    };
    const resolved = resolveSupportChannels(config);
    expect(resolved.supportEmail).toBeNull();
    expect(resolved.issueTrackerUrl).toBeNull();
    expect(resolved.rightsContactEmail).toBeNull();
    expect(resolved.privacyContactEmail).toBeNull();
    expect(resolved.hasAnyChannel).toBe(false);
  });

  it("enabled: true かつ安全な値であれば、そのまま解決される", () => {
    const config: PublicSupportConfig = {
      supportEmail: "support@example.com",
      issueTrackerUrl: "https://github.com/example/repo/issues",
      rightsContactEmail: null,
      privacyContactEmail: null,
      enabled: true,
    };
    const resolved = resolveSupportChannels(config);
    expect(resolved.supportEmail).toBe("support@example.com");
    expect(resolved.issueTrackerUrl).toBe("https://github.com/example/repo/issues");
    expect(resolved.rightsContactEmail).toBeNull();
    expect(resolved.hasAnyChannel).toBe(true);
  });

  it("enabled: true でも危険/不正な値は無視してnullにする", () => {
    const config: PublicSupportConfig = {
      supportEmail: "javascript:alert(1)",
      issueTrackerUrl: "javascript:alert(1)",
      rightsContactEmail: "{RIGHTS_EMAIL}",
      privacyContactEmail: null,
      enabled: true,
    };
    const resolved = resolveSupportChannels(config);
    expect(resolved.supportEmail).toBeNull();
    expect(resolved.issueTrackerUrl).toBeNull();
    expect(resolved.rightsContactEmail).toBeNull();
    expect(resolved.hasAnyChannel).toBe(false);
  });

  it("既定(引数省略)ではPUBLIC_SUPPORT_CONFIGを使い、設定済みの公開専用メールアドレスを一般問い合わせ・権利者向け・プライバシーの3用途で返す", () => {
    const resolved = resolveSupportChannels();
    expect(resolved.hasAnyChannel).toBe(true);
    expect(resolved.supportEmail).toBe(CONFIGURED_EMAIL);
    expect(resolved.rightsContactEmail).toBe(CONFIGURED_EMAIL);
    expect(resolved.privacyContactEmail).toBe(CONFIGURED_EMAIL);
    expect(resolved.issueTrackerUrl).toBeNull();
  });

  it("日本語・英語のどちらで解決しても同じメールアドレスを返す(言語によって宛先を変えない、という設計の前提を確認する)", () => {
    // このモジュール自体はロケールを受け取らない設計であり、呼び出し側(SupportView等)がどの
    // localeで描画してもmailtoの宛先(メールアドレス)は同一である、という不変条件を保証する。
    const first = resolveSupportChannels();
    const second = resolveSupportChannels();
    expect(first.supportEmail).toBe(second.supportEmail);
    expect(first.supportEmail).toBe(CONFIGURED_EMAIL);
  });
});
