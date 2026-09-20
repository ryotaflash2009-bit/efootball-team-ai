import type { GuardCheck } from "../real-import-guards";

/**
 * Backupごとに保存する、秘密情報を一切含まないmanifest。
 *
 * 意図的に含めないもの: host・Project ID・database名の生値・username・password・
 * 接続文字列・token・key・利用者データ・メールアドレス。これらはBackup運用上そもそも
 * manifestへ渡ってくる経路がない設計にしている(呼び出し元の`BuildBackupManifestInput`
 * 自体がこれらのフィールドを持たない)。
 */
export interface BackupManifest {
  backupVersion: string;
  schemaVersion: string;
  jobId: string;
  sourceCategory: "reference_data_full_table_backup";
  createdAt: string;
  postgresMajorVersion: number;
  tableAllowlist: readonly string[];
  rowCounts: Readonly<Record<string, number>>;
  tableChecksums: Readonly<Record<string, string>>;
  totalChecksum: string;
  sourceMetadataChecksum: string;
  dumpFormat: "jsonl-per-table";
  compression: "none" | "gzip";
  encryptionAlgorithm: string;
  encrypted: boolean;
  restoreVerified: boolean;
  retentionCategory: "isolated-test-ephemeral" | "production-short-term" | "production-standard";
  expiresAt: string;
  applicationCommitSha: string;
  backupStatus: "pending" | "encrypted" | "restore_verified" | "failed";
}

export interface BuildBackupManifestInput {
  backupVersion: string;
  schemaVersion: string;
  jobId: string;
  createdAt: string;
  postgresMajorVersion: number;
  tableAllowlist: readonly string[];
  rowCounts: Readonly<Record<string, number>>;
  tableChecksums: Readonly<Record<string, string>>;
  totalChecksum: string;
  sourceMetadataChecksum: string;
  compression: "none" | "gzip";
  encryptionAlgorithm: string;
  retentionCategory: BackupManifest["retentionCategory"];
  expiresAt: string;
  applicationCommitSha: string;
}

/** manifestを新規作成する。作成直後は暗号化・Restore検証のいずれも未実施として扱う(呼び出し側が後で明示的に更新する)。 */
export function buildBackupManifest(input: BuildBackupManifestInput): BackupManifest {
  return {
    backupVersion: input.backupVersion,
    schemaVersion: input.schemaVersion,
    jobId: input.jobId,
    sourceCategory: "reference_data_full_table_backup",
    createdAt: input.createdAt,
    postgresMajorVersion: input.postgresMajorVersion,
    tableAllowlist: input.tableAllowlist,
    rowCounts: input.rowCounts,
    tableChecksums: input.tableChecksums,
    totalChecksum: input.totalChecksum,
    sourceMetadataChecksum: input.sourceMetadataChecksum,
    dumpFormat: "jsonl-per-table",
    compression: input.compression,
    encryptionAlgorithm: input.encryptionAlgorithm,
    encrypted: false,
    restoreVerified: false,
    retentionCategory: input.retentionCategory,
    expiresAt: input.expiresAt,
    applicationCommitSha: input.applicationCommitSha,
    backupStatus: "pending",
  };
}

export function markManifestEncrypted(manifest: BackupManifest): BackupManifest {
  return { ...manifest, encrypted: true, backupStatus: "encrypted" };
}

export function markManifestRestoreVerified(manifest: BackupManifest): BackupManifest {
  return { ...manifest, restoreVerified: true, backupStatus: "restore_verified" };
}

export function markManifestFailed(manifest: BackupManifest): BackupManifest {
  return { ...manifest, backupStatus: "failed" };
}

const FORBIDDEN_MANIFEST_KEYS = [
  "host", "projectId", "project_id", "databaseName", "database_name", "username", "user",
  "password", "connectionString", "connection_string", "token", "key", "secret", "email",
] as const;

const SECRET_LIKE_VALUE_PATTERNS: readonly RegExp[] = [
  /postgres(?:ql)?:\/\/\S+/i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /\bsupabase\.co\b/i,
];

/**
 * manifestに、禁止フィールド名や秘密情報らしき値が紛れ込んでいないことを確認する
 * (manifestをファイルへ書き出す・PRへ含める前に必ず実行する自己点検)。
 */
export function assertManifestHasNoSecrets(manifest: Readonly<Record<string, unknown>>): GuardCheck {
  const json = JSON.stringify(manifest);
  const lowerKeys = Object.keys(manifest).map((k) => k.toLowerCase());
  for (const forbidden of FORBIDDEN_MANIFEST_KEYS) {
    if (lowerKeys.includes(forbidden.toLowerCase())) {
      return { ok: false, reason: `manifestに禁止フィールド名が含まれている: ${forbidden}` };
    }
  }
  for (const pattern of SECRET_LIKE_VALUE_PATTERNS) {
    if (pattern.test(json)) {
      return { ok: false, reason: "manifestに秘密情報らしき値(メール・接続文字列・トークン・Supabaseホスト名)が含まれている" };
    }
  }
  return { ok: true };
}
