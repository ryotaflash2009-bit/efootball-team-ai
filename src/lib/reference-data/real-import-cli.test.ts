import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * `scripts/migration/pg-real-import.mjs`を実際に子プロセスとして起動し、
 * 「既定はdry-run」「--validate-only/--executeなしでは接続0回」「環境変数が無ければ
 * 安全に拒否する」「Session pooler以外の形式は接続前に拒否する」ことを、
 * モックではなく実際のCLI起動で確認する。
 *
 * 実Supabaseへは一切接続しない(すべて架空のテンプレート/パスワード、または未設定のテストのみ)。
 */
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "migration", "pg-real-import.mjs");
const FAKE_SESSION_POOLER_TEMPLATE =
  "postgresql://postgres.example-ref:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const FAKE_TRANSACTION_POOLER_TEMPLATE =
  "postgresql://postgres.example-ref:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";
const FAKE_DIRECT_TEMPLATE = "postgresql://postgres:[YOUR-PASSWORD]@db.example-ref.supabase.co:5432/postgres";
const FAKE_PASSWORD = "fake-test-password-not-real";

function runCli(args: string[], extraEnv: Record<string, string> = {}): { stdout: string; stderr: string; status: number } {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  delete env.MIGRATION_PG_CONNECTION_TEMPLATE;
  delete env.MIGRATION_PG_PASSWORD;
  delete env.MIGRATION_TARGET_LABEL;
  Object.assign(env, extraEnv);
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: env as NodeJS.ProcessEnv,
      timeout: 30_000,
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number | null };
    return { stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? ""), status: e.status ?? 1 };
  }
}

describe("pg-real-import.mjs CLI(実プロセス起動、実Supabase接続なし)", () => {
  it("引数なしは既定でdry-runになり、正常終了する(接続0回)", () => {
    const { stdout, status } = runCli([]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/モード: dry-run/);
    expect(stdout).toMatch(/外部接続0回/);
  });

  it("dry-runでは実測件数(13009\\/66\\/19)が表示される", () => {
    const { stdout } = runCli([]);
    expect(stdout).toMatch(/world_player_cards: 取得元13009件 \/ 検証OK13009件/);
    expect(stdout).toMatch(/managers: 取得元66件 \/ 検証OK66件/);
    expect(stdout).toMatch(/player_card_analysis: 取得元19件 \/ 検証OK19件/);
  });

  it("dry-run/validate-onlyの出力には接続試行を示す文言が一切現れない", () => {
    const dryRun = runCli([]);
    expect(dryRun.stdout + dryRun.stderr).not.toMatch(/PostgreSQLへ接続しました/);
    const validateOnly = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
    });
    expect(validateOnly.stdout + validateOnly.stderr).not.toMatch(/PostgreSQLへ接続しました/);
  });

  it("--execute/--validate-onlyともMIGRATION_TARGET_LABELが無ければ接続前に拒否して終了する", () => {
    for (const flag of ["--execute", "--validate-only"]) {
      const { stdout, stderr, status } = runCli([flag]);
      expect(status).not.toBe(0);
      expect(stdout + stderr).toMatch(/MIGRATION_TARGET_LABEL.*設定されていません/);
      expect(stdout + stderr).not.toMatch(/PostgreSQLへ接続しました/);
    }
  });

  it("MIGRATION_TARGET_LABELだけ設定してもMIGRATION_PG_CONNECTION_TEMPLATEが無ければ拒否する", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], { MIGRATION_TARGET_LABEL: "test-label" });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/MIGRATION_PG_CONNECTION_TEMPLATE.*設定されていません/);
    expect(stdout + stderr).not.toMatch(/PostgreSQLへ接続しました/);
  });

  it("テンプレートだけ設定してもMIGRATION_PG_PASSWORDが無ければ拒否する", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/MIGRATION_PG_PASSWORD.*設定されていません/);
  });

  it("正しいSession poolerテンプレート+パスワードなら--validate-onlyは成功し、接続はしない", () => {
    const { stdout, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/検証OK: 入力準備が完了しました/);
    expect(stdout).not.toMatch(/PostgreSQLへ接続しました/);
  });

  it("Transaction pooler形式は--validate-onlyで拒否される(接続前)", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_TRANSACTION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/Transaction pooler/);
  });

  it("Direct connection形式は--validate-onlyで拒否される(接続前)", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_DIRECT_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/Direct connection/);
  });

  it("プレースホルダーが無いテンプレート(既にパスワードが埋まっている想定)は拒否される", () => {
    const alreadyFilled = FAKE_SESSION_POOLER_TEMPLATE.replace("[YOUR-PASSWORD]", "already-a-real-looking-password");
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: alreadyFilled,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).not.toMatch(/PostgreSQLへ接続しました/);
    expect(stdout + stderr).not.toContain("already-a-real-looking-password");
  });

  it("検証成功時の出力にテンプレート・パスワードの値そのものを含めない", () => {
    const { stdout, stderr } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
    });
    expect(stdout + stderr).not.toContain(FAKE_PASSWORD);
    expect(stdout + stderr).not.toContain("aws-0-ap-northeast-1.pooler.supabase.com");
  });
});
