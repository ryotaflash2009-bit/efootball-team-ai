import { describe, it, expect } from "vitest";
import ja from "@/lib/i18n/dictionaries/ja";
import en from "@/lib/i18n/dictionaries/en";
import {
  buildReleaseReadinessItems,
  assertUniqueIds,
  getBlockersForLevel,
  type ReleaseReadinessStatus,
  type ReleaseReadinessBlockingLevel,
} from "./release-readiness";

const VALID_STATUSES: ReleaseReadinessStatus[] = [
  "complete",
  "partial",
  "not-started",
  "not-applicable",
  "requires-owner-action",
  "requires-specialist-review",
];
const VALID_BLOCKING_LEVELS: ReleaseReadinessBlockingLevel[] = [
  "local-only",
  "internal-test-blocker",
  "invite-beta-blocker",
  "public-beta-blocker",
  "production-blocker",
  "paid-plan-blocker",
];

describe("buildReleaseReadinessItems", () => {
  it("すべての項目idが一意である", () => {
    const items = buildReleaseReadinessItems();
    expect(assertUniqueIds(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it("すべての項目のstatusが有効な値である", () => {
    for (const item of buildReleaseReadinessItems()) {
      expect(VALID_STATUSES).toContain(item.status);
    }
  });

  it("すべての項目のblockingLevelが有効な値である", () => {
    for (const item of buildReleaseReadinessItems()) {
      expect(VALID_BLOCKING_LEVELS).toContain(item.blockingLevel);
    }
  });

  it("titleKey/descriptionKeyがja/en辞書の releaseReadiness 名前空間に実在する(表示名をIDに使っていない)", () => {
    for (const item of buildReleaseReadinessItems()) {
      expect(ja.releaseReadiness).toHaveProperty(item.titleKey);
      expect(ja.releaseReadiness).toHaveProperty(item.descriptionKey);
      expect(en.releaseReadiness).toHaveProperty(item.titleKey);
      expect(en.releaseReadiness).toHaveProperty(item.descriptionKey);
    }
  });

  it("idは辞書キー名やUI表示文字列ではなく、内部識別子用のkebab-case文字列である", () => {
    for (const item of buildReleaseReadinessItems()) {
      expect(item.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("内部パス・PID・SQLiteテーブル名等の開発者向け情報を含まない", () => {
    const serialized = JSON.stringify(buildReleaseReadinessItems());
    expect(serialized).not.toMatch(/C:\\|\/data\/server\.pid|world_player_cards|localhost:3000/i);
  });

  it("認証・ユーザー別データ分離は実装済み、端末間の完全な自動同期は未着手として記録される(過大評価も過小評価もしない)", () => {
    const items = buildReleaseReadinessItems();
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("auth")?.status).toBe("complete");
    expect(byId.get("data-isolation")?.status).toBe("complete");
    expect(byId.get("sync")?.status).toBe("not-started");
    expect(byId.get("cloud-backup")?.status).toBe("partial");
  });

  it("認証・データ分離を「実装済み」と記録する一方、端末間の完全な自動同期はいまだ「未着手」のままである(混同しない)", () => {
    const items = buildReleaseReadinessItems();
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("auth")?.status).not.toBe("not-started");
    expect(byId.get("sync")?.status).not.toBe("complete");
  });

  it("決済・課金・解約は未着手として記録され、Pro課金開始のブロッカーとして扱われる", () => {
    const items = buildReleaseReadinessItems();
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("billing")?.status).toBe("not-started");
    expect(byId.get("billing")?.blockingLevel).toBe("paid-plan-blocker");
    expect(byId.get("cancellation")?.status).toBe("not-started");
  });

  it("問い合わせ窓口・権利者連絡窓口は、公開専用メールアドレスが設定済みのため complete として扱われる", () => {
    const items = buildReleaseReadinessItems();
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("support-contact")?.status).toBe("complete");
    expect(byId.get("support-contact")?.ownerActionRequired).toBe(false);
    expect(byId.get("rights-contact")?.status).toBe("complete");
    expect(byId.get("rights-contact")?.ownerActionRequired).toBe(false);
  });

  it("問い合わせ窓口が未設定の場合(フォールバック検証)、requires-owner-action として扱われる", () => {
    const unsetChannels = {
      supportEmail: null,
      issueTrackerUrl: null,
      rightsContactEmail: null,
      privacyContactEmail: null,
      hasAnyChannel: false,
    };
    const items = buildReleaseReadinessItems(unsetChannels);
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("support-contact")?.status).toBe("requires-owner-action");
    expect(byId.get("support-contact")?.ownerActionRequired).toBe(true);
    expect(byId.get("rights-contact")?.status).toBe("requires-owner-action");
    expect(byId.get("rights-contact")?.ownerActionRequired).toBe(true);
  });

  it("問い合わせ窓口の設定有無にかかわらず、認証・同期・課金等の他のブロッカーは変更されない", () => {
    const configured = buildReleaseReadinessItems();
    const unsetChannels = {
      supportEmail: null,
      issueTrackerUrl: null,
      rightsContactEmail: null,
      privacyContactEmail: null,
      hasAnyChannel: false,
    };
    const unset = buildReleaseReadinessItems(unsetChannels);
    const untouchedIds = ["auth", "data-isolation", "sync", "cloud-backup", "billing", "cancellation", "rights-check"];
    for (const id of untouchedIds) {
      expect(configured.find((i) => i.id === id)).toEqual(unset.find((i) => i.id === id));
    }
  });

  it("権利確認は専門家確認が必要な項目として記録され、正式公開のブロッカーとして扱われる", () => {
    const items = buildReleaseReadinessItems();
    const rightsCheck = items.find((i) => i.id === "rights-check");
    expect(rightsCheck?.status).toBe("requires-specialist-review");
    expect(rightsCheck?.blockingLevel).toBe("production-blocker");
  });

  it("呼び出すたびに同じ内容を返す(決定的)", () => {
    const a = buildReleaseReadinessItems();
    const b = buildReleaseReadinessItems();
    expect(a).toEqual(b);
  });
});

describe("getBlockersForLevel", () => {
  it("指定した段階のブロッカーだけを、id昇順の決定的な順序で返す", () => {
    const items = buildReleaseReadinessItems();
    const blockers = getBlockersForLevel(items, "public-beta-blocker");
    expect(blockers.length).toBeGreaterThan(0);
    const ids = blockers.map((b) => b.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("completeまたはnot-applicableの項目はブロッカーに含めない", () => {
    const items = buildReleaseReadinessItems();
    const blockers = getBlockersForLevel(items, "local-only");
    expect(blockers.every((b) => b.status !== "complete" && b.status !== "not-applicable")).toBe(true);
  });
});
