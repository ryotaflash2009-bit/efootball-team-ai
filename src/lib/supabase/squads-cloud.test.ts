import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptySquad, importSquads, listSquads, saveSquad } from "@/lib/squad/squad-storage";
import { MAX_SQUADS, type StoredSquad } from "@/lib/squad/types";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { computeSquadsPayloadHash, planSquadsRestore, validateFetchedSquadsPayload, validateSquadsForSave, SQUADS_CLOUD_SCHEMA_VERSION } from "./squads-cloud-schema";
import { deleteSquadsCloudSnapshot, fetchSquadsCloudSnapshot, saveSquadsCloudSnapshot } from "./squads-cloud";

function installMemoryStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    },
  });
  setCurrentScope({ kind: "guest" });
}
const sq = (id: string, name = id): StoredSquad => ({ ...emptySquad(name), squadId: id });

function fakeDb() {
  let row: Record<string, unknown> | null = null;
  const client = {
    from(table: string) {
      if (table !== "saved_squads_snapshots") throw new Error(table);
      return {
        select: async () => ({ data: row ? [row] : [], error: null }),
        upsert: (payload: Record<string, unknown>) => ({
          select: async () => {
            if ("user_id" in payload) return { data: null, error: { message: "no user_id" } };
            row = { id: "r1", ...JSON.parse(JSON.stringify(payload)), updated_at: "2026-10-11T00:00:00.000Z" };
            return { data: [row], error: null };
          },
        }),
        delete: () => ({ eq: (_c: string, id: string) => ({ select: async () => (row && row.id === id ? ((row = null), { data: [{ id }], error: null }) : { data: [], error: null }) }) }),
      };
    },
  } as unknown as SupabaseClient;
  return client;
}

describe("保存スカッドのクラウド保存（2026-10-11）", () => {
  beforeEach(() => installMemoryStorage());

  it("ペイロード: squadId 順・同じ内容は同じハッシュ・重複と上限超えと壊れた要素と知らない版は拒否", async () => {
    const a = validateSquadsForSave([sq("sq_b0000000000002"), sq("sq_a0000000000001")]);
    expect(a.ok && a.payload.items.map((s) => s.squadId)).toEqual(["sq_a0000000000001", "sq_b0000000000002"]);
    expect(a.ok && (await computeSquadsPayloadHash(a.payload))).toMatch(/^[0-9a-f]{64}$/);
    expect(validateSquadsForSave([sq("sq_a0000000000001"), sq("sq_a0000000000001")])).toEqual({ ok: false, reason: "duplicate_id" });
    expect(validateSquadsForSave(Array.from({ length: MAX_SQUADS + 1 }, (_, i) => sq(`sq_${String(i).padStart(16, "0")}`)))).toEqual({ ok: false, reason: "too_many" });
    expect(validateSquadsForSave([{ ...sq("sq_a0000000000001"), squadId: "bad id" }])).toEqual({ ok: false, reason: "invalid_item" });
    expect(validateFetchedSquadsPayload({ items: [] }, "squads-cloud/0.v0")).toEqual({ ok: false, reason: "unknown_version" });
  });

  it("アクセス層: 保存して読み戻し（user_id を送らない）・削除して 0 件", async () => {
    const db = fakeDb();
    expect(await fetchSquadsCloudSnapshot(db)).toEqual({ ok: true, data: null });
    const r = await saveSquadsCloudSnapshot(db, [sq("sq_a0000000000001")], "2026-10-11T00:00:00.000Z");
    expect(r.ok && r.data.itemCount).toBe(1);
    expect(r.ok && r.data.schemaVersion).toBe(SQUADS_CLOUD_SCHEMA_VERSION);
    expect(await deleteSquadsCloudSnapshot(db, "r1")).toEqual({ ok: true, data: { id: "r1" } });
    expect(await fetchSquadsCloudSnapshot(db)).toEqual({ ok: true, data: null });
  });

  it("復元: 端末に無いスカッドだけ追加（既存は変えない）・途中の変更は競合・上限を超えるなら何も追加しない", () => {
    const a = sq("sq_a0000000000001", "端末");
    expect(saveSquad(a).ok).toBe(true);
    const local = listSquads();
    const cloud = [{ ...a, squadName: "クラウド" }, sq("sq_b0000000000002", "追加")];
    const plan = planSquadsRestore(local, cloud);
    expect(plan.toAdd.map((s) => s.squadId)).toEqual(["sq_b0000000000002"]);
    expect(plan.sameIdDifferent).toBe(1);
    expect(importSquads(plan.toAdd, { expectedExistingSquadIds: ["sq_zzzz"] })).toEqual({ ok: false, code: "conflict" });
    expect(importSquads(plan.toAdd, { expectedExistingSquadIds: local.map((s) => s.squadId) })).toEqual({ ok: true, saved: 1 });
    expect(listSquads().map((s) => [s.squadId, s.squadName]).sort()).toEqual([["sq_a0000000000001", "端末"], ["sq_b0000000000002", "追加"]]);
    const many = Array.from({ length: MAX_SQUADS - 1 }, (_, i) => sq(`sq_m${String(i).padStart(15, "0")}`));
    expect(importSquads(many)).toEqual({ ok: false, code: "limit" });
    expect(listSquads()).toHaveLength(2);
  });
});
