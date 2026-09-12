"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SignUpSuccessPanel } from "@/components/auth/SignUpSuccessPanel";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isValidEmailFormat, validatePasswordRules } from "@/lib/supabase/password-rules";
import { classifySignUpFailure } from "@/lib/supabase/auth-errors";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

export function SignUpView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // 連打防止

    setFieldError(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidEmailFormat(email)) {
      setFieldError(ta("invalidEmailError"));
      return;
    }
    if (password !== passwordConfirm) {
      setFieldError(ta("passwordMismatchError"));
      return;
    }
    if (validatePasswordRules(password).length > 0) {
      setFieldError(ta("passwordRequirementsHint"));
      return;
    }
    if (!supabase) {
      setErrorMessage(ta("genericErrorMessage"));
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
        },
      });

      if (error) {
        const reason = classifySignUpFailure(error);
        // 既存アカウントの有無は区別しない(メールアドレス存在調査への悪用防止)。
        if (reason === "RATE_LIMITED") {
          setErrorMessage(`${ta("genericErrorMessage")} ${ta("tryAgainMessage")}`);
        } else if (reason === "WEAK_PASSWORD") {
          setErrorMessage(ta("passwordRequirementsHint"));
        } else {
          setErrorMessage(ta("signUpFailedMessage"));
        }
        return;
      }

      // アカウントが既に存在する場合でも同一の成功文言を表示する(メールアドレス存在調査への悪用防止)。
      setSuccessMessage(ta("signUpSuccessMessage"));
      setPassword("");
      setPasswordConfirm("");
    } catch {
      setErrorMessage(ta("genericErrorMessage"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("signUpPageTitle")} icon="shield" />

      {successMessage ? (
        <SignUpSuccessPanel email={email} successMessage={successMessage} />
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
            <Input
              type="password"
              label={ta("passwordLabel")}
              hint={ta("passwordRequirementsHint")}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <Input
              type="password"
              label={ta("passwordConfirmLabel")}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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
              {ta("signUpSubmitButton")}
            </Button>
          </form>
        </Surface>
      )}

      <p className="text-sm text-text-dim">
        {ta("signUpHaveAccountPrompt")}{" "}
        <Link href="/auth/sign-in" className="text-accent hover:underline">
          {ta("signUpSignInLink")}
        </Link>
      </p>
    </div>
  );
}
