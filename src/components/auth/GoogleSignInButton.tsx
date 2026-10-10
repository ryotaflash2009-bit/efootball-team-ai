"use client";

import "@/lib/i18n/dictionaries/ja-ns/auth";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { Button } from "@/components/ui/Button";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import { buildGoogleRedirectTo, isGoogleOAuthAvailable } from "@/lib/supabase/oauth";

/** Google の公開の状態（コードの値・ローカルの ?oauthPreview=1）。マウント後に決めるので SSR の表示（なし）とずれない。 */
export function useGoogleOAuthAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (isGoogleOAuthAvailable(window.location.hostname, window.location.search, isLocalDevHostname)) setAvailable(true);
  }, []);
  return available;
}

/**
 * 「Google で続ける」（redirect 方式・2026-10-11）。押すと Supabase の Google の画面へ移動し、戻りは `/auth/callback?flow=google`。
 * 失敗・キャンセルはログインの画面の `?authError=oauth_cancelled | oauth_failed` で表示する（生のエラー文は出さない）。
 */
export function GoogleSignInButton({ next, onError }: { next: string | null; onError: (message: string) => void }) {
  const t = useT();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return; // 連打防止
    setPending(true);
    try {
      const { getSupabaseBrowserClient, fetchGoogleProviderStatus } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      // 緊急停止（Supabase の Google の Provider を Disable）の間は、Supabase の生のエラーの画面へ移さずに案内する。
      if ((await fetchGoogleProviderStatus()) === "disabled") {
        onError(t("auth", "googleProviderDisabled"));
        setPending(false);
        return;
      }
      if (!supabase?.auth.signInWithOAuth) {
        onError(t("auth", "authErrorNotConfigured"));
        setPending(false);
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildGoogleRedirectTo(window.location.origin, next, process.env.NEXT_PUBLIC_SITE_URL),
          // 複数の Google アカウントを使い分ける人が、意図しないアカウントで登録しないように毎回選ばせる。
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        onError(t("auth", "authErrorOAuthFailed"));
        setPending(false);
      }
      // 成功時はブラウザーが Google の画面へ移動する（pending のまま）。
    } catch {
      onError(t("auth", "authErrorOAuthFailed"));
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick} disabled={pending} data-testid="google-sign-in-button">
      {pending ? t("auth", "googleRedirecting") : t("auth", "googleContinueButton")}
    </Button>
  );
}
