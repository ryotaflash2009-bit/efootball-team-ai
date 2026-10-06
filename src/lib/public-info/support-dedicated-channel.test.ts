import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ja from "@/lib/i18n/dictionaries/ja-full";
import en from "@/lib/i18n/dictionaries/en";
import { PUBLIC_SUPPORT_CONFIG } from "./support-config";

// 2026-10-06 の本人の決定: v1.0 は作成済みの専用メールボックスを維持し、TeamAIXI 専用の窓口であることを明示する。
// 独自ドメインの取得後に TeamAIXI 名義のアドレスへ移行する（docs/product/integrated-roadmap.md の v1.1 backlog）。
describe("問い合わせページ: TeamAIXI 専用の窓口と問い合わせ時の注意", () => {
  it("窓口の名前は本人指定のとおり（ja/en）", () => {
    expect(ja.support.dedicatedChannelLabel).toBe("TeamAIXI専用サポート窓口");
    expect(en.support.dedicatedChannelLabel).toBe("TeamAIXI Support");
  });

  it("注意書きは本人指定の文言そのまま（ja/en）", () => {
    expect(ja.support.contactSafetyNotice).toBe(
      "パスワード、確認コード、APIキー、Secret、住所、電話番号などの個人情報は送信しないでください。不具合を報告する場合は、画面名、操作手順、発生日時、端末、OS、ブラウザーのみを記載してください。",
    );
    expect(en.support.contactSafetyNotice).toBe(
      "Do not send passwords, verification codes, API keys, secrets, addresses, phone numbers, or other personal information. Bug reports should include only the screen, steps, time of occurrence, device, operating system, and browser.",
    );
  });

  it("専用メールボックスを v1.0 で維持している", () => {
    expect(PUBLIC_SUPPORT_CONFIG.enabled).toBe(true);
    expect(PUBLIC_SUPPORT_CONFIG.supportEmail).toBe("efootballteamAIsuportteam@outlook.jp");
  });

  it("画面は窓口の名前を見出しにし、アドレスは強調しない。注意書きを表示する", () => {
    const view = readFileSync("src/components/public-info/SupportView.tsx", "utf8");
    expect(view).toContain('ts("dedicatedChannelLabel")');
    expect(view).toContain('ts("contactSafetyNotice")');
    const addressLine = view.split("\n").find((l) => l.includes("{channels.supportEmail}</p>")) ?? "";
    expect(addressLine).not.toContain("font-semibold");
    expect(view.indexOf('ts("dedicatedChannelLabel")')).toBeLessThan(view.indexOf("{channels.supportEmail}</p>"));
  });

  it("問い合わせページの利用者向けの文言に旧 Project 名を出さない", () => {
    const text = JSON.stringify([ja.support, en.support]);
    expect(text).not.toMatch(/eFootball Team AI|eFootball-Team-AI/);
  });
});
