import { describe, it, expect } from "vitest";
import { parseRealForm, realFormMatchesCard, viewSeason } from "./real-form";

// 2026-10-31 に 127.0.0.1:7870 から実際に返った応答（形のまま）
const haaland = { ok: true, player_id: "253989", name: "Erling Haaland", position: "Forward", team: "Manchester City", age: 26, nationality: "Norway", season: "2026-27 Premier League Stats", season_stats: { "Starts-Substitute Appearances": "8 (0)", "Total Goals": "9", Assists: "0", Shots: "30" }, source: "ESPN", fetched_at: "2026-10-31T17:30:05+09:00" };
const robertoCarlos = { ok: true, player_id: "77521", name: "Roberto Carlos Castro", position: "Midfielder", team: "Deportivo Quito", age: null, nationality: null, season: null, season_stats: {}, source: "ESPN", fetched_at: "2026-10-31T17:31:25+09:00" };
const ronaldinho = { ok: true, name: "Ronaldinho Diniz", position: "Forward", team: "Brockton FC United", nationality: "USA", season: "2026 U.S. Open Cup Stats", season_stats: { "Total Goals": "0" }, source: "ESPN", fetched_at: "2026-10-31T17:31:27+09:00" };
const pedro = { ok: true, name: "João Pedro", position: "Forward", team: "Chelsea", nationality: "Brazil", season: "2026-27 Premier League Stats", season_stats: { "Total Goals": "5" }, source: "ESPN", fetched_at: "2026-10-31T17:31:35+09:00" };
const son = { ok: true, name: "Son Heung-Min", position: "Forward", team: "LAFC", nationality: "South Korea", season: "2027 MLS Stats", season_stats: { "Total Goals": "7", Assists: "14" }, source: "ESPN", fetched_at: "2026-10-31T17:31:42+09:00" };
const mbappe = { ok: true, name: "Kylian Mbappé", nationality: "France", season: "2026-27 LALIGA Stats", season_stats: { "Total Goals": "11", Assists: "2" }, source: "ESPN", fetched_at: "2026-10-31T17:30:07+09:00" };
const NOW = new Date("2026-10-31T08:30:00Z");

describe("parseRealForm", () => {
  it("正しい応答を読む（成績の項目の順のまま）", () => {
    const f = parseRealForm(haaland);
    expect(f?.name).toBe("Erling Haaland");
    expect(f?.stats).toEqual([["Starts-Substitute Appearances", "8 (0)"], ["Total Goals", "9"], ["Assists", "0"], ["Shots", "30"]]);
    expect(f?.source).toBe("ESPN");
  });
  it("成績が空（引退した選手など）・ok でない・形が違うなら null", () => {
    expect(parseRealForm(robertoCarlos)).toBeNull();
    expect(parseRealForm({ ok: false, error: "not found" })).toBeNull();
    expect(parseRealForm(null)).toBeNull();
    expect(parseRealForm({ ...haaland, fetched_at: "x" })).toBeNull();
  });
});

describe("realFormMatchesCard（名前の完全一致 + 国籍の一致）", () => {
  it("同じ選手（アクセントの違いは無視）", () => {
    expect(realFormMatchesCard(parseRealForm(haaland)!, { nameEn: "Erling Haaland", nationality: "Norway" })).toBe(true);
    expect(realFormMatchesCard(parseRealForm(mbappe)!, { nameEn: "Kylian Mbappe", nationality: "France" })).toBe(true);
  });
  it("国籍の別名（World の Korea Republic = ESPN の South Korea）", () => {
    expect(realFormMatchesCard(parseRealForm(son)!, { nameEn: "Son Heung-Min", nationality: "Korea Republic" })).toBe(true);
  });
  it("別人は出さない（2026-10-31 に実際に返った例）", () => {
    expect(realFormMatchesCard(parseRealForm(ronaldinho)!, { nameEn: "Ronaldinho", nationality: "Brazil" })).toBe(false);
    expect(realFormMatchesCard(parseRealForm(pedro)!, { nameEn: "Pedro", nationality: "Brazil" })).toBe(false);
    expect(realFormMatchesCard(parseRealForm(pedro)!, { nameEn: "Pedro", nationality: "Spain" })).toBe(false);
  });
  it("名前が同じでも国籍が違えば出さない・国籍が無ければ出さない", () => {
    expect(realFormMatchesCard(parseRealForm(haaland)!, { nameEn: "Erling Haaland", nationality: "Sweden" })).toBe(false);
    expect(realFormMatchesCard(parseRealForm(haaland)!, { nameEn: "Erling Haaland", nationality: null })).toBe(false);
  });
});

describe("viewSeason", () => {
  it("今のシーズン（2026-27・2026 MLS）はそのまま", () => {
    expect(viewSeason("2026-27 Premier League Stats", NOW)).toEqual({ label: "2026-27 Premier League", futureYearRemoved: false, stale: false });
    expect(viewSeason("2026 MLS Stats", NOW)).toEqual({ label: "2026 MLS", futureYearRemoved: false, stale: false });
  });
  it("ESPN の見出しが未来の年（2027 MLS）なら年を出さない", () => {
    expect(viewSeason("2027 MLS Stats", NOW)).toEqual({ label: "MLS", futureYearRemoved: true, stale: false });
  });
  it("前のシーズンなら注意", () => {
    expect(viewSeason("2025-26 LALIGA Stats", NOW).stale).toBe(true);
    expect(viewSeason("2025 MLS Stats", NOW).stale).toBe(true);
  });
  it("6 月までは前の年に始まるシーズンが今のシーズン", () => {
    expect(viewSeason("2025-26 LALIGA Stats", new Date("2026-03-01T00:00:00Z")).stale).toBe(false);
    expect(viewSeason("2026-27 LALIGA Stats", new Date("2026-03-01T00:00:00Z")).futureYearRemoved).toBe(true);
  });
  it("見出しが無い・「Stats」だけなら注意", () => {
    expect(viewSeason(null, NOW).stale).toBe(true);
    expect(viewSeason("Stats", NOW)).toEqual({ label: null, futureYearRemoved: false, stale: true });
  });
});
