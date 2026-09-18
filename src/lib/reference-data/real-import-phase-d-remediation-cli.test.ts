import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

/**
 * `scripts/migration/pg-phase-d-remediation-import.mjs`を実際に子プロセスとして起動し、
 * 既存の差分投入ツール群(`real-import-cli.test.ts`・`real-import-detail-extension-cli.test.ts`)
 * と同じ観点で安全性を確認する。対象はPhase D差分修正専用(name_sort_key/efhub_name_en)。
 * 実Supabaseへは一切接続しない(すべて架空のテンプレート/パスワード、または未設定のテストのみ)。
 *
 * このCLIは通常、実SQLite(data/efootball.db、gitignore対象・クリーンcheckoutには
 * 存在しない)を読んで件数を実測し、13,009/66/19件と厳密一致することを実接続前の
 * 安全ゲートとして確認する設計になっている。実データをGitへコピーせずクリーン
 * checkoutで再現するため、このテストだけは`MIGRATION_DB_PATH_OVERRIDE`/
 * `MIGRATION_EXPECTED_*_COUNT`(CLI側にテスト専用の差し替え口として追加済み、
 * 未設定時は本番と同じ既定値のまま)で、最小限の合成フィクスチャDB
 * (world_player_cards 3件・managers 2件・player_cards 1件、いずれも架空データ)
 * を指すよう差し替える。
 *
 * 複数のCLIテストファイルが並列実行されると、実子プロセスの同時起動数が増え、
 * Vitestの既定テストタイムアウト(5,000ms)を稀に超えることがあったため、
 * このファイル内のテストだけタイムアウトを緩める(ロジック自体の変更ではない)。
 */
vi.setConfig({ testTimeout: 20_000 });

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "migration", "pg-phase-d-remediation-import.mjs");
const FAKE_SESSION_POOLER_TEMPLATE =
  "postgresql://postgres.example-ref:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const FAKE_TRANSACTION_POOLER_TEMPLATE =
  "postgresql://postgres.example-ref:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";
const FAKE_DIRECT_TEMPLATE = "postgresql://postgres:[YOUR-PASSWORD]@db.example-ref.supabase.co:5432/postgres";
const FAKE_PASSWORD = "fake-test-password-not-real";
const FAKE_CA_PEM = "-----BEGIN CERTIFICATE-----\nMIIB...fake-test-ca-not-real...\n-----END CERTIFICATE-----\n";

// 合成フィクスチャDBの件数(実データではなく、テストの都合で決めた最小件数)。
const FIXTURE_WORLD_COUNT = 3;
const FIXTURE_MANAGER_COUNT = 2;
const FIXTURE_ANALYSIS_COUNT = 1;

let tmpDir: string;
let fakeCaCertPath: string;
let fixtureDbPath: string;

/** テスト専用の最小合成SQLite DBを作る(実データのコピーではなく、架空の最小データ)。 */
function buildFixtureDb(dbPath: string): void {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE world_player_cards (world_card_id TEXT PRIMARY KEY, name_en TEXT);
    CREATE TABLE managers (internal_manager_id INTEGER PRIMARY KEY, name_en TEXT);
    CREATE TABLE player_cards (efhub_card_id TEXT PRIMARY KEY, name_en TEXT);
  `);
  const insertWorld = db.prepare("INSERT INTO world_player_cards (world_card_id, name_en) VALUES (?, ?)");
  insertWorld.run("test-world-1", "Test Player Alpha");
  insertWorld.run("test-world-2", "Test Player Beta");
  insertWorld.run("test-world-3", "Test Player Gamma");
  const insertManager = db.prepare("INSERT INTO managers (internal_manager_id, name_en) VALUES (?, ?)");
  insertManager.run(1, "Test Manager One");
  insertManager.run(2, "Test Manager Two");
  // 孤立参照(world側に存在しないefhub_card_id)を作らないよう、既存world_card_idと一致させる。
  db.prepare("INSERT INTO player_cards (efhub_card_id, name_en) VALUES (?, ?)").run("test-world-1", "Test Player Alpha (eFHUB legacy name)");
  db.close();
}

beforeAll(() => {
  // mkdtempSyncはprefixの親ディレクトリを自動作成しないため、
  // クリーンcheckout(data/test-tmp自体がgitignore対象で存在しない)向けに明示作成する。
  const scratchRoot = path.join(ROOT, "data", "test-tmp");
  mkdirSync(scratchRoot, { recursive: true });
  tmpDir = mkdtempSync(path.join(scratchRoot, "phase-d-remediation-cli-test-"));
  fakeCaCertPath = path.join(tmpDir, "fake-ca.pem");
  writeFileSync(fakeCaCertPath, FAKE_CA_PEM, "utf8");
  fixtureDbPath = path.join(tmpDir, "fixture.db");
  buildFixtureDb(fixtureDbPath);
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function runCli(args: string[], extraEnv: Record<string, string> = {}): { stdout: string; stderr: string; status: number } {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  delete env.MIGRATION_PG_CONNECTION_TEMPLATE;
  delete env.MIGRATION_PG_PASSWORD;
  delete env.MIGRATION_TARGET_LABEL;
  delete env.MIGRATION_PG_CA_CERT_PATH;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  env.MIGRATION_DB_PATH_OVERRIDE = fixtureDbPath;
  env.MIGRATION_EXPECTED_WORLD_COUNT = String(FIXTURE_WORLD_COUNT);
  env.MIGRATION_EXPECTED_MANAGER_COUNT = String(FIXTURE_MANAGER_COUNT);
  env.MIGRATION_EXPECTED_ANALYSIS_COUNT = String(FIXTURE_ANALYSIS_COUNT);
  Object.assign(env, extraEnv);
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH, ...args], { cwd: ROOT, encoding: "utf8", env: env as NodeJS.ProcessEnv, timeout: 30_000 });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number | null };
    return { stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? ""), status: e.status ?? 1 };
  }
}

describe("pg-phase-d-remediation-import.mjs CLI(実プロセス起動、実Supabase接続なし)", () => {
  it("引数なしは既定でdry-runになり、正常終了する(接続0回)", () => {
    const { stdout, status } = runCli([]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/モード: dry-run/);
    expect(stdout).toMatch(/外部接続0回/);
  });

  it("dry-runでは実測件数(合成フィクスチャ3\\/2\\/1件)と並び順検証結果が表示される", () => {
    // 実件数(13,009/66/19)はGit管理外の実DBが必要なため、クリーンcheckoutで再現可能な
    // 最小合成フィクスチャ(3/2/1件、buildFixtureDb参照)で同じ検証観点(件数一致・並び順検証・
    // 孤立参照ゼロ)を確認する。件数の数値自体はテスト専用のダミー値であり、検証の厳密さ
    // (完全一致・並び順・孤立参照)は実件数の場合と変わらない。
    const { stdout } = runCli([]);
    expect(stdout).toMatch(/world_player_cards 更新対象: 3件\(期待値3件\) \/ 並び順検証=true/);
    expect(stdout).toMatch(/managers 更新対象: 2件\(期待値2件\) \/ 並び順検証=true/);
    expect(stdout).toMatch(/player_card_analysis 更新対象: 1件\(期待値1件\) \/ 孤立参照=0件/);
  });

  it("既存13,009\\/66\\/19件の再投入ではなく追加列だけのUPDATEであることを明示する", () => {
    const { stdout } = runCli([]);
    expect(stdout).toMatch(/既存13,009\/66\/19件の再投入ではなく/);
  });

  it("dry-run/validate-onlyの出力には接続試行を示す文言が一切現れない", () => {
    const dryRun = runCli([]);
    expect(dryRun.stdout + dryRun.stderr).not.toMatch(/PostgreSQLへ接続しました/);
  });

  it("--execute/--validate-onlyともMIGRATION_TARGET_LABELが無ければ接続前に拒否して終了する", () => {
    for (const flag of ["--execute", "--validate-only"]) {
      const { stdout, stderr, status } = runCli([flag]);
      expect(status).not.toBe(0);
      expect(stdout + stderr).toMatch(/MIGRATION_TARGET_LABEL.*設定されていません/);
      expect(stdout + stderr).not.toMatch(/PostgreSQLへ接続しました/);
    }
  });

  it("正しいSession poolerテンプレート+パスワード+CA証明書パスなら--validate-onlyは成功し、接続はしない", () => {
    const { stdout, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
      MIGRATION_PG_CA_CERT_PATH: fakeCaCertPath,
      NEXT_PUBLIC_SUPABASE_URL: "https://example-ref.supabase.co",
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/検証OK: 入力準備が完了しました/);
    expect(stdout).toMatch(/CA証明書=指定あり/);
    expect(stdout).not.toMatch(/PostgreSQLへ接続しました/);
  });

  it("CA証明書パスが未指定だと、テンプレート/パスワードが正しくても実接続前に拒否される", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
      NEXT_PUBLIC_SUPABASE_URL: "https://example-ref.supabase.co",
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/CA証明書のパスが指定されていない/);
  });

  it("project refが一致しないSession poolerテンプレートは拒否される(別プロジェクト取り違え検出)", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
      MIGRATION_PG_CA_CERT_PATH: fakeCaCertPath,
      NEXT_PUBLIC_SUPABASE_URL: "https://totallydifferentprojectref.supabase.co",
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/プロジェクト参照が.*一致しない/);
  });

  it("Transaction pooler形式は拒否される(接続前)", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_TRANSACTION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
      MIGRATION_PG_CA_CERT_PATH: fakeCaCertPath,
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/Transaction pooler/);
  });

  it("Direct connection形式は拒否される(接続前)", () => {
    const { stdout, stderr, status } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_DIRECT_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
      MIGRATION_PG_CA_CERT_PATH: fakeCaCertPath,
    });
    expect(status).not.toBe(0);
    expect(stdout + stderr).toMatch(/Direct connection/);
  });

  it("検証成功時の出力にテンプレート・パスワードの値そのものを含めない", () => {
    const { stdout, stderr } = runCli(["--validate-only"], {
      MIGRATION_TARGET_LABEL: "test-label",
      MIGRATION_PG_CONNECTION_TEMPLATE: FAKE_SESSION_POOLER_TEMPLATE,
      MIGRATION_PG_PASSWORD: FAKE_PASSWORD,
      MIGRATION_PG_CA_CERT_PATH: fakeCaCertPath,
      NEXT_PUBLIC_SUPABASE_URL: "https://example-ref.supabase.co",
    });
    expect(stdout + stderr).not.toContain(FAKE_PASSWORD);
    expect(stdout + stderr).not.toContain("aws-0-ap-northeast-1.pooler.supabase.com");
  });
});
