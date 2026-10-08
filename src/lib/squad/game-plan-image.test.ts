import { describe, expect, it } from "vitest";
import { emptyGamePlan, type GamePlan } from "./game-plan";
import { buildGamePlanImageModel, gamePlanImageFileName, wrapText, NOTE_IMAGE_MAX_CHARS, type GamePlanImageLabels, type GamePlanImageResolvers } from "./game-plan-image";

const L: GamePlanImageLabels = {
  title: "ゲームプラン",
  instructions: "チームの指示",
  attacking: "攻撃",
  defensiveLine: "守備ライン",
  pressing: "プレス",
  note: "メモ",
  substitutions: "交代の計画",
  alternative: "代わりの計画",
  opponents: "相手ごとの計画",
  footer: "TeamAIXI（非公式）で作成",
  subTemplate: "{minute}　{out} → {in}（{reason}）",
  minuteTemplate: "{n}分",
  minuteUnknown: "時間未定",
};
const r: GamePlanImageResolvers = {
  attacking: (v) => `atk:${v}`,
  defensiveLine: (v) => `line:${v}`,
  pressing: (v) => `press:${v}`,
  reason: (v) => `reason:${v}`,
  trigger: (v) => `trig:${v}`,
  slotLabel: (id) => `CF（選手A）${id === "cf" ? "" : id}`,
  playerName: (id) => (id === "111" ? "選手B" : "—"),
  formationName: (id) => `F${id}`,
  adjustment: (id) => `adj:${id}`,
};
const base = (): GamePlan => emptyGamePlan("sq_1", "2026-10-09T00:00:00.000Z");

describe("ゲームプランの共有画像（内容）", () => {
  it("何も設定していなければ画像を作らない", () => {
    expect(buildGamePlanImageModel(base(), { squadName: "A", formationName: "4-3-3", labels: L, r })).toBeNull();
  });

  it("設定した項目だけを表示用の文で並べ、ID・URL を載せない", () => {
    const p: GamePlan = {
      ...base(),
      instructions: { attacking: "quick_counter", defensiveLine: "high", pressing: null, note: "  前から  " },
      substitutions: [
        { minute: 70, outSlotId: "cf", inWorldCardId: "111", reason: "fatigue" },
        { minute: null, outSlotId: "cf", inWorldCardId: "111", reason: "tactical" },
        { minute: 55, outSlotId: "cf", inWorldCardId: "111", reason: "chase_goal" },
      ],
      alternative: { formationId: "4-4-2", trigger: "losing", note: "" },
      opponents: [{ label: "ポゼッション型", style: { possession: true, pressing: false, counter: false }, adjustments: ["deeper_defensive_line"], note: "" }, { label: "", style: { possession: false, pressing: false, counter: false }, adjustments: [], note: "" }],
    };
    const m = buildGamePlanImageModel(p, { squadName: "メイン", formationName: "4-3-3", labels: L, r })!;
    expect(m.subtitle).toBe("メイン ・ 4-3-3");
    expect(m.sections.map((s) => s.heading)).toEqual(["チームの指示", "交代の計画", "代わりの計画", "相手ごとの計画"]);
    expect(m.sections[0].lines).toEqual(["攻撃: atk:quick_counter", "守備ライン: line:high", "メモ: 前から"]);
    // 時間の順・未定は最後
    expect(m.sections[1].lines).toEqual(["55分　CF（選手A） → 選手B（reason:chase_goal）", "70分　CF（選手A） → 選手B（reason:fatigue）", "時間未定　CF（選手A） → 選手B（reason:tactical）"]);
    expect(m.sections[2].lines).toEqual(["F4-4-2（trig:losing）"]);
    expect(m.sections[3].lines).toEqual(["ポゼッション型 — adj:deeper_defensive_line"]);
    const all = JSON.stringify(m);
    expect(all).not.toMatch(/sq_1|111|https?:/);
  });

  it("長いメモは切る・はみ出さないよう折り返す", () => {
    const p = { ...base(), instructions: { ...base().instructions, note: "あ".repeat(500) } };
    const m = buildGamePlanImageModel(p, { squadName: "", formationName: "4-3-3", labels: L, r })!;
    expect(m.sections[0].lines[0].length).toBeLessThanOrEqual("メモ: ".length + NOTE_IMAGE_MAX_CHARS);
    expect(m.subtitle).toBe("4-3-3");
    const lines = wrapText("abcdefghij", 3, (s) => s.length);
    expect(lines).toEqual(["abc", "def", "ghi", "j"]);
    expect(wrapText("", 10, (s) => s.length)).toEqual([]);
  });

  it("ファイル名に名前・ID を入れない", () => {
    expect(gamePlanImageFileName("4-3-3", new Date(2026, 9, 9, 10, 0, 0))).toBe("efootball-team-ai-game-plan-4-3-3-2026-10-09.png");
    expect(gamePlanImageFileName("../x", new Date(2026, 9, 9, 10, 0, 0))).toBe("efootball-team-ai-game-plan-plan-2026-10-09.png");
  });
});
