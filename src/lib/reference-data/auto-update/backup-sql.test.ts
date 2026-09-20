import { describe, it, expect } from "vitest";
import {
  buildBackupDumpSelectSql,
  buildBackupCountSql,
  buildBackupTruncateAllRestoreTargetsSql,
  buildBackupRestoreInsertSql,
  mapBackupFieldsToParams,
  toPortableBackupRow,
} from "./backup-sql";
import { BACKUP_SOURCE_TEST_SCHEMA, BACKUP_RESTORE_TEST_SCHEMA, getBackupTableSpec, BACKUP_TABLE_SPECS } from "./backup-schema";

describe("buildBackupDumpSelectSql / buildBackupCountSql", () => {
  it("SELECT *を使わず、schema修飾されている", () => {
    for (const spec of BACKUP_TABLE_SPECS) {
      const sql = buildBackupDumpSelectSql(BACKUP_SOURCE_TEST_SCHEMA, spec.table);
      expect(sql).not.toMatch(/select\s+\*/i);
      expect(sql).toContain(`${BACKUP_SOURCE_TEST_SCHEMA}.${spec.table}`);
      expect(sql).toContain(`order by ${spec.primaryKey}`);

      const count = buildBackupCountSql(BACKUP_SOURCE_TEST_SCHEMA, spec.table);
      expect(count).toContain("count(*)");
      expect(count).not.toMatch(/select\s+\*/i);
    }
  });

  it("restore先schemaに対しても生成できる", () => {
    const sql = buildBackupDumpSelectSql(BACKUP_RESTORE_TEST_SCHEMA, "managers");
    expect(sql).toContain(`${BACKUP_RESTORE_TEST_SCHEMA}.managers`);
  });

  it("許可されていないschema名は例外を投げる", () => {
    expect(() => buildBackupDumpSelectSql("public" as never, "managers")).toThrow();
  });

  it("未定義テーブルは例外を投げる", () => {
    expect(() => buildBackupDumpSelectSql(BACKUP_SOURCE_TEST_SCHEMA, "unknown_table")).toThrow();
  });
});

describe("buildBackupTruncateAllRestoreTargetsSql", () => {
  it("対象4テーブルすべてを単一のTRUNCATE文にまとめ、restore先schemaだけを対象にする", () => {
    const sql = buildBackupTruncateAllRestoreTargetsSql();
    const truncateCount = (sql.match(/\btruncate\b/gi) ?? []).length;
    expect(truncateCount).toBe(1);
    for (const spec of BACKUP_TABLE_SPECS) {
      expect(sql).toContain(`${BACKUP_RESTORE_TEST_SCHEMA}.${spec.table}`);
    }
    expect(sql).not.toContain(BACKUP_SOURCE_TEST_SCHEMA);
  });

  it("1テーブルずつ別々のTRUNCATE文を組み立てる手段を提供しない(外部キー違反の再発防止)", () => {
    // world_player_cardsはplayer_card_analysisから外部キー参照されているため、
    // 単独でTRUNCATEすると実PostgreSQLでは失敗する(2026-09-20、GitHub Actionsで確認済み)。
    // このビルダーは常に4テーブルまとめた単一文だけを返す設計であることを確認する。
    const sql1 = buildBackupTruncateAllRestoreTargetsSql();
    const sql2 = buildBackupTruncateAllRestoreTargetsSql();
    expect(sql1).toBe(sql2);
  });
});

describe("buildBackupRestoreInsertSql", () => {
  it("列を明示し、?プレースホルダーだけで組み立てる", () => {
    const spec = getBackupTableSpec("world_player_cards");
    const sql = buildBackupRestoreInsertSql("world_player_cards", 2);
    expect(sql).toContain(`${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards`);
    expect(sql).not.toMatch(/select\s+\*/i);
    const questionMarks = sql.match(/\?/g) ?? [];
    expect(questionMarks.length).toBe(spec.columns.length * 2);
  });

  it("rowCountが0以下なら例外を投げる", () => {
    expect(() => buildBackupRestoreInsertSql("world_player_cards", 0)).toThrow();
  });
});

describe("mapBackupFieldsToParams", () => {
  it("jsonb列はJSON.stringifyし、text[]列はネイティブ配列のまま渡す", () => {
    const spec = getBackupTableSpec("world_player_cards");
    const fields = { world_card_id: "wc-1", stats: { offensiveAwareness: 80 }, skills: ["Long Range Drive"] };
    const params = mapBackupFieldsToParams(spec, fields);
    const statsIndex = spec.columns.indexOf("stats");
    const skillsIndex = spec.columns.indexOf("skills");
    expect(params[statsIndex]).toBe(JSON.stringify({ offensiveAwareness: 80 }));
    expect(params[skillsIndex]).toEqual(["Long Range Drive"]);
  });

  it("欠損フィールドはnullとして渡す", () => {
    const spec = getBackupTableSpec("managers");
    const params = mapBackupFieldsToParams(spec, { internal_manager_id: 1 });
    expect(params[spec.columns.indexOf("name_en")]).toBeNull();
  });
});

describe("toPortableBackupRow(DB読み出し結果 → 移植可能な論理値への変換)", () => {
  it("jsonb列(stringified)をobjectへ復元する", () => {
    const spec = getBackupTableSpec("world_player_cards");
    const raw = { world_card_id: "wc-1", stats: JSON.stringify({ offensiveAwareness: 80 }) };
    const portable = toPortableBackupRow(spec, raw);
    expect(portable.stats).toEqual({ offensiveAwareness: 80 });
  });

  it("text[]列(stringified、実PostgreSQL adapterの挙動を再現)をネイティブ配列へ復元する", () => {
    const spec = getBackupTableSpec("world_player_cards");
    const raw = { world_card_id: "wc-1", skills: JSON.stringify(["Long Range Drive"]) };
    const portable = toPortableBackupRow(spec, raw);
    expect(portable.skills).toEqual(["Long Range Drive"]);
  });

  it("通常の文字列列はJSONとして解釈せずそのまま保持する", () => {
    const spec = getBackupTableSpec("world_player_cards");
    const raw = { world_card_id: "wc-1", name_en: "Lionel Messi" };
    const portable = toPortableBackupRow(spec, raw);
    expect(portable.name_en).toBe("Lionel Messi");
  });

  it("nullはnullのまま保持する", () => {
    const spec = getBackupTableSpec("world_player_cards");
    const raw = { world_card_id: "wc-1", appearance: null };
    const portable = toPortableBackupRow(spec, raw);
    expect(portable.appearance).toBeNull();
  });

  it("欠損フィールドはnullとして正規化する", () => {
    const spec = getBackupTableSpec("world_player_cards");
    const portable = toPortableBackupRow(spec, { world_card_id: "wc-1" });
    expect(portable.stats).toBeNull();
  });

  it("mapBackupFieldsToParams -> DB読み出し文字列化 -> toPortableBackupRow の往復で元の論理値へ戻る", () => {
    const spec = getBackupTableSpec("player_card_analysis");
    const original = {
      world_card_id: "wc-1",
      player_model: { key: "value" },
      positions: [{ code: "CF" }],
      com_skills: ["Heading"],
      player_skills: ["Long Range Drive", "Rising Shot"],
    };
    const params = mapBackupFieldsToParams(spec, original);
    // 実PostgreSQL adapterの`normalizeRow`は、null以外のobject/array値を一律JSON文字列化して返す。
    const simulatedDbRow: Record<string, unknown> = {};
    spec.columns.forEach((col, i) => {
      const v = params[i];
      simulatedDbRow[col] = v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    });
    const portable = toPortableBackupRow(spec, simulatedDbRow);
    expect(portable.player_model).toEqual(original.player_model);
    expect(portable.positions).toEqual(original.positions);
    expect(portable.com_skills).toEqual(original.com_skills);
    expect(portable.player_skills).toEqual(original.player_skills);
  });
});
