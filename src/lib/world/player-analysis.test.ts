import { describe, it, expect } from "vitest";
import {
  buildPlayerAnalysis,
  valuePercentile,
  PLAYER_MODEL_LABELS,
  POSITION_GRID_TEMPLATE,
} from "./player-analysis";
import type { WorldPlayerDetail } from "./types";
import type { EfhubAnalysisDetail } from "./analysis-repository";

function worldDetail(over: Partial<WorldPlayerDetail> = {}): WorldPlayerDetail {
  return {
    worldCardId: "89138556575063",
    nameEn: "Lionel Messi",
    nameJa: "リオネル メッシ",
    cardType: "BIG TIME",
    registeredPosition: "SS",
    ovrBase: 90,
    ovrMax: 105,
    maximumLevel: 32,
    cardRating: null,
    playingStyle: "Deep-Lying Forward",
    playingStyleDefensive: null,
    nationality: null,
    region: null,
    league: null,
    team: null,
    preferredFoot: "Left foot",
    age: 39,
    height: 170,
    weight: 67,
    boost1: 90,
    boost2: 44,
    appearanceUpdatedAt: null,
    imageUrlCandidate: null,
    mobileImageUrlCandidate: null,
    hasEfhubLink: false,
    efhubCardId: null,
    stats: [],
    playerSkills: ["Double Touch", "Through Passing", "Double Touch"],
    aiStyles: ["Trickster", "Mazing Run", "-"],
    appearance: {
      position: "SS",
      legCoverageRadius: 162.01,
      armCoverageRadius: 152.75,
      torsoCollision: 48.1,
      jumpingHeight: 231.03,
      dribbleHeight: 166,
      legLength: 3,
      ranks: {
        legCoverageRadius: {
          overall: { rank: 12733, total: 13009, topPercent: 98 },
          position: { rank: 214, total: 240, topPercent: 90 },
        },
      },
      updatedAt: null,
    },
    source: "world",
    sourceUrl: "x",
    fetchedAt: null,
    efhubConflicts: [],
    ...over,
  };
}

function efhub(over: Partial<EfhubAnalysisDetail> = {}): EfhubAnalysisDetail {
  return {
    cardId: "89138556575063",
    nameEn: "Lionel Messi",
    registeredPosition: "SS",
    weakFootUsage: 1,
    weakFootAccuracy: 3,
    form: 2,
    conditionValue: 3,
    injuryResistance: 1,
    playerModel: {
      armLength: 5,
      shoulderWidth: 9,
      neckLength: 6,
      chestMeasurement: 9,
      neckSize: 9,
      shoulderHeight: 2,
      legLength: 3,
      thighSize: 9,
      waistSize: 7,
      armSize: 10,
      calfSize: 10,
      legCoverageRadius: 162,
      armCoverageRadius: 152.8,
      jumpingHeight: 228.4,
      torsoCollision: 48.1,
      dribbleHeight: 166,
    },
    positions: [
      { code: "SS", familiarity: null, isRegistered: true },
      { code: "AMF", familiarity: 2, isRegistered: false },
      { code: "CF", familiarity: 2, isRegistered: false },
      { code: "CB", familiarity: 1, isRegistered: false },
    ],
    comSkills: ["trickster", "longBallExpert"],
    playerSkills: ["doubleTouch"],
    ...over,
  };
}

describe("buildPlayerAnalysis — ポジション", () => {
  it("eFHUB 詳細あり: 登録=SS / 適性=AMF,CF / 部分=CB / OVR 数値は一切出さない", () => {
    const a = buildPlayerAnalysis(worldDetail(), efhub());
    expect(a.positions.confirmation).toBe("suitability_only");
    expect(a.positions.registered).toBe("SS");
    const flat = a.positions.grid.flat().filter((c): c is NonNullable<typeof c> => c != null);
    expect(flat.find((c) => c.code === "SS")?.kind).toBe("registered");
    expect(flat.find((c) => c.code === "AMF")?.kind).toBe("suitable");
    expect(flat.find((c) => c.code === "CF")?.kind).toBe("suitable");
    expect(flat.find((c) => c.code === "CB")?.kind).toBe("partial");
    expect(flat.find((c) => c.code === "GK")?.kind).toBe("none");
    // どこにも OVR 数値プロパティが無い
    expect(JSON.stringify(a.positions)).not.toMatch(/"ovr"|overall.*rank/i);
    expect(a.positions.ovrNote).toMatch(/計算規則を確認できていない|推測で算式を作りません/);
  });

  it("eFHUB 詳細なし: unresolved・登録ポジションだけ・他は none", () => {
    const a = buildPlayerAnalysis(worldDetail(), null);
    expect(a.positions.confirmation).toBe("unresolved");
    const flat = a.positions.grid.flat().filter((c): c is NonNullable<typeof c> => c != null);
    expect(flat.find((c) => c.code === "SS")?.kind).toBe("registered");
    expect(flat.filter((c) => c.kind === "suitable" || c.kind === "partial")).toHaveLength(0);
  });

  it("カード ID / 登録ポジションが食い違う eFHUB 詳細は使わない", () => {
    const a = buildPlayerAnalysis(worldDetail(), efhub({ registeredPosition: "GK" }));
    expect(a.positions.confirmation).toBe("unresolved");
    expect(a.model.source).toBe("world_partial"); // legLength は appearance から
  });

  it("familiarityRows: 登録＋副ポジションの生値を返す・登録が先頭・OVR は含まない", () => {
    const a = buildPlayerAnalysis(worldDetail(), efhub());
    expect(a.positions.familiarityRows[0]).toMatchObject({ code: "SS", isRegistered: true });
    const cb = a.positions.familiarityRows.find((r) => r.code === "CB");
    expect(cb).toMatchObject({ familiarity: 1, isRegistered: false });
    expect(a.positions.source).toMatch(/eFHUB/);
    // どの行にも OVR 数値プロパティは無い
    for (const r of a.positions.familiarityRows) {
      expect(Object.keys(r).sort()).toEqual(["code", "familiarity", "isRegistered"]);
    }
  });

  it("eFHUB 詳細なし: familiarityRows は空・source は World のみ", () => {
    const a = buildPlayerAnalysis(worldDetail(), null);
    expect(a.positions.familiarityRows).toEqual([]);
    expect(a.positions.source).toMatch(/未収録/);
  });

  it("グリッドテンプレートは固定（3 列・全内部コードを含む）", () => {
    const codes = POSITION_GRID_TEMPLATE.flat().filter(Boolean);
    for (const c of ["GK", "CB", "LB", "RB", "DMF", "CMF", "AMF", "LMF", "RMF", "LWF", "RWF", "SS", "CF"]) {
      expect(codes).toContain(c);
    }
  });
});

describe("buildPlayerAnalysis — プレーヤーモデル", () => {
  it("eFHUB モデルあり: 11 項目 + source=efhub_detail、単位を付けない（生値）", () => {
    const a = buildPlayerAnalysis(worldDetail(), efhub());
    expect(a.model.source).toBe("efhub_detail");
    expect(a.model.fields).toHaveLength(PLAYER_MODEL_LABELS.length);
    expect(a.model.fields.find((f) => f.key === "armLength")?.value).toBe(5);
    expect(a.model.fields.every((f) => typeof f.value === "number" || f.value === null)).toBe(true);
    expect(a.model.availableCount).toBe(11);
  });

  it("eFHUB なし: legLength だけ appearance から / 他 10 は null / source=world_partial", () => {
    const a = buildPlayerAnalysis(worldDetail(), null);
    expect(a.model.source).toBe("world_partial");
    expect(a.model.fields.find((f) => f.key === "legLength")?.value).toBe(3);
    expect(a.model.fields.filter((f) => f.value != null)).toHaveLength(1);
  });

  it("appearance も無い: source=none", () => {
    const a = buildPlayerAnalysis(worldDetail({ appearance: null }), null);
    expect(a.model.source).toBe("none");
    expect(a.model.availableCount).toBe(0);
  });

  it("0 は実値（null と区別）: shoulderHeight=0 は value 0 で保持・availableCount に数える", () => {
    const e = efhub();
    e.playerModel!.shoulderHeight = 0;
    const a = buildPlayerAnalysis(worldDetail(), e);
    expect(a.model.fields.find((f) => f.key === "shoulderHeight")?.value).toBe(0);
    expect(a.model.availableCount).toBe(11);
  });
});

describe("buildPlayerAnalysis — 物理データ", () => {
  it("5 メトリクス・値と順位（ある分だけ）", () => {
    const a = buildPlayerAnalysis(worldDetail(), null);
    expect(a.physical.metrics.map((m) => m.key)).toEqual([
      "legCoverageRadius",
      "armCoverageRadius",
      "jumpingHeight",
      "torsoCollision",
      "dribbleHeight",
    ]);
    expect(a.physical.metrics[0].value).toBeCloseTo(162.01);
    expect(a.physical.metrics[0].overallRank).toEqual({ rank: 12733, total: 13009, topPercent: 98 });
    expect(a.physical.metrics[1].overallRank).toBeNull();
    expect(a.physical.hasRanks).toBe(true);
  });

  it("appearance 無し: 全メトリクス value=null・hasRanks=false", () => {
    const a = buildPlayerAnalysis(worldDetail({ appearance: null }), null);
    expect(a.physical.metrics.every((m) => m.value == null)).toBe(true);
    expect(a.physical.hasRanks).toBe(false);
  });

  it("0 や小数も実値として保持", () => {
    const w = worldDetail();
    w.appearance!.torsoCollision = 0;
    const a = buildPlayerAnalysis(w, null);
    expect(a.physical.metrics.find((m) => m.key === "torsoCollision")?.value).toBe(0);
  });
});

describe("valuePercentile — 値が大きいほど 100 に近い（誤解しにくい向き）", () => {
  it("rank 1（最大値）→ ほぼ 100", () => {
    expect(valuePercentile({ rank: 1, total: 13009 })).toBe(100);
  });
  it("rank = total（最小値）→ 0", () => {
    expect(valuePercentile({ rank: 13009, total: 13009 })).toBe(0);
  });
  it("中央 → ~50", () => {
    expect(valuePercentile({ rank: 6505, total: 13009 })).toBe(50);
  });
  it("Messi の脚カバー半径 12,733 / 13,009 → 2（小さい値・「上位98%」は使わない）", () => {
    expect(valuePercentile({ rank: 12733, total: 13009 })).toBe(2);
  });
  it("母数 0 は 0（ゼロ除算しない）", () => {
    expect(valuePercentile({ rank: 1, total: 0 })).toBe(0);
  });
});

describe("buildPlayerAnalysis — スキル", () => {
  it("playerSkills は重複除去 / aiStyles は '-' を除去", () => {
    const a = buildPlayerAnalysis(worldDetail(), efhub());
    expect(a.skills.playerSkills).toEqual(["Double Touch", "Through Passing"]);
    expect(a.skills.aiStyles).toEqual(["Trickster", "Mazing Run"]);
    expect(a.skills.highlightAvailable).toBe(false);
  });

  it("aiStyles が空なら comSkills を Title Case で補完", () => {
    const a = buildPlayerAnalysis(worldDetail({ aiStyles: ["-"] }), efhub());
    expect(a.skills.aiStyles).toEqual([]);
    expect(a.skills.comSkillsFallback).toEqual(["Trickster", "Long Ball Expert"]);
  });

  it("スキルが空配列でもクラッシュしない", () => {
    const a = buildPlayerAnalysis(worldDetail({ playerSkills: [], aiStyles: [] }), null);
    expect(a.skills.playerSkills).toEqual([]);
    expect(a.skills.aiStyles).toEqual([]);
    expect(a.skills.comSkillsFallback).toEqual([]);
  });
});

describe("buildPlayerAnalysis — その他特性", () => {
  it("eFHUB あり: 逆足/フォーム/怪我耐性は生値 + raw_unverified", () => {
    const a = buildPlayerAnalysis(worldDetail(), efhub());
    const wfu = a.traits.fields.find((t) => t.key === "weakFootUsage")!;
    expect(wfu.value).toBe(1);
    expect(wfu.confirmation).toBe("raw_unverified");
    const foot = a.traits.fields.find((t) => t.key === "preferredFoot")!;
    expect(foot.value).toBe("Left foot");
    expect(foot.confirmation).toBe("fact");
  });

  it("eFHUB なし: 逆足等は missing / 利き足・身長・体重・年齢は fact", () => {
    const a = buildPlayerAnalysis(worldDetail(), null);
    expect(a.traits.fields.find((t) => t.key === "weakFootUsage")?.confirmation).toBe("missing");
    expect(a.traits.fields.find((t) => t.key === "height")?.value).toBe("170 cm");
    expect(a.traits.fields.find((t) => t.key === "age")?.confirmation).toBe("fact");
  });

  it("身長/体重/年齢が無いカード: missing", () => {
    const a = buildPlayerAnalysis(worldDetail({ height: null, weight: null, age: null }), null);
    expect(a.traits.fields.find((t) => t.key === "height")?.confirmation).toBe("missing");
  });
});
