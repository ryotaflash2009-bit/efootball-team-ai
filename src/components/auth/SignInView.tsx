"use client";

import "@/lib/i18n/dictionaries/ja-ns/auth";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { classifySignInFailure } from "@/lib/supabase/auth-errors";
import { resolveSafeInternalPath } from "@/lib/supabase/safe-redirect";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { isSignupOpen } from "@/lib/supabase/account-availability";
import { authErrorMessageKey } from "@/lib/supabase/email-link";

type AuthKey = keyof Dictionary["auth"];

export function SignInView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    // 期限切れ・無効なリンク等の理由ごとに、次の行動が分かる一般化した文言にする（生のエラー文は出さない）。
    const key = authErrorMessageKey(searchParams.get("authError"));
    return key ? ta(key) : null;
  });

  const supabase = getSupabaseBrowserClient();
  const nextPath = resolveSafeInternalPath(searchParams.get("next"), "/account");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // 連打防止

    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(ta("genericErrorMessage"));
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const reason = classifySignInFailure(error);
        setErrorMessage(reason === "RATE_LIMITED" ? `${ta("genericErrorMessage")} ${ta("tryAgainMessage")}` : ta("signInFailedMessage"));
        return;
      }
      router.push(nextPath);
    } catch {
      setErrorMessage(ta("genericErrorMessage"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("signInPageTitle")} icon="shield" />

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
          <Input
            type="password"
            label={ta("passwordLabel")}
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />

          {errorMessage ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {ta("signInSubmitButton")}
          </Button>
        </form>
      </Surface>

      <div className="flex flex-col gap-1.5 text-sm text-text-dim">
        <p>
          {isSignupOpen() ? ta("signInNoAccountPrompt") : ta("signInNoAccountLimitedPrompt")}{" "}
          <Link href="/auth/sign-up" className="text-accent hover:underline">
            {isSignupOpen() ? ta("signInSignUpLink") : ta("signInLimitedLink")}
          </Link>
        </p>
        <p>
          <Link href="/auth/forgot-password" className="text-accent hover:underline">
            {ta("signInForgotPasswordLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
