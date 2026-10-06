import { describe, expect, it } from "vitest";
import { addRival, compareWithFriend, FRIEND_REQUESTS_PER_DAY, growthOverPeriod, MAX_RIVALS, optOutOfRivals, transitionFriendship, type SharedSquadSummary } from "./friends";

const none = { state: "none" as const, blockedByMe: false };
const ctx = { otherUserId: "u2", blockedByThem: false, requestsToday: 0, friendCount: 0 };

describe("友達（モックの契約）", () => {
  it("申請 → 承認で友達・通知は申請と承認だけ", () => {
    const r = transitionFriendship(none, "request", ctx);
    expect(r).toEqual({ ok: true, next: { state: "pending_outgoing", blockedByMe: false }, notify: { kind: "friend_request_received", toUserId: "u2" } });
    const a = transitionFriendship({ state: "pending_incoming", blockedByMe: false }, "accept", ctx);
    expect(a.ok && a.next.state).toBe("friends");
    expect(a.ok && a.notify?.kind).toBe("friend_request_accepted");
  });

  it("拒否・取り消し・削除・ブロックは相手に通知しない", () => {
    for (const [state, action] of [["pending_incoming", "reject"], ["pending_outgoing", "cancel"], ["friends", "remove"], ["friends", "block"]] as const) {
      const r = transitionFriendship({ state, blockedByMe: false }, action, ctx);
      expect(r.ok && r.notify, `${state} ${action}`).toBeNull();
    }
  });

  it("ブロックの関係では申請・承認できない・解除は自分のブロックだけ", () => {
    expect(transitionFriendship(none, "request", { ...ctx, blockedByThem: true })).toEqual({ ok: false, problem: "blocked_relation" });
    expect(transitionFriendship({ state: "blocked", blockedByMe: true }, "accept", ctx)).toEqual({ ok: false, problem: "blocked_relation" });
    expect(transitionFriendship(none, "unblock", ctx)).toEqual({ ok: false, problem: "not_allowed" });
    expect(transitionFriendship({ state: "blocked", blockedByMe: true }, "unblock", ctx)).toEqual({ ok: true, next: none, notify: null });
  });

  it("1 日の申請の上限・状態に合わない操作は拒否", () => {
    expect(transitionFriendship(none, "request", { ...ctx, requestsToday: FRIEND_REQUESTS_PER_DAY })).toEqual({ ok: false, problem: "rate_limited" });
    expect(transitionFriendship(none, "accept", ctx)).toEqual({ ok: false, problem: "not_allowed" });
    expect(transitionFriendship({ state: "friends", blockedByMe: false }, "request", ctx)).toEqual({ ok: false, problem: "not_allowed" });
  });
});

const summary = (o: Partial<SharedSquadSummary> = {}): SharedSquadSummary => ({ rulesVersion: "v1", overall: 70, categories: { attack: 80, defense: 60 }, overallTopPercent: 20, titles: ["counter"], badges: ["speed"], yourBest: [], growth: 3, sharedAt: "2026-10-07T00:00:00Z", ...o });

describe("友達との比較（モックの契約）", () => {
  it("同じ規則の版なら数値の差・称号の共通と違い", () => {
    const r = compareWithFriend(summary(), summary({ overall: 65, categories: { attack: 70, defense: 75 }, titles: ["possession"], badges: ["speed"] }), { relation: "friends", theirVisibility: "friends", blocked: false });
    if (!r.ok || !r.comparable) throw new Error("expected comparable");
    expect(r.rows.find((x) => x.key === "overall")!.diff).toBe(5);
    expect(r.rows.find((x) => x.key === "defense")!.diff).toBe(-15);
    expect(r.sameTitles).toEqual(["speed"]);
    expect(r.onlyMine).toEqual(["counter"]);
    expect(r.onlyTheirs).toEqual(["possession"]);
  });

  it("規則の版が違うと数値を並べない", () => {
    const r = compareWithFriend(summary(), summary({ rulesVersion: "v2" }), { relation: "friends", theirVisibility: "friends", blocked: false });
    expect(r).toMatchObject({ ok: true, comparable: false, reason: "different_rules_version" });
  });

  it("相手の公開の設定・関係・ブロックで見えない", () => {
    expect(compareWithFriend(summary(), summary(), { relation: "friends", theirVisibility: "nobody", blocked: false })).toEqual({ ok: false, problem: "not_visible" });
    expect(compareWithFriend(summary(), summary(), { relation: "none", theirVisibility: "friends", blocked: false })).toEqual({ ok: false, problem: "not_visible" });
    expect(compareWithFriend(summary(), summary(), { relation: "rival", theirVisibility: "friends", blocked: false })).toEqual({ ok: false, problem: "not_visible" });
    expect(compareWithFriend(summary(), summary(), { relation: "rival", theirVisibility: "rivals", blocked: false }).ok).toBe(true);
    expect(compareWithFriend(summary(), summary(), { relation: "friends", theirVisibility: "friends", blocked: true })).toEqual({ ok: false, problem: "not_visible" });
    expect(compareWithFriend(null, summary(), { relation: "friends", theirVisibility: "friends", blocked: false })).toEqual({ ok: false, problem: "no_data" });
  });
});

describe("ライバル（オプトイン・モックの契約）", () => {
  it("両方がオプトインのときだけ追加・上限・ブロック・オプトアウトで空", () => {
    const off = { optedIn: false, rivals: [] };
    expect(addRival(off, "u2", { otherOptedIn: true, blocked: false })).toEqual({ ok: false, problem: "not_opted_in" });
    const on = { optedIn: true, rivals: [] as string[] };
    expect(addRival(on, "u2", { otherOptedIn: false, blocked: false })).toEqual({ ok: false, problem: "other_not_opted_in" });
    expect(addRival(on, "u2", { otherOptedIn: true, blocked: true })).toEqual({ ok: false, problem: "blocked" });
    const full = { optedIn: true, rivals: Array.from({ length: MAX_RIVALS }, (_, i) => `r${i}`) };
    expect(addRival(full, "u9", { otherOptedIn: true, blocked: false })).toEqual({ ok: false, problem: "limit" });
    const added = addRival(on, "u2", { otherOptedIn: true, blocked: false });
    expect(added.ok && added.next.rivals).toEqual(["u2"]);
    expect(optOutOfRivals({ optedIn: true, rivals: ["u2"] })).toEqual({ optedIn: false, rivals: [] });
  });

  it("週・月の成長（同じ規則の版の点だけ・2 点未満は null）", () => {
    const pts = [
      { at: "2026-09-10T00:00:00Z", overall: 50, rulesVersion: "v1" },
      { at: "2026-10-01T00:00:00Z", overall: 60, rulesVersion: "v1" },
      { at: "2026-10-05T00:00:00Z", overall: 66, rulesVersion: "v1" },
    ];
    expect(growthOverPeriod(pts, "week", "2026-10-07T00:00:00Z")).toEqual({ from: 60, to: 66, delta: 6 });
    expect(growthOverPeriod(pts, "month", "2026-10-07T00:00:00Z")).toEqual({ from: 50, to: 66, delta: 16 });
    expect(growthOverPeriod(pts.slice(2), "week", "2026-10-07T00:00:00Z")).toBeNull();
  });
});
