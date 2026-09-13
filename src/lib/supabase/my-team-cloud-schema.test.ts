import { describe, it, expect } from "vitest";
import {
  MY_TEAM_CLOUD_MAX_ITEMS,
  MY_TEAM_CLOUD_MAX_PAYLOAD_BYTES,
  MY_TEAM_CLOUD_SCHEMA_VERSION,
  toCloudItems,
  validateCloudPayloadForSave,
  validateFetchedCloudPayload,
  computeCloudPayloadHash,
  type CloudMyTeamItem,
} from "./my-team-cloud-schema";
import type { MyTeamRecord } from "@/lib/user-cards/types";

function makeRecord(overrides: Partial<MyTeamRecord> = {}): MyTeamRecord {
  return {
    localRecordId: "myt_abcd1234",
    teamCardId: "tc_abcd1234",
    worldCardId: "123456",
    ownershipStatus: "owned",
    usageStatus: "main",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
    ...overrides,
  };
}

function makeItem(overrides: Partial<CloudMyTeamItem> = {}): CloudMyTeamItem {
  return {
    worldCardId: "123456",
    ownershipStatus: "owned",
    usageStatus: "main",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toCloudItems", () => {
  it("ローカル内部ID(localRecordId/teamCardId)・source・syncStatus・deletedAtを含まない", () => {
    const items = toCloudItems([makeRecord()]);
    expect(items).toEqual([
      {
        worldCardId: "123456",
        ownershipStatus: "owned",
        usageStatus: "main",
        selectedBuildId: null,
        favoriteBuildId: null,
        note: "",
        tags: [],
        addedAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ]);
    expect(items[0]).not.toHaveProperty("localRecordId");
    expect(items[0]).not.toHaveProperty("teamCardId");
    expect(items[0]).not.toHaveProperty("source");
    expect(items[0]).not.toHaveProperty("syncStatus");
    expect(items[0]).not.toHaveProperty("deletedAt");
  });
});

describe("validateCloudPayloadForSave", () => {
  it("正常な配列を受理する", () => {
    const result = validateCloudPayloadForSave([makeItem()]);
    expect(result.ok).toBe(true);
  });

  it("空配列(空のMy Team)を受理する", () => {
    const result = validateCloudPayloadForSave([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.items).toEqual([]);
  });

  it(`最大件数(${MY_TEAM_CLOUD_MAX_ITEMS}件)ちょうどは受理する`, () => {
    const items = Array.from({ length: MY_TEAM_CLOUD_MAX_ITEMS }, (_, i) => makeItem({ worldCardId: String(i + 1) }));
    const result = validateCloudPayloadForSave(items);
    expect(result.ok).toBe(true);
  });

  it("最大件数を1件超えると拒否する(黙って切り詰めない)", () => {
    const items = Array.from({ length: MY_TEAM_CLOUD_MAX_ITEMS + 1 }, (_, i) => makeItem({ worldCardId: String(i + 1) }));
    const result = validateCloudPayloadForSave(items);
    expect(result).toEqual({ ok: false, error: "TOO_MANY_ITEMS" });
  });

  it("worldCardIdが重複している場合は拒否する(黙って重複除去しない)", () => {
    const result = validateCloudPayloadForSave([makeItem({ worldCardId: "1" }), makeItem({ worldCardId: "1" })]);
    expect(result).toEqual({ ok: false, error: "DUPLICATE_WORLD_CARD_ID" });
  });

  it("不正なworldCardId形式を拒否する", () => {
    const result = validateCloudPayloadForSave([makeItem({ worldCardId: "not-a-number" })]);
    expect(result).toEqual({ ok: false, error: "INVALID_STRUCTURE" });
  });

  it("未知のownershipStatusを拒否する", () => {
    // @ts-expect-error 意図的に不正な値を渡す
    const result = validateCloudPayloadForSave([makeItem({ ownershipStatus: "hacked" })]);
    expect(result).toEqual({ ok: false, error: "INVALID_STRUCTURE" });
  });

  it("noteの最大長超過を拒否する", () => {
    const result = validateCloudPayloadForSave([makeItem({ note: "a".repeat(501) })]);
    expect(result).toEqual({ ok: false, error: "INVALID_STRUCTURE" });
  });

  it("タグ最大数超過を拒否する", () => {
    const result = validateCloudPayloadForSave([makeItem({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })]);
    expect(result).toEqual({ ok: false, error: "INVALID_STRUCTURE" });
  });

  it("不正なaddedAt(ISO日時でない)を拒否する", () => {
    const result = validateCloudPayloadForSave([makeItem({ addedAt: "not-a-date" })]);
    expect(result).toEqual({ ok: false, error: "INVALID_STRUCTURE" });
  });

  it("巨大なnoteの積み重ねでペイロードサイズ上限を超えた場合は拒否する", () => {
    // note自体は上限500文字だが、大量の件数×最大長タグ・メモで合計サイズ超過を模擬する。
    const items = Array.from({ length: MY_TEAM_CLOUD_MAX_ITEMS }, (_, i) =>
      makeItem({
        worldCardId: String(i + 1),
        note: "a".repeat(500),
        tags: Array.from({ length: 10 }, (_, t) => "b".repeat(24) + t),
      }),
    );
    const json = JSON.stringify({ items });
    expect(new TextEncoder().encode(json).length).toBeGreaterThan(MY_TEAM_CLOUD_MAX_PAYLOAD_BYTES);
    const result = validateCloudPayloadForSave(items);
    expect(result).toEqual({ ok: false, error: "TOO_LARGE" });
  });
});

describe("validateFetchedCloudPayload", () => {
  it("既知のスキーマバージョン + 正常な配列を受理する", () => {
    const result = validateFetchedCloudPayload({ items: [makeItem()] }, MY_TEAM_CLOUD_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
  });

  it("未知のスキーマバージョンを拒否する(古い/新しいクライアントの安全な不一致処理)", () => {
    const result = validateFetchedCloudPayload({ items: [] }, "my-team-cloud/2099-01-01.v9");
    expect(result).toEqual({ ok: false, error: "UNKNOWN_SCHEMA_VERSION" });
  });

  it("未知のフィールドを含むオブジェクトを拒否する(strictスキーマ)", () => {
    const result = validateFetchedCloudPayload(
      { items: [{ ...makeItem(), unexpectedField: "x" }] },
      MY_TEAM_CLOUD_SCHEMA_VERSION,
    );
    expect(result).toEqual({ ok: false, error: "INVALID_STRUCTURE" });
  });

  it("__proto__ / constructor / prototype キーを含む入力を未知フィールドとして拒否する", () => {
    const poisoned = JSON.parse(
      '{"items":[{"worldCardId":"1","ownershipStatus":"owned","usageStatus":"main","selectedBuildId":null,"favoriteBuildId":null,"note":"","tags":[],"addedAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z","__proto__":{"polluted":true}}]}',
    );
    const result = validateFetchedCloudPayload(poisoned, MY_TEAM_CLOUD_SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    // JSON.parseされたプレーンオブジェクトの__proto__は実プロトタイプへ影響しない安全な自プロパティであり、
    // かつstrictスキーマにより未知フィールドとして拒否されることを確認する。
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("配列でない(オブジェクト直下ではない)構造を拒否する", () => {
    const result = validateFetchedCloudPayload({ items: "not-an-array" }, MY_TEAM_CLOUD_SCHEMA_VERSION);
    expect(result).toEqual({ ok: false, error: "INVALID_STRUCTURE" });
  });

  it("null/未定義の入力を拒否する", () => {
    expect(validateFetchedCloudPayload(null, MY_TEAM_CLOUD_SCHEMA_VERSION).ok).toBe(false);
    expect(validateFetchedCloudPayload(undefined, MY_TEAM_CLOUD_SCHEMA_VERSION).ok).toBe(false);
  });

  it("重複worldCardIdを含むクラウドデータを異常として拒否する", () => {
    const result = validateFetchedCloudPayload(
      { items: [makeItem({ worldCardId: "1" }), makeItem({ worldCardId: "1" })] },
      MY_TEAM_CLOUD_SCHEMA_VERSION,
    );
    expect(result).toEqual({ ok: false, error: "DUPLICATE_WORLD_CARD_ID" });
  });
});

describe("computeCloudPayloadHash", () => {
  it("同じ内容なら常に同じハッシュを返す(決定的)", async () => {
    const a = await computeCloudPayloadHash({ items: [makeItem()] });
    const b = await computeCloudPayloadHash({ items: [makeItem()] });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("内容が異なればハッシュも異なる", async () => {
    const a = await computeCloudPayloadHash({ items: [makeItem({ worldCardId: "1" })] });
    const b = await computeCloudPayloadHash({ items: [makeItem({ worldCardId: "2" })] });
    expect(a).not.toBe(b);
  });

  it("項目の順序が異なればハッシュも異なる(並び順を保持して比較する)", async () => {
    const a = await computeCloudPayloadHash({ items: [makeItem({ worldCardId: "1" }), makeItem({ worldCardId: "2" })] });
    const b = await computeCloudPayloadHash({ items: [makeItem({ worldCardId: "2" }), makeItem({ worldCardId: "1" })] });
    expect(a).not.toBe(b);
  });
});
