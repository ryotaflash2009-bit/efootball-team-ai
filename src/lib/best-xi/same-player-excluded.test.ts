import { describe, it, expect } from "vitest";
import { samePlayerExcluded } from "./same-player-excluded";
import type { BestXiCandidate } from "./types";

const B1 = "105869601784218";
const B2 = "105782628696474";
const C1 = "88036360587367";
const c = (worldCardId: string, extra: Partial<BestXiCandidate> = {}) => ({ candidateKey: `${worldCardId}:base`, worldCardId, abilityStatus: "available", ...extra }) as BestXiCandidate;

describe("AI ベスト11: 同じ選手のため選ばなかったカード（2026-10-11）", () => {
  it("選んだカードと同じ選手の別のカードだけ（カードごとに 1 件・使えない候補は除く）", () => {
    const r = samePlayerExcluded([c(B1), c(B2), c(B2, { candidateKey: `${B2}:b1` }), c(C1), c("105869601000000", { abilityStatus: "unavailable" } as Partial<BestXiCandidate>)], [B1]);
    expect(r.map((x) => x.worldCardId)).toEqual([B2]);
  });
  it("同じ選手がいなければ空", () => {
    expect(samePlayerExcluded([c(B1), c(C1)], [B1, C1])).toEqual([]);
  });
});
