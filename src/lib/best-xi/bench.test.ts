import { describe, it, expect } from "vitest";
import { calculateBuild, emptyAllocation } from "@/lib/progression/engine";
import { MESSI_BIGTIME } from "@/lib/progression/fixtures";
import type { ProgressionCard } from "@/lib/progression/types";
import type { BestXiCandidate } from "./types";
import { selectBestXi } from "./select";
import { selectBestXiBench } from "./bench";

const NOW = "2026-10-07T00:00:00.000Z";

function card(worldCardId: string, registeredPosition: string, overrides: Record<string, number> = {}): ProgressionCard {
  return {
    worldCardId,
    nameEn: `Player ${worldCardId}`,
    nameJa: `選手 ${worldCardId}`,
    registeredPosition,
    cardType: "BASE",
    ovrBase: 80,
    ovrMax: 90,
    maximumLevel: 20,
    boost1: 0,
    boost2: 0,
    baseStats: { ...MESSI_BIGTIME.baseStats, ...overrides },
  };
}

function cand(id: string, pos: string, opts: Partial<BestXiCandidate> & { overrides?: Record<string, number> } = {}): BestXiCandidate {
  const c = card(id, pos, opts.overrides);
  const { overrides: _o, ...rest } = opts;
  return {
    candidateKey: `${id}:${rest.buildId ?? "base"}`,
    worldCardId: id,
    buildId: null,
    buildName: null,
    source: "base",
    nameJa: c.nameJa,
    nameEn: c.nameEn,
    registeredPosition: pos,
    ruleKind: "current",
    abilityStatus: "available",
    stats: calculateBuild({ card: c, allocation: emptyAllocation(), selectedPlayerBoosters: [], selectedConditionalBoosters: [], manager: null }).stats,
    ownershipStatus: "owned",
    intendedPositions: null,
    ...rest,
  };
}

const XI = ["GK", "LB", "CB", "CB", "RB", "DMF", "CMF", "CMF", "LWF", "CF", "RWF"];

function run(pool: BestXiCandidate[], maxSize?: number) {
  const selection = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
  return { selection, bench: selectBestXiBench({ formationId: "4-3-3", candidates: pool, selection, maxSize }) };
}

describe("AI ベスト11 の控え", () => {
  it("先発のカードは控えに入らず、同じカードは 1 回だけ（ビルドが 2 つあっても）", () => {
    const pool = [
      ...XI.map((p, i) => cand(String(i + 1), p)),
      cand("20", "CF", { buildId: "b1", source: "build" }),
      cand("20", "CF", { buildId: "b2", source: "build", overrides: { finishing: 99 } }),
    ];
    const { selection, bench } = run(pool);
    const starters = new Set(selection.slots.map((s) => s.candidate.worldCardId));
    const ids = bench.entries.map((e) => e.candidate.worldCardId);
    expect(ids.some((id) => starters.has(id))).toBe(false);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("控えの GK を最初に選び、本職の穴埋めはフォーメーションのポジションごとに 1 人", () => {
    const pool = [...XI.map((p, i) => cand(String(i + 1), p)), cand("30", "GK"), cand("31", "CB"), cand("32", "CF"), cand("33", "CF")];
    const { bench } = run(pool);
    expect(bench.entries[0]).toMatchObject({ reason: "backupGoalkeeper", position: "GK" });
    const covers = bench.entries.filter((e) => e.reason === "positionCover").map((e) => e.position);
    expect(new Set(covers).size).toBe(covers.length);
    expect(covers).toEqual(expect.arrayContaining(["CB", "CF"]));
    // CF の 2 人目は穴埋めではなく残りの枠
    expect(bench.entries.filter((e) => e.candidate.worldCardId === "32" || e.candidate.worldCardId === "33").map((e) => e.reason).sort()).toEqual(["bestRemaining", "positionCover"]);
  });

  it("本職の控えがいないポジションを示す・GK は 2 人目以降を入れない", () => {
    const pool = [...XI.map((p, i) => cand(String(i + 1), p)), cand("40", "GK"), cand("41", "GK"), cand("42", "CMF")];
    const { bench } = run(pool);
    expect(bench.entries.filter((e) => e.position === "GK")).toHaveLength(1);
    expect(bench.uncoveredPositions).toEqual(expect.arrayContaining(["LB", "CB", "RB", "DMF", "LWF", "CF", "RWF"]));
    expect(bench.uncoveredPositions).not.toContain("CMF");
  });

  it("最大の人数を守る（既定 12）・決定的", () => {
    const extra = Array.from({ length: 20 }, (_, i) => cand(String(100 + i), XI[i % XI.length]));
    const pool = [...XI.map((p, i) => cand(String(i + 1), p)), ...extra];
    const a = run(pool).bench;
    const b = run([...pool].reverse()).bench;
    expect(a.entries).toHaveLength(12);
    expect(a.entries.map((e) => e.candidate.candidateKey)).toEqual(b.entries.map((e) => e.candidate.candidateKey));
    expect(run(pool, 3).bench.entries).toHaveLength(3);
  });

  it("能力データが無い候補は控えにしない", () => {
    const pool = [...XI.map((p, i) => cand(String(i + 1), p)), cand("50", "CB", { abilityStatus: "unavailable", stats: null })];
    expect(run(pool).bench.entries).toHaveLength(0);
  });
});
