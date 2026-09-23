import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { auditCreateUpdaterRoleSql, auditUpdaterPolicySql, auditUpdaterRollbackSql, auditUpdaterVerifySql } from "./updater-role-sql-audit";
import { UPDATER_COLUMN_GRANTS, UPDATER_NEVER_UPDATED_COLUMNS } from "./updater-role";
import { UPDATE_TABLE_CONTRACTS, UPDATER_ROLE_CONTRACT } from "./update-contract";

const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const read = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
const CREATE = read("create-reference-data-updater-role.sql");
const POLICIES = read("create-reference-data-updater-rls-policies.sql");
const ROLLBACK = read("rollback-reference-data-updater-role.sql");
const VERIFY = read("verify-reference-data-updater-role.sql");

describe("updater role契約", () => {
  it("書込み対象はPhase A契約の3 tableだけで、BYPASSRLS・table所有・Backup roleとの共用なし", () => {
    expect(Object.keys(UPDATER_COLUMN_GRANTS)).toEqual([...UPDATER_ROLE_CONTRACT.writableTables]);
    expect(UPDATER_ROLE_CONTRACT.bypassRls).toBe(false);
    expect(UPDATER_ROLE_CONTRACT.sharedWithBackupRole).toBe(false);
  });

  it("UPDATE可能な列は保持列・eFHUB列・identity・主キー・created_atを含まない", () => {
    expect(UPDATER_COLUMN_GRANTS.world_player_cards.update).not.toEqual(expect.arrayContaining(["ai_styles"]));
    for (const [t, never] of Object.entries(UPDATER_NEVER_UPDATED_COLUMNS)) {
      for (const c of never) expect(UPDATER_COLUMN_GRANTS[t as keyof typeof UPDATER_COLUMN_GRANTS].update, `${t}.${c}`).not.toContain(c);
    }
    for (const c of UPDATE_TABLE_CONTRACTS.managers.preserveOnUpdateColumns) expect(UPDATER_COLUMN_GRANTS.managers.update).not.toContain(c);
  });

  it("列はすべて契約のProduction列に存在する", () => {
    for (const [t, g] of Object.entries(UPDATER_COLUMN_GRANTS)) {
      const cols = UPDATE_TABLE_CONTRACTS[t as keyof typeof UPDATE_TABLE_CONTRACTS].productionColumns;
      for (const c of [...g.insert, ...g.update]) expect(cols, `${t}.${c}`).toContain(c);
    }
  });
});

describe("updater role SQL草案の監査", () => {
  it("リポジトリ内の4 SQLは監査に合格する", () => {
    expect(auditCreateUpdaterRoleSql(CREATE)).toEqual([]);
    expect(auditUpdaterPolicySql(POLICIES)).toEqual([]);
    expect(auditUpdaterRollbackSql(ROLLBACK)).toEqual([]);
    expect(auditUpdaterVerifySql(VERIFY)).toEqual([]);
  });

  it("危険な変更を検出する(DELETE付与・保持列のUPDATE・password・BYPASSRLS・対象外table)", () => {
    const checks = (sql: string) => auditCreateUpdaterRoleSql(sql).map((p) => p.check);
    expect(checks(CREATE.replace("grant select on table reference_data.managers", "grant select, delete on table reference_data.managers"))).toContain("forbidden_privilege");
    expect(checks(CREATE.replace("name_en, name_ja, card_type, registered_position, nationality, region, league, team,\n  ovr_base, ovr_max, maximum_level, card_rating, playing_style, playing_style_def, preferred_foot, age,\n  height, weight, image_url, mobile_image_url, boost1, boost2, stats, skills,\n", "name_en, name_ja, card_type, registered_position, nationality, region, league, team,\n  ovr_base, ovr_max, maximum_level, card_rating, playing_style, playing_style_def, preferred_foot, age,\n  height, weight, image_url, mobile_image_url, boost1, boost2, stats, skills, ai_styles,\n"))).toEqual(expect.arrayContaining(["column_grants", "never_updated"]));
    expect(checks(CREATE.replace("  login\n", "  login password 'x'\n"))).toContain("no_password");
    expect(checks(CREATE.replace("  nobypassrls\n", "  bypassrls\n"))).toContain("create_role");
    expect(checks(`${CREATE}\ngrant select on table reference_data.player_card_analysis to reference_data_updater;`)).toContain("scope");
    expect(checks(`${CREATE}\ngrant truncate on table reference_data.managers to reference_data_updater;`)).toContain("forbidden_privilege");
    expect(checks(CREATE.replace("DOES NOT GRANT DELETE OR TRUNCATE", ""))).toContain("banner");
  });

  it("policy・rollback・verifyの危険な変更を検出する", () => {
    expect(auditUpdaterPolicySql(`${POLICIES}\ncreate policy x on reference_data.managers as permissive for delete to reference_data_updater using (true);`).map((p) => p.check)).toEqual(expect.arrayContaining(["policy_names", "policy_command"]));
    expect(auditUpdaterPolicySql(POLICIES.replace("using (status = 'pending')", "using (true)")).map((p) => p.check)).toContain("import_batches_pending_only");
    expect(auditUpdaterRollbackSql(`${ROLLBACK}\ndelete from reference_data.managers;`).map((p) => p.check)).toContain("no_row_changes");
    expect(auditUpdaterVerifySql(`${VERIFY}\nselect * from reference_data.managers;`).map((p) => p.check)).toContain("metadata_only");
  });
});
