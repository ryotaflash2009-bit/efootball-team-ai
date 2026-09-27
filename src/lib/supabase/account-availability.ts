/**
 * アカウント機能（新規登録・メール送信を伴う認証）の公開状態。
 *
 * Supabase Auth の標準メール送信は「プロジェクトのメンバー宛てのみ・1時間に2通」までで、一般の利用者へは届かない
 * （公式ドキュメント: Auth > SMTP）。カスタム SMTP（docs/production-readiness/custom-domain-and-email-runbook.md）を
 * 設定して配信を確認するまでは、新規登録を「限定テスト中」として受け付けない。既存ユーザーのログインは妨げない。
 *
 * カスタム SMTP の設定と配信テスト（Release Gate）が完了したら、PR でこの値を "open" に変える。
 * 環境変数ではなくコードの値にしているのは、本人の追加操作なしで安全側（limited）が既定になるようにするため。
 */
export type AccountSignupMode = "limited" | "open";

export const ACCOUNT_SIGNUP_MODE: AccountSignupMode = "limited";

export function isSignupOpen(mode: AccountSignupMode = ACCOUNT_SIGNUP_MODE): boolean {
  return mode === "open";
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
