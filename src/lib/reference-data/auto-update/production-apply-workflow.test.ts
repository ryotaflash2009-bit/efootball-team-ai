import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { APPLY_SECRET_NAMES, AUTOMATION_ENVIRONMENT, BACKUP_SECRET_NAMES, CONCURRENCY_GROUPS, PLAN_READ_SECRET_NAMES, SECRET_BOUNDARIES } from "./update-contract";
import { APPLY_MODES, forbiddenCredentialsForMode, readApplySecrets, secretNamesForMode } from "./production-apply-cli";
import { STAGE4_CONFIRM, stage4RunTitle, stage4WorldRunTitle } from "./stage4-managers";
import { WORLD_CONFIRM } from "./stage4-world";
import { UPDATER_COLUMN_GRANTS, UPDATER_ROLE_NAME } from "./updater-role";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const YAML = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-production-apply.yml"), "utf8");
const code = YAML.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n");
const CLI = readFileSync(path.join(__dirname, "production-apply-cli.ts"), "utf8");
const STAGE4_CLI = readFileSync(path.join(__dirname, "stage4-managers-cli.ts"), "utf8");

describe("Production apply workflow(Stage 2 preflight + Stage 4 managers)", () => {
  it("workflow_dispatchだけ・読み取り権限(contents/actions)・apply Environment・production-write concurrency", () => {
    expect(code).toMatch(/^on:\s*\n\s+workflow_dispatch:/m);
    expect(code).not.toMatch(/^\s*(schedule|push|pull_request|pull_request_target|workflow_run|repository_dispatch)\s*:/m);
    expect(code).toMatch(/^permissions:\s*\n\s+contents: read\s*\n\s+actions: read\s*\n\s*\nconcurrency:/m);
    expect(code).not.toMatch(/:\s*write\b/);
    // 承認1回化(2026-09-27): plan・dry-runは承認者なしのautomation Environment、preflight・apply・verifyは承認必須のapply Environment。
    expect(code).toContain(`environment: \${{ (inputs.mode == 'plan' || inputs.mode == 'dry-run') && '${AUTOMATION_ENVIRONMENT}' || '${SECRET_BOUNDARIES.production_apply.environment}' }}`);
    expect(code.match(/^\s+environment:/gm)).toHaveLength(1);
    expect(code).toContain(`group: ${CONCURRENCY_GROUPS.productionWrite}`);
    expect(code).toMatch(/cancel-in-progress: false/);
  });

  it("modeはpreflight・plan・dry-run・apply・verifyで、確認入力はmodeごとの固定値(Secret参照より前に検査)", () => {
    // 正規表現の入れ子の繰り返しを使わず、行単位で読む(ReDoS回避)。
    const lines = code.split("\n");
    const start = lines.findIndex((l) => l.trim() === "options:");
    expect(start).toBeGreaterThan(0);
    const options: string[] = [];
    for (let i = start + 1; i < lines.length && lines[i].trim().startsWith("- "); i++) options.push(lines[i].trim().slice(2));
    expect(options).toEqual([...APPLY_MODES]);
    expect(lines[start + 1 + options.length].trim()).toBe("default: preflight");
    expect([...APPLY_MODES]).toEqual(["preflight", "plan", "dry-run", "apply", "verify"]);
    expect(code).toContain(`preflight:managers|preflight:world) expected="preflight" ;;`);
    for (const [mode, confirm] of Object.entries(STAGE4_CONFIRM)) expect(code).toContain(`${mode}:managers) expected="${confirm}" ;;`);
    for (const [mode, confirm] of Object.entries(WORLD_CONFIRM)) expect(code).toContain(`${mode}:world) expected="${confirm}" ;;`);
    expect(code).toContain(`*) echo "::error::unknown mode or dataset"; exit 1 ;;`);
    const datasetBlock = code.slice(code.indexOf("      dataset:"), code.indexOf("      confirm:"));
    expect(datasetBlock).toContain("type: choice");
    expect(datasetBlock).toContain("options:\n          - managers\n          - world\n        default: managers");
    expect(code).toMatch(/^run-name: reference-data \$\{\{ inputs\.mode \}\}\$\{\{ inputs\.dataset == 'world' && ' world' \|\| '' \}\}$/m);
    expect(stage4WorldRunTitle("plan")).toBe("reference-data plan world");
    expect(code.indexOf("Reject unless the confirmation input matches")).toBeLessThan(code.indexOf("secrets.REFERENCE_DATA_APPLY_DB_URL"));
    expect(code.indexOf("Validate run-id and checksum inputs")).toBeLessThan(code.indexOf("secrets.REFERENCE_DATA_APPLY_DB_URL"));
    expect(code).toContain("REFERENCE_DATA_APPLY_MODE: preflight");
    expect(stage4RunTitle("plan")).toBe("reference-data plan");
  });

  it("inputはshellへ直接展開せず環境変数で渡し、run id・checksumを形式検査する", () => {
    const runBlocks = code.split(/\n\s+- name:/).map((step) => step.split(/\n\s+run: \|\n/)[1] ?? "");
    for (const b of runBlocks) expect(b).not.toMatch(/\$\{\{\s*inputs\./);
    expect(code).toContain("num='^[0-9]{1,20}$'");
    expect(code).toContain("hex='^[0-9a-f]{64}$'");
  });

  it("artifactはbindingしたrun idのrunからだけ取得し、run情報はGitHub API(読み取り)で記録する", () => {
    const pairs: Array<[string, string]> = [
      ["stage4-${{ inputs.dataset }}-bundle", "plan_run_id"],
      ["reference-data-backup-summary", "backup_run_id"],
      ["stage4-${{ inputs.dataset }}-dry-run", "dry_run_run_id"],
      ["stage4-${{ inputs.dataset }}-apply-result", "apply_run_id"],
    ];
    for (const [name, id] of pairs) {
      expect(code).toContain(`name: ${name}\n          run-id: \${{ inputs.${id} }}`);
    }
    expect(code).toContain('gh api "repos/$REPO/actions/runs/$1"');
    expect(code).not.toMatch(/gh api [^\n]*(-X|--method)\s+(POST|PUT|PATCH|DELETE)/i);
    expect(code).not.toMatch(/gh (run (rerun|cancel|delete)|workflow run)/);
  });

  it("dry run用のDBはjob内の使い捨てpostgres:17(Productionではない)", () => {
    expect(code).toMatch(/services:\s*\n\s+postgres:\s*\n\s+image: postgres:17/);
    expect(code).toContain("PHASE2_TEST_PG_HOST: localhost");
  });

  it("Secretはmodeごとに1種類だけ: apply用はpreflight/apply/verifyだけ、Planの読み取り専用はplanだけ、dry-runはなし。Backup用は参照しない", () => {
    const refs = [...code.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(new Set(refs)).toEqual(new Set([...APPLY_SECRET_NAMES, ...PLAN_READ_SECRET_NAMES]));
    for (const b of BACKUP_SECRET_NAMES) expect(code).not.toContain(b);
    // どの参照も、modeの条件式の中にだけある(条件なしのSecret参照は無い)。
    const lines = code.split("\n").filter((l) => /secrets\.[A-Z]/.test(l));
    for (const l of lines) {
      if (/secrets\.REFERENCE_DATA_APPLY_/.test(l)) expect(l).toContain("${{ (inputs.mode == 'preflight' || inputs.mode == 'apply' || inputs.mode == 'verify') && secrets.REFERENCE_DATA_APPLY_");
      else expect(l).toContain("${{ inputs.mode == 'plan' && secrets.REFERENCE_DATA_PLAN_READ_");
    }
    // dry-runはどのcredentialも必要としない。
    expect(code).toContain('dry-run) names="" ;;');
  });

  it("uploadするのは要約とStage 4のartifactだけで、no-secret smoke testがある", () => {
    const uploads = [...code.matchAll(/uses: actions\/upload-artifact@v4\s*\n\s+with:\s*\n\s+name: ([^\n]+)/g)].map((m) => m[1].trim());
    expect(uploads).toEqual([
      "reference-data-apply-${{ inputs.mode }}${{ inputs.dataset == 'world' && '-world' || '' }}-summary",
      "stage4-${{ inputs.dataset }}-bundle",
      "stage4-${{ inputs.dataset }}-state",
      "stage4-${{ inputs.dataset }}-dry-run",
      "stage4-${{ inputs.dataset }}-apply-result",
      "stage4-${{ inputs.dataset }}-undo-plan",
    ]);
    expect(code).toContain("REFERENCE_DATA_APPLY_DATASET: ${{ inputs.dataset }}");
    expect(code).toMatch(/Runtime smoke test[\s\S]*REFERENCE_DATA_APPLY_DB_URL: ""/);
  });
});

describe("Production apply CLI", () => {
  it("modeごとのcredential: planは読み取り専用だけ、dry-runはなし、それ以外はapply用。mode外のcredentialは拒否する", () => {
    expect(secretNamesForMode("plan")).toEqual([...PLAN_READ_SECRET_NAMES]);
    expect(secretNamesForMode("dry-run")).toEqual([]);
    for (const m of ["preflight", "apply", "verify"]) expect(secretNamesForMode(m)).toEqual([...APPLY_SECRET_NAMES]);
    const all = Object.fromEntries([...APPLY_SECRET_NAMES, ...PLAN_READ_SECRET_NAMES, ...BACKUP_SECRET_NAMES].map((n) => [n, "x"]));
    expect(forbiddenCredentialsForMode("dry-run", all).sort()).toEqual([...APPLY_SECRET_NAMES, ...PLAN_READ_SECRET_NAMES, ...BACKUP_SECRET_NAMES].sort());
    expect(forbiddenCredentialsForMode("plan", all).sort()).toEqual([...APPLY_SECRET_NAMES, ...BACKUP_SECRET_NAMES].sort());
    expect(forbiddenCredentialsForMode("apply", all).sort()).toEqual([...PLAN_READ_SECRET_NAMES, ...BACKUP_SECRET_NAMES].sort());
    expect(forbiddenCredentialsForMode("plan", { REFERENCE_DATA_PLAN_READ_DB_URL: "u", REFERENCE_DATA_PLAN_READ_DB_CA_CERT: "c" })).toEqual([]);
  });

  it("必須Secretが無ければ接続前に停止する", () => {
    expect(() => readApplySecrets({})).toThrow(/REFERENCE_DATA_APPLY_DB_URL, REFERENCE_DATA_APPLY_DB_CA_CERT/);
    expect(readApplySecrets({ REFERENCE_DATA_APPLY_DB_URL: "u", REFERENCE_DATA_APPLY_DB_CA_CERT: "c" })).toEqual({ REFERENCE_DATA_APPLY_DB_URL: "u", REFERENCE_DATA_APPLY_DB_CA_CERT: "c" });
  });

  it("preflightはread-only transactionでrollbackし、apply executorを呼ばない(書き込みはStage 4のapply modeだけ)", () => {
    expect(CLI).toContain('await client.query("begin read only")');
    expect(CLI).toContain('await client.query("rollback")');
    expect(CLI).not.toMatch(/applyUpdatePlans|applyUndoPlan|insert into|update reference_data/);
    expect(CLI).toMatch(/buildProductionPgClientConfig/);
    expect(STAGE4_CLI).not.toMatch(/applyUpdatePlans|applyUndoPlan/);
    expect(STAGE4_CLI.match(/runManagersApply\(/g)).toHaveLength(1);
    expect(STAGE4_CLI).toMatch(/async function apply\(env: Env[\s\S]*runManagersApply\(/);
    // 確認入力が一致しなければ、どのmodeも処理しない(接続しない)。
    expect(STAGE4_CLI).toMatch(/if \(env\.REFERENCE_DATA_APPLY_CONFIRM !== STAGE4_CONFIRM\[mode\]\) return \{ ok: false, reasons: \["confirmation_mismatch"\]/);
  });

  it("接続・preflightのエラー本文を出力せず、段階と安全なcode(safeErrorCode)だけを返す(Run #2対応)", () => {
    expect(CLI).not.toMatch(/sanitizeErrorMessage/);
    // err.messageを出すのは、自分で投げたsummary_*の固定codeに一致した場合だけ。
    expect(CLI.match(/err\.message/g)).toHaveLength(2);
    expect(CLI).toContain('/^summary_/.test(err.message) ? err.message : "summary_write_failed"');
    expect(CLI).toContain("connect_failed:${safeErrorCode(err)}");
    expect(CLI).toContain("preflight_failed:${safeErrorCode(err)}");
    expect(STAGE4_CLI).not.toMatch(/err\.message|sanitizeErrorMessage/);
    // modeの判定・mode外credentialの拒否・必須Secretの確認は、接続より前。
    expect(CLI.indexOf("checkApplyMode(mode)")).toBeGreaterThan(0);
    expect(CLI.indexOf("checkApplyMode(mode)")).toBeLessThan(CLI.indexOf("forbiddenCredentialsForMode(mode, env)"));
    expect(CLI.indexOf("forbiddenCredentialsForMode(mode, env)")).toBeLessThan(CLI.indexOf("buildProductionPgClientConfig(secrets"));
    expect(CLI.indexOf("buildProductionPgClientConfig(secrets")).toBeLessThan(CLI.indexOf("runPreflightWithConfig(config as ClientConfig)"));
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
