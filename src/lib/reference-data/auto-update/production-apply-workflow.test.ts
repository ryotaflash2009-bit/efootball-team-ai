import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { APPLY_SECRET_NAMES, BACKUP_SECRET_NAMES, CONCURRENCY_GROUPS, SECRET_BOUNDARIES } from "./update-contract";
import { APPLY_MODES, readApplySecrets } from "./production-apply-cli";
import { UPDATER_COLUMN_GRANTS, UPDATER_ROLE_NAME } from "./updater-role";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const YAML = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-production-apply.yml"), "utf8");
const code = YAML.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n");
const CLI = readFileSync(path.join(__dirname, "production-apply-cli.ts"), "utf8");

describe("Production apply workflow(Stage 2: preflightだけ)", () => {
  it("workflow_dispatchだけ・read-only権限・apply Environment・production-write concurrency", () => {
    expect(code).toMatch(/^on:\s*\n\s+workflow_dispatch:/m);
    expect(code).not.toMatch(/^\s*(schedule|push|pull_request|pull_request_target|workflow_run|repository_dispatch)\s*:/m);
    expect(code).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
    expect(code).toContain(`environment: ${SECRET_BOUNDARIES.production_apply.environment}`);
    expect(code).toContain(`group: ${CONCURRENCY_GROUPS.productionWrite}`);
    expect(code).toMatch(/cancel-in-progress: false/);
  });

  it("modeの選択肢はpreflightだけで、確認入力が一致しなければSecretへ触れる前に停止する", () => {
    expect(code).toMatch(/options:\s*\n\s+- preflight\s*\n\s+default: preflight/);
    expect(code).not.toMatch(/- apply\b/);
    expect(code).toContain("inputs.confirm != 'preflight' || inputs.mode != 'preflight'");
    expect(code).toContain("REFERENCE_DATA_APPLY_MODE: preflight");
    expect([...APPLY_MODES]).toEqual(["preflight"]);
  });

  it("apply用Secretだけを参照し、Backup用Secretを参照しない", () => {
    const refs = [...code.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(new Set(refs)).toEqual(new Set(APPLY_SECRET_NAMES));
    for (const b of BACKUP_SECRET_NAMES) expect(code).not.toContain(b);
  });

  it("要約artifactだけをuploadし、no-secret smoke testがある", () => {
    const uploads = code.match(/uses: actions\/upload-artifact@v4[\s\S]*?retention-days: \d+/g) ?? [];
    expect(uploads.length).toBe(1);
    expect(uploads[0]).toContain("reference-data-apply-preflight-summary.json");
    expect(code).toMatch(/Runtime smoke test[\s\S]*REFERENCE_DATA_APPLY_DB_URL: ""/);
  });
});

describe("Production apply CLI", () => {
  it("必須Secretが無ければ接続前に停止する", () => {
    expect(() => readApplySecrets({})).toThrow(/REFERENCE_DATA_APPLY_DB_URL, REFERENCE_DATA_APPLY_DB_CA_CERT/);
    expect(readApplySecrets({ REFERENCE_DATA_APPLY_DB_URL: "u", REFERENCE_DATA_APPLY_DB_CA_CERT: "c" })).toEqual({ REFERENCE_DATA_APPLY_DB_URL: "u", REFERENCE_DATA_APPLY_DB_CA_CERT: "c" });
  });

  it("preflightはread-only transactionでrollbackし、apply executorを呼ばない", () => {
    expect(CLI).toContain('await client.query("begin read only")');
    expect(CLI).toContain('await client.query("rollback")');
    expect(CLI).not.toMatch(/applyUpdatePlans|applyUndoPlan|insert into|update reference_data/);
    expect(CLI).toMatch(/buildProductionPgClientConfig/);
  });

  it("接続・preflightのエラー本文を出力せず、段階と安全なcode(safeErrorCode)だけを返す(Run #2対応)", () => {
    expect(CLI).not.toMatch(/sanitizeErrorMessage/);
    // err.messageを出すのは、自分で投げたsummary_*の固定codeに一致した場合だけ。
    expect(CLI.match(/err\.message/g)).toHaveLength(2);
    expect(CLI).toContain('/^summary_/.test(err.message) ? err.message : "summary_write_failed"');
    expect(CLI).toContain("connect_failed:${safeErrorCode(err)}");
    expect(CLI).toContain("preflight_failed:${safeErrorCode(err)}");
    // modeの判定はSecret読込・接続より前。
    expect(CLI.indexOf("checkApplyMode(env.REFERENCE_DATA_APPLY_MODE)")).toBeLessThan(CLI.indexOf("readApplySecrets(env)"));
    expect(CLI.indexOf("readApplySecrets(env)")).toBeLessThan(CLI.indexOf("runPreflightWithConfig(config)"));
  });
});

describe("Stage 2 Evidence(Run #3 preflight成功)", () => {
  const evidence = JSON.parse(readFileSync(path.join(ROOT, "docs", "production-readiness", "evidence", "stage2-production-preflight-2026-09-24.json"), "utf8"));

  it("preflightの件数が契約(table SELECT 3件・列単位grantの合計)と一致し、利用者・認証データへの権限は0", () => {
    const run3 = evidence.preflightRuns.find((r: { runNumber: number }) => r.runNumber === 3);
    const columnGrants = Object.values(UPDATER_COLUMN_GRANTS).reduce((n, g) => n + g.insert.length + g.update.length, 0);
    expect(run3.summaryArtifact).toMatchObject({ ok: true, phase: "preflight", reasons: [] });
    expect(run3.summaryArtifact.facts).toMatchObject({
      role: UPDATER_ROLE_NAME, readOnly: "on", tableGrantCount: Object.keys(UPDATER_COLUMN_GRANTS).length, columnGrantCount: columnGrants,
      sensitiveSchemaUsageCount: 0, sensitiveTableAccessCount: 0,
    });
    expect(evidence.productionEffects).toEqual({ dataWrites: 0, apply: 0, backup: 0, r2Operations: 0 });
  });

  it("Environmentの記録はSecretの名前だけで、2つのEnvironmentのSecretは重ならない", () => {
    const env = evidence.environmentVerifiedReadOnly;
    expect(new Set(env[SECRET_BOUNDARIES.production_apply.environment!].secretNames)).toEqual(new Set(APPLY_SECRET_NAMES));
    expect(new Set(env[SECRET_BOUNDARIES.backup.environment!].secretNames)).toEqual(new Set(BACKUP_SECRET_NAMES));
    const text = JSON.stringify(evidence);
    expect(text).not.toMatch(/postgres(ql)?:\/\/|-----BEGIN|AGE-SECRET-KEY|age1[0-9a-z]{50,}|supabase\.co|cloudflarestorage/i);
  });
});
