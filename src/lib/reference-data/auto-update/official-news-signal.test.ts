import { describe, it, expect } from "vitest";
import { parseOfficialNews, buildOfficialAheadNotice, OFFICIAL_AHEAD_GRACE_MS } from "../../../../scripts/lib/official-news-signal.mjs";
import { shouldThrottleNotification } from "../../../../scripts/lib/reference-data-notify.mjs";

const page = (items: unknown[]) => `<html><script>const app = createApp({ data(){ return { language: 'ja', newsData: ${JSON.stringify(items)}, filteredNews: [] } } })</script></html>`;
const SAMPLE = [
  { id: 5964, beginDate: "2026-10-15 07:00:00", title: "大会の開催延期のお知らせ", category: 4 },
  { id: 5933, beginDate: "2026-10-08 02:00:04", title: "2026/10/08のLiveUpdateについて", category: 3 },
  { id: 5930, beginDate: "2026-10-08 02:00:02", title: "アップデート配信のお知らせ（バージョン 6.1.0）", category: 3 },
  { id: 5905, beginDate: "2026-10-01 02:00:00", title: "スペシャル選手リスト「例」から獲得できる選手について", category: 4 },
  { id: 1, beginDate: "bad date", title: "壊れた行", category: 4 },
];

describe("公式のお知らせの合図（2026-10-15）", () => {
  it("埋め込みの newsData を読み、掲載日時を日本時間から UTC にし、データに関わるお知らせを見分ける（壊れた行は捨てる）", () => {
    const items = parseOfficialNews(page(SAMPLE))!;
    expect(items.map((x) => x.id)).toEqual([5964, 5933, 5930, 5905]);
    expect(items.find((x) => x.id === 5933)).toMatchObject({ at: "2026-10-07T17:00:04.000Z", dataRelated: true });
    expect(items.find((x) => x.id === 5964)?.dataRelated).toBe(false);
    // 題名は返さない（保存・転載しない）
    expect(Object.keys(items[0]).sort()).toEqual(["at", "category", "dataRelated", "id"]);
  });

  it("ページの形が違えば null（推測しない）", () => {
    expect(parseOfficialNews("<html>no data</html>")).toBeNull();
    expect(parseOfficialNews("newsData: [ {broken")).toBeNull();
    expect(parseOfficialNews(null as unknown as string)).toBeNull();
  });

  it("反映済みのカードがお知らせより新しければ知らせない・お知らせから 3 日以内も知らせない・3 日を過ぎて遅れていれば知らせる", () => {
    const items = parseOfficialNews(page(SAMPLE));
    expect(buildOfficialAheadNotice({ items, appliedLatestCardAt: "2026-10-08T17:01:43.390Z", now: "2026-10-15T00:00:00Z" })).toMatchObject({ notify: false, reason: "source_caught_up" });
    const posted = Date.parse("2026-10-07T17:00:04Z");
    expect(buildOfficialAheadNotice({ items, appliedLatestCardAt: "2026-10-01T00:00:00Z", now: new Date(posted + OFFICIAL_AHEAD_GRACE_MS - 60_000).toISOString() }).reason).toBe("within_grace");
    const n = buildOfficialAheadNotice({ items, appliedLatestCardAt: "2026-10-01T00:00:00Z", now: "2026-10-12T00:00:00Z" });
    expect(n).toMatchObject({ notify: true, kind: "official_ahead", latestId: 5933, days: 4 });
    expect(n.body).toContain("https://www.konami.com/efootball/ja/topic/news/5933");
    expect(n.body).not.toContain("LiveUpdate"); // 題名を転載しない
  });

  it("読めない・反映の記録が無い・データに関わるお知らせが無いときは知らせない", () => {
    expect(buildOfficialAheadNotice({ items: null, appliedLatestCardAt: "2026-10-01T00:00:00Z", now: "2026-10-20T00:00:00Z" }).reason).toBe("unparsable");
    expect(buildOfficialAheadNotice({ items: parseOfficialNews(page(SAMPLE)), appliedLatestCardAt: null, now: "2026-10-20T00:00:00Z" }).reason).toBe("no_applied_state");
    expect(buildOfficialAheadNotice({ items: parseOfficialNews(page([SAMPLE[0]])), appliedLatestCardAt: "2026-10-01T00:00:00Z", now: "2026-10-20T00:00:00Z" }).reason).toBe("no_data_related_news");
  });

  it("同じ知らせは 1 日に 1 回まで", () => {
    const n = buildOfficialAheadNotice({ items: parseOfficialNews(page(SAMPLE)), appliedLatestCardAt: "2026-10-01T00:00:00Z", now: "2026-10-12T00:00:00Z" }) as { kind: string; title: string };
    const last = { body: `**${n.title}**\n\n...`, createdAt: "2026-10-12T00:00:00Z" };
    expect(shouldThrottleNotification(n, last, "2026-10-12T18:00:00Z")).toBe(true);
    expect(shouldThrottleNotification(n, last, "2026-10-13T01:00:00Z")).toBe(false);
  });
});

describe("反映待ちのお知らせと更新日の検出の間隔（2026-10-15・「とにかく最新に」）", () => {
  it("直近 48 時間に、反映済みのカードより新しいデータのお知らせがあれば反映待ち", async () => {
    const { hasPendingOfficialNews } = await import("../../../../scripts/lib/official-news-signal.mjs");
    const items = [{ id: 9, at: "2026-10-15T01:00:00.000Z", category: 3, dataRelated: true }];
    expect(hasPendingOfficialNews({ items, appliedLatestCardAt: "2026-10-08T17:00:00Z", now: "2026-10-15T06:00:00Z" })).toBe(true);
    expect(hasPendingOfficialNews({ items, appliedLatestCardAt: "2026-10-15T02:00:00Z", now: "2026-10-15T06:00:00Z" })).toBe(false); // 反映済み
    expect(hasPendingOfficialNews({ items, appliedLatestCardAt: "2026-10-08T17:00:00Z", now: "2026-10-18T06:00:00Z" })).toBe(false); // 48 時間より前
    expect(hasPendingOfficialNews({ items: [{ ...items[0], dataRelated: false }], appliedLatestCardAt: "2026-10-08T17:00:00Z", now: "2026-10-15T06:00:00Z" })).toBe(false);
  });

  it("watchdog の上限: 日本時間の木・金は 70 分・それ以外は 6 時間 30 分", async () => {
    const { staleMsFor, WATCHDOG_STALE_MS, WATCHDOG_UPDATE_DAY_STALE_MS } = await import("../../../../scripts/lib/detection-watchdog.mjs");
    expect(staleMsFor("2026-10-15T03:00:00Z")).toBe(WATCHDOG_UPDATE_DAY_STALE_MS); // 木 12:00 JST
    expect(staleMsFor("2026-10-16T14:00:00Z")).toBe(WATCHDOG_UPDATE_DAY_STALE_MS); // 金 23:00 JST
    expect(staleMsFor("2026-10-14T14:00:00Z")).toBe(WATCHDOG_STALE_MS); // 水 23:00 JST
    expect(staleMsFor("2026-10-16T15:30:00Z")).toBe(WATCHDOG_STALE_MS); // 土 00:30 JST
    expect(staleMsFor("bad")).toBe(WATCHDOG_STALE_MS);
  });
});
