"use client";

import "@/lib/i18n/dictionaries/ja-ns/community";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fillMessage } from "@/lib/i18n/message-format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { useSignInHref } from "@/components/auth/useSignInHref";
import { validateDisplayName, validatePublicId, canChangePublicId } from "@/lib/profile/public-id";
import {
  PROFILE_VISIBILITIES,
  clearComparison,
  fetchComparison,
  fetchMyProfile,
  listFriends,
  listMyReports,
  listSafety,
  parseShareInput,
  removeFriend,
  respondFriend,
  saveMyProfile,
  searchProfiles,
  setComparison,
  unblock,
  unmute,
  withdrawReport,
  isPublicIdLike,
  type FriendEntry,
  type MyProfile,
  type MyReport,
  type ProfileVisibility,
  type SafetyEntry,
} from "@/lib/community/community-client";
import type { SquadDiagnosisSharePayloadV1 } from "@/lib/squad/squad-diagnosis-share-url";
import { RivalsSection } from "./RivalsSection";
import { communityClient, communityErrorKey, MessageLine, useCommunityAvailable, useCommunityT, type CommunityKey, type Message } from "./community-shared";

const VISIBILITY_KEY: Record<ProfileVisibility, CommunityKey> = {
  private: "visibilityPrivate",
  link: "visibilityLink",
  friends: "visibilityFriends",
  public: "visibilityPublic",
};

/**
 * コミュニティ（F-053〜F-056・F-062・2026-10-14）: 公開プロフィール・友達・比較に使う診断・ブロック/ミュート・通報の記録。
 *
 * - 公開の状態は COMMUNITY_MODE。無効の間は準備中の案内だけで、Supabase を呼ばない。
 * - プロフィールの既定は非公開。他人は公開 ID だけで指す（内部の ID は扱わない）。
 * - 読み込みはログイン済みで有効なときだけ。操作はボタンからだけ。
 */
export function CommunityView() {
  const tc = useCommunityT();
  const router = useRouter();
  const signInHref = useSignInHref();
  const session = useSupabaseSession();
  const available = useCommunityAvailable();

  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [safety, setSafety] = useState<SafetyEntry[]>([]);
  const [reports, setReports] = useState<MyReport[]>([]);
  const [comparison, setComparisonState] = useState<{ payload: SquadDiagnosisSharePayloadV1; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // プロフィールの入力
  const [idInput, setIdInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [visibilityInput, setVisibilityInput] = useState<ProfileVisibility>("private");
  // 比較・検索・ID で開く
  const [shareInput, setShareInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<{ publicId: string; displayName: string }[] | null>(null);
  const [openIdInput, setOpenIdInput] = useState("");

  const load = useCallback(async () => {
    const supabase = await communityClient();
    if (!supabase) return;
    const [p, f, s, r] = await Promise.all([fetchMyProfile(supabase), listFriends(supabase), listSafety(supabase), listMyReports(supabase)]);
    if (!p.ok) {
      setMessage({ tone: "error", text: tc(communityErrorKey(p.error)) });
      setLoaded(true);
      return;
    }
    setProfile(p.data);
    if (p.data) {
      setIdInput(p.data.publicId);
      setNameInput(p.data.displayName);
      setVisibilityInput(p.data.visibility);
      const c = await fetchComparison(supabase, p.data.publicId);
      setComparisonState(c.ok ? c.data : null);
    }
    if (f.ok) setFriends(f.data);
    if (s.ok) setSafety(s.data);
    if (r.ok) setReports(r.data);
    setLoaded(true);
  }, [tc]);

  useEffect(() => {
    if (session.status === "authenticated" && available && !loaded) void load();
  }, [session.status, available, loaded, load]);

  // 診断の共有から来たとき（/account/community#sd1.…）は、比較に使う診断の欄へ入れておく（自動では保存しない）
  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith("#sd")) setShareInput(window.location.href);
  }, []);

  async function run(fn: () => Promise<Message>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const m = await fn();
      setMessage(m);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const idCheck = validatePublicId(idInput);
  const nameCheck = validateDisplayName(nameInput);
  const idChanged = profile != null && idCheck.normalized !== profile.publicId;
  const changeAllowed = profile == null || !idChanged || canChangePublicId(profile.publicIdChangedAt || null, new Date()).ok;

  async function saveProfile() {
    if (!idCheck.ok) return setMessage({ tone: "error", text: tc("errorIdFormat") });
    if (!nameCheck.ok) return setMessage({ tone: "error", text: tc("errorNameFormat") });
    if (!changeAllowed) return setMessage({ tone: "error", text: tc("errorIdChangeTooSoon") });
    await run(async () => {
      const supabase = await communityClient();
      if (!supabase) return { tone: "error", text: tc("errorGeneric") };
      const r = await saveMyProfile(supabase, { publicId: idCheck.normalized, displayName: nameCheck.normalized, visibility: visibilityInput });
      return r.ok ? { tone: "ok", text: tc(r.data === "created" ? "profileCreated" : "profileSaved") } : { tone: "error", text: tc(communityErrorKey(r.error)) };
    });
  }

  async function saveComparison() {
    const payload = parseShareInput(shareInput);
    if (!payload) return setMessage({ tone: "error", text: tc("errorShareInput") });
    await run(async () => {
      const supabase = await communityClient();
      if (!supabase) return { tone: "error", text: tc("errorGeneric") };
      const r = await setComparison(supabase, payload);
      if (r.ok) setShareInput("");
      return r.ok ? { tone: "ok", text: tc("comparisonSaved") } : { tone: "error", text: tc(communityErrorKey(r.error)) };
    });
  }

  async function search() {
    const q = searchInput.trim().toLowerCase();
    if (q.length < 3) return setMessage({ tone: "error", text: tc("searchTooShort") });
    setBusy(true);
    const supabase = await communityClient();
    const r = supabase ? await searchProfiles(supabase, q) : null;
    setBusy(false);
    if (r?.ok) setSearchResults(r.data);
    else setMessage({ tone: "error", text: tc(r ? communityErrorKey(r.error) : "errorGeneric") });
  }

  function openById() {
    const id = openIdInput.trim().toLowerCase();
    if (!isPublicIdLike(id)) return setMessage({ tone: "error", text: tc("errorIdFormat") });
    router.push(`/u/${id}`);
  }

  const simple = (fn: (s: NonNullable<Awaited<ReturnType<typeof communityClient>>>) => Promise<{ ok: boolean; error?: Parameters<typeof communityErrorKey>[0] }>, okKey: CommunityKey) =>
    run(async () => {
      const supabase = await communityClient();
      if (!supabase) return { tone: "error", text: tc("errorGeneric") };
      const r = await fn(supabase);
      return r.ok ? { tone: "ok", text: tc(okKey) } : { tone: "error", text: tc(communityErrorKey(r.error ?? "UNKNOWN")) };
    });

  const incoming = friends.filter((f) => f.state === "pending_incoming");
  const outgoing = friends.filter((f) => f.state === "pending_outgoing");
  const accepted = friends.filter((f) => f.state === "friends");
  const inputClass = "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm";

  return (
    <div className="flex flex-col gap-4" data-testid="community">
      <PageHeader title={tc("pageTitle")} icon="community" description={tc("introBody")} />
      <Surface tone="outline" padding="md" className="flex flex-col gap-1 text-xs text-text-dim">
        <p>{tc("safetyNotice")}</p>
        <p>{tc("noIndexNotice")}</p>
      </Surface>

      {session.status !== "authenticated" ? (
        <Surface padding="md" className="text-sm" data-testid="community-signin">
          <p>{tc("signInRequired")}</p>
          <Link href={signInHref} className="mt-2 inline-block text-accent hover:underline">
            {tc("signInLink")}
          </Link>
        </Surface>
      ) : !available ? (
        <Surface padding="md" className="text-sm text-text-dim" data-testid="community-unavailable">
          {tc("unavailableNotice")}
        </Surface>
      ) : !loaded ? (
        <Surface padding="md" className="text-sm text-text-dim">
          {tc("loading")}
        </Surface>
      ) : (
        <>
          <MessageLine message={message} testId="community-message" />

          {/* プロフィール（F-053・F-054） */}
          <Surface padding="md" className="flex flex-col gap-3 text-sm" data-testid="community-profile">
            <h2 className="font-semibold">{tc("profileHeading")}</h2>
            {profile?.restricted ? <p className="text-xs text-danger" data-testid="community-restricted">{tc("restrictedNotice")}</p> : null}
            {profile ? (
              <p className="text-xs">
                {tc("profileUrlLabel")}{" "}
                <Link href={`/u/${profile.publicId}`} className="text-accent hover:underline" data-testid="community-profile-link">
                  /u/{profile.publicId}
                </Link>
              </p>
            ) : (
              <p className="text-xs text-text-dim">{tc("profileNone")}</p>
            )}
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold">{tc("publicIdLabel")}</span>
              <input className={inputClass} value={idInput} onChange={(e) => setIdInput(e.target.value)} maxLength={20} autoComplete="off" spellCheck={false} data-testid="community-id-input" />
              <span className="text-2xs text-text-muted">{tc("publicIdHelp")}</span>
              {idInput && !idCheck.ok ? <span className="text-2xs text-danger">{tc("errorIdFormat")}</span> : null}
              {idChanged && profile && !changeAllowed ? <span className="text-2xs text-danger">{tc("errorIdChangeTooSoon")}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold">{tc("displayNameLabel")}</span>
              <input className={inputClass} value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={40} autoComplete="off" data-testid="community-name-input" />
              <span className="text-2xs text-text-muted">{tc("displayNameHelp")}</span>
              {nameInput && !nameCheck.ok ? <span className="text-2xs text-danger">{tc("errorNameFormat")}</span> : null}
            </label>
            <fieldset className="flex flex-col gap-1 text-xs">
              <legend className="mb-1 font-semibold">{tc("visibilityLabel")}</legend>
              {PROFILE_VISIBILITIES.map((v) => (
                <label key={v} className="inline-flex items-start gap-2">
                  <input type="radio" name="community-visibility" value={v} checked={visibilityInput === v} onChange={() => setVisibilityInput(v)} data-testid={`community-visibility-${v}`} />
                  <span>{tc(VISIBILITY_KEY[v])}</span>
                </label>
              ))}
            </fieldset>
            <Button size="sm" onClick={saveProfile} disabled={busy || !idCheck.ok || !nameCheck.ok} data-testid="community-profile-save">
              {profile ? tc("profileSaveButton") : tc("profileCreateButton")}
            </Button>
          </Surface>

          {/* 友達との比較に使う診断（F-062） */}
          <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="community-comparison">
            <h2 className="font-semibold">{tc("comparisonHeading")}</h2>
            <p className="text-xs text-text-dim">{tc("comparisonBody")}</p>
            <p className="text-xs" data-testid="community-comparison-status">
              {comparison ? fillMessage(tc("comparisonCurrentTemplate"), { score: String(comparison.payload.o[0] ?? "—"), date: comparison.payload.d }) : tc("comparisonNone")}
            </p>
            <textarea className={`${inputClass} h-16 font-mono text-2xs`} value={shareInput} onChange={(e) => setShareInput(e.target.value)} placeholder={tc("comparisonPlaceholder")} data-testid="community-share-input" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveComparison} disabled={busy || !profile || shareInput.trim() === ""} data-testid="community-comparison-save">
                {tc("comparisonSaveButton")}
              </Button>
              {comparison ? (
                <Button size="sm" variant="secondary" onClick={() => simple((s) => clearComparison(s), "comparisonCleared")} disabled={busy} data-testid="community-comparison-clear">
                  {tc("comparisonClearButton")}
                </Button>
              ) : null}
            </div>
            {!profile ? <p className="text-2xs text-text-muted">{tc("profileRequiredHint")}</p> : null}
            <Link href="/squads" className="w-fit text-xs text-accent hover:underline">
              {tc("comparisonHowTo")}
            </Link>
          </Surface>

          {/* ライバル（F-062・オプトイン） */}
          <RivalsSection hasProfile={profile != null} />

          {/* 友達（F-055） */}
          <Surface padding="md" className="flex flex-col gap-3 text-sm" data-testid="community-friends">
            <h2 className="font-semibold">{tc("friendsHeading")}</h2>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold">{tc("openByIdLabel")}</span>
              <div className="flex gap-2">
                <input className={inputClass} value={openIdInput} onChange={(e) => setOpenIdInput(e.target.value)} placeholder="taro_01" autoComplete="off" spellCheck={false} data-testid="community-open-id-input" />
                <Button size="sm" variant="secondary" onClick={openById} data-testid="community-open-id">
                  {tc("openButton")}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold">{tc("searchLabel")}</span>
              <div className="flex gap-2">
                <input className={inputClass} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} autoComplete="off" spellCheck={false} data-testid="community-search-input" />
                <Button size="sm" variant="secondary" onClick={search} disabled={busy} data-testid="community-search">
                  {tc("searchButton")}
                </Button>
              </div>
              <span className="text-2xs text-text-muted">{tc("searchHelp")}</span>
              {searchResults ? (
                searchResults.length === 0 ? (
                  <p className="text-text-muted" data-testid="community-search-empty">{tc("searchEmpty")}</p>
                ) : (
                  <ul className="flex flex-col gap-1" data-testid="community-search-results">
                    {searchResults.map((r) => (
                      <li key={r.publicId}>
                        <Link href={`/u/${r.publicId}`} className="text-accent hover:underline">
                          {r.displayName} <span className="text-text-muted">@{r.publicId}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>

            <div className="flex flex-col gap-1 text-xs" data-testid="community-incoming">
              <span className="font-semibold">{fillMessage(tc("incomingHeadingTemplate"), { count: String(incoming.length) })}</span>
              {incoming.map((f) => (
                <div key={f.publicId} className="flex flex-wrap items-center gap-2">
                  <Link href={`/u/${f.publicId}`} className="text-accent hover:underline">
                    {f.displayName} <span className="text-text-muted">@{f.publicId}</span>
                  </Link>
                  <Button size="sm" onClick={() => simple((s) => respondFriend(s, f.publicId, true), "friendAccepted")} disabled={busy} data-testid={`community-accept-${f.publicId}`}>
                    {tc("acceptButton")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => simple((s) => respondFriend(s, f.publicId, false), "friendRejected")} disabled={busy} data-testid={`community-reject-${f.publicId}`}>
                    {tc("rejectButton")}
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 text-xs" data-testid="community-friend-list">
              <span className="font-semibold">{fillMessage(tc("friendsListHeadingTemplate"), { count: String(accepted.length) })}</span>
              {accepted.length === 0 ? <p className="text-text-muted">{tc("friendsEmpty")}</p> : null}
              {accepted.map((f) => (
                <Link key={f.publicId} href={`/u/${f.publicId}`} className="w-fit text-accent hover:underline">
                  {f.displayName} <span className="text-text-muted">@{f.publicId}</span>
                </Link>
              ))}
            </div>

            {outgoing.length > 0 ? (
              <div className="flex flex-col gap-1 text-xs" data-testid="community-outgoing">
                <span className="font-semibold">{tc("outgoingHeading")}</span>
                {outgoing.map((f) => (
                  <div key={f.publicId} className="flex flex-wrap items-center gap-2">
                    <span>
                      {f.displayName} <span className="text-text-muted">@{f.publicId}</span>
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => simple((s) => removeFriend(s, f.publicId), "friendRequestCancelled")} disabled={busy}>
                      {tc("cancelRequestButton")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </Surface>

          {/* ブロック・ミュート・通報の記録（F-056） */}
          <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="community-safety">
            <h2 className="font-semibold">{tc("safetyHeading")}</h2>
            <p className="text-xs text-text-dim">{tc("safetyBody")}</p>
            {safety.length === 0 ? <p className="text-xs text-text-muted">{tc("safetyEmpty")}</p> : null}
            {safety.map((e) => (
              <div key={`${e.kind}-${e.publicId}`} className="flex flex-wrap items-center gap-2 text-xs">
                <span>
                  {tc(e.kind === "block" ? "blockedLabel" : "mutedLabel")} @{e.publicId}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => simple((s) => (e.kind === "block" ? unblock(s, e.publicId) : unmute(s, e.publicId)), e.kind === "block" ? "unblocked" : "unmuted")}
                  disabled={busy}
                  data-testid={`community-un${e.kind}-${e.publicId}`}
                >
                  {tc(e.kind === "block" ? "unblockButton" : "unmuteButton")}
                </Button>
              </div>
            ))}
            <h3 className="mt-2 text-xs font-semibold">{tc("myReportsHeading")}</h3>
            {reports.length === 0 ? <p className="text-xs text-text-muted">{tc("myReportsEmpty")}</p> : null}
            <ul className="flex flex-col gap-1 text-xs" data-testid="community-reports">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    @{r.targetPublicId} · {tc(`reason_${r.reason}` as CommunityKey)} · {tc(`reportStatus_${r.status}` as CommunityKey)}
                  </span>
                  {r.status === "open" ? (
                    <Button size="sm" variant="secondary" onClick={() => simple((s) => withdrawReport(s, r.id), "reportWithdrawn")} disabled={busy}>
                      {tc("withdrawButton")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-2xs text-text-muted">{tc("reportProcessNotice")}</p>
          </Surface>
        </>
      )}
    </div>
  );
}
