import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { GET as worldGET } from "./world/players/route";
import { GET as managersGET } from "./managers/route";
import { setReferenceDataClientForTesting, type ReferenceDataClient } from "@/lib/reference-data/runtime/supabase-client";
import { createFakeReferenceDataClient, createSearchRejectingReferenceDataClient } from "@/lib/reference-data/runtime/test-doubles";

const EXACT_WORLD_PAYLOAD = "'; DROP TABLE world_player_cards;--";
const EXACT_MANAGER_PAYLOAD = "'; DROP TABLE managers; --";
const LEAK_RE = /drop|table|select|ilike|\.or\(|postgrest|supabase|cloudflare|stack|world_player_cards|42501|http:|https:/i;

const world = { world_player_cards: [{ world_card_id: "1", name_en: "Lionel Messi", name_ja: null, ovr_max: 90, ovr_base: 80, registered_position: "CF", card_type: "Epic", stats: {}, skills: [], ai_styles: [], image_url: null, mobile_image_url: null, efhub_card_id: null, boost1: "0", boost2: "0", fetched_at: "2026-09-01T00:00:00Z" }] };
const managers = { managers: [{ internal_manager_id: 1, source: "amine250", source_manager_id: "cfabregas", name_en: "Cesc Fabregas", name_ja: null, team_name: null, nationality: null, age: null, released_at: null, possession_game: 80, quick_counter: 70, long_ball_counter: 60, out_wide: 50, long_ball: 40, overload: null, manager_rating: null, coaching_affinity: null, formation: null, has_booster: false, has_link_up_play: false, booster_confirmation: null, boosters: [], link_up_plays: [] }] };

const use = (c: unknown) => setReferenceDataClientForTesting(() => c as ReferenceDataClient);
const req = (path: string, lang = "ja") => new Request(`http://localhost:3000${path}`, { headers: { "accept-language": lang } });

beforeEach(() => {
  vi.stubEnv("WORLD_DATA_SOURCE", "supabase");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  setReferenceDataClientForTesting(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("API: 検索入力の境界", () => {
  it("上流の防御に拒否された検索は400・安全な契約(5xxにしない)", async () => {
    use(createSearchRejectingReferenceDataClient(world, { status: 403, error: { message: "<html>Cloudflare blocked https://x.supabase.co</html>" } }));
    const r = await worldGET(req(`/api/world/players?q=${encodeURIComponent(EXACT_WORLD_PAYLOAD)}`));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body).toEqual({ error: { code: "SEARCH_INPUT_REJECTED", reason: "rejected_by_upstream", message: expect.stringMatching(/検索できません/) } });
    expect(JSON.stringify(body)).not.toMatch(LEAK_RE);

    use(createSearchRejectingReferenceDataClient(managers, { status: 403, error: { message: "" } }));
    const m = await managersGET(req(`/api/managers?q=${encodeURIComponent(EXACT_MANAGER_PAYLOAD)}`, "en-US,en;q=0.9"));
    expect(m.status).toBe(400);
    const mb = await m.json();
    expect(mb.error.message).toMatch(/cannot be used/);
    expect(JSON.stringify(mb)).not.toMatch(LEAK_RE);
  });

  it("NUL・制御文字・異常な長さは上流へ送らずに400", async () => {
    const c = createSearchRejectingReferenceDataClient(world, { status: 403, error: { message: "" } });
    use(c);
    for (const q of ["messi\u0000", "a\u001bb", "x".repeat(1001)]) {
      const r = await worldGET(req(`/api/world/players?q=${encodeURIComponent(q)}`));
      expect(r.status).toBe(400);
      expect((await r.json()).error.code).toBe("SEARCH_INPUT_REJECTED");
    }
    const viaQuery = await worldGET(req(`/api/world/players?query=${encodeURIComponent("a\u0000")}`));
    expect(viaQuery.status).toBe(400);
    const m = await managersGET(req(`/api/managers?q=${encodeURIComponent("a\u0000")}`));
    expect(m.status).toBe(400);
    expect(c.calls).toEqual({ withSearch: 0, withoutSearch: 0 });
  });

  it("本当の認証・権限エラーは入力エラーにせず既存どおり500(内部情報なし)", async () => {
    use(createSearchRejectingReferenceDataClient(world, { status: 403, error: { code: "42501", message: "permission denied for table world_player_cards" } }));
    const r = await worldGET(req(`/api/world/players?q=${encodeURIComponent(EXACT_WORLD_PAYLOAD)}`));
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.error.code).toBe("WORLD_QUERY_FAILED");
    expect(JSON.stringify(body)).not.toMatch(LEAK_RE);
    use(createSearchRejectingReferenceDataClient(world, { status: 401, error: { message: "Invalid API key" } }));
    expect((await worldGET(req("/api/world/players?q=messi"))).status).toBe(500);
  });

  it("正常検索・記号を含む検索・空検索は200で、データは変わらない", async () => {
    use(createFakeReferenceDataClient(world));
    for (const q of ["messi", "Mes", "'", ";", "O'Neil", "三笘", "", "   "]) {
      const r = await worldGET(req(`/api/world/players?q=${encodeURIComponent(q)}`));
      expect(r.status, q).toBe(200);
    }
    const after = await (await worldGET(req("/api/world/players"))).json();
    expect(after.totalCount).toBe(1);
    use(createFakeReferenceDataClient(managers));
    expect((await managersGET(req("/api/managers?q=fabregas"))).status).toBe(200);
    expect(managers.managers.length).toBe(1);
  });
});
