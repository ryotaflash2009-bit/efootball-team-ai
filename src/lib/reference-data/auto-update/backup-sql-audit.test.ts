import { describe, it, expect } from "vitest";
import {
  auditBackupSql,
  assertNoForbiddenSchemaReference,
  assertNoUserDataTableReference,
  assertNoBroadDestructiveDdl,
  assertTruncateScopedToRestoreTargetOnly,
  assertTruncateIsSingleCombinedStatement,
  assertNoDynamicSql,
  assertNoSecretOrConnectionInfo,
  assertNoBypassFlags,
} from "./backup-sql-audit";
import { BACKUP_RESTORE_TEST_SCHEMA } from "./backup-schema";
import { BACKUP_TARGET_TABLES } from "./backup-target";

describe("auditBackupSql(実際のビルダー出力に対する監査)", () => {
  it("issues: []であること", () => {
    const checks = auditBackupSql();
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("静的監査関数の検出力(合成の悪いSQL)", () => {
  it("reference_data(確定Production schema)への参照を検出する", () => {
    expect(assertNoForbiddenSchemaReference(["select * from reference_data.world_player_cards"]).ok).toBe(false);
  });

  it("reference_data_opsへの参照を検出する", () => {
    expect(assertNoForbiddenSchemaReference(["select * from reference_data_ops.update_jobs"]).ok).toBe(false);
  });

  it("利用者データテーブルへの参照を検出する", () => {
    expect(assertNoUserDataTableReference(["select * from public.my_team_snapshots"]).ok).toBe(false);
  });

  it("DROP DATABASEを検出する", () => {
    expect(assertNoBroadDestructiveDdl(["drop database production"]).ok).toBe(false);
  });

  it("DROP SCHEMAを検出する", () => {
    expect(assertNoBroadDestructiveDdl([`drop schema ${BACKUP_RESTORE_TEST_SCHEMA}`]).ok).toBe(false);
  });

  it(`Restore先schema(${BACKUP_RESTORE_TEST_SCHEMA})以外へのTRUNCATEを検出する`, () => {
    expect(assertTruncateScopedToRestoreTargetOnly(["truncate table reference_data.world_player_cards"]).ok).toBe(false);
  });

  it("Restore先schemaへのTRUNCATEは許可する", () => {
    expect(assertTruncateScopedToRestoreTargetOnly([`truncate table ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards`]).ok).toBe(true);
  });

  it("カンマ区切りの一部だけがRestore先schema以外の場合も検出する", () => {
    const sql = `truncate table ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards, reference_data.managers`;
    expect(assertTruncateScopedToRestoreTargetOnly([sql]).ok).toBe(false);
  });

  it("1テーブルずつ別々のTRUNCATE文(外部キー違反の原因、2026-09-20修正)を検出する", () => {
    const sqlList = BACKUP_TARGET_TABLES.map((t) => `truncate table ${BACKUP_RESTORE_TEST_SCHEMA}.${t}`);
    expect(assertTruncateIsSingleCombinedStatement(sqlList).ok).toBe(false);
  });

  it("4テーブルすべてを含む単一のTRUNCATE文は合格する", () => {
    const sql = `truncate table ${BACKUP_TARGET_TABLES.map((t) => `${BACKUP_RESTORE_TEST_SCHEMA}.${t}`).join(", ")}`;
    expect(assertTruncateIsSingleCombinedStatement([sql]).ok).toBe(true);
  });

  it("単一文でも4テーブルの一部が欠けていれば不合格", () => {
    const sql = `truncate table ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards, ${BACKUP_RESTORE_TEST_SCHEMA}.managers`;
    expect(assertTruncateIsSingleCombinedStatement([sql]).ok).toBe(false);
  });

  it("動的SQL(EXECUTE/DO/CALL)を検出する", () => {
    expect(assertNoDynamicSql(["do $$ begin end $$"]).ok).toBe(false);
    expect(assertNoDynamicSql(["call some_procedure()"]).ok).toBe(false);
  });

  it("接続文字列・トークンらしき文字列を検出する", () => {
    expect(assertNoSecretOrConnectionInfo(["select 'postgres://user:pass@host/db'"]).ok).toBe(false);
    expect(assertNoSecretOrConnectionInfo(["select 'api_key=abc'"]).ok).toBe(false);
  });

  it("既知のbypassフラグ(--no-encryption等)を検出する", () => {
    expect(assertNoBypassFlags(["--no-encryption"]).ok).toBe(false);
    expect(assertNoBypassFlags(["--skip-checksum"]).ok).toBe(false);
    expect(assertNoBypassFlags(["--skip-restore-test"]).ok).toBe(false);
  });

  it("bypassフラグが無いargvは合格する", () => {
    expect(assertNoBypassFlags([]).ok).toBe(true);
    expect(assertNoBypassFlags(["--execute"]).ok).toBe(true);
  });
});
