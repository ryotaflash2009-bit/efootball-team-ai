import { BANNED_DISPLAY_TERMS_JA } from "./public-id";
import type { SavedBuild } from "@/lib/progression/types";

/**
 * 公開プロフィール・公開ビルドの契約（2026-10-07・モック・Production に接続しない・純関数）。
 * 公開 ID（F-053）・ブロック（`user_blocks`）・友達（`social/friends.ts`）の上に作る。保存・表示の画面は本人の判断の後の別の実装。
 *
 * - 公開の範囲は項目ごと（プロフィール・ビルド・称号）に private / friends / public。既定はすべて private（何も見せない）。
 * - ブロックの関係（どちらから）・存在しない・非公開は、見る人には**同じ「見つからない」**に見える（存在の推測を防ぐ）。
 * - 公開ビルドに出すのは、カード（World のカード ID）・ビルド名・OVR・育成の配分・ブースター・規則の版だけ。
 *   内部の ID（buildId）・作成と更新の時刻・育成の目的・計算の内訳は出さない。公開ビルドの識別子は別の公開用の slug。
 * - 表示名・自己紹介は表示だけに使う（制御文字・双方向の制御文字を取り除き、長さを制限、なりすましの語を拒否）。
 */
export const PUBLIC_PROFILE_CONTRACT_VERSION = "public-profile/2026-10-07.mock.v1";
export const DISPLAY_NAME_MAX = 24;
export const BIO_MAX = 160;
export const MAX_PUBLIC_BUILDS = 30;

export type Visibility = "private" | "friends" | "public";
export type ViewerRelation = "self" | "friend" | "other" | "anonymous";

export interface ProfileVisibility {
  profile: Visibility;
  builds: Visibility;
  titles: Visibility;
}

export const DEFAULT_VISIBILITY: ProfileVisibility = { profile: "private", builds: "private", titles: "private" };

export interface PublicBuildSource {
  /** 公開用の slug（内部の buildId とは別に発行する）。 */
  slug: string;
  build: SavedBuild;
  /** そのビルドを公開に含めるか（利用者がビルドごとに選ぶ）。既定は含めない。 */
  published: boolean;
}

export interface OwnerProfile {
  publicId: string;
  displayName: string;
  bio: string;
  visibility: ProfileVisibility;
  /** 称号の ID（表示名は画面の辞書で解決）。 */
  titleIds: string[];
  builds: PublicBuildSource[];
}

export interface PublicBuildView {
  slug: string;
  worldCardId: string;
  buildName: string;
  ovr: number | null;
  allocation: Record<string, number>;
  playerBooster: number | null;
  rulesVersion: string;
}

export type PublicProfileView =
  | { found: false }
  | {
      found: true;
      publicId: string;
      displayName: string | null;
      bio: string | null;
      titleIds: string[] | null;
      builds: PublicBuildView[] | null;
      /** 本人が見ているときだけ: 項目ごとの公開の範囲（他人には出さない）。 */
      ownVisibility: ProfileVisibility | null;
    };

export function cleanDisplayText(v: string, max: number): string {
  const kept = Array.from(v.normalize("NFC")).filter((ch) => {
    const c = ch.codePointAt(0)!;
    return c >= 0x20 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x202a && c <= 0x202e) && !(c >= 0x2066 && c <= 0x2069);
  });
  return kept.join("").replace(/\s+/g, " ").trim().slice(0, max);
}

export type DisplayNameProblem = "empty" | "impersonation" | "contains_url_or_email";

/** 表示名の検証（保存の前）。なりすまし（公式・運営など）・URL・メールアドレスを拒否する。 */
export function validateDisplayName(raw: string): { ok: true; value: string } | { ok: false; problem: DisplayNameProblem } {
  const value = cleanDisplayText(raw, DISPLAY_NAME_MAX);
  if (!value) return { ok: false, problem: "empty" };
  const lower = value.toLowerCase();
  if (BANNED_DISPLAY_TERMS_JA.some((t) => value.includes(t)) || /\b(official|admin|staff|konami|moderator)\b/i.test(lower)) return { ok: false, problem: "impersonation" };
  if (/https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(value)) return { ok: false, problem: "contains_url_or_email" };
  return { ok: true, value };
}

const canSee = (v: Visibility, rel: ViewerRelation): boolean => rel === "self" || v === "public" || (v === "friends" && rel === "friend");

/**
 * 見る人の関係から、公開プロフィールの表示を作る。
 * `blocked`（どちらかがブロック）はサーバーだけが知り、ここでは「見つからない」にする。
 * プロフィール自体が見えない場合も「見つからない」（非公開と存在しないを区別しない）。
 */
export function buildPublicProfileView(owner: OwnerProfile | null, viewer: { relation: ViewerRelation; blocked: boolean }): PublicProfileView {
  if (!owner || (viewer.blocked && viewer.relation !== "self")) return { found: false };
  const rel = viewer.relation;
  if (!canSee(owner.visibility.profile, rel)) return { found: false };
  const builds = canSee(owner.visibility.builds, rel)
    ? owner.builds
        .filter((b) => b.published || rel === "self")
        .slice(0, MAX_PUBLIC_BUILDS)
        .map((b) => toPublicBuild(b))
    : null;
  return {
    found: true,
    publicId: owner.publicId,
    displayName: cleanDisplayText(owner.displayName, DISPLAY_NAME_MAX) || null,
    bio: cleanDisplayText(owner.bio, BIO_MAX) || null,
    titleIds: canSee(owner.visibility.titles, rel) ? [...owner.titleIds] : null,
    builds,
    ownVisibility: rel === "self" ? { ...owner.visibility } : null,
  };
}

const SLUG_RE = /^[a-z0-9]{8,24}$/;

export function toPublicBuild(src: PublicBuildSource): PublicBuildView {
  if (!SLUG_RE.test(src.slug)) throw new Error("invalid public build slug");
  const b = src.build;
  const allocation: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.progressionAllocation ?? {})) {
    if (/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k) && Number.isInteger(v) && v >= 0 && v <= 99) allocation[k] = v;
  }
  return {
    slug: src.slug,
    worldCardId: b.worldCardId,
    buildName: cleanDisplayText(b.buildName, 40),
    ovr: typeof b.calculatedOvr === "number" && Number.isFinite(b.calculatedOvr) ? b.calculatedOvr : null,
    allocation,
    playerBooster: typeof b.selectedPlayerBooster === "number" ? b.selectedPlayerBooster : null,
    rulesVersion: b.rulesVersion,
  };
}
