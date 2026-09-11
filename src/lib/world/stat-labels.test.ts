import { describe, it, expect } from "vitest";
import {
  statLabelJa,
  groupLabelJa,
  radarAxisLabelJa,
  buildModeLabelJa,
  statListJa,
  STAT_LABEL_JA,
  GROUP_LABEL_JA,
  RADAR_AXIS_LABEL_JA,
  BUILD_MODE_LABEL_JA,
} from "./stat-labels";
import { WORLD_STAT_KEYS } from "./stats";
import { PROGRESSION_GROUP_IDS } from "@/lib/progression/stat-groups";
import { COMPARE_CATEGORIES } from "@/lib/comparison/categories";

describe("statLabelJa", () => {
  it("26 能力値すべてに日本語ラベルがある", () => {
    for (const k of WORLD_STAT_KEYS) {
      expect(STAT_LABEL_JA[k]).toBeTruthy();
      expect(statLabelJa(k)).toBe(STAT_LABEL_JA[k]);
    }
  });
  it("指定の表記に一致する（一部）", () => {
    expect(statLabelJa("offensiveAwareness")).toBe("オフェンスセンス");
    expect(statLabelJa("lowPass")).toBe("グラウンダーパス");
    expect(statLabelJa("loftedPass")).toBe("フライパス");
    expect(statLabelJa("finishing")).toBe("決定力");
    expect(statLabelJa("setPieceTaking")).toBe("プレースキック");
    expect(statLabelJa("tackling")).toBe("ボール奪取");
    expect(statLabelJa("defensiveEngagement")).toBe("守備意識");
    expect(statLabelJa("gkReflexes")).toBe("コラプシング");
    expect(statLabelJa("acceleration")).toBe("瞬発力");
    expect(statLabelJa("balance")).toBe("ボディコントロール");
  });
  it("未知キーはそのまま返す（クラッシュしない）", () => {
    expect(statLabelJa("nope")).toBe("nope");
  });
});

describe("groupLabelJa", () => {
  it("10 育成カテゴリすべてに日本語ラベルがある", () => {
    for (const g of PROGRESSION_GROUP_IDS) expect(groupLabelJa(g)).not.toBe(g);
  });
  it("指定の表記に一致する", () => {
    expect(groupLabelJa("shooting")).toBe("シュート");
    expect(groupLabelJa("passing")).toBe("パス");
    expect(groupLabelJa("dexterity")).toBe("クイックネス");
    expect(groupLabelJa("lowerBodyStrength")).toBe("脚力");
    expect(groupLabelJa("aerialStrength")).toBe("エアバトル");
    expect(groupLabelJa("defending")).toBe("ディフェンス");
    expect(groupLabelJa("goalkeeping1")).toBe("GK1");
  });
});

describe("radarAxisLabelJa", () => {
  it("全 COMPARE_CATEGORIES に短い日本語軸ラベルがある", () => {
    for (const c of COMPARE_CATEGORIES) {
      const l = radarAxisLabelJa(c.id);
      expect(l).toBeTruthy();
      expect(/[A-Za-z]{3}/.test(l)).toBe(false); // SHT/PAS 等の英略称が残っていない（GK は例外的に許容）
    }
    expect(radarAxisLabelJa("attack")).toBe("シュート");
    expect(radarAxisLabelJa("gk")).toBe("GK");
  });
});

describe("buildModeLabelJa / statListJa", () => {
  it("育成方針", () => {
    expect(buildModeLabelJa("attack")).toBe("攻撃重視");
    expect(buildModeLabelJa("none")).toBe("育成なし");
  });
  it("既知の 5 モードすべてに日本語がある / 未知はそのまま返す", () => {
    for (const m of ["none", "attack", "defense", "balance", "gk"]) {
      expect(buildModeLabelJa(m)).toBeTruthy();
      expect(buildModeLabelJa(m)).not.toBe(m);
    }
    expect(buildModeLabelJa("???")).toBe("???");
  });
  it("対象能力の一覧を日本語で連結", () => {
    expect(statListJa(["finishing", "setPieceTaking", "curl"])).toBe("決定力 / プレースキック / カーブ");
  });
  it("statListJa は空配列・未知キーで落ちない", () => {
    expect(statListJa([])).toBe("");
    expect(statListJa(["nope"])).toBe("nope");
  });
});

describe("辞書の健全性（回帰監査の土台）", () => {
  const noEmpty = (m: Record<string, string>) =>
    Object.entries(m).every(([, v]) => typeof v === "string" && v.trim() !== "");
  const noHtml = (m: Record<string, string>) =>
    Object.values(m).every((v) => !/[<>]/.test(v));
  const noDup = (m: Record<string, string>) =>
    new Set(Object.values(m)).size === Object.keys(m).length;

  it("STAT_LABEL_JA: 26 件・空なし・HTML なし・日本語ラベル重複なし", () => {
    expect(Object.keys(STAT_LABEL_JA)).toHaveLength(26);
    expect(noEmpty(STAT_LABEL_JA)).toBe(true);
    expect(noHtml(STAT_LABEL_JA)).toBe(true);
    expect(noDup(STAT_LABEL_JA)).toBe(true);
  });
  it("GROUP_LABEL_JA: 10 件・空なし・HTML なし・重複なし", () => {
    expect(Object.keys(GROUP_LABEL_JA)).toHaveLength(10);
    expect(noEmpty(GROUP_LABEL_JA)).toBe(true);
    expect(noHtml(GROUP_LABEL_JA)).toBe(true);
    expect(noDup(GROUP_LABEL_JA)).toBe(true);
  });
  it("RADAR_AXIS_LABEL_JA / BUILD_MODE_LABEL_JA: 空なし・重複なし", () => {
    expect(noEmpty(RADAR_AXIS_LABEL_JA)).toBe(true);
    expect(noDup(RADAR_AXIS_LABEL_JA)).toBe(true);
    expect(noEmpty(BUILD_MODE_LABEL_JA)).toBe(true);
    expect(noDup(BUILD_MODE_LABEL_JA)).toBe(true);
  });
  it("辞書のキーは正典（WORLD_STAT_KEYS / PROGRESSION_GROUP_IDS）と一致（過不足なし）", () => {
    expect(new Set(Object.keys(STAT_LABEL_JA))).toEqual(new Set(WORLD_STAT_KEYS));
    expect(new Set(Object.keys(GROUP_LABEL_JA))).toEqual(new Set(PROGRESSION_GROUP_IDS));
    expect(new Set(Object.keys(RADAR_AXIS_LABEL_JA))).toEqual(new Set(COMPARE_CATEGORIES.map((c) => c.id)));
  });
  it("能力値 dribbling と 育成カテゴリ dribbling は両方「ドリブル」（意図的な重複・許可）", () => {
    expect(STAT_LABEL_JA.dribbling).toBe("ドリブル");
    expect(GROUP_LABEL_JA.dribbling).toBe("ドリブル");
  });
});
