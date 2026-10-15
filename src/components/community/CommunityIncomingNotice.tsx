"use client";

import "@/lib/i18n/dictionaries/ja-ns/community";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fillMessage } from "@/lib/i18n/message-format";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { listFriends } from "@/lib/community/community-client";
import { communityClient, useCommunityAvailable, useCommunityT } from "./community-shared";

/**
 * F-121 アプリ内の通知（2026-10-14・最小）: アカウントの画面で、届いた友達の申請の件数を知らせる。
 * メール・プッシュの通知はしない（メールはドメインの後）。ログイン済み・コミュニティが有効なときだけ 1 回読む。0 件なら何も出さない。
 */
export function CommunityIncomingNotice() {
  const tc = useCommunityT();
  const session = useSupabaseSession();
  const available = useCommunityAvailable();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (session.status !== "authenticated" || !available) return;
    let cancelled = false;
    void (async () => {
      const supabase = await communityClient();
      if (!supabase) return;
      const r = await listFriends(supabase);
      if (!cancelled && r.ok) setCount(r.data.filter((f) => f.state === "pending_incoming").length);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.status, available]);

  if (count === 0) return null;
  return (
    <p role="status" className="rounded-md border border-accent/50 bg-accent/5 px-3 py-2 text-xs" data-testid="community-incoming-notice">
      <Link href="/account/community" className="text-accent hover:underline">
        {fillMessage(tc("incomingNoticeTemplate"), { count: String(count) })}
      </Link>
    </p>
  );
}
