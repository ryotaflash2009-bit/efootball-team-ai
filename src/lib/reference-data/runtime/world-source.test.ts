import { describe, it, expect, beforeEach } from "vitest";
import {
  listPlayersFromSupabase,
  getPlayerByWorldIdFromSupabase,
  getPlayersByWorldIdsFromSupabase,
  getWorldImageUrlsFromSupabase,
  getFacetsFromSupabase,
  getSourceMetaFromSupabase,
  _resetFacetCacheForSupabase,
} from "./world-source";
import { createFakeReferenceDataClient, createFailingReferenceDataClient } from "./test-doubles";
import type { WorldListQuery } from "@/lib/world/types";

function makeCardRow(id: string, over: Record<string, unknown> = {}) {
  return {
    world_card_id: id,
    name_en: `Player ${id}`,
    name_ja: null,
    card_type: "EPIC",
    registered_position: "CF",
    nationality: "Japan",
    region: "Asia",
    league: "Other",
    team: "Team",
    ovr_base: 80,
    ovr_max: 90,
    maximum_level: 19,
    card_rating: "B",
    playing_style: null,
    playing_style_def: null,
    preferred_foot: "Right",
    age: 25,
    height: 180,
    weight: 75,
    image_url: null,
    mobile_image_url: null,
    boost1: "0",
    boost2: "0",
    stats: { finishing: 80, dribbling: 85 },
    skills: ["Skill A", "Skill B"],
    source: "efootball-world.com",
    source_url: null,
    appearance_updated_at: "2026-09-14T00:00:00.000Z",
    fetched_at: "2026-09-14T00:00:00.000Z",
    ...over,
  };
}

function baseQuery(over: Partial<WorldListQuery> = {}): WorldListQuery {
  return {
    page: 1,
    pageSize: 24,
    query: "",
    sort: "ovr_max_desc",
    position: null,
    cardType: null,
    playingStyle: null,
    playingStyleDefensive: null,
    minOvr: null,
    maxOvr: null,
    hasBooster: null,
    ...over,
  };
}

beforeEach(() => {
  _resetFacetCacheForSupabase();
});

describe("listPlayersFromSupabase", () => {
  it("全件取得しページング情報を返す", async () => {
    const rows = [makeCardRow("1"), makeCardRow("2"), makeCardRow("3")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery(), client as never);
    expect(result.totalCount).toBe(3);
    expect(result.players.length).toBe(3);
  });

  it("英語名で部分一致検索できる", async () => {
    const rows = [makeCardRow("1", { name_en: "Lionel Messi" }), makeCardRow("2", { name_en: "Someone Else" })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ query: "messi" }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["1"]);
  });

  it("日本語名で部分一致検索できる(Unicode)", async () => {
    const rows = [makeCardRow("1", { name_ja: "リオネル メッシ" }), makeCardRow("2", { name_ja: "別の選手" })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ query: "メッシ" }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["1"]);
  });

  it("world_card_idの完全一致でも検索できる", async () => {
    const rows = [makeCardRow("12345"), makeCardRow("67890")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ query: "12345" }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["12345"]);
  });

  it("sort=nameはname_en列ではなくname_sort_key列で並べ替える(SQLiteのCOLLATE NOCASE互換のため、実データで確認済みの実例に基づく)", async () => {
    // 実データで確認済みの実例("Aaron Hickey"と"Aarón Martín"のように、共通の接頭辞を持ち
    // ダイアクリティカルマークの有無だけで分岐する名前は、'o'(0x6F) < 'ó'(0xF3)のため
    // 無印の方が先に来る。この3件はASCII部分の共通接頭辞"aaron"/"aarón"を持つ)。
    const rows = [
      makeCardRow("1", { name_en: "Aaron Hickey", name_sort_key: "aaron hickey" }),
      makeCardRow("2", { name_en: "Aarón Martín", name_sort_key: "aarón martín" }),
      makeCardRow("3", { name_en: "Aaron Cresswell", name_sort_key: "aaron cresswell" }),
    ];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ sort: "name" }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["3", "1", "2"]);
  });

  it("position/cardType/playingStyleで絞り込める", async () => {
    const rows = [makeCardRow("1", { registered_position: "CF" }), makeCardRow("2", { registered_position: "GK" })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ position: "GK" }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["2"]);
  });

  it("minOvr/maxOvrで絞り込める", async () => {
    const rows = [makeCardRow("1", { ovr_max: 95 }), makeCardRow("2", { ovr_max: 70 })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ minOvr: 90 }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["1"]);
  });

  it("hasBooster=trueはboost1/boost2いずれかが非0の行だけを返す", async () => {
    const rows = [makeCardRow("1", { boost1: "83", boost2: "0" }), makeCardRow("2", { boost1: "0", boost2: "0" }), makeCardRow("3", { boost1: "0", boost2: "30" })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ hasBooster: true }), client as never);
    expect(result.players.map((p) => p.worldCardId).sort()).toEqual(["1", "3"]);
  });

  it("hasBooster=falseはboost1/boost2とも0の行だけを返す", async () => {
    const rows = [makeCardRow("1", { boost1: "83", boost2: "0" }), makeCardRow("2", { boost1: "0", boost2: "0" })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ hasBooster: false }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["2"]);
  });

  it("hasBooster未指定は全件対象", async () => {
    const rows = [makeCardRow("1", { boost1: "83" }), makeCardRow("2", { boost1: "0" })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery(), client as never);
    expect(result.totalCount).toBe(2);
  });

  it("ソート(ovr_max_desc)が正しく適用される", async () => {
    const rows = [makeCardRow("1", { ovr_max: 80 }), makeCardRow("2", { ovr_max: 95 }), makeCardRow("3", { ovr_max: 88 })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ sort: "ovr_max_desc" }), client as never);
    expect(result.players.map((p) => p.worldCardId)).toEqual(["2", "3", "1"]);
  });

  it("ページング(先頭・最終ページ)", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeCardRow(String(i + 1), { ovr_max: 100 - i }));
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const page1 = await listPlayersFromSupabase(baseQuery({ pageSize: 2, page: 1 }), client as never);
    expect(page1.players.length).toBe(2);
    expect(page1.hasNext).toBe(true);
    expect(page1.hasPrevious).toBe(false);
    const page3 = await listPlayersFromSupabase(baseQuery({ pageSize: 2, page: 3 }), client as never);
    expect(page3.players.length).toBe(1);
    expect(page3.hasNext).toBe(false);
    expect(page3.hasPrevious).toBe(true);
  });

  it("0件検索は空配列を返す", async () => {
    const rows = [makeCardRow("1")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery({ query: "no-such-player-xyz" }), client as never);
    expect(result.players).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("hasEfhubLink/efhubCardIdはworld_player_cards.efhub_card_id列を直接読む", async () => {
    const rows = [makeCardRow("1", { efhub_card_id: "47918" }), makeCardRow("2", { efhub_card_id: null })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery(), client as never);
    const p1 = result.players.find((p) => p.worldCardId === "1");
    const p2 = result.players.find((p) => p.worldCardId === "2");
    expect(p1?.hasEfhubLink).toBe(true);
    expect(p1?.efhubCardId).toBe("47918");
    expect(p2?.hasEfhubLink).toBe(false);
    expect(p2?.efhubCardId).toBeNull();
  });

  it("efhub_card_id列が未移行(未設定)の行はhasEfhubLink=falseになる(推測で埋めない)", async () => {
    const rows = [makeCardRow("1"), makeCardRow("2")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await listPlayersFromSupabase(baseQuery(), client as never);
    for (const p of result.players) {
      expect(p.hasEfhubLink).toBe(false);
      expect(p.efhubCardId).toBeNull();
    }
  });

  it("クエリエラー時は例外を投げる", async () => {
    const client = createFailingReferenceDataClient({ message: "network error" });
    await expect(listPlayersFromSupabase(baseQuery(), client as never)).rejects.toThrow();
  });
});

describe("getPlayerByWorldIdFromSupabase", () => {
  it("statsを26項目形式へ復元する", async () => {
    const rows = [makeCardRow("1", { stats: { finishing: 90, dribbling: 85 } })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("1", client as never);
    const finishing = result?.stats.find((s) => s.key === "finishing");
    expect(finishing?.value).toBe(90);
    const missingKey = result?.stats.find((s) => s.key !== "finishing" && s.key !== "dribbling");
    expect(missingKey?.value).toBeNull();
  });

  it("skillsをplayerSkillsとして返す", async () => {
    const rows = [makeCardRow("1", { skills: ["Acrobatic Finishing", "Long Range Drive"] })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("1", client as never);
    expect(result?.playerSkills).toEqual(["Acrobatic Finishing", "Long Range Drive"]);
  });

  it("追加列が未移行(未設定)の間はaiStyles/appearance/efhubConflictsが空/nullになる(推測で埋めない)", async () => {
    const rows = [makeCardRow("1")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("1", client as never);
    expect(result?.aiStyles).toEqual([]);
    expect(result?.appearance).toBeNull();
    expect(result?.efhubConflicts).toEqual([]);
  });

  it("ai_styles/appearance/efhub_conflicts列が投入済みなら実データをそのまま返す", async () => {
    const rows = [
      makeCardRow("1", {
        efhub_card_id: "47918",
        ai_styles: ["Speeding Bullet", "Long Ball Expert"],
        appearance: {
          position: "CF",
          legCoverageRadius: 171.77,
          armCoverageRadius: null,
          torsoCollision: null,
          jumpingHeight: null,
          dribbleHeight: null,
          legLength: null,
          ranks: { legCoverageRadius: { overall: { rank: 120, total: 13009, topPercent: 0.9 }, position: { rank: 5, total: 300, topPercent: 1.7 } } },
          updatedAt: "2026-08-27T16:09:08",
        },
        efhub_conflicts: [{ fieldName: "ovr_max", efhubValue: "104", worldValue: "103" }],
      }),
    ];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("1", client as never);
    expect(result?.hasEfhubLink).toBe(true);
    expect(result?.efhubCardId).toBe("47918");
    expect(result?.aiStyles).toEqual(["Speeding Bullet", "Long Ball Expert"]);
    expect(result?.appearance?.position).toBe("CF");
    expect(result?.appearance?.legCoverageRadius).toBeCloseTo(171.77);
    expect(result?.appearance?.ranks?.legCoverageRadius).toEqual({
      overall: { rank: 120, total: 13009, topPercent: 0.9 },
      position: { rank: 5, total: 300, topPercent: 1.7 },
    });
    expect(result?.efhubConflicts).toEqual([{ fieldName: "ovr_max", efhubValue: "104", worldValue: "103" }]);
  });

  it("appearance/efhub_conflictsが不正な形の場合はnull/空扱いにする(推測で埋めない)", async () => {
    const rows = [makeCardRow("1", { appearance: "not-an-object", efhub_conflicts: [{ noFieldName: true }, "not-an-object"] })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("1", client as never);
    expect(result?.appearance).toBeNull();
    expect(result?.efhubConflicts).toEqual([]);
  });

  it("存在しないIDはnullを返す", async () => {
    const client = createFakeReferenceDataClient({ world_player_cards: [makeCardRow("1")], player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("999999999999999", client as never);
    expect(result).toBeNull();
  });

  it("不正なID形式はnullを返す", async () => {
    const client = createFakeReferenceDataClient({ world_player_cards: [], player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("not-a-real-id", client as never);
    expect(result).toBeNull();
  });

  it("Unicode(日本語名)を保持する", async () => {
    const rows = [makeCardRow("1", { name_ja: "バーチャット" })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayerByWorldIdFromSupabase("1", client as never);
    expect(result?.nameJa).toBe("バーチャット");
  });
});

describe("getPlayersByWorldIdsFromSupabase", () => {
  it("入力順を尊重し、見つからないIDは除外する", async () => {
    const rows = [makeCardRow("1"), makeCardRow("2"), makeCardRow("3")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayersByWorldIdsFromSupabase(["3", "999", "1"], client as never);
    expect(result.map((p) => p.worldCardId)).toEqual(["3", "1"]);
  });

  it("不正なID形式は除外する", async () => {
    const rows = [makeCardRow("1")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayersByWorldIdsFromSupabase(["1", "not-valid"], client as never);
    expect(result.map((p) => p.worldCardId)).toEqual(["1"]);
  });

  it("空配列入力は空配列を返す(クエリを発行しない)", async () => {
    const client = createFakeReferenceDataClient({ world_player_cards: [], player_card_analysis: [] });
    const result = await getPlayersByWorldIdsFromSupabase([], client as never);
    expect(result).toEqual([]);
  });

  it("500件上限を超える入力は先頭500件に丸める", async () => {
    const ids = Array.from({ length: 600 }, (_, i) => String(1000 + i));
    const rows = ids.map((id) => makeCardRow(id));
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getPlayersByWorldIdsFromSupabase(ids, client as never);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

describe("getWorldImageUrlsFromSupabase", () => {
  it("image_url/mobile_image_urlを返す", async () => {
    const rows = [makeCardRow("1", { image_url: "https://d1zxa6glxh8sq9.cloudfront.net/a.webp", mobile_image_url: null })];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const result = await getWorldImageUrlsFromSupabase("1", client as never);
    expect(result?.imageUrl).toBe("https://d1zxa6glxh8sq9.cloudfront.net/a.webp");
    expect(result?.mobileImageUrl).toBeNull();
  });

  it("存在しないIDはnullを返す", async () => {
    const client = createFakeReferenceDataClient({ world_player_cards: [], player_card_analysis: [] });
    const result = await getWorldImageUrlsFromSupabase("999999999999999", client as never);
    expect(result).toBeNull();
  });
});

describe("getFacetsFromSupabase", () => {
  it("distinctな値を返す(重複排除・空文字/null除外)", async () => {
    const rows = [
      makeCardRow("1", { registered_position: "CF" }),
      makeCardRow("2", { registered_position: "CF" }),
      makeCardRow("3", { registered_position: "GK" }),
      makeCardRow("4", { registered_position: null }),
    ];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const facets = await getFacetsFromSupabase(client as never);
    expect(facets.positions.sort()).toEqual(["CF", "GK"]);
  });

  it("2回目の呼び出しはキャッシュを返す(再クエリしない)", async () => {
    const rows = [makeCardRow("1")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const first = await getFacetsFromSupabase(client as never);
    const failingClient = createFailingReferenceDataClient({ message: "should not be called" });
    const second = await getFacetsFromSupabase(failingClient as never);
    expect(second).toBe(first);
  });

  it("PostgRESTの既定行数上限(1件のRangeなしSELECTでは先頭のみ)を超える件数でも、全件をページングして走査する(実際に発生した不具合の再発防止)", async () => {
    // 1,000件を超える行のうち、最後の1行にだけ現れる稀少なcard_typeが正しく検出できるかを確認する。
    // (実際の不具合は、PostgRESTがRange指定の無いSELECTを既定で先頭1,000件までに切り詰めるため、
    // 13,009件中でも稀にしか出現しないcardType/playingStyleがfacetsから欠落していた)
    const rows = Array.from({ length: 1500 }, (_, i) => makeCardRow(String(i + 1), { card_type: "EPIC" }));
    rows[1499] = { ...rows[1499], card_type: "RARE-ONLY-ON-LAST-ROW" };
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const facets = await getFacetsFromSupabase(client as never);
    expect(facets.cardTypes).toContain("RARE-ONLY-ON-LAST-ROW");
    expect(facets.cardTypes).toContain("EPIC");
  });
});

describe("getSourceMetaFromSupabase", () => {
  it("totalCountを返す", async () => {
    const rows = [makeCardRow("1"), makeCardRow("2")];
    const client = createFakeReferenceDataClient({ world_player_cards: rows, player_card_analysis: [] });
    const meta = await getSourceMetaFromSupabase(client as never);
    expect(meta.totalCount).toBe(2);
    expect(meta.source).toBe("eFootball World");
  });
});
