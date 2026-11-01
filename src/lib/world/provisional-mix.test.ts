import { describe, it, expect } from "vitest";
import { mixByOvr, mixByRecency, filterProvisionalForList } from "./provisional-mix";
import type { WorldPlayerListItem } from "./types";

function card(over: Partial<WorldPlayerListItem>): WorldPlayerListItem {
  return {
    worldCardId: "1", nameEn: "A", nameJa: "あ", cardType: "STANDARD", registeredPosition: "CF",
    ovrBase: 80, ovrMax: 90, maximumLevel: 30, cardRating: null, playingStyle: null, playingStyleDefensive: null,
    nationality: "Japan", region: null, league: null, team: "Team A", preferredFoot: null, age: 25, height: 180, weight: 75,
    boost1: 0, boost2: 0, appearanceUpdatedAt: null, imageUrlCandidate: null, mobileImageUrlCandidate: null,
    hasEfhubLink: false, efhubCardId: null, ...over,
  };
}
const prov = (over: Partial<WorldPlayerListItem>, firstSeenAt = "2026-10-30T00:00:00Z") =>
  card({ ...over, provisional: { firstSeenAt } as WorldPlayerListItem["provisional"] });

const BASE = { sort: "ovr_max_desc" as const, position: null, cardType: null, playingStyle: null, playingStyleDefensive: null, nationality: null, league: null, team: null, minOvr: null, maxOvr: null, hasBooster: null };

describe("mixByOvr", () => {
  it("最大 OVR（無ければ基本）の高い順に混ぜる・同じ値は World を先・同じ ID は World", () => {
    const world = [card({ worldCardId: "w1", ovrMax: 105 }), card({ worldCardId: "w2", ovrMax: 100 })];
    const p = [prov({ worldCardId: "p1", ovrMax: null, ovrBase: 102 }), prov({ worldCardId: "p2", ovrMax: 100 }), prov({ worldCardId: "w1", ovrMax: 110 })];
    expect(mixByOvr(world, p, 10).map((x) => x.worldCardId)).toEqual(["w1", "p1", "w2", "p2"]);
    expect(mixByOvr(world, p, 2).map((x) => x.worldCardId)).toEqual(["w1", "p1"]);
  });
});

describe("mixByRecency", () => {
  it("World は見た目の更新・暫定は最初に見つけた時刻で新しい順", () => {
    const world = [card({ worldCardId: "w1", appearanceUpdatedAt: "2026-10-16T00:00:00Z" }), card({ worldCardId: "w2", appearanceUpdatedAt: "2026-10-10T00:00:00Z" })];
    const p = [prov({ worldCardId: "p1" }, "2026-10-29T00:00:00Z"), prov({ worldCardId: "p2" }, "2026-10-12T00:00:00Z")];
    expect(mixByRecency(world, p, 10).map((x) => x.worldCardId)).toEqual(["p1", "w1", "p2", "w2"]);
  });
});

describe("filterProvisionalForList", () => {
  const rows = [
    prov({ worldCardId: "a", registeredPosition: "CF", ovrMax: null, ovrBase: 85, nationality: "Brazil" }),
    prov({ worldCardId: "b", registeredPosition: "CF", ovrMax: 99, ovrBase: 88, boost1: 5 }),
    prov({ worldCardId: "c", registeredPosition: "GK", ovrMax: 90, ovrBase: 80 }),
  ];
  it("ポジション・国籍で絞り、最大 OVR（無ければ基本）の高い順", () => {
    expect(filterProvisionalForList(rows, { ...BASE, position: "CF" }).map((x) => x.worldCardId)).toEqual(["b", "a"]);
    expect(filterProvisionalForList(rows, { ...BASE, nationality: "Brazil" }).map((x) => x.worldCardId)).toEqual(["a"]);
  });
  it("OVR の下限は基本の OVR でも判断できる・上限は最大 OVR が無ければ合わない", () => {
    expect(filterProvisionalForList(rows, { ...BASE, minOvr: 85 }).map((x) => x.worldCardId).sort()).toEqual(["a", "b", "c"]);
    expect(filterProvisionalForList(rows, { ...BASE, maxOvr: 95 }).map((x) => x.worldCardId)).toEqual(["c"]);
  });
  it("ブースターの有無", () => {
    expect(filterProvisionalForList(rows, { ...BASE, hasBooster: true }).map((x) => x.worldCardId)).toEqual(["b"]);
    expect(filterProvisionalForList(rows, { ...BASE, hasBooster: false }).map((x) => x.worldCardId).sort()).toEqual(["a", "c"]);
  });
});
