"use client";

import { useEffect, useState } from "react";
import { OAUTH_PREVIEW_SESSION_KEY, signInHrefFor } from "@/lib/supabase/oauth";

/**
 * ログインの画面への href（2026-10-11）。限定テスト（limited）で、このタブが `/auth/sign-in?oauthPreview=1` を開いたことがあれば、
 * ログアウトの後などの「ログイン」の導線も確認用の URL にする（表示の条件だけ。認証・callback には使わない）。
 * 通常の訪問者は確認用の URL を開かないので、通常の URL のまま（Google のボタンは出ない）。
 */
export function useSignInHref(): string {
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    try {
      setPreview(window.sessionStorage.getItem(OAUTH_PREVIEW_SESSION_KEY) === "1");
    } catch {
      /* 使えない環境は通常の URL */
    }
  }, []);
  return signInHrefFor(preview);
}
