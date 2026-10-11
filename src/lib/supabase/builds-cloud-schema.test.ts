import { describe, it, expect } from "vitest";
import {
  BUILDS_CLOUD_MAX_ITEMS,
  BUILDS_CLOUD_SCHEMA_VERSION,
  canonicalJson,
  computeBuildsPayloadHash,
  planBuildsRestore,
  validateBuildsForSave,
  validateFetchedBuildsPayload,
} from "./builds-cloud-schema";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import type { SavedBuild } from "@/lib/progression/types";

const mk = (over: Partial<SavedBuild> = {}): SavedBuild => ({
  buildId: over.buildId ?? "b_1",
  worldCardId: over.worldCardId ?? "89138556575063",
  buildName: over.buildName ?? "攻撃ビルド",
  progressionAllocation: over.progressionAllocation ?? { shooting: 3, passing: 2 },
  selectedPlayerBooster: over.selectedPlayerBooster ?? null,
  calculatedStats: over.calculatedStats ?? { finishing: 90 },
  calculatedOvr: over.calculatedOvr ?? 91,
  calculationMode: over.calculationMode ?? "provisional",
  rulesVersion: over.rulesVersion ?? PROGRESSION_RULES_VERSION,
  createdAt: over.createdAt ?? "2026-08-20T10:00:00.000Z",
  updatedAt: over.updatedAt ?? "2026-08-25T10:00:00.000Z",
  schemaVersion: over.schemaVersion ?? 1,
});

describe("保存ビルドのクラウド保存のペイロード（2026-10-11）", () => {
  it("保存の前の検証: 並びを決め（buildId 順）、同じ内容は同じハッシュ・未知のキーは除く", async () => {
    const a = validateBuildsForSave([mk({ buildId: "b_2" }), mk({ buildId: "b_1" })]);
    const b = validateBuildsForSave([mk({ buildId: "b_1" }), { ...mk({ buildId: "b_2" }), evil: 1 } as SavedBuild]);
    expect(a.ok && a.payload.items.map((x) => x.buildId)).toEqual(["b_1", "b_2"]);
    expect(a.ok && b.ok && (await computeBuildsPayloadHash(a.payload)) === (await computeBuildsPayloadHash(b.payload))).toBe(true);
    expect(a.ok && (await computeBuildsPayloadHash(a.payload))).toMatch(/^[0-9a-f]{64}$/);
  });
  it("壊れた要素・buildId の重複・上限超えは拒否（黙って捨てない）", () => {
    expect(validateBuildsForSave([{ ...mk(), buildName: "" }])).toEqual({ ok: false, reason: "invalid_item" });
    expect(validateBuildsForSave([mk(), mk()])).toEqual({ ok: false, reason: "duplicate_id" });
    const many = Array.from({ length: BUILDS_CLOUD_MAX_ITEMS + 1 }, (_, i) => mk({ buildId: `b_${i}` }));
    expect(validateBuildsForSave(many)).toEqual({ ok: false, reason: "too_many" });
    const big = Array.from({ length: 300 }, (_, i) => mk({ buildId: `b_${i}`, calculatedStats: Object.fromEntries(Array.from({ length: 200 }, (_, j) => [`stat_${j}`, j])) }));
    expect(validateBuildsForSave(big)).toEqual({ ok: false, reason: "too_large" });
  });
  it("取得した行の検証: 知らない版・形の違い・プロトタイプ汚染のキーは拒否または除去", () => {
    expect(validateFetchedBuildsPayload({ items: [mk()] }, "builds-cloud/9999.v9")).toEqual({ ok: false, reason: "unknown_version" });
    expect(validateFetchedBuildsPayload([mk()], BUILDS_CLOUD_SCHEMA_VERSION)).toEqual({ ok: false, reason: "not_object" });
    expect(validateFetchedBuildsPayload({ items: "x" }, BUILDS_CLOUD_SCHEMA_VERSION)).toEqual({ ok: false, reason: "not_object" });
    const polluted = JSON.parse(`{"items":[${JSON.stringify(mk()).slice(0, -1)},"__proto__":{"admin":true}}]}`);
    const r = validateFetchedBuildsPayload(polluted, BUILDS_CLOUD_SCHEMA_VERSION);
    expect(r.ok).toBe(true);
    expect(r.ok && Object.prototype.hasOwnProperty.call(r.payload.items[0], "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
  it("復元の計画: 端末に無いものだけ追加・同じものは数えるだけ・同じ ID で内容が違えば端末を優先", () => {
    const local = [mk({ buildId: "b_1" }), mk({ buildId: "b_2", buildName: "端末" })];
    const cloud = [mk({ buildId: "b_1" }), mk({ buildId: "b_2", buildName: "クラウド" }), mk({ buildId: "b_3" })];
    const plan = planBuildsRestore(local, cloud);
    expect(plan.toAdd.map((b) => b.buildId)).toEqual(["b_3"]);
    expect(plan.alreadyLocal).toBe(1);
    expect(plan.sameIdDifferent).toBe(1);
  });
  it("canonicalJson はキーの順に依らない・undefined のキーは除く", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: undefined }] })).toBe(canonicalJson({ a: [2, { d: 3 }], b: 1 }));
  });
});
