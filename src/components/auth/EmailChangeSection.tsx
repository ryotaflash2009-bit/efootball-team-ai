"use client";

import "@/lib/i18n/dictionaries/ja-ns/auth";
import { useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isValidEmailFormat } from "@/lib/supabase/password-rules";
import { isEmailDeliveryVerified, resolveAuthRedirectOrigin } from "@/lib/supabase/account-availability";
import { classifyEmailLinkFailure } from "@/lib/supabase/email-link";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

/**
 * メールアドレスの変更（ログイン中）。確認メールが必要なため、カスタム SMTP の配信確認までは利用できない旨を表示し、送信しない。
 * 送信後の文言は、既に使われているアドレスかどうかに関係なく同じ（メールアドレスの存在調査を防ぐ）。
 */
export function EmailChangeSection() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const enabled = isEmailDeliveryVerified();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!enabled || submitting) return; // 連打防止
    setMessage(null);
    if (!isValidEmailFormat(email)) {
      setMessage({ tone: "error", text: ta("invalidEmailError") });
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage({ tone: "error", text: ta("authErrorNotConfigured") });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${resolveAuthRedirectOrigin(window.location.origin)}/auth/callback?next=%2Faccount` },
      );
      if (error && classifyEmailLinkFailure(error as { status?: number; code?: string }) === "rate_limited") {
        setMessage({ tone: "error", text: ta("authErrorRateLimited") });
        return;
      }
      setMessage({ tone: "ok", text: ta("emailChangeSent") });
      setEmail("");
    } catch {
      setMessage({ tone: "error", text: ta("emailSendFailedMessage") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Surface padding="md" className="flex flex-col gap-2" data-testid="email-change-section">
      <p className="text-sm font-semibold">{ta("emailChangeHeading")}</p>
      {!enabled ? (
        <p className="text-xs text-text-dim" data-testid="email-change-limited">
          {ta("emailChangeLimitedNotice")}
        </p>
      ) : null}
      <form className="flex flex-col gap-2" onSubmit={handleSubmit} noValidate>
        <Input
          type="email"
          label={ta("emailChangeLabel")}
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!enabled || submitting}
        />
        <Button type="submit" size="sm" disabled={!enabled || submitting} className="w-fit">
          {ta("emailChangeSubmit")}
        </Button>
      </form>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-danger" : "text-text-dim"}`}>
          {message.text}
        </p>
      ) : null}
    </Surface>
  );
}
