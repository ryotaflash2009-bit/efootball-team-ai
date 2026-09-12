"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { classifyResendFailure } from "@/lib/supabase/auth-errors";
import { getRemainingCooldownSeconds, canResendNow } from "@/lib/supabase/resend-cooldown";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

/**
 * サインアップ成功後の案内画面。
 *
 * - 確認メール送信の案内だけで止まらず、次に行う操作を番号付きで示す。
 * - 確認メール再送信(60秒クールダウン・連打防止・レート制限の安全な案内)を提供する。
 * - ローカル開発ホスト(localhost等)でだけ、確認リンクを別端末で開けない旨を案内する。
 * - `email`はこのコンポーネント内の再送信処理にのみ使い、画面へ再表示しない。
 */
export function SignUpSuccessPanel({ email, successMessage }: { email: string; successMessage: string }) {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);

  const [isLocalDev, setIsLocalDev] = useState(false);
  const [resending, setResending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [resendResult, setResendResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setIsLocalDev(isLocalDevHostname(window.location.hostname));
  }, []);

  useEffect(() => {
    if (lastSentAt === null) return;
    const tick = () => setRemainingSeconds(getRemainingCooldownSeconds(lastSentAt, Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSentAt]);

  async function handleResend() {
    if (resending) return; // 連打防止
    if (!canResendNow(lastSentAt, Date.now())) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setResendResult({ tone: "error", text: ta("resendConfirmationFailedMessage") });
      return;
    }

    setResending(true);
    setResendResult(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLastSentAt(Date.now());
      if (error) {
        const reason = classifyResendFailure(error);
        setResendResult({
          tone: "error",
          text: reason === "RATE_LIMITED" ? ta("resendConfirmationRateLimitedMessage") : ta("resendConfirmationFailedMessage"),
        });
        return;
      }
      setResendResult({ tone: "success", text: ta("resendConfirmationSuccessMessage") });
    } catch {
      setLastSentAt(Date.now());
      setResendResult({ tone: "error", text: ta("resendConfirmationFailedMessage") });
    } finally {
      setResending(false);
    }
  }

  const resendDisabled = resending || remainingSeconds > 0;

  return (
    <Surface tone="inset" padding="md" aria-live="polite" className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-success">{ta("signUpSuccessTitle")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{successMessage}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-text">{ta("signUpNextStepsHeading")}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-dim">
          <li>{ta("signUpStep1")}</li>
          <li>{ta("signUpStep2")}</li>
          <li>{ta("signUpStep3")}</li>
          <li>{ta("signUpStep4")}</li>
        </ol>
      </div>

      <p className="text-xs text-text-muted">{ta("signUpSpamFolderNotice")}</p>
      <p className="text-xs text-text-muted">{ta("signUpAlreadyConfirmedNotice")}</p>

      {isLocalDev ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">{ta("localDevConfirmationNotice")}</p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-xs text-text-muted">{ta("signUpEmailNotArrivingNotice")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleResend} disabled={resendDisabled}>
            {resending ? ta("resendConfirmationSending") : ta("resendConfirmationButton")}
          </Button>
          {remainingSeconds > 0 ? (
            <span className="text-xs text-text-muted">{ta("resendConfirmationWaitTemplate").replace("{seconds}", String(remainingSeconds))}</span>
          ) : null}
        </div>
        {resendResult ? (
          <p role={resendResult.tone === "error" ? "alert" : undefined} className={`text-sm ${resendResult.tone === "error" ? "text-danger" : "text-success"}`}>
            {resendResult.text}
          </p>
        ) : null}
      </div>

      <Link href="/auth/sign-in" className="w-fit">
        <Button type="button" variant="primary" size="sm">
          {ta("signUpGoToSignInButton")}
        </Button>
      </Link>
    </Surface>
  );
}
