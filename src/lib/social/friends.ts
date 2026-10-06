/**
 * 友達・友達との比較・ライバルの契約（2026-10-07・モック・Production に接続しない・純関数）。
 * 公開 ID（F-053）・ブロック（公開 ID の提案の `user_blocks`）の上に作る。保存・通知の送信は将来の別の実装（本人の判断の後）。
 */
export const SOCIAL_CONTRACT_VERSION = "social/2026-10-07.mock.v1";

// ---------------------------------------------------------------------------
// 友達
// ---------------------------------------------------------------------------

export type FriendshipState = "none" | "pending_outgoing" | "pending_incoming" | "friends" | "blocked";
export type FriendAction = "request" | "accept" | "reject" | "cancel" | "remove" | "block" | "unblock";

export interface FriendshipView {
  /** 自分から見た状態。 */
  state: FriendshipState;
  /** 自分が相手をブロックしているか（相手からのブロックは見せない・"none" と同じに見える）。 */
  blockedByMe: boolean;
}

/** 通知の契約（送信はしない）。ブロック・削除・拒否・取り消しは相手に通知しない。 */
export interface FriendNotification {
  kind: "friend_request_received" | "friend_request_accepted";
  toUserId: string;
}

export const FRIEND_REQUESTS_PER_DAY = 20;
export const MAX_FRIENDS = 300;

export type FriendTransition =
  | { ok: true; next: FriendshipView; notify: FriendNotification | null }
  | { ok: false; problem: "not_allowed" | "rate_limited" | "friend_limit" | "blocked_relation" };

/**
 * 自分の操作で状態を変える。`blockedByThem` はサーバーだけが知る（画面へは出さない）。
 * - ブロックされている相手への申請は、相手に見えない形で失敗する（存在の推測を防ぐため problem は "not_allowed" と同じ扱いにできる）。
 */
export function transitionFriendship(
  current: FriendshipView,
  action: FriendAction,
  ctx: { otherUserId: string; blockedByThem: boolean; requestsToday: number; friendCount: number },
): FriendTransition {
  const s = current.state;
  if (action === "block") return { ok: true, next: { state: "blocked", blockedByMe: true }, notify: null };
  if (action === "unblock") return current.blockedByMe ? { ok: true, next: { state: "none", blockedByMe: false }, notify: null } : { ok: false, problem: "not_allowed" };
  if (current.blockedByMe || ctx.blockedByThem) return { ok: false, problem: "blocked_relation" };
  switch (action) {
    case "request":
      if (s !== "none") return { ok: false, problem: "not_allowed" };
      if (ctx.requestsToday >= FRIEND_REQUESTS_PER_DAY) return { ok: false, problem: "rate_limited" };
      if (ctx.friendCount >= MAX_FRIENDS) return { ok: false, problem: "friend_limit" };
      return { ok: true, next: { state: "pending_outgoing", blockedByMe: false }, notify: { kind: "friend_request_received", toUserId: ctx.otherUserId } };
    case "accept":
      if (s !== "pending_incoming") return { ok: false, problem: "not_allowed" };
      if (ctx.friendCount >= MAX_FRIENDS) return { ok: false, problem: "friend_limit" };
      return { ok: true, next: { state: "friends", blockedByMe: false }, notify: { kind: "friend_request_accepted", toUserId: ctx.otherUserId } };
    case "reject":
      return s === "pending_incoming" ? { ok: true, next: { state: "none", blockedByMe: false }, notify: null } : { ok: false, problem: "not_allowed" };
    case "cancel":
      return s === "pending_outgoing" ? { ok: true, next: { state: "none", blockedByMe: false }, notify: null } : { ok: false, problem: "not_allowed" };
    case "remove":
      return s === "friends" ? { ok: true, next: { state: "none", blockedByMe: false }, notify: null } : { ok: false, problem: "not_allowed" };
  }
}

// ---------------------------------------------------------------------------
// 友達との比較
// ---------------------------------------------------------------------------

export type ComparisonVisibility = "nobody" | "friends" | "rivals";

/** 比べるために相手が共有する要約（共有の画像・URL と同じ範囲。選手名・スカッドの ID・本文は含めない）。 */
export interface SharedSquadSummary {
  rulesVersion: string;
  overall: number | null;
  categories: Record<string, number | null>;
  /** パーセンタイル（上位の割合）。分からなければ null。 */
  overallTopPercent: number | null;
  titles: string[];
  badges: string[];
  yourBest: string[];
  /** 前回との差（成長）。 */
  growth: number | null;
  sharedAt: string;
}

export interface ComparisonRow {
  key: string;
  mine: number | null;
  theirs: number | null;
  /** 自分 − 相手（両方に値があるときだけ）。 */
  diff: number | null;
}

export type FriendComparisonResult =
  | { ok: true; comparable: true; rows: ComparisonRow[]; sameTitles: string[]; onlyMine: string[]; onlyTheirs: string[] }
  | { ok: true; comparable: false; reason: "different_rules_version"; mineVersion: string; theirsVersion: string }
  | { ok: false; problem: "not_visible" | "no_data" };

/** 相手の公開の設定と関係を確かめてから比べる。規則の版が違う場合は数値を並べない（誤解を防ぐ）。 */
export function compareWithFriend(
  mine: SharedSquadSummary | null,
  theirs: SharedSquadSummary | null,
  ctx: { relation: "friends" | "rival" | "none"; theirVisibility: ComparisonVisibility; blocked: boolean },
): FriendComparisonResult {
  if (ctx.blocked) return { ok: false, problem: "not_visible" };
  const allowed = ctx.theirVisibility === "friends" ? ctx.relation === "friends" : ctx.theirVisibility === "rivals" ? ctx.relation === "friends" || ctx.relation === "rival" : false;
  if (!allowed) return { ok: false, problem: "not_visible" };
  if (!mine || !theirs) return { ok: false, problem: "no_data" };
  if (mine.rulesVersion !== theirs.rulesVersion) return { ok: true, comparable: false, reason: "different_rules_version", mineVersion: mine.rulesVersion, theirsVersion: theirs.rulesVersion };
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  const keys = [...new Set([...Object.keys(mine.categories), ...Object.keys(theirs.categories)])].sort();
  const rows: ComparisonRow[] = [
    { key: "overall", mine: mine.overall, theirs: theirs.overall, diff: diff(mine.overall, theirs.overall) },
    ...keys.map((k) => ({ key: k, mine: mine.categories[k] ?? null, theirs: theirs.categories[k] ?? null, diff: diff(mine.categories[k] ?? null, theirs.categories[k] ?? null) })),
    { key: "growth", mine: mine.growth, theirs: theirs.growth, diff: diff(mine.growth, theirs.growth) },
  ];
  const a = new Set([...mine.titles, ...mine.badges]);
  const b = new Set([...theirs.titles, ...theirs.badges]);
  return { ok: true, comparable: true, rows, sameTitles: [...a].filter((x) => b.has(x)).sort(), onlyMine: [...a].filter((x) => !b.has(x)).sort(), onlyTheirs: [...b].filter((x) => !a.has(x)).sort() };
}

// ---------------------------------------------------------------------------
// ライバル（オプトイン）
// ---------------------------------------------------------------------------

export interface RivalSettings {
  /** 自分がライバルの機能を使うか（既定は false）。 */
  optedIn: boolean;
  rivals: string[];
}
export const MAX_RIVALS = 5;

export function addRival(s: RivalSettings, otherUserId: string, ctx: { otherOptedIn: boolean; blocked: boolean }): { ok: true; next: RivalSettings } | { ok: false; problem: "not_opted_in" | "other_not_opted_in" | "blocked" | "limit" | "already" } {
  if (!s.optedIn) return { ok: false, problem: "not_opted_in" };
  if (ctx.blocked) return { ok: false, problem: "blocked" };
  if (!ctx.otherOptedIn) return { ok: false, problem: "other_not_opted_in" };
  if (s.rivals.includes(otherUserId)) return { ok: false, problem: "already" };
  if (s.rivals.length >= MAX_RIVALS) return { ok: false, problem: "limit" };
  return { ok: true, next: { ...s, rivals: [...s.rivals, otherUserId] } };
}

export function removeRival(s: RivalSettings, otherUserId: string): RivalSettings {
  return { ...s, rivals: s.rivals.filter((x) => x !== otherUserId) };
}

/** オプトアウトするとライバルの一覧は空になる（相手の側の表示からも外れる）。 */
export function optOutOfRivals(s: RivalSettings): RivalSettings {
  return { optedIn: false, rivals: [] };
}

export interface ScorePoint {
  at: string;
  overall: number | null;
  rulesVersion: string;
}

/** 期間（週・月）の成長: 期間の始めと終わりの総合点の差（同じ規則の版の点だけ）。 */
export function growthOverPeriod(points: readonly ScorePoint[], period: "week" | "month", now: string): { from: number; to: number; delta: number } | null {
  const days = period === "week" ? 7 : 30;
  const start = Date.parse(now) - days * 86_400_000;
  const inRange = points.filter((p) => p.overall !== null && Date.parse(p.at) >= start && Date.parse(p.at) <= Date.parse(now)).sort((a, b) => a.at.localeCompare(b.at));
  if (inRange.length < 2) return null;
  const last = inRange[inRange.length - 1];
  const first = inRange.find((p) => p.rulesVersion === last.rulesVersion)!;
  if (first === last) return null;
  return { from: first.overall!, to: last.overall!, delta: last.overall! - first.overall! };
}
