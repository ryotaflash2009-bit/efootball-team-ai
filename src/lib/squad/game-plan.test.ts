import { describe, it, expect } from "vitest";
import {
  GAME_PLAN_SCHEMA,
  MAX_OPPONENT_PLANS,
  MAX_SUBSTITUTIONS,
  NOTE_MAX,
  deleteGamePlan,
  duplicateGamePlan,
  emptyGamePlan,
  exportGamePlan,
  gamePlanStorageKey,
  importGamePlan,
  loadGamePlan,
  sanitizeGamePlan,
  saveGamePlan,
  validateGamePlan,
  type GamePlan,
} from "./game-plan";
import { emptySquad } from "./squad-storage";
import type { StoredSquad } from "./types";

const NOW = "2026-10-07T00:00:00.000Z";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

function squad(): StoredSquad {
  const sq = emptySquad("A", "4-3-3");
  return {
    ...sq,
    squadId: "sq_abcdef123456",
    slots: sq.slots.map((s) => (s.slotId === "cf" ? { ...s, worldCardId: "111" } : s.slotId === "lwf" ? { ...s, worldCardId: "112" } : s)),
    substitutes: [
      { subId: "s1", worldCardId: "201", buildMode: "none", savedBuildId: null },
      { subId: "s2", worldCardId: "202", buildMode: "none", savedBuildId: null },
    ] as StoredSquad["substitutes"],
  };
}

function plan(over: Partial<GamePlan> = {}): GamePlan {
  return { ...emptyGamePlan("sq_abcdef123456", NOW), ...over };
}

describe("ゲームプラン: 検証と整形", () => {
  it("空のプランは問題なし・スキーマと ID を持つ", () => {
    const p = emptyGamePlan("sq_abcdef123456", NOW);
    expect(p.schema).toBe(GAME_PLAN_SCHEMA);
    expect(validateGamePlan(p, squad())).toEqual([]);
  });

  it("交代: 枠・控え・重複・時間の順を確かめる", () => {
    const p = plan({
      substitutions: [
        { minute: 60, outSlotId: "cf", inWorldCardId: "201", reason: "fatigue" },
        { minute: 55, outSlotId: "cf", inWorldCardId: "201", reason: "tactical" },
        { minute: null, outSlotId: "rwf", inWorldCardId: "999", reason: "chase_goal" },
        { minute: 70, outSlotId: "zz", inWorldCardId: "202", reason: "protect_lead" },
      ],
    });
    const ids = validateGamePlan(p, squad()).map((i) => `${i.id}@${i.index}`);
    expect(ids).toEqual(
      expect.arrayContaining([
        "sub_in_used_twice@1",
        "sub_out_used_twice@1",
        "sub_minutes_not_ordered@1",
        "sub_out_slot_empty@2",
        "sub_in_not_on_bench@2",
        "sub_out_slot_missing@3",
      ]),
    );
    expect(ids).not.toContain("sub_in_not_on_bench@0");
  });

  it("代わりの計画: 同じフォーメーション・フォーメーションなしの場面を知らせる", () => {
    expect(validateGamePlan(plan({ alternative: { formationId: "4-3-3", trigger: "losing", note: "" } }), squad()).map((i) => i.id)).toEqual(["alternative_same_formation"]);
    expect(validateGamePlan(plan({ alternative: { formationId: null, trigger: "losing", note: "" } }), squad()).map((i) => i.id)).toEqual(["alternative_trigger_without_formation"]);
  });

  it("整形: 不明な値・制御文字・長すぎる文・上限を超える件数を落とす", () => {
    const raw = {
      schema: GAME_PLAN_SCHEMA,
      squadId: "sq_abcdef123456",
      updatedAt: NOW,
      instructions: { attacking: "tiki_taka", defensiveLine: "high", pressing: "low", note: "a\u0000b‮c" + "x".repeat(400) },
      substitutions: Array.from({ length: 9 }, (_, i) => ({ minute: 10 + i, outSlotId: "cf", inWorldCardId: "201", reason: "fatigue" })).concat([
        { minute: 0, outSlotId: "cf", inWorldCardId: "201", reason: "fatigue" },
      ]),
      alternative: { formationId: "9-9-9", trigger: "losing", note: "" },
      opponents: Array.from({ length: 8 }, (_, i) => ({ label: `O${i}`, style: { possession: true }, adjustments: ["tall_center_backs", "tall_center_backs", "nope"], note: "" })),
    };
    const p = sanitizeGamePlan(raw)!;
    expect(p.instructions.attacking).toBeNull();
    expect(p.instructions.defensiveLine).toBe("high");
    expect(p.instructions.note.startsWith("abc")).toBe(true);
    expect(Array.from(p.instructions.note).length).toBeLessThanOrEqual(NOTE_MAX);
    expect(p.substitutions).toHaveLength(MAX_SUBSTITUTIONS);
    expect(p.alternative.formationId).toBeNull();
    expect(p.opponents).toHaveLength(MAX_OPPONENT_PLANS);
    expect(p.opponents[0].adjustments).toEqual(["tall_center_backs"]);
    expect(p.opponents[0].style).toEqual({ possession: true, pressing: false, counter: false });
    expect(sanitizeGamePlan({ ...raw, schema: "x" })).toBeNull();
    expect(sanitizeGamePlan({ ...raw, squadId: "../evil" })).toBeNull();
  });
});

describe("ゲームプラン: 書き出し・読み込み・複製・保存", () => {
  const full = plan({
    instructions: { attacking: "quick_counter", defensiveLine: "deep", pressing: "standard", note: "メモ" },
    substitutions: [{ minute: 60, outSlotId: "cf", inWorldCardId: "201", reason: "fatigue" }],
    alternative: { formationId: "4-4-2", trigger: "winning", note: "" },
    opponents: [{ label: "速い相手", style: { possession: false, pressing: true, counter: true }, adjustments: ["deeper_defensive_line"], note: "" }],
  });

  it("書き出しはスカッドの ID を含まず、読み込みで読み込む先の ID になる（往復で同じ内容）", () => {
    const text = exportGamePlan(full, "4-3-3");
    expect(text).not.toContain("sq_abcdef123456");
    const r = importGamePlan(text, { squadId: "sq_zzzzzz999999", formationId: "4-3-3" }, NOW);
    if (!r.ok) throw new Error(r.reason);
    expect(r.formationMismatch).toBe(false);
    expect({ ...r.plan, squadId: full.squadId }).toEqual(full);
    expect(r.plan.squadId).toBe("sq_zzzzzz999999");
  });

  it("読み込み: 違うフォーメーション・壊れた JSON・違う形・大きすぎるファイル", () => {
    const text = exportGamePlan(full, "4-3-3");
    const r = importGamePlan(text, { squadId: "sq_zzzzzz999999", formationId: "3-5-2" }, NOW);
    expect(r.ok && r.formationMismatch).toBe(true);
    expect(importGamePlan("{", { squadId: "sq_a1b2c3", formationId: "4-3-3" }, NOW)).toEqual({ ok: false, reason: "invalid_json" });
    expect(importGamePlan('{"schema":"other"}', { squadId: "sq_a1b2c3", formationId: "4-3-3" }, NOW)).toEqual({ ok: false, reason: "invalid_schema" });
    expect(importGamePlan("x".repeat(40 * 1024), { squadId: "sq_a1b2c3", formationId: "4-3-3" }, NOW)).toEqual({ ok: false, reason: "too_large" });
  });

  it("複製は新しい ID・元のプランは変わらない", () => {
    const d = duplicateGamePlan(full, "sq_copy00000001", "2026-10-08T00:00:00.000Z")!;
    expect(d.squadId).toBe("sq_copy00000001");
    d.opponents[0].label = "changed";
    expect(full.opponents[0].label).toBe("速い相手");
    expect(duplicateGamePlan(full, "bad id", NOW)).toBeNull();
  });

  it("保存・読み込み・削除（スカッドごと・アカウントごとのキー）", () => {
    const ls = memoryStorage();
    const key = gamePlanStorageKey({ kind: "guest" });
    expect(key).toBe("efootball-team-ai:local:guest:game-plans:v1");
    expect(gamePlanStorageKey({ kind: "account", scopeId: "abc" })).toBe("efootball-team-ai:local:account:abc:game-plans:v1");
    expect(saveGamePlan(ls, key, full)).toBe(true);
    expect(loadGamePlan(ls, key, full.squadId)).toEqual(full);
    expect(loadGamePlan(ls, key, "sq_other000000")).toBeNull();
    ls.setItem(key, "{broken");
    expect(loadGamePlan(ls, key, full.squadId)).toBeNull();
    expect(saveGamePlan(ls, key, full)).toBe(true);
    expect(deleteGamePlan(ls, key, full.squadId)).toBe(true);
    expect(loadGamePlan(ls, key, full.squadId)).toBeNull();
    expect(saveGamePlan(null, key, full)).toBe(false);
  });
});
