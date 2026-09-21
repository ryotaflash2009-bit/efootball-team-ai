import { Client } from "pg";
import { createPostgresQueryClient } from "./postgres-adapter";
import { R2RealClient } from "./backup-r2-real-client";
import { runProductionBackup } from "./run-production-backup";
import { resolveBackupCategory, type BackupCategory } from "./backup-category";
import { sanitizeErrorMessage } from "../real-import-guards";

/**
 * `reference-data-production-backup.yml`のjobから直接実行されるCLIエントリーポイント。
 *
 * このファイルはこのセッションでは一度も実行していない(Production未接続、R2未接続、
 * `age`未実行)。実行時に読む環境変数はすべてGitHub ActionsのSecrets/service container
 * 設定から渡される想定であり、このファイル自体はいかなる値もハードコードしない。
 *
 * 6 Secretのいずれかが欠けている場合、workflow側の「Check required secrets are
 * configured」ステップがこのスクリプトより先に必ず失敗する設計(`backup-workflow-audit.ts`
 * で確認済み)だが、このファイル自身も念のため同じ6項目を再確認し、欠けていれば
 * 接続を一切試みずに終了する(defense in depth、単独実行された場合の保険)。
 */

export const REQUIRED_ENV_NAMES = [
  "REFERENCE_DATA_BACKUP_DB_URL",
  "REFERENCE_DATA_BACKUP_AGE_RECIPIENT",
  "REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID",
  "REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY",
  "REFERENCE_DATA_BACKUP_R2_ENDPOINT",
  "REFERENCE_DATA_BACKUP_R2_BUCKET",
] as const;

export function readRequiredEnv(env: Readonly<Record<string, string | undefined>>): Record<(typeof REQUIRED_ENV_NAMES)[number], string> {
  const missing = REQUIRED_ENV_NAMES.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`必須環境変数が不足している(blocked): ${missing.join(", ")}`);
  }
  const out = {} as Record<(typeof REQUIRED_ENV_NAMES)[number], string>;
  for (const name of REQUIRED_ENV_NAMES) out[name] = env[name] as string;
  return out;
}

/**
 * workflow_dispatchの`backup_category` choice inputから渡された値を読む。
 *
 * 2026-09-21追記: 以前の`readPrefix`(廃止)は`REFERENCE_DATA_BACKUP_PREFIX`という
 * 自由な文字列を読み、prefixだけを決定していた。これにより、workflow YAMLのprefix値と
 * manifestのretentionCategory/retentionDaysが独立して設定可能になり、両者の不整合
 * (例: prefix=pre-apply/なのにretentionCategory=production-standard・8日で期限切れ)が
 * 生じ得た。この関数はprefixを直接受け取らず、`category`という1つの値だけを受け取り、
 * `resolveBackupCategory`(`backup-category.ts`)による完全一致検証を経由させることで、
 * prefix・retentionCategory・retentionDaysの組み合わせを常に一意に決定させる
 * (前後の空白除去・大文字小文字補正・既定値へのフォールバックは一切行わない)。
 */
export function readCategory(env: Readonly<Record<string, string | undefined>>): BackupCategory {
  const raw = env.REFERENCE_DATA_BACKUP_CATEGORY;
  if (raw === undefined || raw === "") {
    throw new Error("REFERENCE_DATA_BACKUP_CATEGORYが未設定(blocked)");
  }
  const resolved = resolveBackupCategory(raw);
  if (!resolved.ok || !resolved.category) {
    throw new Error(`REFERENCE_DATA_BACKUP_CATEGORYが不正(blocked): ${resolved.reason}`);
  }
  return resolved.category;
}

export async function main(): Promise<void> {
  const env = process.env;
  let prodPgClient: Client | null = null;
  let verifyPgClient: Client | null = null;
  let exitCode = 1;

  try {
    const secrets = readRequiredEnv(env);
    const category = readCategory(env);

    const verifyHost = env.BACKUP_VERIFY_PG_HOST ?? "localhost";
    const verifyPort = Number(env.BACKUP_VERIFY_PG_PORT ?? "5432");
    const verifyUser = env.BACKUP_VERIFY_PG_USER ?? "";
    const verifyPassword = env.BACKUP_VERIFY_PG_PASSWORD ?? "";
    const verifyDatabase = env.BACKUP_VERIFY_PG_DATABASE ?? "";
    if (!verifyUser || !verifyPassword || !verifyDatabase) {
      throw new Error("BACKUP_VERIFY_PG_USER / BACKUP_VERIFY_PG_PASSWORD / BACKUP_VERIFY_PG_DATABASE が未設定(blocked、隔離Restore検証用のservice container接続情報)");
    }
    if (!["localhost", "127.0.0.1"].includes(verifyHost)) {
      throw new Error("BACKUP_VERIFY_PG_HOSTはlocalhost/127.0.0.1だけを許可する(このjob専用のservice container以外への接続を防ぐ)");
    }

    prodPgClient = new Client({ connectionString: secrets.REFERENCE_DATA_BACKUP_DB_URL, ssl: { rejectUnauthorized: true } });
    verifyPgClient = new Client({ host: verifyHost, port: verifyPort, user: verifyUser, password: verifyPassword, database: verifyDatabase });

    await prodPgClient.connect();
    await verifyPgClient.connect();

    const prodClient = createPostgresQueryClient(prodPgClient);
    const verifyClient = createPostgresQueryClient(verifyPgClient);
    const r2Client = new R2RealClient({
      endpoint: secrets.REFERENCE_DATA_BACKUP_R2_ENDPOINT,
      bucket: secrets.REFERENCE_DATA_BACKUP_R2_BUCKET,
      accessKeyId: secrets.REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID,
      secretAccessKey: secrets.REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY,
    });

    const now = new Date();
    const jobId = env.GITHUB_RUN_ID ? `gha-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT ?? "1"}` : `manual-${now.getTime()}`;
    const applicationCommitSha = env.GITHUB_SHA ?? "0".repeat(40);

    const result = await runProductionBackup({
      prodClient,
      verifyClient,
      r2Client,
      ageRecipient: secrets.REFERENCE_DATA_BACKUP_AGE_RECIPIENT,
      jobId,
      now,
      schemaVersion: env.REFERENCE_DATA_BACKUP_SCHEMA_VERSION ?? now.toISOString().slice(0, 10),
      postgresMajorVersion: Number(env.REFERENCE_DATA_BACKUP_PG_MAJOR_VERSION ?? "16"),
      applicationCommitSha,
      category,
    });

    // audit summary: secretを含まないJSONだけをstdoutへ出力する(workflow側がログとして残す)。
    process.stdout.write(`${JSON.stringify({ ok: result.ok, reasons: result.reasons, summary: result.summary }, null, 2)}\n`);
    exitCode = result.ok ? 0 : 1;
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ ok: false, reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))] }, null, 2)}\n`);
    exitCode = 1;
  } finally {
    await prodPgClient?.end().catch(() => undefined);
    await verifyPgClient?.end().catch(() => undefined);
  }
  process.exitCode = exitCode;
}

// このファイル自体はmain()をexportするだけで、import時に自動実行しない
// (CommonJS/ESMどちらでimportしても安全にするため、`require.main`/`import.meta`いずれの
// 自己実行判定も使わない)。実際の起動は`scripts/run-production-backup-entry.mjs`
// (このリポジトリの他の`scripts/*.mjs`と同じ、素のNodeスクリプトの規約)が
// コンパイル後のこの関数をimportして呼び出す。
