/**
 * Production Backup workflowが保存する、秘密情報を含まない要約artifact(Phase F)。
 *
 * - 許可リストの項目だけを取り出す(接続文字列・host・bucket名・鍵・証明書・行データは入れない)。
 * - 出力前に、実行時のSecret値(環境変数の値そのもの)が要約文字列に含まれていないことを確認し、
 *   含まれていれば要約を書き出さずにblockedとする。
 * - このmoduleはファイルを書かない(書き出しはCLI側)。
 */

export const BACKUP_SUMMARY_ARTIFACT_SCHEMA = "reference-data-backup-summary/v1";

const ALLOWED_SUMMARY_KEYS = [
  "phase", "ok", "storageVerified", "restoreVerified", "objectKey", "manifestKey", "jobId", "category", "prefix",
  "retentionCategory", "retentionDays", "expiresAt", "rowCounts", "totalChecksum", "encryptionAlgorithm", "backupVersion",
  // 形式"2"の追加列の収録確認(列名・列数・行数・非null件数だけ。値は含まない)。
  "columnCoverage",
] as const;

export interface BackupSummaryArtifact {
  readonly schema: typeof BACKUP_SUMMARY_ARTIFACT_SCHEMA;
  readonly ok: boolean;
  readonly reasons: readonly string[];
  readonly summary: Readonly<Record<string, unknown>>;
  readonly generatedAt: string;
}

/** 実行結果から要約artifactを作る。許可リスト外の項目は落とす。 */
export function buildBackupSummaryArtifact(
  result: { ok: boolean; reasons: readonly string[]; summary?: Readonly<Record<string, unknown>> },
  generatedAt: Date,
): BackupSummaryArtifact {
  const summary: Record<string, unknown> = {};
  for (const key of ALLOWED_SUMMARY_KEYS) {
    if (result.summary && key in result.summary) summary[key] = result.summary[key];
  }
  return { schema: BACKUP_SUMMARY_ARTIFACT_SCHEMA, ok: result.ok, reasons: [...result.reasons], summary, generatedAt: generatedAt.toISOString() };
}

/**
 * 要約をJSON文字列にする。Secret値(8文字以上の値だけを対象。空・短い値は誤検出を避けるため除外)の
 * どれかが含まれていればthrowする。
 */
export function serializeBackupSummaryArtifact(artifact: BackupSummaryArtifact, secretValues: readonly (string | undefined)[]): string {
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  for (const value of secretValues) {
    if (typeof value !== "string" || value.trim().length < 8) continue;
    const probes = [value, ...value.split(/\r?\n/).filter((line) => line.trim().length >= 16)];
    if (probes.some((p) => text.includes(p))) throw new Error("要約artifactにSecret値が含まれているため書き出さない(blocked)");
  }
  return text;
}

/** 書き出し先はworkflowが渡す`*.json`のpathだけ(改行・NULを含むpathは拒否)。 */
export function assertSummaryArtifactPath(p: string): string {
  if (!/\.json$/.test(p) || /[\r\n\0]/.test(p)) throw new Error("要約artifactの出力先が不正(blocked)");
  return p;
}
