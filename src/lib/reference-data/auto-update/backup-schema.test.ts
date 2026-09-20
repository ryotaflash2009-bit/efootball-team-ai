import { describe, it, expect } from "vitest";
import {
  BACKUP_TABLE_SPECS,
  getBackupTableSpec,
  buildBackupIsolatedSchemaDdl,
  BACKUP_SOURCE_TEST_SCHEMA,
  BACKUP_RESTORE_TEST_SCHEMA,
} from "./backup-schema";

describe("BACKUP_TABLE_SPECS", () => {
  it("4テーブルすべてが定義され、主キーが重複しない", () => {
    expect(BACKUP_TABLE_SPECS.length).toBe(4);
    const tables = BACKUP_TABLE_SPECS.map((s) => s.table);
    expect(new Set(tables).size).toBe(4);
  });

  it("getBackupTableSpecは未定義テーブルで例外を投げる", () => {
    expect(() => getBackupTableSpec("unknown_table")).toThrow();
  });

  it("各テーブルのjsonbColumnsはcolumnsの部分集合", () => {
    for (const spec of BACKUP_TABLE_SPECS) {
      for (const col of spec.jsonbColumns) {
        expect(spec.columns).toContain(col);
      }
      expect(spec.columns).toContain(spec.primaryKey);
    }
  });
});

describe("buildBackupIsolatedSchemaDdl", () => {
  it("source用schema名でDDLを生成できる", () => {
    const ddl = buildBackupIsolatedSchemaDdl(BACKUP_SOURCE_TEST_SCHEMA);
    expect(ddl).toContain(`create schema if not exists ${BACKUP_SOURCE_TEST_SCHEMA}`);
    for (const table of ["world_player_cards", "managers", "player_card_analysis", "import_batches"]) {
      expect(ddl).toContain(`${BACKUP_SOURCE_TEST_SCHEMA}.${table}`);
    }
  });

  it("restore先schema名でDDLを生成できる(sourceとは別schema名)", () => {
    const ddl = buildBackupIsolatedSchemaDdl(BACKUP_RESTORE_TEST_SCHEMA);
    expect(ddl).toContain(`create schema if not exists ${BACKUP_RESTORE_TEST_SCHEMA}`);
    expect(BACKUP_RESTORE_TEST_SCHEMA).not.toBe(BACKUP_SOURCE_TEST_SCHEMA);
  });

  it("許可されていないschema名は例外を投げる(型を迂回した呼び出しに対する実行時防御)", () => {
    expect(() => buildBackupIsolatedSchemaDdl("public" as never)).toThrow();
    expect(() => buildBackupIsolatedSchemaDdl("reference_data" as never)).toThrow();
  });

  it("生成したDDLはpublic/authスキーマへの参照を含まない", () => {
    const ddl = buildBackupIsolatedSchemaDdl(BACKUP_SOURCE_TEST_SCHEMA);
    expect(ddl).not.toMatch(/\bpublic\./i);
    expect(ddl).not.toMatch(/\bauth\./i);
  });
});
