import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditReferenceDataExtensionSql, ANALYSIS_NAME_EXTENDABLE_TABLES } from "./reference-data-sql-audit";

/**
 * Phase Dの2件の差分修正(name_sort_key追加・player_card_analysis.efhub_name_en追加)の
 * migration SQL静的監査。既存の`reference-data-extension-sql-audit.test.ts`
 * (最初のdetail-extension migration専用)とは別の対象ファイルを扱う。
 */
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const NAME_SORT_KEY_EXTEND_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/extend-name-sort-key-schema.sql");
const NAME_SORT_KEY_ROLLBACK_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-name-sort-key-extension.sql");
const ANALYSIS_NAME_EXTEND_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/extend-player-card-analysis-name-schema.sql");
const ANALYSIS_NAME_ROLLBACK_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-player-card-analysis-name-extension.sql");

describe("extend-name-sort-key-schema.sql", () => {
  it("監査項目をすべて満たす(issues空、既定の許可テーブルworld_player_cards/managersのみ)", () => {
    const sql = readFileSync(NAME_SORT_KEY_EXTEND_PATH, "utf8");
    const result = auditReferenceDataExtensionSql(sql);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("player_card_analysis/import_batchesへは一切言及しない", () => {
    const sql = readFileSync(NAME_SORT_KEY_EXTEND_PATH, "utf8");
    expect(sql.toLowerCase()).not.toMatch(/\bplayer_card_analysis\b/);
    expect(sql.toLowerCase()).not.toMatch(/\bimport_batches\b/);
  });

  it("既存の13,009/66件を再投入・変更するINSERT/UPDATEを含まない", () => {
    const sql = readFileSync(NAME_SORT_KEY_EXTEND_PATH, "utf8");
    expect(sql.toLowerCase()).not.toMatch(/\binsert\s+into\b/);
    expect(sql.toLowerCase()).not.toMatch(/\bupdate\s+reference_data\b/);
  });
});

describe("rollback-name-sort-key-extension.sql", () => {
  it("world_player_cards/managers以外を変更しない", () => {
    const sql = readFileSync(NAME_SORT_KEY_ROLLBACK_PATH, "utf8");
    expect(sql).not.toMatch(/drop\s+schema/i);
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/alter\s+table\s+(?:reference_data\.)?(player_card_analysis|import_batches)\b/i);
    expect(sql).not.toMatch(/alter\s+table\s+(?:public\.)?(my_team_snapshots|rls_probe_records)\b/i);
  });
  it("name_sort_key列・関連インデックス・制約だけを削除する", () => {
    const sql = readFileSync(NAME_SORT_KEY_ROLLBACK_PATH, "utf8").toLowerCase();
    expect(sql).toContain("drop column if exists name_sort_key");
    expect(sql).toContain("drop index if exists");
  });
});

describe("extend-player-card-analysis-name-schema.sql", () => {
  it("監査項目をすべて満たす(issues空、player_card_analysisのみ許可)", () => {
    const sql = readFileSync(ANALYSIS_NAME_EXTEND_PATH, "utf8");
    const result = auditReferenceDataExtensionSql(sql, "reference_data", ANALYSIS_NAME_EXTENDABLE_TABLES);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("既定の許可テーブル(world_player_cards/managers)だけを対象にした場合は、player_card_analysisへのALTERとして拒否される", () => {
    const sql = readFileSync(ANALYSIS_NAME_EXTEND_PATH, "utf8");
    const result = auditReferenceDataExtensionSql(sql); // allowedTables省略 = 既定(world_player_cards/managersのみ)
    expect(result.ok).toBe(false);
  });

  it("world_player_cards/managers/import_batchesへのALTER/CREATE/INSERT等のDDL文を含まない(説明コメント内の言及は許容する)", () => {
    const sql = readFileSync(ANALYSIS_NAME_EXTEND_PATH, "utf8");
    expect(sql).not.toMatch(/\balter\s+table\s+(?:reference_data\.)?(world_player_cards|managers|import_batches)\b/i);
    expect(sql).not.toMatch(/\b(create|drop)\s+table\s+(?:reference_data\.)?(world_player_cards|managers|import_batches)\b/i);
  });

  it("既存19件を再投入・変更するINSERT/UPDATEを含まない", () => {
    const sql = readFileSync(ANALYSIS_NAME_EXTEND_PATH, "utf8");
    expect(sql.toLowerCase()).not.toMatch(/\binsert\s+into\b/);
    expect(sql.toLowerCase()).not.toMatch(/\bupdate\s+reference_data\b/);
  });
});

describe("rollback-player-card-analysis-name-extension.sql", () => {
  it("player_card_analysis以外を変更しない", () => {
    const sql = readFileSync(ANALYSIS_NAME_ROLLBACK_PATH, "utf8");
    expect(sql).not.toMatch(/drop\s+schema/i);
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/alter\s+table\s+(?:reference_data\.)?(world_player_cards|managers|import_batches)\b/i);
    expect(sql).not.toMatch(/alter\s+table\s+(?:public\.)?(my_team_snapshots|rls_probe_records)\b/i);
  });
  it("efhub_name_en列・関連制約だけを削除する", () => {
    const sql = readFileSync(ANALYSIS_NAME_ROLLBACK_PATH, "utf8").toLowerCase();
    expect(sql).toContain("drop column if exists efhub_name_en");
  });
});
