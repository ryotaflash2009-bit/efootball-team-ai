import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolveSupportChannels, type ResolvedSupportChannels } from "./support-config";

/**
 * 公開準備状況の内部データモデル(開発者向け)。
 *
 * - 表示名・説明文はすべて ja/en 辞書キー経由で解決する(このファイルへ日本語・英語の
 *   生文字列を書かない。titleKey/descriptionKeyを辞書キー名にする)。
 * - 通常利用者向けUIへは、このモデルの `id`(内部識別子)をそのまま表示しない
 *   (呼び出し側の責務。カテゴリ名・状態・タイトル・説明はすべて辞書経由で解決してから表示する)。
 * - 内部パス・PID・テスト件数・SQLiteテーブル名など開発者向け情報はこのモデルに含めない。
 */

export type ReleaseReadinessStatus =
  | "complete"
  | "partial"
  | "not-started"
  | "not-applicable"
  | "requires-owner-action"
  | "requires-specialist-review";

export type ReleaseReadinessBlockingLevel =
  | "local-only"
  | "internal-test-blocker"
  | "invite-beta-blocker"
  | "public-beta-blocker"
  | "production-blocker"
  | "paid-plan-blocker";

export type ReleaseReadinessCategory =
  | "auth"
  | "data-safety"
  | "legal"
  | "rights"
  | "support"
  | "infrastructure"
  | "billing";

type ReleaseReadinessKey = keyof Dictionary["releaseReadiness"];

export interface ReleaseReadinessItem {
  id: string;
  category: ReleaseReadinessCategory;
  status: ReleaseReadinessStatus;
  blockingLevel: ReleaseReadinessBlockingLevel;
  titleKey: ReleaseReadinessKey;
  descriptionKey: ReleaseReadinessKey;
  /** この判定の根拠を示す短い内部コード(開発者向け。表示専用文言ではない)。 */
  evidenceCode: string;
  /** 運営者(上杉さん)自身の対応が必要かどうか。 */
  ownerActionRequired: boolean;
}

/**
 * 公開準備チェック項目の一覧(本タスクの調査結果に基づく)。
 * 問い合わせ窓口関連の2項目(support-contact / rights-contact)は、
 * `PUBLIC_SUPPORT_CONFIG` が未設定である限り "requires-owner-action" として扱う
 * (`buildReleaseReadinessItems()` が実行時に反映する)。
 */
function baseItems(): ReleaseReadinessItem[] {
  return [
    {
      id: "auth",
      category: "auth",
      status: "complete",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemAuthTitle",
      descriptionKey: "itemAuthDesc",
      evidenceCode: "supabase-auth-registration-login-logout-email-confirmation-password-reset-implemented",
      ownerActionRequired: false,
    },
    {
      id: "data-isolation",
      category: "auth",
      status: "complete",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemDataIsolationTitle",
      descriptionKey: "itemDataIsolationDesc",
      evidenceCode: "rls-based-per-user-isolation-implemented",
      ownerActionRequired: false,
    },
    {
      id: "sync",
      category: "data-safety",
      status: "not-started",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemSyncTitle",
      descriptionKey: "itemSyncDesc",
      evidenceCode: "localstorage-only-no-full-auto-sync-code",
      ownerActionRequired: false,
    },
    {
      id: "cloud-backup",
      category: "data-safety",
      status: "partial",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemCloudBackupTitle",
      descriptionKey: "itemCloudBackupDesc",
      evidenceCode: "explicit-my-team-cloud-save-alpha-feature-no-full-auto-backup",
      ownerActionRequired: false,
    },
    {
      id: "local-backup",
      category: "data-safety",
      status: "complete",
      blockingLevel: "local-only",
      titleKey: "itemLocalBackupTitle",
      descriptionKey: "itemLocalBackupDesc",
      evidenceCode: "json-export-import-existing-feature",
      ownerActionRequired: false,
    },
    {
      id: "data-deletion",
      category: "data-safety",
      status: "complete",
      blockingLevel: "local-only",
      titleKey: "itemDataDeletionTitle",
      descriptionKey: "itemDataDeletionDesc",
      evidenceCode: "delete-all-local-data-feature",
      ownerActionRequired: false,
    },
    {
      id: "terms",
      category: "legal",
      status: "partial",
      blockingLevel: "invite-beta-blocker",
      titleKey: "itemTermsTitle",
      descriptionKey: "itemTermsDesc",
      evidenceCode: "terms-draft-published-governing-law-unset",
      ownerActionRequired: true,
    },
    {
      id: "privacy",
      category: "legal",
      status: "partial",
      blockingLevel: "invite-beta-blocker",
      titleKey: "itemPrivacyTitle",
      descriptionKey: "itemPrivacyDesc",
      evidenceCode: "privacy-draft-published",
      ownerActionRequired: true,
    },
    {
      id: "disclaimer",
      category: "legal",
      status: "complete",
      blockingLevel: "local-only",
      titleKey: "itemDisclaimerTitle",
      descriptionKey: "itemDisclaimerDesc",
      evidenceCode: "disclaimer-page-published",
      ownerActionRequired: false,
    },
    {
      id: "unofficial-notice",
      category: "legal",
      status: "complete",
      blockingLevel: "local-only",
      titleKey: "itemUnofficialNoticeTitle",
      descriptionKey: "itemUnofficialNoticeDesc",
      evidenceCode: "unofficial-notice-footer-about-disclaimer",
      ownerActionRequired: false,
    },
    {
      id: "rights-check",
      category: "rights",
      status: "requires-specialist-review",
      blockingLevel: "production-blocker",
      titleKey: "itemRightsCheckTitle",
      descriptionKey: "itemRightsCheckDesc",
      evidenceCode: "no-confirmed-redistribution-license-in-repo",
      ownerActionRequired: true,
    },
    {
      id: "support-contact",
      category: "support",
      status: "requires-owner-action",
      blockingLevel: "invite-beta-blocker",
      titleKey: "itemSupportContactTitle",
      descriptionKey: "itemSupportContactDesc",
      evidenceCode: "public-support-config-unset",
      ownerActionRequired: true,
    },
    {
      id: "rights-contact",
      category: "support",
      status: "requires-owner-action",
      blockingLevel: "invite-beta-blocker",
      titleKey: "itemRightsContactTitle",
      descriptionKey: "itemRightsContactDesc",
      evidenceCode: "public-support-config-unset",
      ownerActionRequired: true,
    },
    {
      id: "hosting",
      category: "infrastructure",
      status: "complete",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemHostingTitle",
      descriptionKey: "itemHostingDesc",
      evidenceCode: "vercel-production-deployment-live-invite-alpha",
      ownerActionRequired: false,
    },
    {
      id: "monitoring",
      category: "infrastructure",
      status: "not-started",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemMonitoringTitle",
      descriptionKey: "itemMonitoringDesc",
      evidenceCode: "no-monitoring-integration",
      ownerActionRequired: false,
    },
    {
      id: "error-collection",
      category: "infrastructure",
      status: "not-started",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemErrorCollectionTitle",
      descriptionKey: "itemErrorCollectionDesc",
      evidenceCode: "no-error-monitoring-service",
      ownerActionRequired: false,
    },
    {
      id: "security",
      category: "infrastructure",
      status: "requires-specialist-review",
      blockingLevel: "production-blocker",
      titleKey: "itemSecurityTitle",
      descriptionKey: "itemSecurityDesc",
      evidenceCode: "rls-and-basic-input-validation-no-formal-third-party-review",
      ownerActionRequired: true,
    },
    {
      id: "operating-cost",
      category: "infrastructure",
      status: "not-started",
      blockingLevel: "production-blocker",
      titleKey: "itemOperatingCostTitle",
      descriptionKey: "itemOperatingCostDesc",
      evidenceCode: "no-cost-estimate",
      ownerActionRequired: true,
    },
    {
      id: "free-pro-design",
      category: "billing",
      status: "not-started",
      blockingLevel: "paid-plan-blocker",
      titleKey: "itemFreeProDesignTitle",
      descriptionKey: "itemFreeProDesignDesc",
      evidenceCode: "no-pricing-design",
      ownerActionRequired: true,
    },
    {
      id: "billing",
      category: "billing",
      status: "not-started",
      blockingLevel: "paid-plan-blocker",
      titleKey: "itemBillingTitle",
      descriptionKey: "itemBillingDesc",
      evidenceCode: "no-payment-integration",
      ownerActionRequired: false,
    },
    {
      id: "cancellation",
      category: "billing",
      status: "not-started",
      blockingLevel: "paid-plan-blocker",
      titleKey: "itemCancellationTitle",
      descriptionKey: "itemCancellationDesc",
      evidenceCode: "no-refund-policy",
      ownerActionRequired: true,
    },
    {
      id: "support-structure",
      category: "support",
      status: "not-started",
      blockingLevel: "public-beta-blocker",
      titleKey: "itemSupportStructureTitle",
      descriptionKey: "itemSupportStructureDesc",
      evidenceCode: "no-ongoing-support-structure",
      ownerActionRequired: false,
    },
  ];
}

/**
 * 実行時の設定(問い合わせ窓口の設定状態)を反映した最終的な項目一覧を返す。
 * `PUBLIC_SUPPORT_CONFIG` が有効化され、安全に表示できる連絡先が設定されていれば、
 * support-contact / rights-contact の status を "complete" へ引き上げる。
 *
 * `channelsOverride` はUnit Test専用(未設定状態のフォールバック挙動を、実際の
 * `PUBLIC_SUPPORT_CONFIG` を書き換えずに検証するため)。呼び出し側の本番コードは省略し、
 * 常に実際の設定値(`resolveSupportChannels()` の既定呼び出し)を使うこと。
 */
export function buildReleaseReadinessItems(channelsOverride?: ResolvedSupportChannels): ReleaseReadinessItem[] {
  const channels = channelsOverride ?? resolveSupportChannels();
  return baseItems().map((item) => {
    if (item.id === "support-contact" && channels.supportEmail) {
      return { ...item, status: "complete" as const, ownerActionRequired: false, evidenceCode: "public-support-config-set" };
    }
    if (item.id === "rights-contact" && channels.rightsContactEmail) {
      return { ...item, status: "complete" as const, ownerActionRequired: false, evidenceCode: "public-support-config-set" };
    }
    return item;
  });
}

/** すべての `id` が一意であることを前提とする(Unit Testで検証)。 */
export function assertUniqueIds(items: ReleaseReadinessItem[]): boolean {
  const ids = items.map((i) => i.id);
  return new Set(ids).size === ids.length;
}

/** 指定したブロッカー段階に該当する項目だけを、決定的な順序(id昇順)で返す。 */
export function getBlockersForLevel(items: ReleaseReadinessItem[], level: ReleaseReadinessBlockingLevel): ReleaseReadinessItem[] {
  return items
    .filter((i) => i.blockingLevel === level && i.status !== "complete" && i.status !== "not-applicable")
    .sort((a, b) => a.id.localeCompare(b.id));
}
