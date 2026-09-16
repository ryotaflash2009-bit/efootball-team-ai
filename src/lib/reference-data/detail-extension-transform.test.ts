import { describe, it, expect } from "vitest";
import {
  buildEfhubLinkMap,
  buildAiStylesMap,
  buildAppearanceMap,
  buildEfhubConflictsMap,
  buildManagerBoostersMap,
  buildManagerLinkUpPlaysMap,
  findOrphanIds,
} from "./detail-extension-transform";

describe("buildEfhubLinkMap", () => {
  it("world+efhub両方が揃うinternal_card_idだけをリンクとして採用する", () => {
    const map = buildEfhubLinkMap([
      { internal_card_id: 1, source: "world", source_card_id: "1000" },
      { internal_card_id: 1, source: "efhub", source_card_id: "47918" },
      { internal_card_id: 2, source: "world", source_card_id: "2000" }, // efhub側なし
      { internal_card_id: 3, source: "efhub", source_card_id: "3000" }, // world側なし
    ]);
    expect(map.size).toBe(1);
    expect(map.get("1000")).toBe("47918");
    expect(map.has("2000")).toBe(false);
  });

  it("world_card_id == efhub_card_idの偶然の一致も正しく扱う", () => {
    const map = buildEfhubLinkMap([
      { internal_card_id: 1, source: "world", source_card_id: "88043608522894" },
      { internal_card_id: 1, source: "efhub", source_card_id: "88043608522894" },
    ]);
    expect(map.get("88043608522894")).toBe("88043608522894");
  });

  it("空配列は空のMapを返す", () => {
    expect(buildEfhubLinkMap([]).size).toBe(0);
  });
});

describe("buildAiStylesMap", () => {
  it("display_order順に並べる", () => {
    const map = buildAiStylesMap([
      { world_card_id: "1", style_name: "Long Ball Expert", display_order: 1 },
      { world_card_id: "1", style_name: "Speeding Bullet", display_order: 0 },
    ]);
    expect(map.get("1")).toEqual(["Speeding Bullet", "Long Ball Expert"]);
  });

  it("対応の無いworld_card_idはMapに現れない", () => {
    const map = buildAiStylesMap([{ world_card_id: "1", style_name: "X", display_order: 0 }]);
    expect(map.has("2")).toBe(false);
  });
});

describe("buildAppearanceMap", () => {
  it("ranks_jsonをパースする", () => {
    const map = buildAppearanceMap([
      {
        world_card_id: "1",
        position: "CF",
        leg_coverage_radius: 1.5,
        arm_coverage_radius: 2.5,
        torso_collision: 3.5,
        jumping_height: 4.5,
        dribble_height: 5.5,
        leg_length: 6.5,
        ranks_json: '{"legCoverageRadius":{"overall":{"rank":1,"total":100,"topPercent":1}}}',
        updated_at: "2026-09-14T00:00:00.000Z",
      },
    ]);
    const v = map.get("1")!;
    expect(v.position).toBe("CF");
    expect(v.legCoverageRadius).toBe(1.5);
    expect(v.ranks).toEqual({ legCoverageRadius: { overall: { rank: 1, total: 100, topPercent: 1 } } });
  });

  it("壊れたJSONはranksをnullにする(例外を投げない)", () => {
    const map = buildAppearanceMap([
      {
        world_card_id: "1",
        position: null,
        leg_coverage_radius: null,
        arm_coverage_radius: null,
        torso_collision: null,
        jumping_height: null,
        dribble_height: null,
        leg_length: null,
        ranks_json: "{invalid json",
        updated_at: null,
      },
    ]);
    expect(map.get("1")!.ranks).toBeNull();
  });

  it("ranks_jsonがnullならranksもnull", () => {
    const map = buildAppearanceMap([
      {
        world_card_id: "1",
        position: null,
        leg_coverage_radius: null,
        arm_coverage_radius: null,
        torso_collision: null,
        jumping_height: null,
        dribble_height: null,
        leg_length: null,
        ranks_json: null,
        updated_at: null,
      },
    ]);
    expect(map.get("1")!.ranks).toBeNull();
  });
});

describe("buildEfhubConflictsMap", () => {
  it("安全な3項目だけを保持する(内部監査フィールドを含む型を渡しても出力には出ない)", () => {
    const map = buildEfhubConflictsMap([
      { world_card_id: "1", field_name: "ovr_max", efhub_value: "104", world_value: "103" },
      { world_card_id: "1", field_name: "playing_style", efhub_value: "Defensive Goalkeeper", world_value: "Basic" },
    ]);
    const arr = map.get("1")!;
    expect(arr).toHaveLength(2);
    expect(Object.keys(arr[0]).sort()).toEqual(["efhubValue", "fieldName", "worldValue"].sort());
  });

  it("world_card_idがnullの行は無視する", () => {
    const map = buildEfhubConflictsMap([{ world_card_id: null, field_name: "x", efhub_value: null, world_value: null }]);
    expect(map.size).toBe(0);
  });
});

describe("buildManagerBoostersMap", () => {
  it("display_order順に並べ、フィールドを変換する", () => {
    const map = buildManagerBoostersMap([
      { internal_manager_id: 1, display_order: 1, stat_name_en: "Kicking Power", stat_key: "kickingPower", delta: 1, raw_value: "+1", application_condition: null, confirmation_status: "confirmed" },
      { internal_manager_id: 1, display_order: 0, stat_name_en: "Defensive Awareness", stat_key: "defensiveAwareness", delta: 1, raw_value: "+1", application_condition: null, confirmation_status: "confirmed" },
    ]);
    const arr = map.get(1)!;
    expect(arr.map((b) => b.statNameEn)).toEqual(["Defensive Awareness", "Kicking Power"]);
    expect(arr[0].statKey).toBe("defensiveAwareness");
  });

  it("booster0件の監督はMapに現れない", () => {
    const map = buildManagerBoostersMap([]);
    expect(map.has(1)).toBe(false);
  });
});

describe("buildManagerLinkUpPlaysMap", () => {
  it("centerPiece/keyManを正しく結合する", () => {
    const plays = [{ id: 100, internal_manager_id: 1, display_order: 0, name: "Over-the-Top Pass A", confirmation_status: "provisional" }];
    const conditions = [
      { link_up_play_id: 100, role: "centerPiece" as const, playing_style: "Long Ball Expert", positions_json: '["DMF"]' },
      { link_up_play_id: 100, role: "keyMan" as const, playing_style: "Speed Merchant", positions_json: '["CF"]' },
    ];
    const map = buildManagerLinkUpPlaysMap(plays, conditions);
    const arr = map.get(1)!;
    expect(arr).toHaveLength(1);
    expect(arr[0].centerPiece).toEqual({ role: "centerPiece", playingStyle: "Long Ball Expert", positions: ["DMF"] });
    expect(arr[0].keyMan).toEqual({ role: "keyMan", playingStyle: "Speed Merchant", positions: ["CF"] });
  });

  it("role側が欠けている場合はnullになる", () => {
    const plays = [{ id: 100, internal_manager_id: 1, display_order: 0, name: "X", confirmation_status: "provisional" }];
    const conditions = [{ link_up_play_id: 100, role: "centerPiece" as const, playing_style: null, positions_json: "[]" }];
    const map = buildManagerLinkUpPlaysMap(plays, conditions);
    expect(map.get(1)![0].keyMan).toBeNull();
    expect(map.get(1)![0].centerPiece).toEqual({ role: "centerPiece", playingStyle: null, positions: [] });
  });

  it("壊れたpositions_jsonは空配列扱いにする", () => {
    const plays = [{ id: 100, internal_manager_id: 1, display_order: 0, name: "X", confirmation_status: "provisional" }];
    const conditions = [{ link_up_play_id: 100, role: "centerPiece" as const, playing_style: null, positions_json: "{not an array" }];
    const map = buildManagerLinkUpPlaysMap(plays, conditions);
    expect(map.get(1)![0].centerPiece!.positions).toEqual([]);
  });

  it("Link-up Play 0件の監督はMapに現れない", () => {
    expect(buildManagerLinkUpPlaysMap([], []).has(1)).toBe(false);
  });
});

describe("findOrphanIds", () => {
  it("既知の主キー集合に無いIDだけを返す", () => {
    expect(findOrphanIds(["1", "2", "3"], new Set(["1", "3"]))).toEqual(["2"]);
  });
  it("全て既知なら空配列", () => {
    expect(findOrphanIds(["1"], new Set(["1"]))).toEqual([]);
  });
});
