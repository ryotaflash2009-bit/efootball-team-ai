import { describe, it, expect, vi, afterEach } from "vitest";
import { listPlayersFromSupabase } from "./world-source";
import { listManagersFromSupabase } from "./managers-source";
import { createFakeReferenceDataClient, createSearchRejectingReferenceDataClient } from "./test-doubles";
import { parseWorldListQuery } from "@/lib/world/schemas";
import { parseManagerListQuery } from "@/lib/managers/schemas";
import { SearchInputRejectedError } from "@/lib/search/search-input";
import { WorldQueryError } from "@/lib/world/db";
import type { ReferenceDataClient } from "./supabase-client";

const EXACT_WORLD_PAYLOAD = "'; DROP TABLE world_player_cards;--";
const EXACT_MANAGER_PAYLOAD = "'; DROP TABLE managers; --";
const WAF_BODY = "<html><head><title>Attention Required! | Cloudflare</title></head><body>Sorry, you have been blocked. Ray ID: 8a1b2c3d https://example.supabase.co/rest/v1/world_player_cards?or=(name_en.ilike...)</body></html>";

function worldRow(id: string, name: string) {
  return { world_card_id: id, name_en: name, name_ja: null, ovr_max: 90, ovr_base: 80, registered_position: "CF", card_type: "Epic", stats: {}, skills: [], ai_styles: [], image_url: null, mobile_image_url: null, efhub_card_id: null, boost1: "0", boost2: "0", name_sort_key: name.toLowerCase(), appearance_updated_at: null };
}
function managerRow(id: number, sourceId: string, name: string) {
  return { internal_manager_id: id, source: "amine250", source_manager_id: sourceId, name_en: name, name_ja: null, team_name: null, nationality: null, age: null, released_at: null, possession_game: 80, quick_counter: 70, long_ball_counter: 60, out_wide: 50, long_ball: 40, overload: null, manager_rating: null, coaching_affinity: null, formation: null, has_booster: false, has_link_up_play: false, booster_confirmation: null, boosters: [], link_up_plays: [], name_sort_key: name.toLowerCase() };
}
const WORLD = { world_player_cards: [worldRow("1", "Lionel Messi"), worldRow("2", "N'Golo Kanté"), worldRow("3", "三笘 薫"), worldRow("4", "Big 50%_off")] };
const MANAGERS = { managers: [managerRow(1, "cfabregas", "Cesc Fabregas"), managerRow(2, "oneil", "Martin O'Neill")] };

const wq = (q: string) => parseWorldListQuery({ q, pageSize: "24" });
const mq = (q: string) => parseManagerListQuery({ q });
const asClient = (c: unknown) => c as ReferenceDataClient;

afterEach(() => vi.restoreAllMocks());

describe("正常検索(regressionなし)", () => {
  it("通常の選手・監督検索と、アポストロフィ・Unicode・日本語・LIKE記号を含む正当な検索", async () => {
    const c = asClient(createFakeReferenceDataClient(WORLD));
    expect((await listPlayersFromSupabase(wq("messi"), c)).players.map((p) => p.worldCardId)).toEqual(["1"]);
    expect((await listPlayersFromSupabase(wq("N'Golo"), c)).totalCount).toBe(1);
    expect((await listPlayersFromSupabase(wq("Kanté"), c)).totalCount).toBe(1);
    expect((await listPlayersFromSupabase(wq("三笘"), c)).totalCount).toBe(1);
    expect((await listPlayersFromSupabase(wq("50%_off"), c)).totalCount).toBe(1);
    expect((await listPlayersFromSupabase(wq("5"), c)).totalCount).toBe(1); // 部分一致(50%)。IDの完全一致とは別
    expect((await listPlayersFromSupabase(wq(""), c)).totalCount).toBe(4);
    const m = asClient(createFakeReferenceDataClient(MANAGERS));
    expect((await listManagersFromSupabase(mq("fabregas"), m)).totalCount).toBe(1);
    expect((await listManagersFromSupabase(mq("O'Neill"), m)).totalCount).toBe(1);
  });

  it("SQLインジェクション風の文字列も、上流が受け付ければ通常の検索(0件)として200相当で返る", async () => {
    const c = asClient(createFakeReferenceDataClient(WORLD));
    expect((await listPlayersFromSupabase(wq(EXACT_WORLD_PAYLOAD), c)).totalCount).toBe(0);
    expect((await listManagersFromSupabase(mq(EXACT_MANAGER_PAYLOAD), asClient(createFakeReferenceDataClient(MANAGERS)))).totalCount).toBe(0);
  });
});

describe("上流の防御による拒否(403・error codeなし・検索語なしの確認クエリは成功)", () => {
  it("選手検索: 入力エラー(rejected_by_upstream)として扱い、確認クエリを1回だけ発行する", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c = createSearchRejectingReferenceDataClient(WORLD, { status: 403, error: { message: WAF_BODY } });
    const err = await listPlayersFromSupabase(wq(EXACT_WORLD_PAYLOAD), asClient(c)).catch((e) => e);
    expect(err).toBeInstanceOf(SearchInputRejectedError);
    expect(err.reason).toBe("rejected_by_upstream");
    expect(c.calls).toEqual({ withSearch: 1, withoutSearch: 1 });
    const logged = errSpy.mock.calls.map((a) => String(a[0])).join("\n");
    expect(logged).toContain('"errorCategory":"upstream_request_rejected"');
    expect(logged).not.toMatch(/Cloudflare|blocked|Ray ID|supabase\.co|ilike|DROP/);
    expect(String(err.message)).not.toMatch(/Cloudflare|DROP|ilike|supabase/);
  });

  it("監督検索も同じ", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c = createSearchRejectingReferenceDataClient(MANAGERS, { status: 403, error: { message: "" } });
    await expect(listManagersFromSupabase(mq(EXACT_MANAGER_PAYLOAD), asClient(c))).rejects.toBeInstanceOf(SearchInputRejectedError);
  });
});

describe("本当の認証・権限・上流障害は入力エラーにしない", () => {
  const cases: [string, number, { code?: string; message: string }, boolean][] = [
    ["403 + PostgreSQL権限code(42501)", 403, { code: "42501", message: "permission denied for table world_player_cards" }, false],
    ["403 + PostgRESTのJWT code", 403, { code: "PGRST301", message: "JWT expired" }, false],
    ["403 codeなし・確認クエリも403(全体が拒否=権限問題)", 403, { message: "" }, true],
    ["401", 401, { message: "Invalid API key" }, false],
    ["429", 429, { message: "Too Many Requests" }, false],
    ["500", 500, { message: "internal" }, false],
    ["502 malformed(HTML本文)", 502, { message: "<html>Bad Gateway</html>" }, false],
    ["503", 503, { message: "" }, false],
  ];
  for (const [label, status, error, alsoRejectWithoutSearch] of cases) {
    it(label, async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const c = createSearchRejectingReferenceDataClient(WORLD, { status, error, alsoRejectWithoutSearch });
      const err = await listPlayersFromSupabase(wq(EXACT_WORLD_PAYLOAD), asClient(c)).catch((e) => e);
      expect(err).toBeInstanceOf(WorldQueryError);
      expect(err).not.toBeInstanceOf(SearchInputRejectedError);
    });
  }

  it("検索語が無いクエリの403は、確認クエリを出さず既存どおりWorldQueryError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c = createSearchRejectingReferenceDataClient(WORLD, { status: 403, error: { message: "" }, alsoRejectWithoutSearch: true });
    await expect(listPlayersFromSupabase(wq(""), asClient(c))).rejects.toBeInstanceOf(WorldQueryError);
    expect(c.calls.withSearch).toBe(0);
    expect(c.calls.withoutSearch).toBe(1);
  });
});
