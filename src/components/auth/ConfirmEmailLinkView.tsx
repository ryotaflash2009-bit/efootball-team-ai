"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { classifyEmailLinkFailure, parseConfirmParams, type ConfirmParams } from "@/lib/supabase/email-link";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

const FAILURE_KEY: Record<string, AuthKey> = {
  link_expired: "authErrorLinkExpired",
  link_invalid: "authErrorLinkInvalid",
  rate_limited: "authErrorRateLimited",
  not_configured: "authErrorNotConfigured",
  unavailable: "authErrorServiceUnavailable",
  unknown: "authErrorLinkInvalid",
};

/**
 * 認証メールのリンクの着地点（`/auth/confirm?token_hash=…&type=…`）。
 * - トークンの検証は利用者がボタンを押したときだけ（メール事業者のリンク事前取得で先に使われないように）。
 * - 読み取った直後に URL からトークンを消す（履歴・Referer へ残さない）。
 * - 戻り先は種類ごとの固定の内部パス（parseConfirmParams）。生のエラー文は表示しない。
 */
export function ConfirmEmailLinkView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const router = useRouter();
  const [params, setParams] = useState<ConfirmParams | null>(null);
  const [status, setStatus] = useState<"ready" | "verifying" | "success" | "error">("ready");
  const [errorKey, setErrorKey] = useState<AuthKey | null>(null);

  useEffect(() => {
    const parsed = parseConfirmParams(window.location.search);
    setParams(parsed);
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    if (!parsed.ok) {
      setStatus("error");
      setErrorKey("authErrorLinkInvalid");
    }
  }, []);

  async function handleConfirm() {
    if (!params?.ok || status === "verifying" || status === "success") return; // 連打防止
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("error");
      setErrorKey("authErrorNotConfigured");
      return;
    }
    setStatus("verifying");
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type });
      if (error) {
        setStatus("error");
        setErrorKey(FAILURE_KEY[classifyEmailLinkFailure(error as { status?: number; code?: string })]);
        return;
      }
      setStatus("success");
      router.replace(params.next);
    } catch {
      // 通信失敗・タイムアウト。リンクは使われていない可能性が高いので、無効とは言わず再試行を案内する。
      setStatus("error");
      setErrorKey("authErrorServiceUnavailable");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("confirmPageTitle")} icon="shield" />
      <Surface padding="md" className="flex max-w-md flex-col gap-3">
        {status === "error" && errorKey ? (
          <>
            <p role="alert" className="text-sm text-danger" data-testid="confirm-error">
              {ta(errorKey)}
            </p>
            <div className="flex flex-wrap gap-2">
              {params?.ok && (errorKey === "authErrorServiceUnavailable" || errorKey === "authErrorRateLimited") ? (
                <Button size="sm" onClick={handleConfirm} data-testid="confirm-retry">
                  {ta("confirmRetryButton")}
                </Button>
              ) : null}
              <Link href="/auth/sign-in">
                <Button size="sm">{ta("callbackReturnLink")}</Button>
              </Link>
              <Link href="/auth/forgot-password">
                <Button variant="secondary" size="sm">
                  {ta("forgotPasswordPageTitle")}
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">{ta("confirmPageBody")}</p>
            <Button onClick={handleConfirm} disabled={!params?.ok || status !== "ready"} data-testid="confirm-button" className="w-fit">
              {status === "verifying" ? ta("confirmProcessing") : status === "success" ? ta("confirmSuccess") : ta("confirmButton")}
            </Button>
            <p className="text-2xs text-text-muted">{ta("confirmWhyButton")}</p>
          </>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {status === "success" ? ta("confirmSuccess") : status === "verifying" ? ta("confirmProcessing") : ""}
        </p>
      </Surface>
    </div>
  );
}
