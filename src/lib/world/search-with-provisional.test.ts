import { describe, it, expect } from "vitest";
import { playersWithProvisional } from "./search-with-provisional";

describe("playersWithProvisional", () => {
  it("正式なカードの後に暫定のカード・同じ ID は正式だけ", () => {
    const out = playersWithProvisional({ players: [{ worldCardId: "1" }, { worldCardId: "2" }], provisionalMatches: [{ worldCardId: "2" }, { worldCardId: "3" }] });
    expect(out.map((p) => p.worldCardId)).toEqual(["1", "2", "3"]);
  });
  it("暫定が無い・形が違うとき", () => {
    expect(playersWithProvisional({ players: [{ worldCardId: "1" }] }).map((p) => p.worldCardId)).toEqual(["1"]);
    expect(playersWithProvisional(null)).toEqual([]);
    expect(playersWithProvisional({ players: "x" })).toEqual([]);
  });
});
