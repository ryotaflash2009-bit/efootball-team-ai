import type { BackupObjectPrefix } from "./backup-r2-target";
import type { BackupManifest } from "./backup-manifest";

/**
 * Production Backupの「category」から、object prefix・manifestのretentionCategory・
 * retentionDaysを一意に決定する固定mapping。
 *
 * 2026-09-21追記: 以前は呼び出し側(`run-production-backup-cli.ts`)が`prefix`・
 * `retentionCategory`・`retentionDays`をそれぞれ個別に(実質自由に組み合わせ可能な形で)
 * 指定できたため、workflow YAMLの`REFERENCE_DATA_BACKUP_PREFIX`を`pre-apply/`へ変更しても、
 * `retentionCategory`は`production-standard`・`retentionDays`は8日のまま残り、
 * 「自動削除されないはずのpre-applyなのに、manifestは8日で期限切れと記録される」という
 * 不整合が生じ得た。この不整合を構造的に発生させないため、呼び出し側が触れるのは
 * `category`という1つの値だけにし、prefix・retentionCategory・retentionDaysの組み合わせは
 * このファイルの`BACKUP_CATEGORY_MAPPING`だけが決定する(呼び出し側からの自由指定を禁止する)。
 *
 * R2 Lifecycle Rule(本人がCloudflare Dashboardで設定済み、実値)と一致させている:
 * daily/ 8日・weekly/ 35日・monthly/ 100日・pre-apply/ 自動削除なし。
 */

export const BACKUP_CATEGORIES = ["daily", "weekly", "monthly", "pre-apply"] as const;
export type BackupCategory = (typeof BACKUP_CATEGORIES)[number];

export interface BackupCategoryMapping {
  prefix: BackupObjectPrefix;
  retentionCategory: BackupManifest["retentionCategory"];
  /** nullは「R2 Lifecycle Ruleによる自動削除の対象外」を意味する(0や遠い未来の日付で偽装しない)。 */
  retentionDays: number | null;
}

export const BACKUP_CATEGORY_MAPPING: Readonly<Record<BackupCategory, BackupCategoryMapping>> = {
  daily: { prefix: "daily/", retentionCategory: "production-daily", retentionDays: 8 },
  weekly: { prefix: "weekly/", retentionCategory: "production-weekly", retentionDays: 35 },
  monthly: { prefix: "monthly/", retentionCategory: "production-monthly", retentionDays: 100 },
  "pre-apply": { prefix: "pre-apply/", retentionCategory: "production-pre-apply", retentionDays: null },
} as const;

export interface ResolveBackupCategoryResult {
  ok: boolean;
  reason?: string;
  category?: BackupCategory;
  mapping?: BackupCategoryMapping;
}

/**
 * `raw`が`BACKUP_CATEGORIES`のいずれかと**完全一致**する場合だけ受理する。
 * 前後の空白除去・大文字小文字の補正・部分一致はいずれも行わない
 * (workflow_dispatchのchoice inputは元々4値しか選べないが、CLI側が独立して
 * 同じ厳格さで再検証する、defense in depthの方針)。
 */
export function resolveBackupCategory(raw: string): ResolveBackupCategoryResult {
  const match = BACKUP_CATEGORIES.find((c) => c === raw);
  if (!match) {
    return {
      ok: false,
      reason: `許可されていないBackup category: ${JSON.stringify(raw)}(daily/weekly/monthly/pre-applyの完全一致だけを許可する)`,
    };
  }
  return { ok: true, category: match, mapping: BACKUP_CATEGORY_MAPPING[match] };
}
