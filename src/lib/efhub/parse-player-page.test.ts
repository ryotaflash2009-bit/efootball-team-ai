import { describe, it, expect } from "vitest";
import { parsePlayerPage, ParserStructureError } from "./parse-player-page";
import { serializeCard, deserializeCard } from "./card-store";
import { STAT_DEFINITIONS, STAT_KEYS } from "./masters";
import { PARSER_VERSION } from "./parser-version";
import messiGolden from "@/data/cards/89138556575063.json";
import cannavaroGolden from "@/data/cards/88041460996837.json";

/**
 * 合成 RSC ページ（本調査 docs/player-root-findings.md の実構造から作成）でパーサを検証する。
 * 生レスポンスは保存しない方針のため、フィクスチャはコード内で組み立てる。
 */

function rscScript(rows: string[]): string {
  const chunk = rows.map((r) => r + "\n").join("");
  return `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`;
}

// ---- Messi (89138556575063) の実データ ----
const MESSI_BASE_STATS = {
  offensiveAwareness: 81, ballControl: 86, dribbling: 87, tightPossession: 86, lowPass: 82,
  loftedPass: 80, finishing: 80, heading: 49, setPieceTaking: 83, curl: 86, speed: 76,
  acceleration: 81, kickingPower: 77, jump: 48, physicalContact: 77, balance: 82, stamina: 72,
  defensiveAwareness: 44, ballWinning: 42, trackingBack: 42, aggression: 42, gkAwareness: 40,
  gkCatching: 40, gkClearing: 40, gkReflexes: 40, gkReach: 40,
};
const MESSI_SKILLS = [
  "doubleTouch", "longRangeDrive", "firstTimeShot", "oneTouchPass", "throughPassing",
  "pinpointCrossing", "captaincy", "momentumDribbling", "edgedCrossing", "magneticFeet",
];
const MESSI_ADD_POS = [
  { position: "RMF", familiarity: 2 }, { position: "AMF", familiarity: 2 },
  { position: "RWF", familiarity: 2 }, { position: "CF", familiarity: 2 },
];
const MESSI_MODEL = {
  armLength: 5, shoulderWidth: 9, neckLength: 6, chestMeasurement: 9, neckSize: 9,
  shoulderHeight: 2, legLength: 3, thighSize: 9, waistSize: 7, armSize: 10, calfSize: 10,
  legCoverageRadius: 162, armCoverageRadius: 152.8, jumpingHeight: 228.4, torsoCollision: 48.1,
  dribbleHeight: 166,
};
const MESSI_PLAYER = {
  id: "89138556575063", playerId: "89138556575063",
  name: "Lionel Messi", nameJa: "リオネル メッシ", nameZh: "利昂内尔·梅西", slug: "lionel-messi",
  nationality: "", nationalityCode: "", countryId: 144,
  team: "Argentina", teamId: "50", league: "American Cup", leagueId: 210,
  position: "SS", additionalPositions: "$f:props:additionalPositions",
  playingStyle: "Deep-Lying Forward", overallRating: 90,
  age: 39, height: 170, weight: 67, preferredFoot: "Left",
  weakFootUsage: 1, weakFootAccuracy: 3, form: 2, condition: 3, injuryResistance: 1,
  skills: "$f:props:children:props:playerSkills", comSkills: ["trickster", "longBallExpert"],
  stats: "$f:props:baseStats", playerModel: MESSI_MODEL,
  imageUrl: "https://efimg.com/efootballhub22/images/player_cards/89138556575063_l.png",
  gpValue: 0, datapackId: 20251204, playerType: 7, boostId: 1192, boostId2: 1400, levelCap: 32,
};

function messiHtml(overrides?: {
  baseStats?: Record<string, unknown>;
  omitPlayer?: boolean;
  defensiveStyle?: string;
}): string {
  const rows = [
    "1:" + JSON.stringify({ baseStats: overrides?.baseStats ?? MESSI_BASE_STATS }),
    "2:" + JSON.stringify({ children: { props: { playerSkills: MESSI_SKILLS } } }),
    "3:" + JSON.stringify({ additionalPositions: MESSI_ADD_POS }),
  ];
  if (!overrides?.omitPlayer) {
    const player = overrides?.defensiveStyle
      ? { ...MESSI_PLAYER, playingStyleDefensive: overrides.defensiveStyle }
      : MESSI_PLAYER;
    rows.push("4:" + JSON.stringify({ player }));
  }
  // 関連選手（levelCap なし）— 中心オブジェクト誤認しないことの確認用
  rows.push(
    "5:" + JSON.stringify({
      player: { id: "370537029180759", playerId: "370537029180759", name: "Lionel Messi", position: "AMF", overallRating: 89, team: "Argentina", imageUrl: "x", playerType: 2 },
    }),
  );
  return `<!doctype html><html><body>${rscScript(rows)}</body></html>`;
}

// ---- Cannavaro (88041460996837) ----
const CANNAVARO_PLAYER = {
  id: "88041460996837", playerId: "88041460996837",
  name: "Fabio Cannavaro", nameJa: "ファビオ カンナヴァーロ", nameZh: "法比奥·卡纳瓦罗", slug: "fabio-cannavaro",
  nationality: "", nationalityCode: "", countryId: 215,
  team: "Piemonte BN", teamId: "120", league: "Italian League", leagueId: 116,
  position: "CB", additionalPositions: "$f:props:additionalPositions",
  playingStyle: "Destroyer", overallRating: 88,
  age: 31, height: 176, weight: 75, preferredFoot: "Right",
  weakFootUsage: 1, weakFootAccuracy: 2, form: 2, condition: 3, injuryResistance: 2,
  skills: "$f:props:children:props:playerSkills", comSkills: ["earlyCross"],
  stats: "$f:props:baseStats",
  playerModel: {
    armLength: 7, shoulderWidth: 7, neckLength: 4, chestMeasurement: 4, neckSize: 9, shoulderHeight: 5,
    legLength: 7, thighSize: 10, waistSize: 7, armSize: 7, calfSize: 9, legCoverageRadius: 169.8,
    armCoverageRadius: 159.8, jumpingHeight: 259, torsoCollision: 49.1, dribbleHeight: 176,
  },
  imageUrl: "https://efimg.com/efootballhub22/images/player_cards/88041460996837_l.png",
  gpValue: 0, datapackId: 20251204, playerType: 5, boostId: 1030, boostId2: 0, levelCap: 27,
};
const CANNAVARO_BASE_STATS = {
  offensiveAwareness: 55, ballControl: 63, dribbling: 62, tightPossession: 63, lowPass: 70,
  loftedPass: 68, finishing: 58, heading: 70, setPieceTaking: 53, curl: 55, speed: 77,
  acceleration: 81, kickingPower: 72, jump: 86, physicalContact: 83, balance: 83, stamina: 75,
  defensiveAwareness: 82, ballWinning: 83, trackingBack: 84, aggression: 83, gkAwareness: 40,
  gkCatching: 40, gkClearing: 40, gkReflexes: 40, gkReach: 40,
};
const CANNAVARO_SKILLS = [
  "oneTouchPass", "manMarking", "interception", "acrobaticClear", "fightingSpirit",
  "blocker", "aerialSuperiority", "slidingTackle", "aerialForte", "shadowHunt",
];
const CANNAVARO_ADD_POS = [{ position: "RB", familiarity: 1 }];

function cannavaroHtml(): string {
  return `<!doctype html><html><body>${rscScript([
    "1:" + JSON.stringify({ baseStats: CANNAVARO_BASE_STATS }),
    "2:" + JSON.stringify({ children: { props: { playerSkills: CANNAVARO_SKILLS } } }),
    "3:" + JSON.stringify({ additionalPositions: CANNAVARO_ADD_POS }),
    "4:" + JSON.stringify({ player: CANNAVARO_PLAYER }),
  ])}</body></html>`;
}

const FIXED_OPTS = (id: string) => ({
  expectedPlayerId: id,
  sourceUrl: `https://efhub.com/players/${id}`,
  fetchedAt: "2026-08-28T00:00:00.000Z",
});

describe("parsePlayerPage — 正常系", () => {
  it("Messi: golden JSON と完全一致する", () => {
    const card = parsePlayerPage(messiHtml(), FIXED_OPTS("89138556575063"));
    expect(card).toEqual(messiGolden);
  });

  it("Cannavaro: golden JSON と完全一致する（boostId2=0, playerType=5, levelCap=27）", () => {
    const card = parsePlayerPage(cannavaroHtml(), FIXED_OPTS("88041460996837"));
    expect(card).toEqual(cannavaroGolden);
    expect(card.boostId2).toBe(0);
    expect(card.playerTypeCode).toBe(5);
    expect(card.levelCap).toBe(27);
    expect(card.comSkills).toEqual(["earlyCross"]);
  });

  it("baseStats は26キーちょうど", () => {
    const card = parsePlayerPage(messiHtml(), FIXED_OPTS("89138556575063"));
    expect(Object.keys(card.baseStats).sort()).toEqual([...STAT_KEYS].sort());
  });

  it("parserVersion が全レコードに入る / ovrMax は null / source は efhub", () => {
    const card = parsePlayerPage(messiHtml(), FIXED_OPTS("89138556575063"));
    expect(card.parserVersion).toBe(PARSER_VERSION);
    expect(card.ovrMax).toBeNull();
    expect(card.source).toBe("efhub");
  });

  it("ovrMax は opts で与えれば入る", () => {
    const card = parsePlayerPage(messiHtml(), { ...FIXED_OPTS("89138556575063"), ovrMax: 107 });
    expect(card.ovrMax).toBe(107);
    expect(card.ovrBase).toBe(90);
  });

  it("playingStyleDefensive: 無いカードは null（playingStyleName とは別フィールド）", () => {
    const card = parsePlayerPage(messiHtml(), FIXED_OPTS("89138556575063"));
    expect(card.playingStyleDefensive).toBeNull();
    expect(card.playingStyleName).toBe("Deep-Lying Forward");
  });

  it("playingStyleDefensive: あるカードは文字列で取得（名称変換せず生値）", () => {
    const card = parsePlayerPage(
      messiHtml({ defensiveStyle: "Anchor Man" }),
      FIXED_OPTS("89138556575063"),
    );
    expect(card.playingStyleDefensive).toBe("Anchor Man");
    expect(card.playingStyleName).toBe("Deep-Lying Forward");
  });

  it("後方互換: playingStyleDefensive キーが無い旧形式データも Zod を通る", async () => {
    const { parsedPlayerCardSchema } = await import("./card-schema");
    const card = parsePlayerPage(messiHtml(), FIXED_OPTS("89138556575063"));
    const { playingStyleDefensive: _omit, ...withoutKey } = card;
    void _omit;
    expect(parsedPlayerCardSchema.safeParse(withoutKey).success).toBe(true);
  });
});

describe("parsePlayerPage — 異常系（推測で埋めず例外）", () => {
  it("playerId が期待IDと一致しない → ParserStructureError", () => {
    expect(() => parsePlayerPage(messiHtml(), FIXED_OPTS("99999999999999"))).toThrow(ParserStructureError);
  });

  it("中心 player オブジェクトが無い → ParserStructureError", () => {
    expect(() => parsePlayerPage(messiHtml({ omitPlayer: true }), FIXED_OPTS("89138556575063"))).toThrow(
      ParserStructureError,
    );
  });

  it("baseStats が不完全（10キー） → ParserStructureError", () => {
    const partial = Object.fromEntries(Object.entries(MESSI_BASE_STATS).slice(0, 10));
    expect(() => parsePlayerPage(messiHtml({ baseStats: partial }), FIXED_OPTS("89138556575063"))).toThrow(
      ParserStructureError,
    );
  });

  it("能力値が範囲外（999） → Zod 検証で ParserStructureError", () => {
    const bad = { ...MESSI_BASE_STATS, offensiveAwareness: 999 };
    expect(() => parsePlayerPage(messiHtml({ baseStats: bad }), FIXED_OPTS("89138556575063"))).toThrow(
      ParserStructureError,
    );
  });

  it("expectedPlayerId が数字でない → ParserStructureError", () => {
    expect(() => parsePlayerPage(messiHtml(), FIXED_OPTS("abc"))).toThrow(ParserStructureError);
  });

  it("RSC が全く無い HTML → ParserStructureError", () => {
    expect(() => parsePlayerPage("<html><body>no rsc</body></html>", FIXED_OPTS("89138556575063"))).toThrow(
      ParserStructureError,
    );
  });
});

describe("card-store シリアライズ（FS なし）", () => {
  it("serialize → deserialize でラウンドトリップする", () => {
    const card = parsePlayerPage(messiHtml(), FIXED_OPTS("89138556575063"));
    expect(deserializeCard(serializeCard(card))).toEqual(card);
  });
});

describe("masters", () => {
  it("STAT_DEFINITIONS は26件で statKey が STAT_KEYS と一致", () => {
    expect(STAT_DEFINITIONS).toHaveLength(26);
    expect(STAT_DEFINITIONS.map((d) => d.statKey).sort()).toEqual([...STAT_KEYS].sort());
  });

  it("日本語名は全て null（screenshots 確認前は推測しない）", () => {
    expect(STAT_DEFINITIONS.every((d) => d.nameJa === null)).toBe(true);
  });
});
