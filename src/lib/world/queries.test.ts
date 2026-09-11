import { describe, it, expect } from "vitest";
import { buildWhere, orderByClause } from "./queries";
import { parseWorldListQuery } from "./schemas";
import type { WorldSortKey } from "./types";

const base = parseWorldListQuery({});

describe("buildWhere", () => {
  it("条件なしなら空文字・パラメーターなし", () => {
    const r = buildWhere(base);
    expect(r.sql).toBe("");
    expect(r.params).toEqual([]);
  });

  it("検索語は必ずバインドパラメーターで渡す（SQL へ値を連結しない）", () => {
    const q = parseWorldListQuery({ q: "Messi" });
    const r = buildWhere(q);
    expect(r.sql).toContain("LIKE ?");
    expect(r.sql).not.toContain("Messi");
    // 名前2回 + World ID + eFHUB ID の4パラメーター
    expect(r.params).toEqual(["%messi%", "%messi%", "Messi", "Messi"]);
  });

  it("LIKE のワイルドカードをエスケープする", () => {
    const q = parseWorldListQuery({ q: "50% _x" });
    const r = buildWhere(q);
    expect(r.params[0]).toBe("%50\\% \\_x%");
    expect(r.sql).toContain("ESCAPE '\\'");
  });

  it("SQL インジェクション風の検索語も値として扱う", () => {
    const q = parseWorldListQuery({ q: "'; DROP TABLE world_player_cards; --" });
    const r = buildWhere(q);
    expect(r.sql).not.toContain("DROP");
    expect(r.params[2]).toBe("'; DROP TABLE world_player_cards; --");
  });

  it("フィルタは列 = ? で追加される", () => {
    const q = parseWorldListQuery({ position: "GK", cardType: "EPIC", minOvr: "90", maxOvr: "100" });
    const r = buildWhere(q);
    expect(r.sql).toContain("c.registered_position = ?");
    expect(r.sql).toContain("c.card_type = ?");
    expect(r.sql).toContain("c.ovr_max >= ?");
    expect(r.sql).toContain("c.ovr_max <= ?");
    expect(r.params).toEqual(["GK", "EPIC", 90, 100]);
  });

  it("hasBooster は真偽で別の固定条件（パラメーターなし）", () => {
    expect(buildWhere(parseWorldListQuery({ hasBooster: "1" })).sql).toContain("<> 0");
    expect(buildWhere(parseWorldListQuery({ hasBooster: "0" })).sql).toContain("= 0");
  });
});

describe("orderByClause", () => {
  it("既知キーは固定 ORDER BY", () => {
    expect(orderByClause("name")).toBe("ORDER BY c.name_en COLLATE NOCASE ASC, c.world_card_id ASC");
    expect(orderByClause("ovr_max_desc")).toContain("c.ovr_max DESC");
  });
  it("未知キー（型を無視して渡しても）安全な既定へ", () => {
    expect(orderByClause("__evil__" as WorldSortKey)).toBe(orderByClause("ovr_max_desc"));
  });
  it("ORDER BY 句にユーザー入力が入り込む余地がない", () => {
    const all: WorldSortKey[] = [
      "ovr_max_desc",
      "ovr_max_asc",
      "ovr_base_desc",
      "ovr_base_asc",
      "name",
      "updated_desc",
    ];
    for (const k of all) {
      expect(orderByClause(k).startsWith("ORDER BY c.")).toBe(true);
    }
  });
});
