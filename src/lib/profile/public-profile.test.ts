import { describe, it, expect } from "vitest";
import { DEFAULT_VISIBILITY, MAX_PUBLIC_BUILDS, buildPublicProfileView, toPublicBuild, validateDisplayName, type OwnerProfile } from "./public-profile";
import type { SavedBuild } from "@/lib/progression/types";

const build = (id: string, over: Partial<SavedBuild> = {}): SavedBuild => ({
  buildId: `b_internal_${id}`,
  worldCardId: "88045755960770",
  buildName: `Build ${id}`,
  progressionAllocation: { shooting: 6, dribbling: 4 },
  selectedPlayerBooster: 2,
  calculatedStats: { finishing: 90 },
  calculatedOvr: 99,
  calculationMode: "confirmed",
  rulesVersion: "progression/2026-08-28.v2",
  createdAt: "2026-10-01T10:11:12.000Z",
  updatedAt: "2026-10-02T10:11:12.000Z",
  schemaVersion: 1,
  buildIntent: { intendedPositions: ["CF"] } as SavedBuild["buildIntent"],
  ...over,
});

function owner(over: Partial<OwnerProfile> = {}): OwnerProfile {
  return {
    publicId: "taro_01",
    displayName: "Taro",
    bio: "eFootball が好き",
    visibility: { profile: "public", builds: "friends", titles: "public" },
    titleIds: ["attack_master"],
    builds: [
      { slug: "pubbuild0001", build: build("1"), published: true },
      { slug: "pubbuild0002", build: build("2"), published: false },
    ],
    ...over,
  };
}

describe("公開プロフィール（モック）", () => {
  it("既定はすべて非公開: 本人以外には「見つからない」", () => {
    const o = owner({ visibility: DEFAULT_VISIBILITY });
    expect(buildPublicProfileView(o, { relation: "other", blocked: false })).toEqual({ found: false });
    expect(buildPublicProfileView(o, { relation: "friend", blocked: false })).toEqual({ found: false });
    expect(buildPublicProfileView(o, { relation: "self", blocked: false }).found).toBe(true);
  });

  it("ブロック・存在しない・非公開は同じ「見つからない」", () => {
    expect(buildPublicProfileView(owner(), { relation: "friend", blocked: true })).toEqual({ found: false });
    expect(buildPublicProfileView(null, { relation: "other", blocked: false })).toEqual({ found: false });
    expect(buildPublicProfileView(owner({ visibility: { ...DEFAULT_VISIBILITY } }), { relation: "anonymous", blocked: false })).toEqual({ found: false });
  });

  it("項目ごとの範囲: 友達だけのビルドは他人に出ない・公開に含めたビルドだけ", () => {
    const other = buildPublicProfileView(owner(), { relation: "other", blocked: false });
    const friend = buildPublicProfileView(owner(), { relation: "friend", blocked: false });
    const self = buildPublicProfileView(owner(), { relation: "self", blocked: false });
    if (!other.found || !friend.found || !self.found) throw new Error("expected found");
    expect(other.builds).toBeNull();
    expect(other.titleIds).toEqual(["attack_master"]);
    expect(other.ownVisibility).toBeNull();
    expect(friend.builds?.map((b) => b.slug)).toEqual(["pubbuild0001"]);
    expect(self.builds?.map((b) => b.slug)).toEqual(["pubbuild0001", "pubbuild0002"]);
    expect(self.ownVisibility).toEqual(owner().visibility);
  });

  it("公開ビルドに内部の ID・時刻・育成の目的・計算の内訳を出さない", () => {
    const v = toPublicBuild({ slug: "pubbuild0001", build: build("1"), published: true });
    const text = JSON.stringify(v);
    expect(text).not.toContain("b_internal_1");
    expect(text).not.toContain("2026-10-01");
    expect(text).not.toContain("intendedPositions");
    expect(text).not.toContain("finishing");
    expect(v).toMatchObject({ slug: "pubbuild0001", ovr: 99, allocation: { shooting: 6, dribbling: 4 }, playerBooster: 2 });
    expect(() => toPublicBuild({ slug: "BAD/slug", build: build("1"), published: true })).toThrow();
  });

  it("公開ビルドは最大 30 件・不正な配分の値は落とす", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ slug: `pubbuild${String(i).padStart(4, "0")}`, build: build(String(i), { progressionAllocation: { shooting: 6, "bad key": 3, dribbling: -1 } }), published: true }));
    const v = buildPublicProfileView(owner({ builds: many, visibility: { profile: "public", builds: "public", titles: "public" } }), { relation: "anonymous", blocked: false });
    if (!v.found) throw new Error("expected found");
    expect(v.builds).toHaveLength(MAX_PUBLIC_BUILDS);
    expect(v.builds![0].allocation).toEqual({ shooting: 6 });
  });

  it("表示名: 制御文字を除き、なりすまし・URL・メールアドレスを拒否", () => {
    expect(validateDisplayName("  Ta‮ro\u0000  ")).toEqual({ ok: true, value: "Taro" });
    expect(validateDisplayName("公式アカウント")).toEqual({ ok: false, problem: "impersonation" });
    expect(validateDisplayName("KONAMI fan")).toEqual({ ok: false, problem: "impersonation" });
    expect(validateDisplayName("me@example.com")).toEqual({ ok: false, problem: "contains_url_or_email" });
    expect(validateDisplayName("   ")).toEqual({ ok: false, problem: "empty" });
  });
});
