/**
 * 公開 ID（F-053）の規則。本人の判断（2026-10-02 C）: 公開 ID は利用者が決める設定で、メールアドレス・実名とは別。
 *
 * - 形式: 英小文字で始まり、英小文字・数字・`_` の 3〜20 文字（URL `/u/<公開ID>` にそのまま使える）。
 *   大文字・全角は NFKC と小文字化で正規化してから判定する（`Taro_01` と `taro_01` は同じ ID）。
 * - 予約語: 画面・API の経路や運営を連想させる語は、完全一致で使えない。
 * - 禁止語: なりすまし（運営・公式・KONAMI 等）と不適切な語は、`_`・数字の置き換え（0→o 等）を戻した上で部分一致でも使えない。
 * - 個人情報の混入: メールアドレス・電話番号らしい並び・URL を拒否する（実名は機械では判定できないため画面で注意する）。
 * - 変更は 30 日に 1 回。
 * - 純関数（保存・通信なし）。Production の表・一意性の確認は、承認後のマイグレーションと RLS で行う。
 */

export const PUBLIC_ID_RULES_VERSION = "public-id/2026-10-02.v1";
export const PUBLIC_ID_MIN = 3;
export const PUBLIC_ID_MAX = 20;
export const PUBLIC_ID_CHANGE_INTERVAL_DAYS = 30;

export type PublicIdProblem =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "must_start_with_letter"
  | "consecutive_underscores"
  | "edge_underscore"
  | "reserved"
  | "banned"
  | "personal_info";

export type PublicIdValidation = { ok: true; normalized: string } | { ok: false; normalized: string; problem: PublicIdProblem };

/** 画面の経路・機能名・運営を連想させる語（完全一致で使えない）。 */
export const RESERVED_PUBLIC_IDS: ReadonlySet<string> = new Set([
  "about", "account", "admin", "api", "app", "auth", "best_xi", "billing", "blog", "community", "compare", "contact",
  "dashboard", "data", "delete", "diagnosis", "disclaimer", "favorites", "help", "home", "login", "logout", "managers",
  "me", "my_builds", "my_team", "new", "null", "players", "privacy", "profile", "release", "root", "search", "settings",
  "share", "signin", "signup", "squads", "static", "status", "support", "system", "team", "terms", "test", "undefined",
  "user", "users", "world", "www",
]);

/**
 * 部分一致でも使えない語（置き換えを戻した後の文字列で判定）。
 * なりすまし・運営の装い・権利者名と、最低限の不適切な語。網羅ではないため、通報と管理者の確認を併用する。
 */
export const BANNED_PUBLIC_ID_TERMS: readonly string[] = [
  "admin", "administrator", "moderator", "official", "staff", "support", "teamai", "efootball", "konami",
  "fuck", "shit", "bitch", "nigger", "faggot", "rape", "nazi", "hitler", "porn", "sex",
];

/** 画面に表示する日本語の禁止語（表示名用・部分一致）。 */
export const BANNED_DISPLAY_TERMS_JA: readonly string[] = ["公式", "運営", "管理者", "スタッフ", "コナミ"];

const LEET: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };

/** NFKC・前後の空白除去・小文字化。 */
export function normalizePublicId(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

/** 禁止語の判定用: `_` を除き、数字の置き換えを戻す（`adm1n` → `admin`）。 */
export function deobfuscate(id: string): string {
  return id.replace(/_/g, "").replace(/[0-9]/g, (d) => LEET[d] ?? d);
}

export function validatePublicId(raw: string): PublicIdValidation {
  const normalized = normalizePublicId(raw);
  const fail = (problem: PublicIdProblem): PublicIdValidation => ({ ok: false, normalized, problem });
  if (normalized.length === 0) return fail("empty");
  if (/@|https?:|www\.|\.(com|jp|net|org)\b/.test(normalized) || /\d{7,}/.test(normalized.replace(/[-_\s]/g, ""))) return fail("personal_info");
  if (normalized.length < PUBLIC_ID_MIN) return fail("too_short");
  if (normalized.length > PUBLIC_ID_MAX) return fail("too_long");
  if (!/^[a-z0-9_]+$/.test(normalized)) return fail("invalid_chars");
  if (!/^[a-z]/.test(normalized)) return fail("must_start_with_letter");
  if (normalized.endsWith("_")) return fail("edge_underscore");
  if (normalized.includes("__")) return fail("consecutive_underscores");
  if (RESERVED_PUBLIC_IDS.has(normalized)) return fail("reserved");
  const plain = deobfuscate(normalized);
  if (BANNED_PUBLIC_ID_TERMS.some((t) => plain.includes(t) || normalized.replace(/_/g, "").includes(t))) return fail("banned");
  return { ok: true, normalized };
}

/** 前回の変更から 30 日たったか。初回（null）は変更できる。日時が読めなければ変更させない。 */
export function canChangePublicId(lastChangedAt: string | null, now: Date): { ok: true } | { ok: false; nextAt: string } {
  if (lastChangedAt === null) return { ok: true };
  const t = Date.parse(lastChangedAt);
  if (!Number.isFinite(t)) return { ok: false, nextAt: "" };
  const next = t + PUBLIC_ID_CHANGE_INTERVAL_DAYS * 86_400_000;
  return now.getTime() >= next ? { ok: true } : { ok: false, nextAt: new Date(next).toISOString() };
}

/** 公開プロフィールの型（Production の表は承認後。ここでは画面とテストの契約だけ）。 */
export interface PublicProfileDraft {
  publicId: string;
  /** 表示名（かな・漢字可）。実名を使わない旨を画面で注意する。 */
  displayName: string;
  /** 既定は非公開。 */
  visibility: "private" | "link" | "friends" | "public";
  publicIdChangedAt: string | null;
  rulesVersion: typeof PUBLIC_ID_RULES_VERSION;
}

export type DisplayNameProblem = "empty" | "too_long" | "control_chars" | "banned" | "personal_info";

/** 表示名: 1〜20 文字、制御文字・なりすましの語・連絡先を拒否する。 */
export function validateDisplayName(raw: string): { ok: true; normalized: string } | { ok: false; problem: DisplayNameProblem } {
  const normalized = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return { ok: false, problem: "empty" };
  if ([...normalized].length > 20) return { ok: false, problem: "too_long" };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/.test(normalized)) return { ok: false, problem: "control_chars" };
  if (/@|https?:|\d{7,}/.test(normalized.replace(/[-\s]/g, ""))) return { ok: false, problem: "personal_info" };
  const lower = normalized.toLowerCase();
  if (BANNED_DISPLAY_TERMS_JA.some((t) => normalized.includes(t)) || BANNED_PUBLIC_ID_TERMS.some((t) => deobfuscate(lower.replace(/\s/g, "")).includes(t))) {
    return { ok: false, problem: "banned" };
  }
  return { ok: true, normalized };
}
