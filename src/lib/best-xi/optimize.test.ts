import { describe, it, expect } from "vitest";
import { calculateBuild, emptyAllocation } from "@/lib/progression/engine";
import { MESSI_BIGTIME } from "@/lib/progression/fixtures";
import { getFormation } from "@/lib/squad/formations";
import type { ProgressionCard, StatBreakdown } from "@/lib/progression/types";
import type { BestXiCandidate } from "./types";
import { optimizeBestXi } from "./optimize";

const SLOTS = [...getFormation("4-3-3").slots].sort((a, b) => a.displayOrder - b.displayOrder);

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

function statsFor(c: ProgressionCard): StatBreakdown[] {
  return calculateBuild({ card: c, allocation: emptyAllocation(), selectedPlayerBoosters: [], selectedConditionalBoosters: [], manager: null }).stats;
}

function candidate(c: ProgressionCard, opts: Partial<BestXiCandidate> = {}): BestXiCandidate {
  return {
    candidateKey: `${c.worldCardId}:${opts.buildId ?? "base"}`,
    worldCardId: c.worldCardId,
    buildId: null,
    buildName: null,
    source: "base",
    nameJa: c.nameJa,
    nameEn: c.nameEn,
    registeredPosition: c.registeredPosition,
    ruleKind: "current",
    abilityStatus: "available",
    stats: statsFor(c),
    ownershipStatus: "owned",
    intendedPositions: null,
    ...opts,
  };
}

describe("optimizeBestXi: 全体最適化(局所貪欲との乖離)", () => {
  it("候補がその場しのぎで先に埋まった同系統スロット(LB)ではなく、後から見ても本職スロット(CB)へ収まる", () => {
    // 「最も候補が少ないスロットから埋める」だけの単純な貪欲法では、CB登録の唯一の候補が
    // 先にLB(related)へ割り当てられ、本来のCB(exact)スロットが候補不足のまま残り得る
    // (実際にこのタスクの開発中に発見・修正した具体的な乖離ケース)。
    // 全体最適化はスロット充足数を減らさない範囲でこれを是正し、本職(exact)を優先する。
    const defender = candidate(card("defender", "CB"));
    const { assignment } = optimizeBestXi({ slots: SLOTS, candidates: [defender] });
    const lcb = assignment.get("lcb");
    const rcb = assignment.get("rcb");
    const lb = assignment.get("lb");
    expect(lb).toBeUndefined();
    expect([lcb?.worldCardId, rcb?.worldCardId]).toContain("defender");
  });

  it("同系統内の複数候補でも、埋まるスロット数を最大化した上で本職優先の配置になる", () => {
    // 3人は完全に同一の能力値のため、どの2人がCBに入るかは同点(どの組合せも等しく最適)。
    // ここでは「特定の1人が必ずCBに入る」ことではなく、以下の不変条件だけを検証する:
    // (1) 3枠すべてが埋まる (2) CB本職スロット2枠は両方ともexactで埋まる
    // (3) 3人目はLB/RBのどちらかにrelatedで入る (4) 同じ候補が重複配置されない。
    const cbA = candidate(card("cbA", "CB"));
    const cbB = candidate(card("cbB", "CB"));
    const cbC = candidate(card("cbC", "CB"));
    const { assignment } = optimizeBestXi({ slots: SLOTS, candidates: [cbA, cbB, cbC] });
    expect(assignment.size).toBe(3);
    const lcb = assignment.get("lcb")?.worldCardId;
    const rcb = assignment.get("rcb")?.worldCardId;
    expect(lcb).toBeDefined();
    expect(rcb).toBeDefined();
    expect(lcb).not.toBe(rcb);
    const thirdSlotId = assignment.get("lb") ? "lb" : "rb";
    const thirdCardId = assignment.get(thirdSlotId)?.worldCardId;
    expect(thirdCardId).toBeDefined();
    // 3人とも重複なく使われている。
    expect(new Set([lcb, rcb, thirdCardId]).size).toBe(3);
    expect(new Set([lcb, rcb, thirdCardId])).toEqual(new Set(["cbA", "cbB", "cbC"]));
  });
});

describe("optimizeBestXi: 同一カード複数ビルドの最良変体選択", () => {
  it("同じカードでも、配置される具体的なスロットごとに最良のビルド変体を選ぶ(グローバルに『一番良いビルド』を機械的に選ばない)", () => {
    const base = card("multi", "CB");
    // ビルドA: CB向け(defensiveAwareness/tacklingが高い)。ビルドB: LB向け(speed/accelerationが高い)。
    const buildForCb = candidate(base, {
      candidateKey: "multi:bA",
      buildId: "bA",
      source: "build",
      stats: statsFor(card("multi", "CB", { defensiveAwareness: 95, tackling: 95, speed: 40, acceleration: 40 })),
    });
    const buildForLb = candidate(base, {
      candidateKey: "multi:bB",
      buildId: "bB",
      source: "build",
      stats: statsFor(card("multi", "CB", { defensiveAwareness: 40, tackling: 40, speed: 95, acceleration: 95 })),
    });
    const otherCb = candidate(card("otherCb", "CB"));
    const { assignment } = optimizeBestXi({ slots: SLOTS, candidates: [buildForCb, buildForLb, otherCb] });

    // multiはCBかLBのどちらかに入るはず。入った先ごとに、その先に適したビルドが選ばれているべき。
    const multiSlotId = [...assignment.entries()].find(([, c]) => c.worldCardId === "multi")?.[0];
    expect(multiSlotId).toBeDefined();
    const chosen = assignment.get(multiSlotId!)!;
    if (multiSlotId === "lcb" || multiSlotId === "rcb") {
      expect(chosen.buildId).toBe("bA");
    } else {
      expect(chosen.buildId).toBe("bB");
    }
    // 同じカードの2つのビルド変体が同時に採用されることはない。
    const multiCount = [...assignment.values()].filter((c) => c.worldCardId === "multi").length;
    expect(multiCount).toBe(1);
  });
});

describe("optimizeBestXi: 決定性", () => {
  it("候補配列の並び順を変えても結果(スロット→worldCardId+buildIdの対応)は変わらない", () => {
    const pool = [
      candidate(card("gk", "GK")),
      candidate(card("lb", "LB")),
      candidate(card("cbA", "CB")),
      candidate(card("cbB", "CB")),
      candidate(card("rb", "RB")),
      candidate(card("dmf", "DMF")),
      candidate(card("cmf1", "CMF")),
      candidate(card("cmf2", "CMF")),
      candidate(card("lwf", "LWF")),
      candidate(card("cf", "CF")),
      candidate(card("rwf", "RWF")),
    ];
    const shuffled = [...pool].reverse();
    const a = optimizeBestXi({ slots: SLOTS, candidates: pool });
    const b = optimizeBestXi({ slots: SLOTS, candidates: shuffled });
    const normalize = (m: Map<string, BestXiCandidate>) =>
      [...m.entries()].map(([slotId, c]) => `${slotId}:${c.worldCardId}:${c.buildId ?? ""}`).sort();
    expect(normalize(a.assignment)).toEqual(normalize(b.assignment));
  });
});

describe("optimizeBestXi: 性能(候補数30/120/300)", () => {
  function bigPool(n: number): BestXiCandidate[] {
    const positions = ["GK", "LB", "CB", "RB", "DMF", "CMF", "LWF", "CF", "RWF"];
    const out: BestXiCandidate[] = [];
    for (let i = 0; i < n; i++) {
      out.push(candidate(card(`p-${i}`, positions[i % positions.length])));
    }
    return out;
  }

  it.each([30, 120, 300])("候補数%i件でも妥当な時間で完了し、決定的である", (n) => {
    const pool = bigPool(n);
    const start = Date.now();
    const result1 = optimizeBestXi({ slots: SLOTS, candidates: pool });
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[optimizeBestXi performance] candidates=${n} elapsedMs=${elapsed}`);
    expect(elapsed).toBeLessThan(3000);
    expect(result1.assignment.size).toBeGreaterThan(0);

    const result2 = optimizeBestXi({ slots: SLOTS, candidates: pool });
    const normalize = (m: Map<string, BestXiCandidate>) =>
      [...m.entries()].map(([slotId, c]) => `${slotId}:${c.worldCardId}:${c.buildId ?? ""}`).sort();
    expect(normalize(result1.assignment)).toEqual(normalize(result2.assignment));
  });
});
