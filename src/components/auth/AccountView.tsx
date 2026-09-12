"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

export function AccountView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const session = useSupabaseSession();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return; // 連打防止
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("accountPageTitle")} icon="shield" />

      {session.status === "loading" ? (
        <Surface padding="md">
          <p className="text-sm text-text-dim">{ta("checkingSessionMessage")}</p>
        </Surface>
      ) : session.status === "unconfigured" ? (
        <Surface tone="outline" padding="md">
          <p className="text-sm text-text-dim">{ta("genericErrorMessage")}</p>
        </Surface>
      ) : session.status === "unauthenticated" ? (
        <Surface padding="md" className="flex flex-col gap-3">
          <p className="text-sm text-text-dim">{ta("accountLoginRequiredMessage")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/auth/sign-in">
              <Button variant="primary" size="sm">
                {ta("navSignIn")}
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button variant="secondary" size="sm">
                {ta("navSignUp")}
              </Button>
            </Link>
          </div>
        </Surface>
      ) : (
        <div className="flex flex-col gap-4">
          <Surface padding="md" className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-success">{ta("accountLoggedInLabel")}</p>
            <p className="text-sm text-text-dim">
              {ta("accountEmailLabel")}: {session.email ?? "-"}
            </p>
            <Button variant="secondary" size="sm" onClick={handleLogout} disabled={signingOut} className="w-fit">
              {signingOut ? ta("logoutProcessingMessage") : ta("logoutButton")}
            </Button>
          </Surface>

          <Surface tone="inset" padding="md" className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-text">{ta("accountCloudSyncNoticeTitle")}</p>
            <p className="text-sm text-text-dim">{ta("accountCloudSyncNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountLocalDataNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountNoAutoUploadNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountCrossDeviceNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountDeletionFutureNoticeDesc")}</p>
          </Surface>

          <Surface tone="outline" padding="md" className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-text-muted">{t("rlsTest", "devNoticeTitle")}</p>
            <Link href="/account/rls-test" className="w-fit text-sm text-accent hover:underline">
              {t("rlsTest", "pageTitle")}
            </Link>
          </Surface>
        </div>
      )}
    </div>
  );
}
