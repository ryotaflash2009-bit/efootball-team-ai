import { describe, it, expect } from "vitest";
import {
  PROMOTION_TABLE_SPECS,
  PROMOTION_ORDER,
  checkAllowedPromotionPair,
  checkPromotionOrderValid,
  buildPromotionUpsertSql,
  buildPromotionReadbackSql,
  buildPromotionSelectByIdsSql,
  buildPromotionCountSql,
  buildPromotionDeleteByIdSql,
  buildSourceMetadataUpsertSql,
  buildSourceMetadataSelectSql,
  buildSourceMetadataDeleteSql,
  mapFieldsToParams,
  getPromotionTableSpec,
  PROMOTION_STAGING_SCHEMA,
  PROMOTION_FINAL_SCHEMA,
} from "./promotion-sql";

describe("checkAllowedPromotionPair", () => {
  it("許可された3組はいずれも合格する", () => {
    for (const spec of PROMOTION_TABLE_SPECS) {
      expect(checkAllowedPromotionPair(spec.sourceTable, spec.targetTable).ok).toBe(true);
    }
  });

  it("許可されていない組み合わせは拒否される", () => {
    expect(checkAllowedPromotionPair("staging_world_player_cards", "managers").ok).toBe(false);
    expect(checkAllowedPromotionPair("auth.users", "world_player_cards").ok).toBe(false);
    expect(checkAllowedPromotionPair("staging_world_player_cards", "my_team_snapshots").ok).toBe(false);
  });
});

describe("checkPromotionOrderValid", () => {
  it("正しい順序は合格", () => {
    expect(checkPromotionOrderValid(PROMOTION_ORDER).ok).toBe(true);
  });

  it("順序違反は拒否", () => {
    expect(checkPromotionOrderValid(["player_card_analysis", "world_player_cards", "managers"]).ok).toBe(false);
  });

  it("件数不一致は拒否", () => {
    expect(checkPromotionOrderValid(["world_player_cards"]).ok).toBe(false);
  });
});

describe("buildPromotionUpsertSql", () => {
  it("schema修飾・列明示・?プレースホルダーのみで組み立てる", () => {
    const sql = buildPromotionUpsertSql("world_player_cards", 2);
    expect(sql).toContain(`${PROMOTION_FINAL_SCHEMA}.world_player_cards`);
    expect(sql).toContain("on conflict (world_card_id) do update set");
    expect(sql).not.toMatch(/select\s+\*/i);
    expect(sql).not.toMatch(/\$\d/);
    const questionMarks = sql.match(/\?/g) ?? [];
    const spec = getPromotionTableSpec("world_player_cards");
    expect(questionMarks.length).toBe(spec.columns.length * 2);
  });

  it("rowCountが0以下なら例外を投げる", () => {
    expect(() => buildPromotionUpsertSql("world_player_cards", 0)).toThrow();
  });

  it("許可されていないtargetTableは例外を投げる", () => {
    expect(() => buildPromotionUpsertSql("my_team_snapshots", 1)).toThrow();
  });

  it("3テーブルすべてで生成できる", () => {
    for (const spec of PROMOTION_TABLE_SPECS) {
      expect(() => buildPromotionUpsertSql(spec.targetTable, 1)).not.toThrow();
    }
  });
});

describe("buildPromotionReadbackSql / buildPromotionSelectByIdsSql / buildPromotionCountSql", () => {
  it("SELECT *を使わず、schema修飾されている", () => {
    for (const spec of PROMOTION_TABLE_SPECS) {
      const readback = buildPromotionReadbackSql(spec.targetTable);
      expect(readback).not.toMatch(/select\s+\*/i);
      expect(readback).toContain(`${PROMOTION_FINAL_SCHEMA}.${spec.targetTable}`);

      const byIds = buildPromotionSelectByIdsSql(spec.targetTable, 3);
      expect(byIds).not.toMatch(/select\s+\*/i);
      expect((byIds.match(/\?/g) ?? []).length).toBe(3);

      const count = buildPromotionCountSql(spec.targetTable);
      expect(count).toContain("count(*)");
      expect(count).not.toMatch(/select\s+\*/i);
    }
  });
});

describe("buildPromotionDeleteByIdSql", () => {
  it("主キー等価条件のWHERE句を持つ(全件削除ではない)", () => {
    for (const spec of PROMOTION_TABLE_SPECS) {
      const sql = buildPromotionDeleteByIdSql(spec.targetTable);
      expect(sql).toMatch(/where\s+\w+\s*=\s*\?/i);
      expect(sql).toContain(`${PROMOTION_FINAL_SCHEMA}.${spec.targetTable}`);
    }
  });
});

describe("source_metadata SQL", () => {
  it("upsert/select/deleteがすべてschema修飾・パラメータ化されている", () => {
    expect(buildSourceMetadataUpsertSql()).toContain(`${PROMOTION_FINAL_SCHEMA}.source_metadata`);
    expect(buildSourceMetadataSelectSql()).toContain(`${PROMOTION_FINAL_SCHEMA}.source_metadata`);
    expect(buildSourceMetadataDeleteSql()).toMatch(/where\s+table_name\s*=\s*\?/i);
  });
});

describe("mapFieldsToParams", () => {
  it("jsonb列はJSON.stringifyし、それ以外(text[]含む)はそのまま渡す", () => {
    const spec = getPromotionTableSpec("world_player_cards");
    const fields = {
      world_card_id: "wc-1",
      stats: { offensiveAwareness: 80 },
      skills: ["Long Range Drive"],
      appearance: null,
    };
    const params = mapFieldsToParams(spec, fields, "2026-01-01T00:00:00.000Z");
    const statsIndex = spec.columns.indexOf("stats");
    const skillsIndex = spec.columns.indexOf("skills");
    const updatedAtIndex = spec.columns.indexOf("updated_at");
    expect(params[statsIndex]).toBe(JSON.stringify({ offensiveAwareness: 80 }));
    expect(params[skillsIndex]).toEqual(["Long Range Drive"]);
    expect(params[updatedAtIndex]).toBe("2026-01-01T00:00:00.000Z");
  });

  it("欠損フィールドはnullとして渡す", () => {
    const spec = getPromotionTableSpec("managers");
    const params = mapFieldsToParams(spec, { internal_manager_id: 1 }, "2026-01-01T00:00:00.000Z");
    const nameIndex = spec.columns.indexOf("name_en");
    expect(params[nameIndex]).toBeNull();
  });
});

describe("固定schema名", () => {
  it("staging/finalとも隔離テスト専用schema名のまま", () => {
    expect(PROMOTION_STAGING_SCHEMA).toBe("reference_data_ops_test");
    expect(PROMOTION_FINAL_SCHEMA).toBe("reference_data_test");
  });
});
