import { describe, it, expect } from "vitest";
import {
  auditPromotionSql,
  assertNoForbiddenSchemaReference,
  assertNoUserDataTableReference,
  assertNoSelectStar,
  assertNoDestructiveDdl,
  assertNoDynamicSql,
  assertDeleteOnlyByPrimaryKey,
  assertParameterizedOnly,
  assertNoSecretOrConnectionInfo,
  assertSchemasFixed,
  assertPromotionOrderFixed,
  assertExactlyThreeAllowedTables,
  assertRollbackSqlExistsForAllTables,
} from "./promotion-sql-audit";

describe("auditPromotionSql(実際のビルダー出力)", () => {
  it("全チェックに合格する", () => {
    const checks = auditPromotionSql();
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });
});

describe("静的監査関数の検出力(合成の悪いSQLで確認)", () => {
  it("public/auth/reference_data/reference_data_opsへの参照を検出する", () => {
    expect(assertNoForbiddenSchemaReference(["select 1 from public.x"]).ok).toBe(false);
    expect(assertNoForbiddenSchemaReference(["select 1 from auth.users"]).ok).toBe(false);
    expect(assertNoForbiddenSchemaReference(["select 1 from reference_data.world_player_cards"]).ok).toBe(false);
    expect(assertNoForbiddenSchemaReference(["select 1 from reference_data_ops.update_jobs"]).ok).toBe(false);
  });

  it("reference_data_test/reference_data_ops_testは誤検出しない", () => {
    expect(assertNoForbiddenSchemaReference(["select 1 from reference_data_test.world_player_cards"]).ok).toBe(true);
    expect(assertNoForbiddenSchemaReference(["select 1 from reference_data_ops_test.update_jobs"]).ok).toBe(true);
  });

  it("利用者データテーブルへの参照を検出する", () => {
    expect(assertNoUserDataTableReference(["select 1 from x where id in (select id from my_team_snapshots)"]).ok).toBe(false);
  });

  it("SELECT *を検出する", () => {
    expect(assertNoSelectStar(["select * from reference_data_test.world_player_cards"]).ok).toBe(false);
  });

  it("TRUNCATE/DROP/ALTER/GRANTを検出する", () => {
    expect(assertNoDestructiveDdl(["truncate table x"]).ok).toBe(false);
    expect(assertNoDestructiveDdl(["drop table x"]).ok).toBe(false);
    expect(assertNoDestructiveDdl(["alter table x add column y text"]).ok).toBe(false);
    expect(assertNoDestructiveDdl(["grant select on x to y"]).ok).toBe(false);
  });

  it("動的SQL(EXECUTE/DO)を検出する", () => {
    expect(assertNoDynamicSql(["do $$ begin execute 'drop table x'; end $$;"]).ok).toBe(false);
  });

  it("WHERE句の無いDELETEを検出する(全件削除の危険)", () => {
    expect(assertDeleteOnlyByPrimaryKey(["delete from reference_data_test.world_player_cards"]).ok).toBe(false);
  });

  it("主キー等価条件以外のDELETEを検出する", () => {
    expect(assertDeleteOnlyByPrimaryKey(["delete from reference_data_test.world_player_cards where ovr_max > ?"]).ok).toBe(false);
  });

  it("主キー等価条件のDELETEは合格する", () => {
    expect(assertDeleteOnlyByPrimaryKey(["delete from reference_data_test.world_player_cards where world_card_id = ?"]).ok).toBe(true);
  });

  it("VALUES句への文字列リテラル直接埋め込みを検出する(SQL interpolation)", () => {
    expect(assertParameterizedOnly(["insert into x (a) values ('injected')"]).ok).toBe(false);
  });

  it("接続文字列・Supabaseホスト名らしき文字列を検出する", () => {
    expect(assertNoSecretOrConnectionInfo(["-- postgres://user:pass@host/db"]).ok).toBe(false);
    expect(assertNoSecretOrConnectionInfo(["select 1 from x.supabase.co"]).ok).toBe(false);
  });

  it("schema名・promotion順序・許可テーブル数・rollback対応の自己整合性チェックに合格する", () => {
    expect(assertSchemasFixed().ok).toBe(true);
    expect(assertPromotionOrderFixed().ok).toBe(true);
    expect(assertExactlyThreeAllowedTables().ok).toBe(true);
    expect(assertRollbackSqlExistsForAllTables().ok).toBe(true);
  });
});
