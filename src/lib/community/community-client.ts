import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeShareToken, validateSharePayload, type SquadDiagnosisSharePayloadV1 } from "@/lib/squad/squad-diagnosis-share-url";

/**
 * コミュニティ 第 1 段階（F-053〜F-056・F-062・2026-10-14）のアクセス層。
 * サーバーは docs/production-readiness/sql/create-community-stage1-schema.sql の関数だけ（表へ直接は触らない）。
 *
 * - 他人は公開 ID だけで指す。user_id（内部の UUID）は送らない・受け取らない。
 * - Supabase の生のエラー文は外へ出さない（理由コードへ一般化する）。
 * - 見えない相手・ブロックの関係・存在しない ID は、どれも同じ「見つからない」になる（存在の推測を防ぐ）。
 */
export const COMMUNITY_CONTRACT_VERSION = "community/2026-10-14.v1";
const REQUEST_TIMEOUT_MS = 15000;

export const PROFILE_VISIBILITIES = ["private", "link", "friends", "public"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
export const COMMUNITY_REPORT_REASONS = ["spam", "harassment", "personal_info", "impersonation", "inappropriate_image", "rights_violation", "minor_safety", "other"] as const;
export type CommunityReportReason = (typeof COMMUNITY_REPORT_REASONS)[number];
export const REPORT_NOTE_MAX = 500;

export type CommunityError =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "FRIEND_LIMIT"
  | "PROFILE_REQUIRED"
  | "SELF"
  | "ID_TAKEN"
  | "ID_RESERVED"
  | "ID_RECENTLY_RELEASED"
  | "ID_CHANGE_TOO_SOON"
  | "INVALID_INPUT"
  | "RESTRICTED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK"
  | "UNKNOWN";
export type CommunityResult<T> = { ok: true; data: T } | { ok: false; error: CommunityError };

export interface MyProfile {
  publicId: string;
  displayName: string;
  visibility: ProfileVisibility;
  publicIdChangedAt: string;
  restricted: boolean;
}
export type Relation = "self" | "none" | "pending_outgoing" | "pending_incoming" | "friends" | "blocked";
export interface ProfileView {
  publicId: string;
  /** ブロックした相手は null（名前を残さない）。 */
  displayName: string | null;
  /** 本人のときだけ。 */
  visibility: ProfileVisibility | null;
  relation: Relation;
  blockedByMe: boolean;
  mutedByMe: boolean;
  isSelf: boolean;
  hasComparison: boolean;
}
export interface FriendEntry {
  publicId: string;
  displayName: string;
  state: "friends" | "pending_incoming" | "pending_outgoing";
  since: string;
}
export interface SafetyEntry {
  kind: "block" | "mute";
  publicId: string;
  createdAt: string;
}
export interface MyReport {
  id: number;
  targetPublicId: string;
  reason: CommunityReportReason;
  status: "open" | "reviewing" | "actioned" | "dismissed" | "withdrawn";
  createdAt: string;
}

/** 関数の例外（errcode・message）→ 理由コード。 */
export function classifyCommunityError(error: { code?: string | null; message?: string | null; status?: number | null } | null | undefined): CommunityError {
  if (!error) return "UNKNOWN";
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (error.status === 401 || code === "PGRST301" || code === "28000") return "UNAUTHENTICATED";
  if (code === "PGRST202" || code === "42883") return "UNAVAILABLE";
  switch (code) {
    case "P0010":
      return "NOT_FOUND";
    case "P0011":
      return "RATE_LIMITED";
    case "P0012":
      return "FRIEND_LIMIT";
    case "P0013":
      return "PROFILE_REQUIRED";
    case "P0014":
      return "SELF";
    case "P0016":
      return "RESTRICTED";
    case "P0001":
      return "ID_RESERVED";
    case "P0002":
      return "ID_CHANGE_TOO_SOON";
    case "P0003":
      return "ID_RECENTLY_RELEASED";
    case "23505":
      return "ID_TAKEN";
    case "23514":
    case "22023":
    case "22001":
      return "INVALID_INPUT";
  }
  if (/not_authenticated/.test(msg)) return "UNAUTHENTICATED";
  return "UNKNOWN";
}

class TimeoutError extends Error {}
function withTimeout<T>(promise: PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError("timeout")), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function rpc<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown> | undefined, map: (data: unknown) => T | null): Promise<CommunityResult<T>> {
  try {
    const { data, error } = await withTimeout(supabase.rpc(fn, args));
    if (error) return { ok: false, error: classifyCommunityError(error) };
    const mapped = map(data);
    return mapped === null ? { ok: false, error: "UNKNOWN" } : { ok: true, data: mapped };
  } catch (e) {
    return { ok: false, error: e instanceof TimeoutError ? "TIMEOUT" : "NETWORK" };
  }
}

const rows = (data: unknown): Record<string, unknown>[] => (Array.isArray(data) ? (data as Record<string, unknown>[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isVisibility = (v: unknown): v is ProfileVisibility => typeof v === "string" && (PROFILE_VISIBILITIES as readonly string[]).includes(v);
const text = (data: unknown): string | null => (typeof data === "string" ? data : null);

export function fetchMyProfile(supabase: SupabaseClient): Promise<CommunityResult<MyProfile | null>> {
  return rpc<{ v: MyProfile | null }>(supabase, "community_my_profile", undefined, (data) => {
    const r = rows(data)[0];
    if (!r) return { v: null };
    return { v: { publicId: str(r.public_id), displayName: str(r.display_name), visibility: isVisibility(r.visibility) ? r.visibility : "private", publicIdChangedAt: str(r.public_id_changed_at), restricted: r.restricted === true } };
  }).then((r) => (r.ok ? { ok: true as const, data: r.data.v } : r));
}

export function saveMyProfile(supabase: SupabaseClient, input: { publicId: string; displayName: string; visibility: ProfileVisibility }): Promise<CommunityResult<"created" | "updated">> {
  return rpc(supabase, "community_save_my_profile", { p_public_id: input.publicId, p_display_name: input.displayName, p_visibility: input.visibility }, (d) =>
    d === "created" || d === "updated" ? d : null,
  );
}

export function fetchProfile(supabase: SupabaseClient, publicId: string): Promise<CommunityResult<ProfileView | null>> {
  return rpc<{ v: ProfileView | null }>(supabase, "community_get_profile", { p_public_id: publicId }, (data) => {
    const r = rows(data)[0];
    if (!r) return { v: null };
    const relation = str(r.relation) as Relation;
    return {
      v: {
        publicId: str(r.public_id),
        displayName: typeof r.display_name === "string" ? r.display_name : null,
        visibility: isVisibility(r.visibility) ? r.visibility : null,
        relation: ["self", "none", "pending_outgoing", "pending_incoming", "friends", "blocked"].includes(relation) ? relation : "none",
        blockedByMe: r.blocked_by_me === true,
        mutedByMe: r.muted_by_me === true,
        isSelf: r.is_self === true,
        hasComparison: r.has_comparison === true,
      },
    };
  }).then((r) => (r.ok ? { ok: true as const, data: r.data.v } : r));
}

export function searchProfiles(supabase: SupabaseClient, q: string): Promise<CommunityResult<{ publicId: string; displayName: string }[]>> {
  return rpc(supabase, "community_search", { q }, (data) => rows(data).map((r) => ({ publicId: str(r.public_id), displayName: str(r.display_name) })));
}

export function requestFriend(supabase: SupabaseClient, publicId: string) {
  return rpc(supabase, "community_request_friend", { p_public_id: publicId }, (d) =>
    d === "requested" || d === "accepted" || d === "already_friends" || d === "already_requested" ? d : null,
  );
}
export function respondFriend(supabase: SupabaseClient, publicId: string, accept: boolean) {
  return rpc(supabase, "community_respond_friend", { p_public_id: publicId, p_accept: accept }, (d) => (d === "accepted" || d === "rejected" || d === "not_found" ? d : null));
}
export function removeFriend(supabase: SupabaseClient, publicId: string) {
  return rpc(supabase, "community_remove_friend", { p_public_id: publicId }, text);
}
export function listFriends(supabase: SupabaseClient): Promise<CommunityResult<FriendEntry[]>> {
  return rpc(supabase, "community_list_friends", undefined, (data) =>
    rows(data)
      .filter((r) => r.state === "friends" || r.state === "pending_incoming" || r.state === "pending_outgoing")
      .map((r) => ({ publicId: str(r.public_id), displayName: str(r.display_name), state: r.state as FriendEntry["state"], since: str(r.since) })),
  );
}

export function block(supabase: SupabaseClient, publicId: string) {
  return rpc(supabase, "community_block", { p_public_id: publicId }, text);
}
export function unblock(supabase: SupabaseClient, publicId: string) {
  return rpc(supabase, "community_unblock", { p_public_id: publicId }, text);
}
export function mute(supabase: SupabaseClient, publicId: string) {
  return rpc(supabase, "community_mute", { p_public_id: publicId }, text);
}
export function unmute(supabase: SupabaseClient, publicId: string) {
  return rpc(supabase, "community_unmute", { p_public_id: publicId }, text);
}
export function listSafety(supabase: SupabaseClient): Promise<CommunityResult<SafetyEntry[]>> {
  return rpc(supabase, "community_list_safety", undefined, (data) =>
    rows(data)
      .filter((r) => r.kind === "block" || r.kind === "mute")
      .map((r) => ({ kind: r.kind as SafetyEntry["kind"], publicId: str(r.public_id), createdAt: str(r.created_at) })),
  );
}

export function report(supabase: SupabaseClient, publicId: string, reason: CommunityReportReason, note: string) {
  return rpc(supabase, "community_report", { p_public_id: publicId, p_reason: reason, p_note: note.slice(0, REPORT_NOTE_MAX) }, (d) => (d === "reported" || d === "duplicate" ? d : null));
}
export function listMyReports(supabase: SupabaseClient): Promise<CommunityResult<MyReport[]>> {
  return rpc(supabase, "community_list_my_reports", undefined, (data) =>
    rows(data).map((r) => ({ id: Number(r.id), targetPublicId: str(r.target_public_id), reason: str(r.reason) as CommunityReportReason, status: str(r.status) as MyReport["status"], createdAt: str(r.created_at) })),
  );
}
export function withdrawReport(supabase: SupabaseClient, id: number) {
  return rpc(supabase, "community_withdraw_report", { p_id: id }, text);
}

/** 比較に使う要約を保存（共有 URL・sd1 のトークンから。アプリの厳密な検証を通ったものだけ）。 */
export function setComparison(supabase: SupabaseClient, payload: SquadDiagnosisSharePayloadV1) {
  if (validateSharePayload(payload) !== null) return Promise.resolve({ ok: false as const, error: "INVALID_INPUT" as const });
  return rpc(supabase, "community_set_comparison", { p_summary: payload }, (d) => (d === "saved" ? d : null));
}
export function clearComparison(supabase: SupabaseClient) {
  return rpc(supabase, "community_clear_comparison", undefined, text);
}
/** 本人または友達の要約。サーバーから来たものもアプリの検証を通し、通らなければ「無し」にする。 */
export function fetchComparison(supabase: SupabaseClient, publicId: string): Promise<CommunityResult<{ payload: SquadDiagnosisSharePayloadV1; updatedAt: string } | null>> {
  return rpc<{ v: { payload: SquadDiagnosisSharePayloadV1; updatedAt: string } | null }>(supabase, "community_get_comparison", { p_public_id: publicId }, (data) => {
    const r = rows(data)[0];
    if (!r || validateSharePayload(r.summary) !== null) return { v: null };
    return { v: { payload: r.summary as SquadDiagnosisSharePayloadV1, updatedAt: str(r.updated_at) } };
  }).then((r) => (r.ok ? { ok: true as const, data: r.data.v } : r));
}

/** 共有 URL（…/share/diagnosis#sd1.…）またはトークンだけの入力から要約を取り出す。 */
export function parseShareInput(input: string): SquadDiagnosisSharePayloadV1 | null {
  const s = input.trim();
  const hash = s.indexOf("#");
  const token = hash >= 0 ? s.slice(hash + 1) : s;
  const r = decodeShareToken(token);
  return r.ok ? r.payload : null;
}

/** /u/<公開 ID> の経路の値として正しい形か（画面で問い合わせる前の確認・詳しい規則はサーバー）。 */
export function isPublicIdLike(v: string): boolean {
  return /^[a-z][a-z0-9_]{2,19}$/.test(v);
}
