import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteBuildsCloudSnapshot, fetchBuildsCloudSnapshot, saveBuildsCloudSnapshot } from "./builds-cloud";
import { BUILDS_CLOUD_SCHEMA_VERSION } from "./builds-cloud-schema";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import type { SavedBuild } from "@/lib/progression/types";

const mk = (buildId: string): SavedBuild => ({
  buildId,
  worldCardId: "89138556575063",
  buildName: "攻撃ビルド",
  progressionAllocation: { shooting: 3 },
  selectedPlayerBooster: null,
  calculatedStats: { finishing: 90 },
  calculatedOvr: 91,
  calculationMode: "provisional",
  rulesVersion: PROGRESSION_RULES_VERSION,
  createdAt: "2026-08-20T10:00:00.000Z",
  updatedAt: "2026-08-25T10:00:00.000Z",
  schemaVersion: 1,
});

/** 1 ユーザー 1 行だけを持つ偽の Supabase（user_id を受け取ったら失敗にする＝送っていないことの確認）。 */
function fakeDb(opts: { multi?: boolean; corruptOnRead?: boolean; failUpsert?: boolean } = {}) {
  let row: Record<string, unknown> | null = null;
  const sent: unknown[] = [];
  const client = {
    from(table: string) {
      if (table !== "saved_builds_snapshots") throw new Error(`unexpected table ${table}`);
      return {
        select: async () => ({ data: row ? (opts.multi ? [row, { ...row, id: "x2" }] : [opts.corruptOnRead ? { ...row, builds_data: { items: [{ bad: true }] } } : row]) : [], error: null }),
        upsert: (payload: Record<string, unknown>) => ({
          select: async () => {
            sent.push(payload);
            if ("user_id" in payload) return { data: null, error: { message: "user_id must not be sent" } };
            if (opts.failUpsert) return { data: null, error: { status: 401 } };
            row = { id: "row-1", ...payload, updated_at: "2026-10-11T00:00:00.000Z" };
            return { data: [row], error: null };
          },
        }),
        delete: () => ({
          eq: (_c: string, id: string) => ({
            select: async () => {
              if (!row || row.id !== id) return { data: [], error: null };
              row = null;
              return { data: [{ id }], error: null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, sent };
}

describe("保存ビルドのクラウド保存のアクセス層（2026-10-11）", () => {
  it("0 件は成功の null・保存して読み戻し（user_id を送らない・版と件数とハッシュ）・削除して 0 件", async () => {
    const { client, sent } = fakeDb();
    expect(await fetchBuildsCloudSnapshot(client)).toEqual({ ok: true, data: null });
    const saved = await saveBuildsCloudSnapshot(client, [mk("b_2"), mk("b_1")], "2026-10-11T00:00:00.000Z");
    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.data.itemCount).toBe(2);
    expect(saved.ok && saved.data.payload.items.map((b) => b.buildId)).toEqual(["b_1", "b_2"]);
    expect((sent[0] as Record<string, unknown>).schema_version).toBe(BUILDS_CLOUD_SCHEMA_VERSION);
    expect(sent[0]).not.toHaveProperty("user_id");
    const del = await deleteBuildsCloudSnapshot(client, saved.ok ? saved.data.id : "");
    expect(del).toEqual({ ok: true, data: { id: "row-1" } });
    expect(await fetchBuildsCloudSnapshot(client)).toEqual({ ok: true, data: null });
  });
  it("壊れた端末のデータは送らない・複数行・壊れたクラウドのデータ・未ログインは失敗として返す（生のエラーは出さない）", async () => {
    const { client, sent } = fakeDb();
    expect(await saveBuildsCloudSnapshot(client, [mk("b_1"), mk("b_1")], "2026-10-11T00:00:00.000Z")).toEqual({ ok: false, error: "INVALID_LOCAL_DATA" });
    expect(sent).toHaveLength(0);
    const multi = fakeDb({ multi: true });
    await saveBuildsCloudSnapshot(multi.client, [mk("b_1")], "2026-10-11T00:00:00.000Z");
    expect(await fetchBuildsCloudSnapshot(multi.client)).toEqual({ ok: false, error: "MULTIPLE_ROWS" });
    const corrupt = fakeDb({ corruptOnRead: true });
    expect(await saveBuildsCloudSnapshot(corrupt.client, [mk("b_1")], "2026-10-11T00:00:00.000Z")).toEqual({ ok: false, error: "INVALID_CLOUD_DATA" });
    expect(await saveBuildsCloudSnapshot(fakeDb({ failUpsert: true }).client, [mk("b_1")], "2026-10-11T00:00:00.000Z")).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(await deleteBuildsCloudSnapshot(fakeDb().client, "nope")).toEqual({ ok: false, error: "NOT_FOUND_OR_FORBIDDEN" });
  });
});
