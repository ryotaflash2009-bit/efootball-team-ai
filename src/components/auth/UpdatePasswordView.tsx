"use client";

import "@/lib/i18n/dictionaries/ja-ns/auth";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { validatePasswordRules } from "@/lib/supabase/password-rules";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

export function UpdatePasswordView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = getSupabaseBrowserClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // 連打防止

    setFieldError(null);
    setErrorMessage(null);

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // 理由ごとに次の行動が分かる一般化した文言（生のエラー文は出さない）。
        const code = (error as { code?: string; status?: number }).code;
        const status = (error as { code?: string; status?: number }).status;
        if (code === "reauthentication_needed") setErrorMessage(ta("reauthenticationNeededMessage"));
        else if (code === "weak_password") setErrorMessage(ta("passwordRequirementsHint"));
        else if (status === 429 || code === "over_request_rate_limit") setErrorMessage(ta("authErrorRateLimited"));
        else if (status === 401 || code === "session_not_found" || code === "session_expired") setErrorMessage(ta("sessionExpiredMessage"));
        else setErrorMessage(ta("genericErrorMessage"));
        return;
      }
      await supabase.auth.signOut();
      setSuccess(true);
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
      <PageHeader title={ta("updatePasswordPageTitle")} icon="shield" description={ta("updatePasswordDescription")} />

      {success ? (
        <Surface tone="inset" padding="md">
          <p className="text-sm text-text-dim">{ta("updatePasswordSuccessMessage")}</p>
          <Link href="/auth/sign-in" className="mt-2 inline-block text-sm text-accent hover:underline">
            {ta("signInPageTitle")}
          </Link>
        </Surface>
      ) : (
        <Surface padding="md" className="max-w-md">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
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
              {ta("updatePasswordSubmitButton")}
            </Button>
          </form>
        </Surface>
      )}
    </div>
  );
}
