import { describe, it, expect } from "vitest";
import { listManagersFromSupabase, getManagerByIdFromSupabase, getManagerCountFromSupabase } from "./managers-source";
import { createFakeReferenceDataClient, createFailingReferenceDataClient } from "./test-doubles";
import type { ManagerListQuery, ManagerSortKey } from "@/lib/managers/types";

const ALL_SORT_KEYS: ManagerSortKey[] = [
  "name",
  "released_desc",
  "released_asc",
  "possession_desc",
  "quick_counter_desc",
  "long_ball_counter_desc",
  "out_wide_desc",
  "long_ball_desc",
  "overload_desc",
];

// 各ソートキーの主ソート列(name以外はnullを取りうる数値/日時列)。
const PRIMARY_FIELD: Record<ManagerSortKey, string> = {
  name: "name_sort_key",
  released_desc: "released_at",
  released_asc: "released_at",
  possession_desc: "possession_game",
  quick_counter_desc: "quick_counter",
  long_ball_counter_desc: "long_ball_counter",
  out_wide_desc: "out_wide",
  long_ball_desc: "long_ball",
  overload_desc: "overload",
};

function makeManagerRow(id: number, over: Record<string, unknown> = {}) {
  return {
    internal_manager_id: id,
    source: "amine250",
    source_manager_id: String(id),
    name_en: `Manager ${id}`,
    name_ja: null,
    team_name: null,
    nationality: null,
    age: null,
    released_at: null,
    possession_game: 0,
    quick_counter: 0,
    long_ball_counter: 0,
    out_wide: 0,
    long_ball: 0,
    overload: 0,
    manager_rating: null,
    coaching_affinity: null,
    formation: null,
    has_booster: false,
    has_link_up_play: false,
    booster_confirmation: null,
    source_url: null,
    fetched_at: "2026-09-14T00:00:00.000Z",
    ...over,
  };
}

function baseQuery(over: Partial<ManagerListQuery> = {}): ManagerListQuery {
  return { page: 1, pageSize: 24, query: "", sort: "name", hasBooster: null, hasLinkUpPlay: null, ...over };
}

describe("listManagersFromSupabase", () => {
  it("全件取得し、ページング情報を返す", async () => {
    const rows = [makeManagerRow(1), makeManagerRow(2), makeManagerRow(3)];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery(), client as never);
    expect(result.totalCount).toBe(3);
    expect(result.managers.length).toBe(3);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrevious).toBe(false);
  });

  it("名前・チーム名・source_manager_idで検索できる", async () => {
    const rows = [makeManagerRow(1, { name_en: "Antonio Conte" }), makeManagerRow(2, { name_en: "Pep Guardiola" })];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ query: "conte" }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([1]);
  });

  it("sort=nameはname_en列ではなくname_sort_key列で並べ替える(SQLiteのCOLLATE NOCASE互換のため、実データで確認済みの実例に基づく)", async () => {
    // 実データで確認済みの実例("Steven Gerrard"と"Ståle Solbakken"は、両者とも先頭"St"を
    // 共有し、次の文字が'e'(0x65) < 'å'(0xE5)のため"Steven"側が先に来る)。
    const rows = [
      makeManagerRow(1, { name_en: "Ståle Solbakken", name_sort_key: "ståle solbakken" }),
      makeManagerRow(2, { name_en: "Steven Gerrard", name_sort_key: "steven gerrard" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: "name" }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([2, 1]);
  });

  it("hasBooster/hasLinkUpPlayで絞り込める", async () => {
    const rows = [makeManagerRow(1, { has_booster: true }), makeManagerRow(2, { has_booster: false })];
    const client = createFakeReferenceDataClient({ managers: rows });
    const trueResult = await listManagersFromSupabase(baseQuery({ hasBooster: true }), client as never);
    expect(trueResult.managers.map((m) => m.internalManagerId)).toEqual([1]);
    const falseResult = await listManagersFromSupabase(baseQuery({ hasBooster: false }), client as never);
    expect(falseResult.managers.map((m) => m.internalManagerId)).toEqual([2]);
  });

  it("ページングが正しく動作する(先頭・最終ページ)", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeManagerRow(i + 1, { name_en: `Z${i}` }));
    const client = createFakeReferenceDataClient({ managers: rows });
    const page1 = await listManagersFromSupabase(baseQuery({ pageSize: 2, page: 1 }), client as never);
    expect(page1.managers.length).toBe(2);
    expect(page1.hasNext).toBe(true);
    const page3 = await listManagersFromSupabase(baseQuery({ pageSize: 2, page: 3 }), client as never);
    expect(page3.managers.length).toBe(1);
    expect(page3.hasNext).toBe(false);
  });

  it("nameJa/teamName等のnullを保持する", async () => {
    const rows = [makeManagerRow(1)];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery(), client as never);
    expect(result.managers[0].nameJa).toBeNull();
    expect(result.managers[0].teamName).toBeNull();
  });

  it("boosters列が未移行(未設定)の間はboosterSummaryが空配列になる(推測で埋めない)", async () => {
    const rows = [makeManagerRow(1)];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery(), client as never);
    expect(result.managers[0].boosterSummary).toEqual([]);
  });

  it("boosters列が投入済みならboosterSummaryを組み立てる", async () => {
    const rows = [
      makeManagerRow(1, {
        boosters: [
          { statNameEn: "Defensive Awareness", statKey: "defAwareness", delta: 1, rawValue: "+1", applicationCondition: null, confirmationStatus: "confirmed" },
          { statNameEn: "Kicking Power", statKey: "kickingPower", delta: 1, rawValue: "+1", applicationCondition: null, confirmationStatus: "confirmed" },
        ],
      }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery(), client as never);
    expect(result.managers[0].boosterSummary).toEqual(["Defensive Awareness +1", "Kicking Power +1"]);
  });

  it("Unicode(日本語名)を保持する", async () => {
    const rows = [makeManagerRow(1, { name_ja: "アントニオ コンテ" })];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery(), client as never);
    expect(result.managers[0].nameJa).toBe("アントニオ コンテ");
  });

  it("クエリエラー時はWorldQueryError相当を投げる", async () => {
    const client = createFailingReferenceDataClient({ message: "network error" });
    await expect(listManagersFromSupabase(baseQuery(), client as never)).rejects.toThrow();
  });
});

describe("障害系: 各HTTPステータス/ネットワーク断でも安全に例外化される(優先度A)", () => {
  const cases: [string, number | undefined, { message: string }][] = [
    ["401", 401, { message: "JWT expired" }],
    ["403", 403, { message: "permission denied" }],
    ["429", 429, { message: "too many requests" }],
    ["500", 500, { message: "internal server error" }],
    ["503", 503, { message: "service unavailable" }],
    ["timeout(status0+abort)", 0, { message: "AbortError: The operation was aborted" }],
    ["network(status0)", 0, { message: "TypeError: fetch failed" }],
    ["genericなSDK例外(statusなし)", undefined, { message: "unexpected SDK exception" }],
  ];
  for (const [label, status, error] of cases) {
    it(`${label}: listManagersFromSupabaseが例外を投げる`, async () => {
      const client = createFailingReferenceDataClient(error, status);
      await expect(listManagersFromSupabase(baseQuery(), client as never)).rejects.toThrow();
    });
    it(`${label}: getManagerByIdFromSupabaseが例外を投げる`, async () => {
      const client = createFailingReferenceDataClient(error, status);
      await expect(getManagerByIdFromSupabase("1", client as never)).rejects.toThrow();
    });
    it(`${label}: getManagerCountFromSupabaseが例外を投げる`, async () => {
      const client = createFailingReferenceDataClient(error, status);
      await expect(getManagerCountFromSupabase(client as never)).rejects.toThrow();
    });
  }
});

describe("getManagerByIdFromSupabase", () => {
  it("boosters/link_up_plays列が未移行(未設定)の間は詳細のboosters/linkUpPlaysが空配列になる(推測で埋めない)", async () => {
    const client = createFakeReferenceDataClient({ managers: [makeManagerRow(1)] });
    const result = await getManagerByIdFromSupabase("1", client as never);
    expect(result?.internalManagerId).toBe(1);
    expect(result?.boosters).toEqual([]);
    expect(result?.linkUpPlays).toEqual([]);
  });

  it("boosters/link_up_plays列が投入済みなら実データをそのまま返す", async () => {
    const row = makeManagerRow(1, {
      boosters: [{ statNameEn: "Kicking Power", statKey: "kickingPower", delta: 1, rawValue: "+1", applicationCondition: null, confirmationStatus: "confirmed" }],
      link_up_plays: [
        {
          name: "Over-the-Top Pass A",
          centerPiece: { role: "centerPiece", playingStyle: "Long Ball Expert", positions: ["DMF"] },
          keyMan: { role: "keyMan", playingStyle: "Speed Merchant", positions: ["CF"] },
          confirmationStatus: "provisional",
        },
      ],
    });
    const client = createFakeReferenceDataClient({ managers: [row] });
    const result = await getManagerByIdFromSupabase("1", client as never);
    expect(result?.boosters).toEqual([
      { statNameEn: "Kicking Power", statKey: "kickingPower", delta: 1, rawValue: "+1", applicationCondition: null, confirmationStatus: "confirmed" },
    ]);
    expect(result?.linkUpPlays).toEqual([
      {
        name: "Over-the-Top Pass A",
        centerPiece: { role: "centerPiece", playingStyle: "Long Ball Expert", positions: ["DMF"] },
        keyMan: { role: "keyMan", playingStyle: "Speed Merchant", positions: ["CF"] },
        confirmationStatus: "provisional",
      },
    ]);
  });

  it("存在しないIDはnullを返す", async () => {
    const client = createFakeReferenceDataClient({ managers: [makeManagerRow(1)] });
    const result = await getManagerByIdFromSupabase("999", client as never);
    expect(result).toBeNull();
  });

  it("不正なID形式はnullを返す(クエリを発行しない)", async () => {
    const client = createFakeReferenceDataClient({ managers: [] });
    const result = await getManagerByIdFromSupabase("not-a-number", client as never);
    expect(result).toBeNull();
  });
});

describe("listManagersFromSupabase: NULL順序・internal_manager_id最終タイブレーク(Phase D確定仕様)", () => {
  it("released_asc: NULLはASCで先頭に来る(SQLiteの既定動作互換)", async () => {
    const rows = [
      makeManagerRow(1, { released_at: "2020-01-01", name_sort_key: "a" }),
      makeManagerRow(2, { released_at: null, name_sort_key: "b" }),
      makeManagerRow(3, { released_at: "2019-01-01", name_sort_key: "c" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: "released_asc" }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([2, 3, 1]);
  });

  it("released_desc: NULLはDESCで末尾に来る(SQLiteの既定動作互換)", async () => {
    const rows = [
      makeManagerRow(1, { released_at: "2020-01-01", name_sort_key: "a" }),
      makeManagerRow(2, { released_at: null, name_sort_key: "b" }),
      makeManagerRow(3, { released_at: "2019-01-01", name_sort_key: "c" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: "released_desc" }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([1, 3, 2]);
  });

  it.each(ALL_SORT_KEYS.filter((k) => k !== "name"))("%s: 主ソート列のNULLは明示的なnullsFirstに従う(overloadのような64/66件NULLでも正しく末尾に集まる)", async (sortKey) => {
    const field = PRIMARY_FIELD[sortKey];
    const isAsc = sortKey === "released_asc";
    const rows = [
      makeManagerRow(1, { [field]: null, name_sort_key: "a" }),
      makeManagerRow(2, { [field]: 5, name_sort_key: "b" }),
      makeManagerRow(3, { [field]: null, name_sort_key: "c" }),
      makeManagerRow(4, { [field]: 10, name_sort_key: "d" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: sortKey }), client as never);
    const ids = result.managers.map((m) => m.internalManagerId);
    const nullIds = [1, 3];
    const nonNullIdsInOrder = isAsc ? [2, 4] : [4, 2];
    if (isAsc) {
      expect(ids.slice(0, 2)).toEqual(nullIds);
      expect(ids.slice(2)).toEqual(nonNullIdsInOrder);
    } else {
      expect(ids.slice(0, 2)).toEqual(nonNullIdsInOrder);
      expect(ids.slice(2)).toEqual(nullIds);
    }
  });

  it("同じreleased_atの監督はname_sort_keyでタイブレークする", async () => {
    const rows = [
      makeManagerRow(1, { released_at: "2020-01-01", name_sort_key: "zeta" }),
      makeManagerRow(2, { released_at: "2020-01-01", name_sort_key: "alpha" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: "released_desc" }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([2, 1]);
  });

  it("主ソート値が同一の監督はname_sort_keyでタイブレークする(possession_desc)", async () => {
    const rows = [
      makeManagerRow(1, { possession_game: 89, name_sort_key: "zeta" }),
      makeManagerRow(2, { possession_game: 89, name_sort_key: "alpha" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: "possession_desc" }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([2, 1]);
  });

  it.each(ALL_SORT_KEYS)("%s: name_sort_keyまで同一の監督はinternal_manager_id ASCで最終タイブレークする(挿入順に依存しない)", async (sortKey) => {
    const field = PRIMARY_FIELD[sortKey];
    // Johan Cruyff(51/58)相当: 主ソート値・name_sort_keyとも完全一致、IDの大きい方を先に挿入して
    // 挿入順序に依存していないことを検証する。
    const rows = [
      makeManagerRow(58, { [field]: 42, name_sort_key: "johan cruyff" }),
      makeManagerRow(51, { [field]: 42, name_sort_key: "johan cruyff" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: sortKey }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([51, 58]);
  });

  it("3件が完全同値(主ソート値・name_sort_key)でもinternal_manager_id ASCで安定して並ぶ", async () => {
    const rows = [
      makeManagerRow(30, { possession_game: 70, name_sort_key: "mikel arteta" }),
      makeManagerRow(10, { possession_game: 70, name_sort_key: "mikel arteta" }),
      makeManagerRow(20, { possession_game: 70, name_sort_key: "mikel arteta" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: "possession_desc" }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([10, 20, 30]);
  });

  it("同一クエリを複数回実行しても順序が変わらない(安定性)", async () => {
    const rows = [
      makeManagerRow(58, { possession_game: 42, name_sort_key: "johan cruyff" }),
      makeManagerRow(51, { possession_game: 42, name_sort_key: "johan cruyff" }),
      makeManagerRow(3, { possession_game: 10, name_sort_key: "someone" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const orders: number[][] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = await listManagersFromSupabase(baseQuery({ sort: "possession_desc" }), client as never);
      orders.push(result.managers.map((m) => m.internalManagerId));
    }
    expect(orders[0]).toEqual([51, 58, 3]);
    expect(orders[1]).toEqual(orders[0]);
    expect(orders[2]).toEqual(orders[0]);
  });

  it("タイブレーク対象のグループがページ境界をまたいでも重複・欠落なくページングできる(pageSize=1)", async () => {
    const rows = [
      makeManagerRow(58, { possession_game: 42, name_sort_key: "johan cruyff" }),
      makeManagerRow(51, { possession_game: 42, name_sort_key: "johan cruyff" }),
      makeManagerRow(99, { possession_game: 5, name_sort_key: "zzz" }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const collected: number[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const result = await listManagersFromSupabase(baseQuery({ sort: "possession_desc", pageSize: 1, page }), client as never);
      expect(result.managers.length).toBe(1);
      collected.push(result.managers[0].internalManagerId);
    }
    expect(collected).toEqual([51, 58, 99]);
    expect(new Set(collected).size).toBe(3);
  });

  it("検索条件と組み合わせてもinternal_manager_idタイブレークが機能する", async () => {
    const rows = [
      makeManagerRow(58, { possession_game: 42, name_sort_key: "johan cruyff", name_en: "Johan Cruyff", has_booster: true }),
      makeManagerRow(51, { possession_game: 42, name_sort_key: "johan cruyff", name_en: "Johan Cruyff", has_booster: true }),
      makeManagerRow(3, { possession_game: 90, name_sort_key: "other", name_en: "Other Manager", has_booster: false }),
    ];
    const client = createFakeReferenceDataClient({ managers: rows });
    const result = await listManagersFromSupabase(baseQuery({ sort: "possession_desc", hasBooster: true }), client as never);
    expect(result.managers.map((m) => m.internalManagerId)).toEqual([51, 58]);
  });
});

describe("getManagerCountFromSupabase", () => {
  it("66件相当の件数を返す", async () => {
    const rows = Array.from({ length: 66 }, (_, i) => makeManagerRow(i + 1));
    const client = createFakeReferenceDataClient({ managers: rows });
    expect(await getManagerCountFromSupabase(client as never)).toBe(66);
  });
});
