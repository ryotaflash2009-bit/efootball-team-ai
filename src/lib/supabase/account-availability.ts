/**
 * アカウント機能（新規登録・メール送信を伴う認証）の公開状態。
 *
 * Supabase Auth の標準メール送信は「プロジェクトのメンバー宛てのみ・1時間に2通」までで、一般の利用者へは届かない
 * （公式ドキュメント: Auth > SMTP）。独自ドメインとカスタム SMTP（docs/production-readiness/custom-domain-and-email-runbook.md）
 * を設定して配信を確認するまでは、新規登録を「限定テスト中」として受け付けない。既存ユーザーのログインは妨げない。
 *
 * 2つの独立した Gate（どちらもコードの値。環境変数ではないので、本人の追加操作なしで安全側が既定になる）:
 * - AUTH_EMAIL_DELIVERY: メール配信の状態。カスタム SMTP を設定し、配信テスト（Release Validator）に合格した後に
 *   PR で "custom_smtp_verified" に変える。
 * - ACCOUNT_SIGNUP_MODE: 新規登録の公開。本人の承認を得てから PR で "open" に変える。
 * 新規登録が開くのは **両方** がそろったときだけ（fail closed）。カスタム SMTP を有効にしただけでは開かない。
 */
export type AccountSignupMode = "limited" | "open";
export type AuthEmailDelivery = "builtin_members_only" | "custom_smtp_verified";

export const AUTH_EMAIL_DELIVERY: AuthEmailDelivery = "builtin_members_only";
export const ACCOUNT_SIGNUP_MODE: AccountSignupMode = "limited";

/** 一般の利用者へ認証メール（確認・再設定・メールアドレス変更・再認証）が届く状態か。 */
export function isEmailDeliveryVerified(delivery: AuthEmailDelivery = AUTH_EMAIL_DELIVERY): boolean {
  return delivery === "custom_smtp_verified";
}

/** 新規登録を公開してよいか（配信確認と公開判断の両方が必要）。 */
export function isSignupOpen(mode: AccountSignupMode = ACCOUNT_SIGNUP_MODE, delivery: AuthEmailDelivery = AUTH_EMAIL_DELIVERY): boolean {
  return mode === "open" && isEmailDeliveryVerified(delivery);
}

/**
 * ローカル開発ホストだけで、?signupPreview=1 による登録フォームの表示を許す（black-box で登録フォームを検証し続けるため）。
 * 本番・プレビューのホストでは、クエリだけでは決して開かない。
 */
export function isSignupPreviewAllowed(hostname: string, search: string, isLocalDevHostname: (h: string) => boolean): boolean {
  if (!isLocalDevHostname(hostname)) return false;
  return new URLSearchParams(search).get("signupPreview") === "1";
}

/**
 * 認証メール内リンクの戻り先（origin）。
 * NEXT_PUBLIC_SITE_URL が https の origin として正しく設定されていればそれを使い、プレビュー環境の URL を
 * 本番のメールへ混ぜない。未設定・不正なら現在の origin（従来どおり。Supabase 側の Redirect URLs 許可リストが最終防御）。
 */
export function resolveAuthRedirectOrigin(currentOrigin: string, configured: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  if (typeof configured === "string" && configured.trim() !== "") {
    try {
      const u = new URL(configured.trim());
      if (u.protocol === "https:" && u.pathname.replace(/\/+$/, "") === "" && !u.search && !u.hash && !u.username && !u.password) {
        return u.origin;
      }
    } catch {
      /* 不正な値は使わない */
    }
  }
  return currentOrigin;
}
