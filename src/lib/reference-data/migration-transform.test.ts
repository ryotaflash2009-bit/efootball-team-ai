import { describe, it, expect } from "vitest";
import {
  computeDatasetVersion,
  computePayloadHash,
  transformWorldPlayerCard,
  validateWorldPlayerCard,
  transformManager,
  validateManager,
  transformPlayerCardAnalysis,
  findOrphanAnalysisRows,
  findDuplicateIds,
  buildManifest,
  type WorldPlayerCardSqliteRow,
  type ManagerSqliteRow,
  type PlayerCardAnalysisSqliteRow,
} from "./migration-transform";

const BATCH_ID = "00000000-0000-4000-8000-000000000000";

function baseCard(over: Partial<WorldPlayerCardSqliteRow> = {}): WorldPlayerCardSqliteRow {
  return {
    world_card_id: "88043608522894",
    name_en: "Burchet",
    name_ja: "バーチャット",
    card_type: "EPIC",
    registered_position: "RWF",
    nationality: "Australia",
    region: "Asia-Oceania",
    league: "Other",
    team: "EFB United",
    ovr_base: 84,
    ovr_max: 94,
    maximum_level: 19,
    card_rating: "B",
    playing_style: null,
    playing_style_def: null,
    preferred_foot: "Right",
    age: 24,
    height: 180,
    weight: 75,
    image_url: "https://d1zxa6glxh8sq9.cloudfront.net/player_88043608522894_1787815095927.webp",
    mobile_image_url: null,
    boost1: null,
    boost2: null,
    source: "efootball-world.com",
    source_url: null,
    appearance_updated_at: "2026-08-27T22:57:38.813Z",
    fetched_at: "2026-08-27T22:57:38.813Z",
    ...over,
  };
}

describe("computeDatasetVersion", () => {
  it("prefix-YYYY-MM-DDの形式を返す", () => {
    expect(computeDatasetVersion("world", new Date("2026-09-14T10:00:00.000Z"))).toBe("world-2026-09-14");
  });
});

describe("computePayloadHash", () => {
  it("同じ内容なら同じハッシュ、内容が違えば違うハッシュ", () => {
    const a = computePayloadHash([{ id: 1 }]);
    const b = computePayloadHash([{ id: 1 }]);
    const c = computePayloadHash([{ id: 2 }]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("transformWorldPlayerCard", () => {
  it("statsとskillsを正しくまとめ、dataset_version/import_batch_idを付与する", () => {
    const row = baseCard();
    const stats = [
      { world_card_id: row.world_card_id, stat_key: "finishing", value: 90 },
      { world_card_id: row.world_card_id, stat_key: "dribbling", value: 85 },
    ];
    const skills = [
      { world_card_id: row.world_card_id, skill_name: "Long Range Drive", display_order: 1 },
      { world_card_id: row.world_card_id, skill_name: "Acrobatic Finishing", display_order: 0 },
    ];
    const pg = transformWorldPlayerCard(row, stats, skills, "world-2026-09-14", BATCH_ID);
    expect(pg.stats).toEqual({ finishing: 90, dribbling: 85 });
    expect(pg.skills).toEqual(["Acrobatic Finishing", "Long Range Drive"]); // display_order順
    expect(pg.dataset_version).toBe("world-2026-09-14");
    expect(pg.import_batch_id).toBe(BATCH_ID);
    expect(pg.world_card_id).toBe(row.world_card_id);
  });

  it("日本語名(Unicode)を破損なく保持する", () => {
    const row = baseCard({ name_ja: "リオネル メッシ" });
    const pg = transformWorldPlayerCard(row, [], [], "world-2026-09-14", BATCH_ID);
    expect(pg.name_ja).toBe("リオネル メッシ");
    // JSONへの往復でも破損しないことを確認
    expect(JSON.parse(JSON.stringify(pg)).name_ja).toBe("リオネル メッシ");
  });
});

describe("validateWorldPlayerCard", () => {
  it("正常な行はok:true", () => {
    const pg = transformWorldPlayerCard(baseCard(), [], [], "world-2026-09-14", BATCH_ID);
    expect(validateWorldPlayerCard(pg)).toEqual({ ok: true, errors: [] });
  });

  it("不正なworld_card_id形式を検出する", () => {
    const pg = transformWorldPlayerCard(baseCard({ world_card_id: "not-a-number" }), [], [], "world-2026-09-14", BATCH_ID);
    expect(validateWorldPlayerCard(pg).ok).toBe(false);
    expect(validateWorldPlayerCard(pg).errors[0]).toMatch(/world_card_id形式が不正/);
  });

  it("name_enが空を検出する", () => {
    const pg = transformWorldPlayerCard(baseCard({ name_en: "" }), [], [], "world-2026-09-14", BATCH_ID);
    expect(validateWorldPlayerCard(pg).errors).toContain(`name_enが空: ${pg.world_card_id}`);
  });

  it("ovr_maxが範囲外を検出する", () => {
    const pg = transformWorldPlayerCard(baseCard({ ovr_max: 999 }), [], [], "world-2026-09-14", BATCH_ID);
    expect(validateWorldPlayerCard(pg).errors).toContain(`ovr_maxが範囲外: ${pg.world_card_id}`);
  });

  it("許可ホスト外の画像URLを検出する(既存のisAllowedWorldImageUrlを再利用)", () => {
    const pg = transformWorldPlayerCard(baseCard({ image_url: "https://evil.example.com/x.webp" }), [], [], "world-2026-09-14", BATCH_ID);
    expect(validateWorldPlayerCard(pg).errors[0]).toMatch(/image_urlが許可ホスト外/);
  });

  it("画像URLが無い(null)場合はエラーにしない", () => {
    const pg = transformWorldPlayerCard(baseCard({ image_url: null }), [], [], "world-2026-09-14", BATCH_ID);
    expect(validateWorldPlayerCard(pg).ok).toBe(true);
  });
});

function baseManager(over: Partial<ManagerSqliteRow> = {}): ManagerSqliteRow {
  return {
    internal_manager_id: 1,
    source: "amine250",
    source_manager_id: "conte",
    name_en: "Antonio Conte",
    name_ja: "アントニオ コンテ",
    team_name: null,
    nationality: "Italy",
    age: null,
    released_at: null,
    possession_game: 3,
    quick_counter: 0,
    long_ball_counter: 0,
    out_wide: 0,
    long_ball: 0,
    overload: 0,
    manager_rating: "A",
    coaching_affinity: null,
    formation: "3-4-3",
    has_booster: 1,
    has_link_up_play: 0,
    booster_confirmation: "confirmed",
    source_url: null,
    fetched_at: "2026-08-28T01:46:13.165Z",
    ...over,
  };
}

describe("transformManager / validateManager", () => {
  it("has_booster/has_link_up_playを0/1からbooleanへ変換する", () => {
    const pg = transformManager(baseManager(), "managers-2026-09-14", BATCH_ID);
    expect(pg.has_booster).toBe(true);
    expect(pg.has_link_up_play).toBe(false);
  });

  it("正常な行はok:true", () => {
    const pg = transformManager(baseManager(), "managers-2026-09-14", BATCH_ID);
    expect(validateManager(pg)).toEqual({ ok: true, errors: [] });
  });

  it("internal_manager_idが整数でない場合を検出する", () => {
    const pg = transformManager(baseManager({ internal_manager_id: 1.5 }), "managers-2026-09-14", BATCH_ID);
    expect(validateManager(pg).ok).toBe(false);
  });

  it("name_enが空を検出する", () => {
    const pg = transformManager(baseManager({ name_en: "" }), "managers-2026-09-14", BATCH_ID);
    expect(validateManager(pg).ok).toBe(false);
  });
});

describe("transformPlayerCardAnalysis", () => {
  it("efhub_card_idをworld_card_idへマッピングする", () => {
    const row: PlayerCardAnalysisSqliteRow = {
      efhub_card_id: "88035823848901",
      weak_foot_usage: 3,
      weak_foot_accuracy: 3,
      form: 2,
      condition_value: 3,
      injury_resistance: 2,
      player_model: { armLength: 2 },
      positions: [{ code: "LMF", familiarity: 2, isRegistered: true }],
      com_skills: ["skill_a"],
      player_skills: ["skill_b"],
      fetched_at: "2026-08-27T20:59:28.673Z",
    };
    const pg = transformPlayerCardAnalysis(row, "analysis-2026-09-14", BATCH_ID);
    expect(pg.world_card_id).toBe("88035823848901");
    expect(pg.source).toBe("efhub");
    expect(pg.player_model).toEqual({ armLength: 2 });
  });
});

describe("findOrphanAnalysisRows", () => {
  it("world_player_cardsに存在しないIDを検出する", () => {
    const analysis = [
      transformPlayerCardAnalysis(
        { efhub_card_id: "1", weak_foot_usage: null, weak_foot_accuracy: null, form: null, condition_value: null, injury_resistance: null, player_model: {}, positions: [], com_skills: [], player_skills: [], fetched_at: "2026-01-01T00:00:00.000Z" },
        "v1",
        BATCH_ID,
      ),
      transformPlayerCardAnalysis(
        { efhub_card_id: "2", weak_foot_usage: null, weak_foot_accuracy: null, form: null, condition_value: null, injury_resistance: null, player_model: {}, positions: [], com_skills: [], player_skills: [], fetched_at: "2026-01-01T00:00:00.000Z" },
        "v1",
        BATCH_ID,
      ),
    ];
    expect(findOrphanAnalysisRows(analysis, new Set(["1"]))).toEqual(["2"]);
    expect(findOrphanAnalysisRows(analysis, new Set(["1", "2"]))).toEqual([]);
  });
});

describe("findDuplicateIds", () => {
  it("重複しているIDだけを返す", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "a" }, { id: "c" }, { id: "c" }, { id: "c" }];
    expect(findDuplicateIds(rows, (r) => r.id).sort()).toEqual(["a", "c"]);
  });

  it("重複が無ければ空配列", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(findDuplicateIds(rows, (r) => r.id)).toEqual([]);
  });
});

describe("buildManifest", () => {
  it("件数・ハッシュ・生成日時を含むマニフェストを作る", () => {
    const validRows = [{ id: "1" }, { id: "2" }];
    const manifest = buildManifest({
      targetTable: "world_player_cards",
      datasetVersion: "world-2026-09-14",
      importBatchId: BATCH_ID,
      source: "data/efootball.db",
      sourceRowCount: 3,
      validRows,
      invalidRowCount: 1,
      duplicateIdCount: 0,
      now: new Date("2026-09-14T10:00:00.000Z"),
    });
    expect(manifest.targetTable).toBe("world_player_cards");
    expect(manifest.sourceRowCount).toBe(3);
    expect(manifest.validRowCount).toBe(2);
    expect(manifest.invalidRowCount).toBe(1);
    expect(manifest.payloadHash).toBe(computePayloadHash(validRows));
    expect(manifest.generatedAt).toBe("2026-09-14T10:00:00.000Z");
  });
});
