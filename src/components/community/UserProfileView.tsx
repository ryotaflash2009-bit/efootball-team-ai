"use client";

import "@/lib/i18n/dictionaries/ja-ns/community";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { useSignInHref } from "@/components/auth/useSignInHref";
import { diagnosisCategoryLabel } from "@/components/squad/SharedDiagnosisView";
import { SHARE_CATEGORY_IDS, type SquadDiagnosisSharePayloadV1 } from "@/lib/squad/squad-diagnosis-share-url";
import {
  COMMUNITY_REPORT_REASONS,
  REPORT_NOTE_MAX,
  block,
  fetchComparison,
  fetchMyProfile,
  fetchProfile,
  isPublicIdLike,
  mute,
  removeFriend,
  report,
  requestFriend,
  respondFriend,
  unblock,
  unmute,
  type CommunityReportReason,
  type ProfileView,
} from "@/lib/community/community-client";
import { communityClient, communityErrorKey, MessageLine, useCommunityAvailable, useCommunityT, type CommunityKey, type Message } from "./community-shared";

type Summary = SquadDiagnosisSharePayloadV1;

/**
 * 利用者の公開プロフィール（/u/<公開 ID>・F-053〜F-056・F-062・2026-10-14）。ログインが必要・noindex。
 * 見えない相手・存在しない ID・ブロックの関係は、どれも同じ「表示できません」になる。
 */
export function UserProfileView({ publicId }: { publicId: string }) {
  const tc = useCommunityT();
  const { displayLocale } = useLocale();
  const signInHref = useSignInHref();
  const session = useSupabaseSession();
  const available = useCommunityAvailable();
  const id = publicId.toLowerCase();

  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [view, setView] = useState<ProfileView | null>(null);
  const [mine, setMine] = useState<Summary | null>(null);
  const [theirs, setTheirs] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<CommunityReportReason>("spam");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!isPublicIdLike(id)) return setState("missing");
    const supabase = await communityClient();
    if (!supabase) return setState("missing");
    const r = await fetchProfile(supabase, id);
    if (!r.ok) {
      setMessage({ tone: "error", text: tc(communityErrorKey(r.error)) });
      return setState("missing");
    }
    if (!r.data) return setState("missing");
    setView(r.data);
    setState("ready");
    if (r.data.relation === "friends" && r.data.hasComparison) {
      const [me, t] = await Promise.all([fetchMyProfile(supabase), fetchComparison(supabase, id)]);
      setTheirs(t.ok ? (t.data?.payload ?? null) : null);
      if (me.ok && me.data) {
        const m = await fetchComparison(supabase, me.data.publicId);
        setMine(m.ok ? (m.data?.payload ?? null) : null);
      }
    } else {
      setTheirs(null);
    }
  }, [id, tc]);

  useEffect(() => {
    if (session.status === "authenticated" && available) void load();
  }, [session.status, available, load]);

  async function act(fn: (s: NonNullable<Awaited<ReturnType<typeof communityClient>>>) => Promise<{ ok: true; data: unknown } | { ok: false; error: Parameters<typeof communityErrorKey>[0] }>, okKey: (data: unknown) => CommunityKey) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const supabase = await communityClient();
      if (!supabase) return setMessage({ tone: "error", text: tc("errorGeneric") });
      const r = await fn(supabase);
      setMessage(r.ok ? { tone: "ok", text: tc(okKey(r.data)) } : { tone: "error", text: tc(communityErrorKey(r.error)) });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const header = <PageHeader title={tc("profilePageTitle")} icon="community" description={tc("profilePageBody")} />;
  if (session.status !== "authenticated") {
    return (
      <div className="flex flex-col gap-4" data-testid="user-profile">
        {header}
        <Surface padding="md" className="text-sm" data-testid="user-profile-signin">
          <p>{tc("profileSignInRequired")}</p>
          <Link href={signInHref} className="mt-2 inline-block text-accent hover:underline">
            {tc("signInLink")}
          </Link>
        </Surface>
      </div>
    );
  }
  if (!available) {
    return (
      <div className="flex flex-col gap-4" data-testid="user-profile">
        {header}
        <Surface padding="md" className="text-sm text-text-dim" data-testid="user-profile-unavailable">
          {tc("unavailableNotice")}
        </Surface>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="user-profile">
      {header}
      <MessageLine message={message} testId="user-profile-message" />
      {state === "loading" ? (
        <Surface padding="md" className="text-sm text-text-dim">
          {tc("loading")}
        </Surface>
      ) : state === "missing" || !view ? (
        <Surface padding="md" className="text-sm" data-testid="user-profile-missing">
          <p>{tc("profileMissing")}</p>
          <Link href="/account/community" className="mt-2 inline-block text-accent hover:underline">
            {tc("backToCommunity")}
          </Link>
        </Surface>
      ) : view.relation === "blocked" ? (
        <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="user-profile-blocked">
          <p>{fillMessage(tc("blockedProfileTemplate"), { id: view.publicId })}</p>
          <Button size="sm" variant="secondary" onClick={() => act((s) => unblock(s, view.publicId), () => "unblocked")} disabled={busy} data-testid="user-profile-unblock">
            {tc("unblockButton")}
          </Button>
        </Surface>
      ) : (
        <>
          <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="user-profile-card">
            <p className="text-lg font-semibold" data-testid="user-profile-name">
              {view.displayName}
            </p>
            <p className="text-xs text-text-muted">@{view.publicId}</p>
            <p className="text-xs" data-testid="user-profile-relation">
              {tc(`relation_${view.relation}` as CommunityKey)}
            </p>
            {view.isSelf ? (
              <Link href="/account/community" className="w-fit text-xs text-accent hover:underline">
                {tc("editOwnProfile")}
              </Link>
            ) : (
              <div className="flex flex-wrap gap-2">
                {view.relation === "none" ? (
                  <Button size="sm" onClick={() => act((s) => requestFriend(s, view.publicId), (d) => (d === "accepted" ? "friendAccepted" : "friendRequested"))} disabled={busy} data-testid="user-profile-request">
                    {tc("requestButton")}
                  </Button>
                ) : null}
                {view.relation === "pending_outgoing" ? (
                  <Button size="sm" variant="secondary" onClick={() => act((s) => removeFriend(s, view.publicId), () => "friendRequestCancelled")} disabled={busy} data-testid="user-profile-cancel">
                    {tc("cancelRequestButton")}
                  </Button>
                ) : null}
                {view.relation === "pending_incoming" ? (
                  <>
                    <Button size="sm" onClick={() => act((s) => respondFriend(s, view.publicId, true), () => "friendAccepted")} disabled={busy} data-testid="user-profile-accept">
                      {tc("acceptButton")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => act((s) => respondFriend(s, view.publicId, false), () => "friendRejected")} disabled={busy}>
                      {tc("rejectButton")}
                    </Button>
                  </>
                ) : null}
                {view.relation === "friends" ? (
                  <Button size="sm" variant="secondary" onClick={() => act((s) => removeFriend(s, view.publicId), () => "friendRemoved")} disabled={busy} data-testid="user-profile-remove">
                    {tc("removeFriendButton")}
                  </Button>
                ) : null}
              </div>
            )}
          </Surface>

          {view.relation === "friends" ? (
            <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="user-profile-compare">
              <h2 className="font-semibold">{tc("compareHeading")}</h2>
              {!theirs ? (
                <p className="text-xs text-text-muted">{tc("compareTheirsNone")}</p>
              ) : !mine ? (
                <p className="text-xs text-text-muted">
                  {tc("compareMineNone")}{" "}
                  <Link href="/account/community" className="text-accent hover:underline">
                    {tc("backToCommunity")}
                  </Link>
                </p>
              ) : mine.r !== theirs.r ? (
                <p className="text-xs text-text-muted" data-testid="user-profile-compare-version">
                  {tc("compareDifferentVersion")}
                </p>
              ) : (
                <CompareTable mine={mine} theirs={theirs} labels={{ item: tc("compareItem"), mine: tc("compareMine"), theirs: tc("compareTheirs"), diff: tc("compareDiff"), overall: tc("compareOverall") }} categoryLabel={(c) => diagnosisCategoryLabel(c, displayLocale)} />
              )}
              <p className="text-2xs text-text-muted">{tc("compareNotice")}</p>
            </Surface>
          ) : null}

          {!view.isSelf ? (
            <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="user-profile-safety">
              <h2 className="font-semibold">{tc("safetyActionsHeading")}</h2>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => act((s) => (view.mutedByMe ? unmute(s, view.publicId) : mute(s, view.publicId)), () => (view.mutedByMe ? "unmuted" : "muted"))} disabled={busy} data-testid="user-profile-mute">
                  {tc(view.mutedByMe ? "unmuteButton" : "muteButton")}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmBlock(true)} disabled={busy} data-testid="user-profile-block">
                  {tc("blockButton")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setReportOpen((v) => !v)} disabled={busy} data-testid="user-profile-report-open">
                  {tc("reportButton")}
                </Button>
              </div>
              <p className="text-2xs text-text-muted">{tc("muteBlockHelp")}</p>
              {confirmBlock ? (
                <div role="alertdialog" className="flex flex-col gap-2 rounded-md border border-danger/50 bg-danger/5 p-3 text-xs" data-testid="user-profile-block-confirm">
                  <p>{tc("blockConfirm")}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setConfirmBlock(false);
                        void act((s) => block(s, view.publicId), () => "blocked");
                      }}
                      data-testid="user-profile-block-yes"
                    >
                      {tc("blockConfirmButton")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmBlock(false)}>
                      {tc("cancelButton")}
                    </Button>
                  </div>
                </div>
              ) : null}
              {reportOpen ? (
                <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs" data-testid="user-profile-report-form">
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">{tc("reportReasonLabel")}</span>
                    <select className="rounded-md border border-border bg-surface px-2 py-1.5" value={reason} onChange={(e) => setReason(e.target.value as CommunityReportReason)} data-testid="user-profile-report-reason">
                      {COMMUNITY_REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {tc(`reason_${r}` as CommunityKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">{tc("reportNoteLabel")}</span>
                    <textarea className="h-20 rounded-md border border-border bg-surface px-2 py-1.5" value={note} maxLength={REPORT_NOTE_MAX} onChange={(e) => setNote(e.target.value)} data-testid="user-profile-report-note" />
                    <span className="text-2xs text-text-muted">{tc("reportNoteHelp")}</span>
                  </label>
                  {reason === "minor_safety" ? <p className="text-2xs text-danger">{tc("reportEmergencyNotice")}</p> : null}
                  <Button
                    size="sm"
                    onClick={() => {
                      void act((s) => report(s, view.publicId, reason, note), (d) => (d === "duplicate" ? "reportDuplicate" : "reported")).then(() => {
                        setReportOpen(false);
                        setNote("");
                      });
                    }}
                    disabled={busy}
                    data-testid="user-profile-report-submit"
                  >
                    {tc("reportSubmitButton")}
                  </Button>
                  <p className="text-2xs text-text-muted">{tc("reportProcessNotice")}</p>
                </div>
              ) : null}
            </Surface>
          ) : null}
        </>
      )}
    </div>
  );
}

function CompareTable({
  mine,
  theirs,
  labels,
  categoryLabel,
}: {
  mine: Summary;
  theirs: Summary;
  labels: { item: string; mine: string; theirs: string; diff: string; overall: string };
  categoryLabel: (id: (typeof SHARE_CATEGORY_IDS)[number]) => string;
}) {
  const rows = [
    { key: "overall", label: labels.overall, a: mine.o[0], b: theirs.o[0] },
    ...SHARE_CATEGORY_IDS.map((id) => ({ key: id, label: categoryLabel(id), a: mine.c[id][0], b: theirs.c[id][0] })),
  ];
  return (
    <table className="w-full text-xs" data-testid="user-profile-compare-table">
      <thead>
        <tr className="text-text-muted">
          <th className="text-start font-normal">{labels.item}</th>
          <th className="text-end font-normal">{labels.mine}</th>
          <th className="text-end font-normal">{labels.theirs}</th>
          <th className="text-end font-normal">{labels.diff}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const d = r.a != null && r.b != null ? r.a - r.b : null;
          return (
            <tr key={r.key} className="border-t border-border">
              <td className="py-1">{r.label}</td>
              <td className="text-end tabular-nums">{r.a ?? "—"}</td>
              <td className="text-end tabular-nums">{r.b ?? "—"}</td>
              <td className={`text-end tabular-nums ${d == null || d === 0 ? "" : d > 0 ? "text-success" : "text-danger"}`}>{d == null ? "—" : d > 0 ? `+${d}` : String(d)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
