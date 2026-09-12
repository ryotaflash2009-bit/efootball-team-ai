"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isValidEmailFormat } from "@/lib/supabase/password-rules";
import { classifyPasswordResetFailure } from "@/lib/supabase/auth-errors";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

export function ForgotPasswordView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const supabase = getSupabaseBrowserClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // 連打防止

    setFieldError(null);
    setErrorMessage(null);

    if (!isValidEmailFormat(email)) {
      setFieldError(ta("invalidEmailError"));
      return;
    }
    if (!supabase) {
      setErrorMessage(ta("genericErrorMessage"));
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}` : undefined,
      });

      if (error) {
        const reason = classifyPasswordResetFailure(error);
        if (reason === "RATE_LIMITED") {
          setErrorMessage(`${ta("genericErrorMessage")} ${ta("tryAgainMessage")}`);
          return;
        }
        // 該当アカウントが存在しない場合の失敗も含め、詳細は区別せず成功時と同じ案内にする
        // (メールアドレス存在調査への悪用防止)。
      }
      setSent(true);
    } catch {
      setErrorMessage(ta("genericErrorMessage"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("forgotPasswordPageTitle")} icon="shield" description={ta("forgotPasswordDescription")} />

      {sent ? (
        <Surface tone="inset" padding="md">
          <p className="text-sm text-text-dim">{ta("forgotPasswordSentMessage")}</p>
        </Surface>
      ) : (
        <Surface padding="md" className="max-w-md">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Input
              type="email"
              label={ta("emailLabel")}
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />

            {fieldError ? (
              <p role="alert" className="text-sm text-danger">
                {fieldError}
              </p>
            ) : null}
            {errorMessage ? (
              <p role="alert" className="text-sm text-danger">
                {errorMessage}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {ta("forgotPasswordSubmitButton")}
            </Button>
          </form>
        </Surface>
      )}

      <p className="text-sm text-text-dim">
        <Link href="/auth/sign-in" className="text-accent hover:underline">
          {ta("callbackReturnLink")}
        </Link>
      </p>
    </div>
  );
}
