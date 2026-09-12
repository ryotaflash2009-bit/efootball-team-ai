"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type AuthKey = keyof Dictionary["auth"];

/**
 * ヘッダー右側の最小限のアカウント導線(PC・モバイル共通、モバイルでもテキストは省略しアイコンのみ表示)。
 * Supabaseが未設定の環境では何も表示しない(既存機能への影響ゼロを優先)。
 * 読み込み中は同じ大きさのプレースホルダーを表示し、レイアウトのガタつきを避ける。
 */
export function HeaderAccountNav() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const session = useSupabaseSession();

  if (session.status === "unconfigured") return null;

  if (session.status === "loading") {
    return <span className="h-9 w-9 shrink-0 rounded-md bg-surface-2" aria-hidden="true" />;
  }

  if (session.status === "authenticated") {
    return (
      <Link
        href="/account"
        title={ta("navAccount")}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-xs text-text-dim transition-colors hover:border-accent hover:text-text"
      >
        <Icon name="shield" size={15} />
        <span className="hidden sm:inline">{ta("navAccount")}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/auth/sign-in"
      title={ta("navSignIn")}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-xs text-text-dim transition-colors hover:border-accent hover:text-text"
    >
      <Icon name="shield" size={15} />
      <span className="hidden sm:inline">{ta("navSignIn")}</span>
    </Link>
  );
}
