import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { APPLY_SECRET_NAMES, BACKUP_SECRET_NAMES, CONCURRENCY_GROUPS, SECRET_BOUNDARIES } from "./update-contract";
import { APPLY_MODES, readApplySecrets } from "./production-apply-cli";

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
});
