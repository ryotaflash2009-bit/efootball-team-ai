import { describe, it, expect } from "vitest";
import { getEfhubAnalysisDetailFromSupabase } from "./analysis-source";
import { createFakeReferenceDataClient, createFailingReferenceDataClient } from "./test-doubles";

const CARD_ID = "88043608522894";

function makeAnalysisRow(over: Record<string, unknown> = {}) {
  return {
    world_card_id: CARD_ID,
    efhub_name_en: "Burchett", // レガシーeFHUB表記(わざとworld_player_cards.name_enと違う表記にしている)
    weak_foot_usage: 3,
    weak_foot_accuracy: 2,
    form: 1,
    condition_value: 2,
    injury_resistance: 3,
    player_model: { armLength: 2, shoulderWidth: 4 },
    positions: [{ code: "CF", familiarity: 2, isRegistered: true }],
    com_skills: ["skill_a", "skill_b"],
    player_skills: ["skill_c"],
    source: "efhub",
    source_url: null,
    fetched_at: "2026-09-14T00:00:00.000Z",
    ...over,
  };
}

function makeWorldRow(over: Record<string, unknown> = {}) {
  return { world_card_id: CARD_ID, name_en: "Burchet", registered_position: "RWF", ...over };
}

describe("getEfhubAnalysisDetailFromSupabase", () => {
  it("存在するカードの分析結果を返す(nameEnはplayer_card_analysis.efhub_name_enから、registeredPositionはworld_player_cardsから補完)", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [makeAnalysisRow()],
      world_player_cards: [makeWorldRow()],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.nameEn).toBe("Burchett");
    expect(result?.registeredPosition).toBe("RWF");
    expect(result?.weakFootUsage).toBe(3);
    expect(result?.playerModel).toEqual({ armLength: 2, shoulderWidth: 4 });
    expect(result?.positions).toEqual([{ code: "CF", familiarity: 2, isRegistered: true }]);
    expect(result?.comSkills).toEqual(["skill_a", "skill_b"]);
    expect(result?.playerSkills).toEqual(["skill_c"]);
  });

  it("nameEnはworld_player_cards.name_enと表記が異なっていても、player_card_analysis.efhub_name_enをそのまま返す(意図的な区別、既知の仕様)", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [makeAnalysisRow({ efhub_name_en: "Pavel Nedved" })],
      world_player_cards: [makeWorldRow({ name_en: "Pavel Nedvěd" })],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.nameEn).toBe("Pavel Nedved");
  });

  it("efhub_name_enが未設定(null)ならnameEnはnullを返す(追加migration適用前の既知の状態)", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [makeAnalysisRow({ efhub_name_en: null })],
      world_player_cards: [makeWorldRow()],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.nameEn).toBeNull();
  });

  it("存在しないカードIDはnullを返す", async () => {
    const client = createFakeReferenceDataClient({ player_card_analysis: [], world_player_cards: [] });
    const result = await getEfhubAnalysisDetailFromSupabase("99999999999999", client as never);
    expect(result).toBeNull();
  });

  it("不正なID形式はnullを返す(クエリを発行しない)", async () => {
    const client = createFakeReferenceDataClient({ player_card_analysis: [], world_player_cards: [] });
    const result = await getEfhubAnalysisDetailFromSupabase("not-a-real-id", client as never);
    expect(result).toBeNull();
  });

  it("空配列(positions/com_skills/player_skills)を保持する", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [makeAnalysisRow({ positions: [], com_skills: [], player_skills: [] })],
      world_player_cards: [makeWorldRow()],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.positions).toEqual([]);
    expect(result?.comSkills).toEqual([]);
    expect(result?.playerSkills).toEqual([]);
  });

  it("player_modelが空オブジェクトならnullを返す(既存SQLite実装と同じ挙動)", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [makeAnalysisRow({ player_model: {} })],
      world_player_cards: [makeWorldRow()],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.playerModel).toBeNull();
  });

  it("null許容フィールド(weak_foot_usage等)のnullを保持する", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [makeAnalysisRow({ weak_foot_usage: null, form: null })],
      world_player_cards: [makeWorldRow()],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.weakFootUsage).toBeNull();
    expect(result?.form).toBeNull();
  });

  it("world_player_cards側に対応行が無くてもregisteredPositionはnullで分析結果自体は返す(nameEnはefhub_name_enから取れるため影響を受けない)", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [makeAnalysisRow()],
      world_player_cards: [],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.nameEn).toBe("Burchett");
    expect(result?.registeredPosition).toBeNull();
    expect(result?.weakFootUsage).toBe(3);
  });

  it("positionsは格納順に依存せず、is_registered DESC, position_code ASCへ読み取り時に並べ替える(実際に確認済みの格納順序ズレの再発防止)", async () => {
    const client = createFakeReferenceDataClient({
      player_card_analysis: [
        makeAnalysisRow({
          positions: [
            { code: "LMF", familiarity: null, isRegistered: true },
            { code: "RMF", familiarity: 2, isRegistered: false },
            { code: "AMF", familiarity: 2, isRegistered: false },
            { code: "SS", familiarity: 1, isRegistered: false },
          ],
        }),
      ],
      world_player_cards: [makeWorldRow()],
    });
    const result = await getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never);
    expect(result?.positions.map((p) => p.code)).toEqual(["LMF", "AMF", "RMF", "SS"]);
  });

  it("クエリエラー時は例外を投げる", async () => {
    const client = createFailingReferenceDataClient({ message: "network error" });
    await expect(getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never)).rejects.toThrow();
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
    it(`${label}: getEfhubAnalysisDetailFromSupabaseが例外を投げる`, async () => {
      const client = createFailingReferenceDataClient(error, status);
      await expect(getEfhubAnalysisDetailFromSupabase(CARD_ID, client as never)).rejects.toThrow();
    });
  }
});
