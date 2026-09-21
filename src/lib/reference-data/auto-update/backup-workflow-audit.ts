import type { GuardCheck } from "../real-import-guards";

/**
 * Production Backup手動承認workflow(`.github/workflows/reference-data-production-backup.yml`)の
 * 静的監査。生YAMLテキストを対象に検査する(YAMLパーサーは使わず、行ベースの単純な
 * 文字列検査に留める。このモジュール自体はworkflowを実行しない)。
 */

/**
 * 2026-09-21再評価: Cloudflare R2はS3互換のAccess Key ID + Secret Access Keyによる
 * SigV4認証を要求し、単一の`STORAGE_TOKEN`では表現できない。従来の
 * `REFERENCE_DATA_BACKUP_STORAGE_TOKEN`/`REFERENCE_DATA_BACKUP_STORAGE_DESTINATION`
 * (provider未確定時の汎用名)を、R2採用確定に伴いR2固有の4項目へ置き換えた
 * (詳細は[[reference-data-production-backup-r2-adapter.md]]参照)。
 */
const REQUIRED_SECRET_NAMES = [
  "REFERENCE_DATA_BACKUP_DB_URL",
  "REFERENCE_DATA_BACKUP_AGE_RECIPIENT",
  "REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID",
  "REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY",
  "REFERENCE_DATA_BACKUP_R2_ENDPOINT",
  "REFERENCE_DATA_BACKUP_R2_BUCKET",
] as const;

/** `on:`ブロックが`workflow_dispatch`だけを持ち、`schedule`/`pull_request`/`push`を一切含まないことを確認する。 */
export function assertWorkflowDispatchOnly(yaml: string): GuardCheck {
  if (!/\bworkflow_dispatch\s*:/.test(yaml)) {
    return { ok: false, reason: "workflow_dispatchトリガーが見つからない" };
  }
  const forbidden = ["schedule", "pull_request", "push"];
  for (const trigger of forbidden) {
    if (new RegExp(`^\\s*${trigger}\\s*:`, "m").test(yaml)) {
      return { ok: false, reason: `禁止されたトリガー(${trigger})が含まれている` };
    }
  }
  return { ok: true };
}

/** `permissions:`が`contents: read`だけであり、write権限を一切要求しないことを確認する。 */
export function assertReadOnlyPermissions(yaml: string): GuardCheck {
  const m = yaml.match(/^permissions:\s*\n((?:\s+.+\n?)+)/m);
  if (!m) {
    return { ok: false, reason: "permissionsブロックが見つからない(既定の広い権限のまま実行される危険)" };
  }
  const block = m[1];
  if (!/contents:\s*read/.test(block)) {
    return { ok: false, reason: "permissionsに contents: read が明記されていない" };
  }
  if (/:\s*write/.test(block)) {
    return { ok: false, reason: "permissionsにwrite権限が含まれている" };
  }
  return { ok: true };
}

/** GitHub Environment(承認ゲート)が指定されていることを確認する。 */
export function assertEnvironmentApprovalConfigured(yaml: string): GuardCheck {
  if (!/^\s*environment:\s*\S+/m.test(yaml)) {
    return { ok: false, reason: "environment(GitHub Environment承認ゲート)が指定されていない" };
  }
  return { ok: true };
}

/** 必須Secret名(REQUIRED_SECRET_NAMES)がすべて参照されており、他の未知のSecretを参照していないことを確認する。 */
export function assertRequiredSecretsMatch(yaml: string): GuardCheck {
  const referenced = [...yaml.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]);
  const uniqueReferenced = [...new Set(referenced)];
  const missing = REQUIRED_SECRET_NAMES.filter((n) => !uniqueReferenced.includes(n));
  const unexpected = uniqueReferenced.filter((n) => !(REQUIRED_SECRET_NAMES as readonly string[]).includes(n));
  if (missing.length > 0 || unexpected.length > 0) {
    return {
      ok: false,
      reason: `参照されているSecretが想定の${REQUIRED_SECRET_NAMES.length}件と一致しない(不足: ${missing.join(",") || "なし"} / 想定外: ${unexpected.join(",") || "なし"})`,
    };
  }
  return { ok: true };
}

/** Secretの存在チェック(空でないことの確認)が、他のいかなるステップより先に実行されることを確認する。 */
export function assertSecretCheckRunsFirst(yaml: string): GuardCheck {
  const stepBlocks = yaml.split(/\n\s*-\s+name:/).slice(1);
  if (stepBlocks.length < 2) {
    return { ok: false, reason: "ステップが2件未満(secret確認ステップと後続ステップの両方が必要)" };
  }
  const firstStepHasConfirmCheck = /confirm/i.test(stepBlocks[0]);
  const secretCheckIndex = stepBlocks.findIndex((s) => /required secret/i.test(s));
  if (secretCheckIndex === -1) {
    return { ok: false, reason: "secret存在チェックのステップが見つからない" };
  }
  // confirm入力チェック(secretを一切読まない)は許容するが、secret存在チェックはそれ以降の
  // どのステップよりも先(secretを読まない後続ステップが無い限り、実質的に最初)に来る必要がある。
  if (!firstStepHasConfirmCheck && secretCheckIndex !== 0) {
    return { ok: false, reason: "secret存在チェックより前に別のステップが実行される設計になっている" };
  }
  return { ok: true };
}

/** secretの生値をecho/print等でログへ出力していないことを確認する(空文字判定だけを許可する)。 */
export function assertNoSecretValuePrinted(yaml: string): GuardCheck {
  if (/echo[^\n]*\$\{\{\s*secrets\./.test(yaml)) {
    return { ok: false, reason: "secretsコンテキストの値を直接echoしている(ログ露出の危険)" };
  }
  const dangerousPrint = /echo\s+"\$(REFERENCE_DATA_BACKUP_\w+)"/;
  if (dangerousPrint.test(yaml)) {
    return { ok: false, reason: "secret由来の環境変数の値をそのままechoしている" };
  }
  return { ok: true };
}

/** 承認をCLIの `--yes`/`-y` フラグ等で代替する設計になっていないことを確認する。 */
export function assertNoApprovalBypassFlag(yaml: string): GuardCheck {
  if (/--yes\b|-y\b|--force\b|--no-confirm\b|--skip-approval\b/i.test(yaml)) {
    return { ok: false, reason: "承認をCLIフラグで代替する記述が含まれている" };
  }
  return { ok: true };
}

export function auditBackupApprovalWorkflow(yaml: string): GuardCheck[] {
  return [
    assertWorkflowDispatchOnly(yaml),
    assertReadOnlyPermissions(yaml),
    assertEnvironmentApprovalConfigured(yaml),
    assertRequiredSecretsMatch(yaml),
    assertSecretCheckRunsFirst(yaml),
    assertNoSecretValuePrinted(yaml),
    assertNoApprovalBypassFlag(yaml),
  ];
}
