"use client";

import "@/lib/i18n/dictionaries/ja-ns/community";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import { isCommunityAvailable } from "@/lib/supabase/community-mode";
import type { CommunityError } from "@/lib/community/community-client";

export type CommunityKey = keyof Dictionary["community"];

export function useCommunityT() {
  const t = useT();
  return useCallback((k: CommunityKey) => t("community", k), [t]);
}

/** 公開の状態（本番は COMMUNITY_MODE・ローカルは ?communityPreview=1）。描画の後に決める（水和の差を出さない）。 */
export function useCommunityAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(isCommunityAvailable(window.location.hostname, window.location.search, isLocalDevHostname));
  }, []);
  return available;
}

export async function communityClient() {
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
  return getSupabaseBrowserClient();
}

export function communityErrorKey(e: CommunityError): CommunityKey {
  switch (e) {
    case "UNAUTHENTICATED":
      return "errorUnauthenticated";
    case "NOT_FOUND":
      return "errorNotFound";
    case "RATE_LIMITED":
      return "errorRateLimited";
    case "FRIEND_LIMIT":
      return "errorFriendLimit";
    case "PROFILE_REQUIRED":
      return "errorProfileRequired";
    case "SELF":
      return "errorSelf";
    case "ID_TAKEN":
      return "errorIdTaken";
    case "ID_RESERVED":
      return "errorIdReserved";
    case "ID_RECENTLY_RELEASED":
      return "errorIdRecentlyReleased";
    case "ID_CHANGE_TOO_SOON":
      return "errorIdChangeTooSoon";
    case "INVALID_INPUT":
      return "errorInvalidInput";
    case "RESTRICTED":
      return "errorRestricted";
    case "UNAVAILABLE":
      return "unavailableNotice";
    case "NOT_OPTED_IN":
      return "errorRivalNotOptedIn";
    case "OTHER_NOT_OPTED_IN":
      return "errorRivalOtherNotOptedIn";
    case "RIVAL_LIMIT":
      return "errorRivalLimit";
    default:
      return "errorGeneric";
  }
}

export type Message = { tone: "ok" | "error"; text: string } | null;

export function MessageLine({ message, testId }: { message: Message; testId: string }) {
  if (!message) return null;
  return (
    <p role={message.tone === "error" ? "alert" : "status"} className={`text-xs ${message.tone === "error" ? "text-danger" : "text-success"}`} data-testid={testId}>
      {message.text}
    </p>
  );
}
