import { describe, it, expect } from "vitest";
import { evaluatePlayerTitles, PLAYER_TITLE_RULES, MAX_PLAYER_BADGES } from "./player-titles";
import { evaluateDiagnosisTitles, MAX_DIAGNOSIS_BADGES } from "./diagnosis-titles";
import type { CardPercentile } from "@/lib/percentiles/card-percentiles";
import type { PercentileBucket } from "@/lib/percentiles/distribution";
import { readFileSync } from "node:fs";
import path from "node:path";

const P = (bucket: PercentileBucket, topPercent: number): CardPercentile => ({ bucket, topPercent, n: 5000 });
const map = (entries: [string, CardPercentile][]) => new Map(entries);

describe("F-072 選手の称号", () => {
  it("規則の全能力が上位5%以内なら称号、上位10%以内ならバッジ。最も強い規則が称号", () => {
    const r = evaluatePlayerTitles(
      "field",
      map([
        ["speed", P("top1", 0.8)],
        ["acceleration", P("top5", 3)],
        ["lowPass", P("top10", 8)],
        ["loftedPass", P("top5", 4)],
        ["heading", P("top25", 20)],
        ["jumping", P("top1", 1)],
      ]),
    );
    expect(r.primary?.ruleId).toBe("pace");
    expect(r.primary?.weakestBucket).toBe("top5");
    expect(r.badges.map((b) => b.ruleId)).toEqual(["passing"]);
    expect(r.rulesVersion).toMatch(/^player-titles\//);
  });

  it("条件を満たさなければ何も出さない。値が無い能力を含む規則は判定しない", () => {
    expect(evaluatePlayerTitles("field", map([["speed", P("top25", 20)], ["acceleration", P("top1", 1)]]))).toMatchObject({ primary: null, badges: [] });
    expect(evaluatePlayerTitles("field", map([["speed", P("top1", 0.5)]]))).toMatchObject({ primary: null, badges: [] });
  });

  it("役割の規則だけを使う（GK にフィールドの称号を付けない）", () => {
    const all = map(PLAYER_TITLE_RULES.flatMap((r) => r.statKeys).map((k) => [k, P("top1", 1)] as [string, CardPercentile]));
    const gk = evaluatePlayerTitles("gk", all);
    expect([gk.primary, ...gk.badges].every((t) => PLAYER_TITLE_RULES.find((r) => r.id === t!.ruleId)!.role === "gk")).toBe(true);
    const field = evaluatePlayerTitles("field", all);
    expect(field.badges.length).toBe(MAX_PLAYER_BADGES);
    expect(field.primary?.ruleId).toBe("pace"); // 同点は定義順
  });

  it("決定的（同じ入力なら同じ結果）", () => {
    const input = map([["speed", P("top5", 2)], ["acceleration", P("top5", 2)], ["stamina", P("top10", 9)]]);
    expect(evaluatePlayerTitles("field", input)).toEqual(evaluatePlayerTitles("field", input));
  });
});

describe("F-072 スカッド診断の称号", () => {
  it("段階 A 以上のうち最高点が称号、残りを点数順に最大4つ。完成度は対象外", () => {
    const r = evaluateDiagnosisTitles({
      attack: [40, "C"],
      defense: [80, "A"],
      aerial: [54, "C"],
      speed: [61, "B"],
      passBuildUp: [82, "A"],
      dribblePossession: [75, "A"],
      pressResistance: [82, "A"],
      counterAttack: [89, "S"],
      squadCompleteness: [100, "S"],
    });
    expect(r.primary).toEqual({ categoryId: "counterAttack", score: 89, tier: "S" });
    expect(r.badges.map((b) => b.categoryId)).toEqual(["passBuildUp", "pressResistance", "defense", "dribblePossession"]);
    expect(r.badges.length).toBeLessThanOrEqual(MAX_DIAGNOSIS_BADGES);
  });

  it("段階 A 以上が無ければ何も出さない。判定対象外（null）は無視", () => {
    expect(evaluateDiagnosisTitles({ attack: [60, "B"], defense: [null, null] })).toMatchObject({ primary: null, badges: [] });
  });

  it("診断結果のカテゴリ（オブジェクト形式）も受け付ける", () => {
    expect(evaluateDiagnosisTitles({ aerial: { score: 90, tier: "S" } }).primary?.categoryId).toBe("aerial");
  });
});

describe("F-072 文言", () => {
  it("「最強」「公式」「専門家」、抽選を思わせる表現を使わない", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    // 日本語の titles は分割した module（ja-ns/titles.ts、2026-10-04）、英語は en.ts の中。
    for (const f of ["ja-ns/titles.ts", "en.ts"]) {
      const s = readFileSync(path.join(root, "src", "lib", "i18n", "dictionaries", f), "utf8");
      const start = f === "en.ts" ? s.lastIndexOf("  titles: {") : s.indexOf("= {");
      const block = s.slice(start, f === "en.ts" ? s.indexOf("\n  },", start) : s.indexOf("\n};", start));
      const values = [...block.matchAll(/:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      expect(values.length).toBe(28);
      for (const v of values) {
        expect(v).not.toMatch(/最強|公式|専門家|プロ認定|ガチャ|レア|当たり/);
        expect(v).not.toMatch(/\b(SSR|strongest|official|expert|certified|gacha|rare|jackpot)\b/i);
      }
    }
  });
});
