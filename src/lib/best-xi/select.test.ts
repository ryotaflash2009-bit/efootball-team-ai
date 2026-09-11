import { describe, it, expect } from "vitest";
import { calculateBuild, emptyAllocation } from "@/lib/progression/engine";
import { MESSI_BIGTIME } from "@/lib/progression/fixtures";
import type { ProgressionCard, StatBreakdown } from "@/lib/progression/types";
import type { BestXiCandidate } from "./types";
import { selectBestXi } from "./select";
import { computeRankTuple } from "./rank";

const NOW = "2026-09-10T00:00:00.000Z";

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

function baseCandidate(c: ProgressionCard, opts: Partial<BestXiCandidate> = {}): BestXiCandidate {
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

/** 4-3-3の11スロットすべてを本職適性で埋められる候補プール。 */
function fullPool(): BestXiCandidate[] {
  return [
    baseCandidate(card("1", "GK")),
    baseCandidate(card("2", "LB")),
    baseCandidate(card("3", "CB")),
    baseCandidate(card("4", "CB")),
    baseCandidate(card("5", "RB")),
    baseCandidate(card("6", "DMF")),
    baseCandidate(card("7", "CMF")),
    baseCandidate(card("8", "CMF")),
    baseCandidate(card("9", "LWF")),
    baseCandidate(card("10", "CF")),
    baseCandidate(card("11", "RWF")),
  ];
}

describe("selectBestXi: 完全な候補", () => {
  it("11人すべてのスロットを埋める", () => {
    const result = selectBestXi({ formationId: "4-3-3", candidates: fullPool(), unavailableCards: [], generatedAt: NOW });
    expect(result.slots).toHaveLength(11);
    expect(result.unfilledSlots).toHaveLength(0);
  });

  it("GK/DF/MF/FWの人数が正しい(4-3-3: GK1,DF4,MF3,FW3)", () => {
    const result = selectBestXi({ formationId: "4-3-3", candidates: fullPool(), unavailableCards: [], generatedAt: NOW });
    const byPos = (positions: string[]) => result.slots.filter((s) => positions.includes(s.position)).length;
    expect(byPos(["GK"])).toBe(1);
    expect(byPos(["LB", "CB", "RB"])).toBe(4);
    expect(byPos(["DMF", "CMF"])).toBe(3);
    expect(byPos(["LWF", "CF", "RWF"])).toBe(3);
  });

  it("同じカード・同じworldCardIdの重複配置がない", () => {
    const result = selectBestXi({ formationId: "4-3-3", candidates: fullPool(), unavailableCards: [], generatedAt: NOW });
    const ids = result.slots.map((s) => s.candidate.worldCardId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("本職適性の候補は exact として選出され、選考理由に exactPosition を含む", () => {
    const result = selectBestXi({ formationId: "4-3-3", candidates: fullPool(), unavailableCards: [], generatedAt: NOW });
    for (const slot of result.slots) {
      expect(slot.suitability.tier).toBe("exact");
      expect(slot.reasonCodes).toContain("exactPosition");
      expect(slot.reasonCodes.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("selectBestXi: 同一カード複数ビルド", () => {
  it("同じカードの複数ビルドから最適な1件だけを採用し、他は同時起用しない", () => {
    const messi = card("multi", "CF");
    const pool = [
      ...fullPool().filter((c) => c.worldCardId !== "10"), // CF枠の基準候補を外す
      baseCandidate(messi, { candidateKey: "multi:bA", buildId: "bA", buildName: "ビルドA", source: "build" }),
      baseCandidate(messi, { candidateKey: "multi:bB", buildId: "bB", buildName: "ビルドB", source: "build" }),
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const cfSlot = result.slots.find((s) => s.position === "CF");
    expect(cfSlot?.candidate.worldCardId).toBe("multi");
    // CFスロット自身の文脈では、採用されなかった方の兄弟ビルドが
    // 「同一カードの別ビルドが採用済み」として選外候補に記録される。
    const exclusion = result.notableExclusions.find(
      (e) => e.relatedSlotId === cfSlot?.slotId && e.candidate.worldCardId === "multi" && e.candidateKey !== cfSlot?.candidate.candidateKey,
    );
    expect(exclusion?.reasonCode).toBe("sameCardBuildUsedElsewhere");
  });
});

describe("selectBestXi: 候補不足", () => {
  it("候補が8人だけの場合、8人以内しか選出せず残りは空きスロットになる", () => {
    const partial = fullPool().slice(0, 8);
    const result = selectBestXi({ formationId: "4-3-3", candidates: partial, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.length).toBeLessThanOrEqual(8);
    expect(result.unfilledSlots.length).toBe(11 - result.slots.length);
  });

  it("GK候補が無い場合、GK枠は空きになりフィールド選手で埋めない", () => {
    const noGk = fullPool().filter((c) => c.worldCardId !== "1");
    const result = selectBestXi({ formationId: "4-3-3", candidates: noGk, unavailableCards: [], generatedAt: NOW });
    const gkSlot = result.slots.find((s) => s.position === "GK");
    expect(gkSlot).toBeUndefined();
    const unfilledGk = result.unfilledSlots.find((s) => s.position === "GK");
    expect(unfilledGk).toBeDefined();
    expect(unfilledGk?.reason).toBe("noCandidate");
    // 他のスロットは選考できる範囲で埋まる
    expect(result.slots.length).toBe(10);
  });

  it("CB候補が1人だけの場合、候補総数(10人)を超えて選出せず、同じ候補を2回配置しない", () => {
    // fullPool(11人=11スロット過不足なし)からCBを1人だけ外す → 候補10人に対しスロット11。
    // 他の同系統候補(LB/RB)が条件付きでその枠を埋めることはあり得るため、
    // 「空くのが必ずCB」とは断定しない(適性データが薄い環境では既存ルール上も断定できないため)。
    // ここで確認するのは: 候補不足で必ずどこか1枠は埋まらない・除去した本人は現れない・重複がないこと。
    const removedCbId = "4";
    const oneCb = fullPool().filter((c) => c.worldCardId !== removedCbId);
    const result = selectBestXi({ formationId: "4-3-3", candidates: oneCb, unavailableCards: [], generatedAt: NOW });
    expect(result.slots).toHaveLength(10);
    expect(result.unfilledSlots).toHaveLength(1);
    // 除去したCB本人(worldCardId "4")は当然どこにも出現しない
    expect(result.slots.some((s) => s.candidate.worldCardId === removedCbId)).toBe(false);
    // 使用済みの候補に重複がない
    const usedIds = result.slots.map((s) => s.candidate.worldCardId);
    expect(new Set(usedIds).size).toBe(usedIds.length);
  });

  it("架空の選手を生成しない(入力候補より多い選手数を出さない)", () => {
    const partial = fullPool().slice(0, 3);
    const result = selectBestXi({ formationId: "4-3-3", candidates: partial, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.length).toBeLessThanOrEqual(3);
  });
});

describe("selectBestXi: 適性不足の除外", () => {
  it("GK登録の選手をフィールド候補として無理配置しない", () => {
    const gkOnly = [baseCandidate(card("1", "GK"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: gkOnly, unavailableCards: [], generatedAt: NOW });
    const nonGkSlots = result.slots.filter((s) => s.position !== "GK");
    expect(nonGkSlots).toHaveLength(0);
  });
});

describe("selectBestXi: 決定性", () => {
  it("候補の並び順を入れ替えても同じ結果になる", () => {
    const pool = fullPool();
    const reversed = [...pool].reverse();
    const r1 = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const r2 = selectBestXi({ formationId: "4-3-3", candidates: reversed, unavailableCards: [], generatedAt: NOW });
    const key = (r: typeof r1) => r.slots.map((s) => `${s.slotId}:${s.candidate.candidateKey}`).sort().join("|");
    expect(key(r1)).toBe(key(r2));
  });

  it("同じ入力からは常に同じ選考結果を返す", () => {
    const pool = fullPool();
    const r1 = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const r2 = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(r1).toEqual(r2);
  });

  it("入力候補配列を変更しない", () => {
    const pool = fullPool();
    const before = JSON.stringify(pool);
    selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(JSON.stringify(pool)).toBe(before);
  });
});

describe("selectBestXi: 旧規則・壊れたデータ", () => {
  it("旧規則(legacy)の候補も条件付きで利用でき、例外を投げない", () => {
    const pool = fullPool();
    pool[0] = { ...pool[0], ruleKind: "legacy" };
    expect(() => selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW })).not.toThrow();
  });

  it("能力データが無い(abilityStatus unavailable)候補は除外され、有効な候補だけで部分結果を作る", () => {
    const pool = fullPool();
    pool[0] = { ...pool[0], abilityStatus: "unavailable", stats: null };
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const gkSlot = result.slots.find((s) => s.position === "GK");
    expect(gkSlot).toBeUndefined();
    // NaN・undefinedが混入しない
    for (const slot of result.slots) {
      expect(Number.isNaN(slot.positionRating)).toBe(false);
    }
  });

  it("registeredPositionがnullの候補でも例外を投げず安全に扱う", () => {
    const pool = fullPool();
    pool[0] = { ...pool[0], registeredPosition: null };
    expect(() => selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW })).not.toThrow();
  });
});

describe("selectBestXi: 性能", () => {
  it("大量の候補があっても妥当な時間で完了し、結果は決定的である", () => {
    const positions = ["GK", "LB", "CB", "RB", "DMF", "CMF", "LWF", "CF", "RWF"];
    const big: BestXiCandidate[] = [];
    for (let i = 0; i < 300; i++) {
      const pos = positions[i % positions.length];
      big.push(baseCandidate(card(`big-${i}`, pos)));
    }
    const start = Date.now();
    const result = selectBestXi({ formationId: "4-3-3", candidates: big, unavailableCards: [], generatedAt: NOW });
    const elapsed = Date.now() - start;
    expect(result.slots.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);

    const result2 = selectBestXi({ formationId: "4-3-3", candidates: big, unavailableCards: [], generatedAt: NOW });
    expect(result).toEqual(result2);
  });
});

describe("selectBestXi: 集計値", () => {
  it("candidateCount・availableBuildCount・excludedCandidateCountを正しく報告する", () => {
    const messi = card("multi", "CF");
    const pool = [
      ...fullPool().filter((c) => c.worldCardId !== "10"),
      baseCandidate(messi, { candidateKey: "multi:bA", buildId: "bA", source: "build" }),
      baseCandidate(messi, { candidateKey: "multi:bB", buildId: "bB", source: "build" }),
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.candidateCount).toBe(11); // 重複worldCardIdを除いた人数
    expect(result.availableBuildCount).toBe(2);
  });
});

/**
 * 不具合A回帰テスト: 「ポジション別推定評価を計算できること」と「そのスロットへ自動配置してよいこと」を
 * 混同しない。登録ポジションの系統(GK/DF/MF/FW)がスロットの系統と異なる(unresolved)候補は、
 * 推定評価の数値が存在しても自動選出しない。実画面で確認された「攻撃系選手がCBへ配置される」問題の
 * 直接的な再現・回帰テスト。
 */
describe("selectBestXi: 不適切配置の回帰(不具合A)", () => {
  it("SS登録選手をCBへ自動配置しない(GK+SSのみの候補プール)", () => {
    // SSはFW系統のため、同じFW系統のLWF/CF/RWFへ「related」で入ることはあり得るが、
    // 系統が異なるCB(DF)へは(unresolvedのため)自動配置されない。
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("attacker", "SS"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const cbSlots = result.slots.filter((s) => s.position === "CB");
    expect(cbSlots).toHaveLength(0);
    expect(result.slots.some((s) => s.candidate.worldCardId === "attacker" && s.position === "CB")).toBe(false);
  });

  it("CF登録選手をCBへ自動配置しない", () => {
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("attacker", "CF"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.filter((s) => s.position === "CB")).toHaveLength(0);
    expect(result.slots.some((s) => s.candidate.worldCardId === "attacker" && s.position === "CB")).toBe(false);
  });

  it("RWF登録選手をCBへ自動配置しない", () => {
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("attacker", "RWF"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.filter((s) => s.position === "CB")).toHaveLength(0);
    expect(result.slots.some((s) => s.candidate.worldCardId === "attacker" && s.position === "CB")).toBe(false);
  });

  it("LWF登録選手をDMFへ自動配置しない", () => {
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("winger", "LWF"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.filter((s) => s.position === "DMF")).toHaveLength(0);
    expect(result.slots.some((s) => s.candidate.worldCardId === "winger" && s.position === "DMF")).toBe(false);
  });

  it("CB登録選手をCFへ自動配置しない", () => {
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("defender", "CB"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.filter((s) => s.position === "CF")).toHaveLength(0);
    // CB登録選手は本職のCBスロットへは配置されてよい
    expect(result.slots.some((s) => s.candidate.worldCardId === "defender" && s.position === "CB")).toBe(true);
  });

  it("実画面再現(フルパイプライン): CB候補が皆無で、他ポジションが全員本職で埋まっている状況でも、行き場のない攻撃系選手をCBへ押し込まない", () => {
    // GK/LB/RB/DMF/CMF×2/LWF/CF/RWFは全員本職(exact)候補がいるためそこへ収まる。
    // CB候補は0人。唯一の「行き場を失った」候補はSS登録選手(4-3-3にSS専用スロットは無い)。
    // 修正前のロジックでは、SS選手がunresolvedのままCBスロットへ押し込まれ得た
    // (実画面で確認された不具合そのものの再現条件)。
    const pool = [
      baseCandidate(card("gk", "GK")),
      baseCandidate(card("lb", "LB")),
      baseCandidate(card("rb", "RB")),
      baseCandidate(card("dmf", "DMF")),
      baseCandidate(card("cmf1", "CMF")),
      baseCandidate(card("cmf2", "CMF")),
      baseCandidate(card("lwf", "LWF")),
      baseCandidate(card("cf", "CF")),
      baseCandidate(card("rwf", "RWF")),
      baseCandidate(card("ss_cornered", "SS")),
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.some((s) => s.candidate.worldCardId === "ss_cornered" && s.position === "CB")).toBe(false);
    // CB候補が皆無なので、両CBスロットとも候補不足になる(架空の選手で埋めない)。
    expect(result.unfilledSlots.filter((s) => s.position === "CB")).toHaveLength(2);
    // 行き場のないSS選手自体も、どのスロットにも無理配置されない(全スロットが埋まるかCB以外で候補不足)。
    expect(result.slots.some((s) => s.candidate.worldCardId === "ss_cornered")).toBe(false);
  });

  it("実画面再現: 攻撃系(SS/CF/RWF)3人+GK+本職CB1人のプールで、CBスロットは本職候補だけが入り、攻撃系はCBへ入らない", () => {
    const pool = [
      baseCandidate(card("gk", "GK")),
      baseCandidate(card("ss1", "SS")),
      baseCandidate(card("cf1", "CF")),
      baseCandidate(card("rwf1", "RWF")),
      baseCandidate(card("cb1", "CB")),
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const cbSlots = result.slots.filter((s) => s.position === "CB");
    expect(cbSlots).toHaveLength(1);
    expect(cbSlots[0].candidate.worldCardId).toBe("cb1");
    expect(cbSlots[0].suitability.tier).toBe("exact");
    // もう1つのCBスロットは候補不足(攻撃系で埋められていない)
    const unfilledCb = result.unfilledSlots.filter((s) => s.position === "CB");
    expect(unfilledCb).toHaveLength(1);
    expect(["ss1", "cf1", "rwf1"]).not.toContain(result.slots.find((s) => s.position === "CB")?.candidate.worldCardId ?? "");
  });

  it("推定評価(positionRating)の数値がCBに対して計算できても、unresolvedなら選出しない", () => {
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("attacker", "CF"))];
    const attackerForCb = computeRankTuple(pool[1], "CB").tuple;
    // 推定評価自体は計算できる(nullではない)ことを確認したうえで、それでも不適格(除外)であることを検証する。
    expect(attackerForCb.positionRating).not.toBeNull();
    expect(attackerForCb.eligible).toBe(false);
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.some((s) => s.candidate.worldCardId === "attacker" && s.position === "CB")).toBe(false);
  });

  it("関連ポジション(同系統DF)と確認できる候補は既存規則どおり自動選出できる(本職スロットが埋まった後、CB登録選手がLBへ)", () => {
    // lcb/rcbを本職候補で先に埋めたうえで、3人目のCB登録選手が「related」でLBへ入れることを確認する。
    const pool = [
      baseCandidate(card("gk", "GK")),
      baseCandidate(card("cbA", "CB")),
      baseCandidate(card("cbB", "CB")),
      baseCandidate(card("cb1", "CB")),
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const cbSlots = result.slots.filter((s) => s.position === "CB");
    expect(cbSlots.map((s) => s.suitability.tier)).toEqual(["exact", "exact"]);
    const lbSlot = result.slots.find((s) => s.position === "LB");
    expect(lbSlot?.candidate.worldCardId).toBe("cb1");
    expect(lbSlot?.suitability.tier).toBe("related");
    // cb1個人にとってはCB(本職)の方が高評価なはずだが、CB本職枠は既に埋まっているため
    // チーム全体最適化のためにLBへ配置されている。このことを示す理由コードが付く。
    expect(lbSlot?.reasonCodes).toContain("optimalOverallPlacement");
  });

  it("CB候補が1人ならCBを1人だけ選出し、もう1枠は候補不足になる(攻撃系で埋めない)", () => {
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("cb1", "CB")), baseCandidate(card("cf1", "CF"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const cbSlots = result.slots.filter((s) => s.position === "CB");
    expect(cbSlots).toHaveLength(1);
    expect(cbSlots[0].candidate.worldCardId).toBe("cb1");
    expect(result.unfilledSlots.filter((s) => s.position === "CB")).toHaveLength(1);
  });

  it("候補不足でも他の有効スロットの選考は継続する", () => {
    const pool = [baseCandidate(card("gk", "GK")), baseCandidate(card("cf1", "CF")), baseCandidate(card("dmf1", "DMF"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.some((s) => s.position === "GK" && s.candidate.worldCardId === "gk")).toBe(true);
    expect(result.slots.some((s) => s.position === "CF" && s.candidate.worldCardId === "cf1")).toBe(true);
    expect(result.slots.some((s) => s.position === "DMF" && s.candidate.worldCardId === "dmf1")).toBe(true);
    expect(result.unfilledSlots.length).toBeGreaterThan(0);
  });

  it("行き場のないunresolved候補は、選外候補一覧に「適性を確認できない」理由(positionSuitabilityUnresolved)で表示され得る", () => {
    // LB/RB登録候補を含めない(DF系統でCBの選外候補枠を先取りする競合者をなくす)ことで、
    // 行き場を失ったSS登録選手が、CB等のDFスロットの選外候補として確実に検出されるようにする。
    const pool = [
      baseCandidate(card("gk", "GK")),
      baseCandidate(card("dmf", "DMF")),
      baseCandidate(card("cmf1", "CMF")),
      baseCandidate(card("cmf2", "CMF")),
      baseCandidate(card("lwf", "LWF")),
      baseCandidate(card("cf", "CF")),
      baseCandidate(card("rwf", "RWF")),
      baseCandidate(card("ss_cornered", "SS")),
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.some((s) => s.candidate.worldCardId === "ss_cornered")).toBe(false);
    const exclusion = result.notableExclusions.find((e) => e.candidate.worldCardId === "ss_cornered");
    expect(exclusion?.reasonCode).toBe("positionSuitabilityUnresolved");
  });

  it("gkMismatchは引き続き自動選出しない(フィールド選手をGKへ配置しない)", () => {
    const pool = [baseCandidate(card("cf1", "CF"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.some((s) => s.position === "GK")).toBe(false);
  });

  it("GK登録選手をフィールドスロットへ配置しない(GKだけの候補プール)", () => {
    const pool = [baseCandidate(card("gk1", "GK"))];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.filter((s) => s.position !== "GK")).toHaveLength(0);
  });

  it("GK⇔フィールドの不一致は「適性を確認できない」とは別の理由(gkFieldMismatch)として選外候補に表示され得る", () => {
    // 2人目のGK登録選手はGKスロットに選出されない(1人目の方が評価が高い)が、
    // フィールドスロットに対しては「GKとフィールドが不一致」という、系統不明(unresolved)とは
    // 区別できる確実な不適性の理由で選外候補として検討され得る。
    const gk1 = baseCandidate(card("gk1", "GK", { gkAwareness: 95, gkCatching: 95, gkParrying: 95, gkReflexes: 95, gkReach: 95 }));
    const gk2 = baseCandidate(card("gk2", "GK", { gkAwareness: 55, gkCatching: 55, gkParrying: 55, gkReflexes: 55, gkReach: 55 }));
    const result = selectBestXi({ formationId: "4-3-3", candidates: [gk1, gk2], unavailableCards: [], generatedAt: NOW });
    const gkSlot = result.slots.find((s) => s.position === "GK");
    expect(gkSlot?.candidate.worldCardId).toBe("gk1");
    const exclusion = result.notableExclusions.find((e) => e.candidate.worldCardId === "gk2");
    expect(exclusion?.reasonCode).toBe("gkFieldMismatch");
  });
});

describe("selectBestXi: 全体最適化(全体のスロット充足数・本職数・同系統数の集計)", () => {
  it("filledRequiredSlotCount・exactSelectionCount・relatedSelectionCountを実際の配置と一致させて報告する", () => {
    const result = selectBestXi({ formationId: "4-3-3", candidates: fullPool(), unavailableCards: [], generatedAt: NOW });
    expect(result.filledRequiredSlotCount).toBe(11);
    expect(result.exactSelectionCount).toBe(11);
    expect(result.relatedSelectionCount).toBe(0);
  });

  it("同系統配置(related)を含む場合、related件数が正しく反映される", () => {
    const pool = [
      baseCandidate(card("gk", "GK")),
      baseCandidate(card("cbA", "CB")),
      baseCandidate(card("cbB", "CB")),
      baseCandidate(card("cb1", "CB")), // 3人目はLBへrelatedで入る
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.filledRequiredSlotCount).toBe(4);
    expect(result.exactSelectionCount).toBe(3); // gk, cbA, cbB
    expect(result.relatedSelectionCount).toBe(1); // cb1がLBへ
  });
});

describe("selectBestXi: 保存済み育成目的(buildIntent)の補助的な使用", () => {
  it("実際に配置されたスロットが保存済み使用予定ポジションと一致する場合、補助的な選考理由として表示され得る", () => {
    // cbA/cbBがCB本職枠を埋めるため、3人目のcb1はLB(related)へ配置される。
    // cb1が「LBを使う予定」と保存済み育成目的で申告していれば、その一致を補助的理由として表示できる。
    const pool = [
      baseCandidate(card("gk", "GK")),
      baseCandidate(card("cbA", "CB")),
      baseCandidate(card("cbB", "CB")),
      baseCandidate(card("cb1", "CB"), { intendedPositions: ["LB"] }),
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const lbSlot = result.slots.find((s) => s.position === "LB");
    expect(lbSlot?.candidate.worldCardId).toBe("cb1");
    expect(lbSlot?.reasonCodes).toContain("intentPositionMatch");
  });

  it("保存済み育成目的は実際の適性・評価より優先されない(intendedPositionsだけで配置は決まらない)", () => {
    // cbAはLB registeredで「LBを使う予定」と自己申告しているが、実際のポジション登録はLBそのものなので
    // 本職として自然にLBへ入るだけであり、CBへは(未確認の適性を根拠に)配置されない。
    const pool = [
      baseCandidate(card("gk", "GK")),
      baseCandidate(card("attacker", "SS"), { intendedPositions: ["CB"] }), // 育成目的だけでCBを主張しても無視される
    ];
    const result = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.some((s) => s.candidate.worldCardId === "attacker" && s.position === "CB")).toBe(false);
  });
});

describe("selectBestXi: 決定性(候補配列の並び順・防御的な候補プール上限)", () => {
  it("候補配列の並び順を変えても最終結果(スロット→選手の対応)は変わらない", () => {
    const pool = fullPool();
    const shuffled = [...pool].reverse();
    const a = selectBestXi({ formationId: "4-3-3", candidates: pool, unavailableCards: [], generatedAt: NOW });
    const b = selectBestXi({ formationId: "4-3-3", candidates: shuffled, unavailableCards: [], generatedAt: NOW });
    const normalize = (r: typeof a) => r.slots.map((s) => `${s.slotId}:${s.candidate.candidateKey}`).sort();
    expect(normalize(a)).toEqual(normalize(b));
  });

  it("候補プールが防御的な上限を超える極端に巨大な入力でも、決定的に完了し制限事項として開示される", () => {
    const positions = ["GK", "LB", "CB", "RB", "DMF", "CMF", "LWF", "CF", "RWF"];
    const huge: BestXiCandidate[] = [];
    for (let i = 0; i < 350; i++) {
      huge.push(baseCandidate(card(`huge-${i}`, positions[i % positions.length])));
    }
    const result = selectBestXi({ formationId: "4-3-3", candidates: huge, unavailableCards: [], generatedAt: NOW });
    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.limitationCodes).toContain("largeCandidatePoolBounded");

    const result2 = selectBestXi({ formationId: "4-3-3", candidates: huge, unavailableCards: [], generatedAt: NOW });
    expect(result).toEqual(result2);
  });
});
