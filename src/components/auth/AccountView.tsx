"use client";

import "@/lib/i18n/dictionaries/ja-ns/auth";
import "@/lib/i18n/dictionaries/ja-ns/localDataMigration";
import "@/lib/i18n/dictionaries/ja-ns/myTeamCloud";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { isSignupOpen } from "@/lib/supabase/account-availability";
import { EmailChangeSection } from "@/components/auth/EmailChangeSection";
import { detectAllGuestData } from "@/lib/local-storage-scope/legacy-detect";
import { DATA_KINDS } from "@/lib/local-storage-scope/types";

type AuthKey = keyof Dictionary["auth"];

export function AccountView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const session = useSupabaseSession();
  const [signingOut, setSigningOut] = useState(false);
  // ゲスト（未ログイン）で保存したデータの件数（2026-10-11）。ログインしても自動ではコピーしない。本人が引き継ぎの画面で選ぶ。
  const [guestItemCount, setGuestItemCount] = useState(0);
  useEffect(() => {
    if (session.status !== "authenticated") return;
    const g = detectAllGuestData();
    setGuestItemCount(DATA_KINDS.reduce((n, k) => n + g[k].itemCount, 0));
  }, [session.status]);

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
                {isSignupOpen() ? ta("navSignUp") : ta("navSignUpLimited")}
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

          {guestItemCount > 0 ? (
            <Surface tone="outline" padding="md" className="flex flex-col gap-1.5" data-testid="account-guest-data-notice">
              <p className="text-sm text-text">{t("localDataMigration", "guestDataAccountNotice").replace("{count}", String(guestItemCount))}</p>
              <Link href="/account/local-data-migration?source=guest" className="w-fit text-sm text-accent hover:underline">
                {t("localDataMigration", "guestDataAccountLink")}
              </Link>
            </Surface>
          ) : null}

          <EmailChangeSection />

          <Surface tone="inset" padding="md" className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-text">{ta("accountCloudSyncNoticeTitle")}</p>
            <p className="text-sm text-text-dim">{ta("accountCloudSyncNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountLocalDataNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountNoAutoUploadNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountCrossDeviceNoticeDesc")}</p>
            <p className="text-sm text-text-dim">{ta("accountDeletionFutureNoticeDesc")}</p>
          </Surface>

          <Surface tone="outline" padding="md" className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-text-muted">{t("myTeamCloud", "devNoticeTitle")}</p>
            <Link href="/account/my-team-cloud" className="w-fit text-sm text-accent hover:underline">
              {t("myTeamCloud", "pageTitle")}
            </Link>
          </Surface>

          <Surface tone="outline" padding="md" className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-text-muted">{t("localDataMigration", "legacySummaryHeading")}</p>
            <Link href="/account/local-data-migration" className="w-fit text-sm text-accent hover:underline">
              {t("localDataMigration", "pageTitle")}
            </Link>
          </Surface>
        </div>
      )}
    </div>
  );
}
