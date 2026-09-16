import { describe, it, expect } from "vitest";
import {
  EXPECTED_COUNTS,
  ALLOWED_TARGET_TABLES,
  assertAllowedTable,
  qualifiedTable,
  parseExecuteFlag,
  parseValidateOnlyFlag,
  maskSecretValue,
  maskConnectionStringPatterns,
  sanitizeErrorMessage,
  checkAllTablesEmpty,
  checkExactCounts,
  checkHashesMatch,
  checkNoDuplicates,
  checkNoOrphans,
  checkPrimaryKeySetMatches,
  checkNoInvalidRows,
  checkSqliteIntegrity,
  decideCommitOrRollback,
  checkIdempotencyGuard,
  chunkRows,
  buildUpsertSql,
  buildBulkUpdateSql,
} from "./real-import-guards";

describe("parseExecuteFlag", () => {
  it("--executeが無ければfalse(既定でdry-run)", () => {
    expect(parseExecuteFlag([])).toBe(false);
    expect(parseExecuteFlag(["node", "script.mjs"])).toBe(false);
  });
  it("--executeがあればtrue", () => {
    expect(parseExecuteFlag(["node", "script.mjs", "--execute"])).toBe(true);
  });
});

describe("parseValidateOnlyFlag", () => {
  it("--validate-onlyが無ければfalse", () => {
    expect(parseValidateOnlyFlag(["node", "script.mjs"])).toBe(false);
  });
  it("--validate-onlyがあればtrue", () => {
    expect(parseValidateOnlyFlag(["node", "script.mjs", "--validate-only"])).toBe(true);
  });
});

describe("秘密情報マスキング", () => {
  it("既知の秘密値を除去する", () => {
    const secret = "postgres://user:hunter2@db.example.supabase.co:5432/postgres";
    const message = `接続失敗: ${secret} に到達できません`;
    expect(maskSecretValue(message, secret)).not.toContain("hunter2");
    expect(maskSecretValue(message, secret)).toContain("[REDACTED]");
  });

  it("secretがundefined/nullなら元の文字列をそのまま返す", () => {
    expect(maskSecretValue("hello", undefined)).toBe("hello");
    expect(maskSecretValue("hello", null)).toBe("hello");
  });

  it("未知のpostgres://パターンもマスクする(多層防御)", () => {
    const message = "failed to connect to postgres://otheruser:otherpass@unexpected-host:5432/db";
    const masked = maskConnectionStringPatterns(message);
    expect(masked).not.toContain("otherpass");
    expect(masked).not.toContain("otheruser");
  });

  it("Supabaseホスト名らしきパターンをマスクする", () => {
    const message = "connection to aws-0-ap-northeast-1.pooler.supabase.com timed out";
    expect(maskConnectionStringPatterns(message)).not.toContain("pooler.supabase.com");
  });

  it("sanitizeErrorMessageは既知の秘密値と一般パターンの両方をマスクする", () => {
    const secret = "postgres://admin:s3cr3t@db.example-project-ref.supabase.co:5432/postgres";
    const message = `error: ${secret}`;
    const result = sanitizeErrorMessage(message, secret);
    expect(result).not.toContain("s3cr3t");
    expect(result).not.toContain("supabase.co");
  });

  it("sanitizeErrorMessageは複数の秘密値(テンプレート・パスワード・完成文字列)を同時にマスクできる", () => {
    const template = "postgresql://postgres.example-ref:[YOUR-PASSWORD]@aws-0-x.pooler.supabase.com:5432/postgres";
    const password = "my-raw-password";
    const connectionString = "postgresql://postgres.example-ref:my-raw-password@aws-0-x.pooler.supabase.com:5432/postgres";
    const message = `failed: template=${template} password=${password} full=${connectionString}`;
    const result = sanitizeErrorMessage(message, [template, password, connectionString]);
    expect(result).not.toContain("my-raw-password");
    expect(result).not.toContain("pooler.supabase.com");
  });
});

describe("checkAllTablesEmpty", () => {
  it("全テーブル0件ならok", () => {
    expect(checkAllTablesEmpty({ world_player_cards: 0, managers: 0 })).toEqual({ ok: true });
  });
  it("1件でも非0件があれば中止", () => {
    const result = checkAllTablesEmpty({ world_player_cards: 5, managers: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/world_player_cards=5件/);
  });
});

describe("checkExactCounts", () => {
  it("完全一致ならok", () => {
    expect(checkExactCounts({ world_player_cards: 13009 }, { world_player_cards: 13009 })).toEqual({ ok: true });
  });
  it("不足はNG", () => {
    expect(checkExactCounts({ world_player_cards: 13008 }, { world_player_cards: 13009 }).ok).toBe(false);
  });
  it("超過もNG", () => {
    expect(checkExactCounts({ world_player_cards: 13010 }, { world_player_cards: 13009 }).ok).toBe(false);
  });
  it("EXPECTED_COUNTSは13009/66/19", () => {
    expect(EXPECTED_COUNTS).toEqual({ world_player_cards: 13009, managers: 66, player_card_analysis: 19 });
  });
});

describe("checkHashesMatch", () => {
  it("一致すればok", () => {
    expect(checkHashesMatch({ t: "abc" }, { t: "abc" })).toEqual({ ok: true });
  });
  it("不一致ならNG", () => {
    expect(checkHashesMatch({ t: "abc" }, { t: "def" }).ok).toBe(false);
  });
});

describe("checkNoDuplicates / checkNoOrphans / checkNoInvalidRows", () => {
  it("空配列ならok", () => {
    expect(checkNoDuplicates([], "world_player_cards")).toEqual({ ok: true });
    expect(checkNoOrphans([])).toEqual({ ok: true });
    expect(checkNoInvalidRows(0, "managers")).toEqual({ ok: true });
  });
  it("1件でもあればNG", () => {
    expect(checkNoDuplicates(["1"], "world_player_cards").ok).toBe(false);
    expect(checkNoOrphans(["2"]).ok).toBe(false);
    expect(checkNoInvalidRows(3, "managers").ok).toBe(false);
  });
});

describe("checkPrimaryKeySetMatches", () => {
  it("完全一致すればok(順序は無関係)", () => {
    expect(checkPrimaryKeySetMatches(["3", "1", "2"], ["1", "2", "3"], "world_player_cards")).toEqual({ ok: true });
  });
  it("欠落があればNG", () => {
    const result = checkPrimaryKeySetMatches(["1", "2"], ["1", "2", "3"], "world_player_cards");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/欠落1件/);
  });
  it("想定外の余分な行があればNG", () => {
    const result = checkPrimaryKeySetMatches(["1", "2", "3", "4"], ["1", "2", "3"], "world_player_cards");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/想定外1件/);
  });
});

describe("checkSqliteIntegrity", () => {
  it("okならok", () => {
    expect(checkSqliteIntegrity("ok")).toEqual({ ok: true });
  });
  it("ok以外はNG", () => {
    expect(checkSqliteIntegrity("corruption detected").ok).toBe(false);
  });
});

describe("decideCommitOrRollback", () => {
  it("全部okならcommit", () => {
    expect(decideCommitOrRollback([{ ok: true }, { ok: true }])).toEqual({ decision: "commit", reasons: [] });
  });
  it("1件でも失敗があればrollback、理由を全て集める", () => {
    const result = decideCommitOrRollback([{ ok: true }, { ok: false, reason: "件数不一致" }, { ok: false, reason: "ハッシュ不一致" }]);
    expect(result.decision).toBe("rollback");
    expect(result.reasons).toEqual(["件数不一致", "ハッシュ不一致"]);
  });
});

describe("checkIdempotencyGuard", () => {
  it("未使用のbatch_id・dataset_versionならok", () => {
    const result = checkIdempotencyGuard(new Set(["existing-1"]), new Set(["v1"]), { batchId: "new-1", datasetVersion: "v2" });
    expect(result).toEqual({ ok: true });
  });
  it("同じimport_batch_idの再実行を拒否する", () => {
    const result = checkIdempotencyGuard(new Set(["batch-1"]), new Set(), { batchId: "batch-1", datasetVersion: "v2" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/再実行を拒否/);
  });
  it("同じdataset_versionの重複投入を拒否する", () => {
    const result = checkIdempotencyGuard(new Set(), new Set(["world-2026-09-14"]), { batchId: "batch-2", datasetVersion: "world-2026-09-14" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/重複投入を拒否/);
  });
});

describe("chunkRows", () => {
  it("指定サイズごとに分割する", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("13009件を2000件ずつに分けると7チャンク(最後は1009件)になる", () => {
    const rows = Array.from({ length: 13009 }, (_, i) => i);
    const chunks = chunkRows(rows, 2000);
    expect(chunks.length).toBe(7);
    expect(chunks[0].length).toBe(2000);
    expect(chunks[6].length).toBe(1009);
  });
  it("size<=0は例外", () => {
    expect(() => chunkRows([1], 0)).toThrow();
  });
});

describe("許可テーブルの管理", () => {
  it("ALLOWED_TARGET_TABLESは4テーブルちょうど", () => {
    expect([...ALLOWED_TARGET_TABLES].sort()).toEqual(["import_batches", "managers", "player_card_analysis", "world_player_cards"].sort());
  });
  it("assertAllowedTableは許可外テーブルで例外を投げる", () => {
    expect(() => assertAllowedTable("my_team_snapshots")).toThrow();
    expect(() => assertAllowedTable("users")).toThrow();
    expect(() => assertAllowedTable("world_player_cards")).not.toThrow();
  });
  it("qualifiedTableはreference_data.を前置する", () => {
    expect(qualifiedTable("managers")).toBe("reference_data.managers");
  });
  it("qualifiedTableは許可外テーブルで例外を投げる", () => {
    expect(() => qualifiedTable("auth.users")).toThrow();
  });
});

describe("buildUpsertSql", () => {
  it("public/authスキーマへは絶対に言及しない", () => {
    const sql = buildUpsertSql("world_player_cards", ["world_card_id", "name_en"], 2, "world_card_id");
    expect(sql).not.toMatch(/\bpublic\./i);
    expect(sql).not.toMatch(/\bauth\./i);
    expect(sql).toMatch(/^insert into reference_data\.world_player_cards/);
  });

  it("値そのものを含まず、プレースホルダーのみで構成される", () => {
    const sql = buildUpsertSql("managers", ["internal_manager_id", "name_en"], 3, "internal_manager_id");
    // $1〜$6 (3行×2列)のプレースホルダーが含まれ、実データ文字列は含まれない
    for (let i = 1; i <= 6; i += 1) expect(sql).toContain(`$${i}`);
    expect(sql).not.toMatch(/[^\x00-\x7F]/); // 日本語等の非ASCII(=実データ)が混入していない
  });

  it("on conflictでUPSERTになっている", () => {
    const sql = buildUpsertSql("managers", ["internal_manager_id", "name_en"], 1, "internal_manager_id");
    expect(sql).toContain("on conflict (internal_manager_id) do update set");
    expect(sql).toContain("name_en = excluded.name_en");
    expect(sql).not.toContain("internal_manager_id = excluded.internal_manager_id");
  });

  it("許可外テーブルでは例外を投げる(schemaを固定するための多層防御)", () => {
    expect(() => buildUpsertSql("auth.users", ["id"], 1, "id")).toThrow();
  });

  it("rowCountが0以下では例外を投げる", () => {
    expect(() => buildUpsertSql("managers", ["internal_manager_id"], 0, "internal_manager_id")).toThrow();
  });
});

describe("buildBulkUpdateSql", () => {
  it("UPDATE ... FROM (VALUES ...) 形式でSQLを組み立てる(主キーの型キャストも明示する)", () => {
    const sql = buildBulkUpdateSql(
      "managers",
      "internal_manager_id",
      ["boosters", "link_up_plays"],
      { internal_manager_id: "integer", boosters: "jsonb", link_up_plays: "jsonb" },
      2,
    );
    expect(sql).toMatch(/^update reference_data\.managers as t/);
    expect(sql).toContain("set boosters = v.boosters, link_up_plays = v.link_up_plays");
    expect(sql).toContain(
      "from (values ($1::integer, $2::jsonb, $3::jsonb), ($4::integer, $5::jsonb, $6::jsonb)) as v(internal_manager_id, boosters, link_up_plays)",
    );
    expect(sql).toContain("where t.internal_manager_id = v.internal_manager_id");
  });

  it("public/authスキーマへは言及しない", () => {
    const sql = buildBulkUpdateSql("world_player_cards", "world_card_id", ["ai_styles"], { world_card_id: "text", ai_styles: "text[]" }, 1);
    expect(sql).not.toMatch(/\bpublic\./i);
    expect(sql).not.toMatch(/\bauth\./i);
  });

  it("主キー以外でキャスト指定の無い列にはキャストを付けない(主キーには必ず付く)", () => {
    const sql = buildBulkUpdateSql("world_player_cards", "world_card_id", ["efhub_card_id"], { world_card_id: "text" }, 1);
    expect(sql).toContain("($1::text, $2)");
  });

  it("主キーの型キャストが未指定なら例外を投げる(PostgreSQLの型推論に依存させない、実際に発生した障害の再発防止)", () => {
    expect(() => buildBulkUpdateSql("world_player_cards", "world_card_id", ["efhub_card_id"], {}, 1)).toThrow(/主キー/);
    expect(() => buildBulkUpdateSql("managers", "internal_manager_id", ["boosters"], { boosters: "jsonb" }, 1)).toThrow(/主キー/);
  });

  it("主キーのキャストが\"none\"指定でも例外を投げる", () => {
    expect(() => buildBulkUpdateSql("world_player_cards", "world_card_id", ["efhub_card_id"], { world_card_id: "none" }, 1)).toThrow(/主キー/);
  });

  it("許可外テーブルでは例外を投げる", () => {
    expect(() => buildBulkUpdateSql("auth.users", "id", ["x"], { id: "text" }, 1)).toThrow();
  });

  it("rowCountが0以下では例外を投げる", () => {
    expect(() => buildBulkUpdateSql("managers", "internal_manager_id", ["boosters"], { internal_manager_id: "integer" }, 0)).toThrow();
  });

  it("値そのものを含まず、プレースホルダーのみで構成される", () => {
    const sql = buildBulkUpdateSql("managers", "internal_manager_id", ["boosters"], { internal_manager_id: "integer", boosters: "jsonb" }, 1);
    expect(sql).not.toMatch(/[^\x00-\x7F]/);
  });
});
