import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyCommunityError,
  fetchComparison,
  fetchMyProfile,
  fetchProfile,
  isPublicIdLike,
  listFriends,
  parseShareInput,
  report,
  setComparison,
} from "./community-client";
import { COMMUNITY_MODE, isCommunityAvailable } from "@/lib/supabase/community-mode";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import { buildShareUrl, type SquadDiagnosisSharePayloadV1 } from "@/lib/squad/squad-diagnosis-share-url";
import { SQUAD_DIAGNOSIS_RULES_VERSION, ABILITY_CATEGORIES, DIAGNOSIS_TIER_THRESHOLDS } from "@/lib/squad/squad-diagnosis";

const tierOf = (n: number) => DIAGNOSIS_TIER_THRESHOLDS.find((t) => n >= t.min)?.tier ?? "D";

const fake = (impl: (fn: string, args: unknown) => { data: unknown; error: unknown }) => {
  const rpc = vi.fn(async (fn: string, args: unknown) => impl(fn, args));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
};
const payload = (): SquadDiagnosisSharePayloadV1 => ({
  v: 1,
  k: "sd",
  r: SQUAD_DIAGNOSIS_RULES_VERSION,
  d: "2026-10-14",
  o: [72, tierOf(72)],
  c: Object.fromEntries(ABILITY_CATEGORIES.map((c) => [c.id, [null, null]])) as unknown as SquadDiagnosisSharePayloadV1["c"],
  s: null,
  w: null,
});

describe("コミュニティの公開の状態", () => {
  it("本番の関数を適用・確認するまで無効。ローカルの ?communityPreview=1 だけ開く", () => {
    expect(["disabled", "enabled"]).toContain(COMMUNITY_MODE);
    expect(isCommunityAvailable("efootball-team-ai.vercel.app", "?communityPreview=1", isLocalDevHostname, "disabled")).toBe(false);
    expect(isCommunityAvailable("localhost", "", isLocalDevHostname, "disabled")).toBe(false);
    expect(isCommunityAvailable("localhost", "?communityPreview=1", isLocalDevHostname, "disabled")).toBe(true);
    expect(isCommunityAvailable("efootball-team-ai.vercel.app", "", isLocalDevHostname, "enabled")).toBe(true);
  });
});

describe("コミュニティのアクセス層", () => {
  it("関数の例外を理由コードへ一般化する（生の文は出さない）", () => {
    expect(classifyCommunityError({ code: "P0010", message: "not_found" })).toBe("NOT_FOUND");
    expect(classifyCommunityError({ code: "P0011" })).toBe("RATE_LIMITED");
    expect(classifyCommunityError({ code: "P0012" })).toBe("FRIEND_LIMIT");
    expect(classifyCommunityError({ code: "P0013" })).toBe("PROFILE_REQUIRED");
    expect(classifyCommunityError({ code: "P0014" })).toBe("SELF");
    expect(classifyCommunityError({ code: "23505" })).toBe("ID_TAKEN");
    expect(classifyCommunityError({ code: "P0001" })).toBe("ID_RESERVED");
    expect(classifyCommunityError({ code: "P0002" })).toBe("ID_CHANGE_TOO_SOON");
    expect(classifyCommunityError({ code: "P0003" })).toBe("ID_RECENTLY_RELEASED");
    expect(classifyCommunityError({ code: "PGRST202" })).toBe("UNAVAILABLE");
    expect(classifyCommunityError({ status: 401 })).toBe("UNAUTHENTICATED");
    expect(classifyCommunityError({ code: "XX000", message: "secret detail" })).toBe("UNKNOWN");
  });

  it("本人のプロフィール: 無ければ null・あれば形を整えて返す", async () => {
    expect(await fetchMyProfile(fake(() => ({ data: [], error: null })).client)).toEqual({ ok: true, data: null });
    const r = await fetchMyProfile(fake(() => ({ data: [{ public_id: "taro", display_name: "T", visibility: "friends", public_id_changed_at: "2026-10-14", restricted: false }], error: null })).client);
    expect(r).toEqual({ ok: true, data: { publicId: "taro", displayName: "T", visibility: "friends", publicIdChangedAt: "2026-10-14", restricted: false } });
  });

  it("他人のプロフィール: 見えない相手は null（存在しないのと同じ）・公開 ID だけを送る", async () => {
    const { client, rpc } = fake(() => ({ data: [], error: null }));
    expect(await fetchProfile(client, "hanako")).toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledWith("community_get_profile", { p_public_id: "hanako" });
  });

  it("友達の一覧: 未知の状態は捨てる", async () => {
    const r = await listFriends(fake(() => ({ data: [{ public_id: "a", display_name: "A", state: "friends", since: "x" }, { public_id: "b", display_name: "B", state: "weird", since: "x" }], error: null })).client);
    expect(r.ok && r.data.map((f) => f.publicId)).toEqual(["a"]);
  });

  it("通報: 補足は 500 文字で切る", async () => {
    const { client, rpc } = fake(() => ({ data: "reported", error: null }));
    expect(await report(client, "x_user", "spam", "a".repeat(600))).toEqual({ ok: true, data: "reported" });
    expect((rpc.mock.calls[0][1] as { p_note: string }).p_note.length).toBe(500);
  });

  it("比較の要約: 検証を通らないものは送らない・受け取ったものも検証する", async () => {
    const { client, rpc } = fake(() => ({ data: "saved", error: null }));
    expect(await setComparison(client, { ...payload(), k: "x" } as never)).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(rpc).not.toHaveBeenCalled();
    expect(await setComparison(client, payload())).toEqual({ ok: true, data: "saved" });
    const bad = await fetchComparison(fake(() => ({ data: [{ summary: { k: "sd", evil: 1 }, updated_at: "x" }], error: null })).client, "a_user");
    expect(bad).toEqual({ ok: true, data: null });
    const good = await fetchComparison(fake(() => ({ data: [{ summary: payload(), updated_at: "x" }], error: null })).client, "a_user");
    expect(good.ok && good.data?.payload.o).toEqual([72, tierOf(72)]);
  });

  it("共有 URL・トークンから要約を取り出す。壊れた入力は null", () => {
    const url = buildShareUrl("https://efootball-team-ai.vercel.app", payload());
    expect(parseShareInput(url)?.o).toEqual([72, tierOf(72)]);
    expect(parseShareInput(url.slice(url.indexOf("#") + 1))?.o).toEqual([72, tierOf(72)]);
    expect(parseShareInput("https://example.com/#sd1.abc.00000000")).toBeNull();
    expect(parseShareInput("")).toBeNull();
  });

  it("公開 ID の形", () => {
    expect(isPublicIdLike("taro_01")).toBe(true);
    expect(isPublicIdLike("Taro")).toBe(false);
    expect(isPublicIdLike("1abc")).toBe(false);
    expect(isPublicIdLike("ab")).toBe(false);
  });
});
