import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMyTeamCloudSnapshot, saveMyTeamCloudSnapshot, deleteMyTeamCloudSnapshot } from "./my-team-cloud";
import { MY_TEAM_CLOUD_SCHEMA_VERSION, MY_TEAM_CLOUD_MAX_ITEMS } from "./my-team-cloud-schema";
import type { MyTeamRecord } from "@/lib/user-cards/types";

function makeRecord(overrides: Partial<MyTeamRecord> = {}): MyTeamRecord {
  return {
    localRecordId: "myt_abcd1234",
    teamCardId: "tc_abcd1234",
    worldCardId: "123456",
    ownershipStatus: "owned",
    usageStatus: "main",
    selectedBuildId: null,
    favoriteBuildId: null,
    note: "",
    tags: [],
    addedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
    ...overrides,
  };
}

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    schema_version: MY_TEAM_CLOUD_SCHEMA_VERSION,
    team_data: { items: [] },
    item_count: 0,
    payload_hash: "a".repeat(64),
    client_updated_at: "2026-09-01T00:00:00.000Z",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

interface MockHandlers {
  select?: () => Promise<{ data: unknown; error: unknown }>;
  upsert?: (payload: unknown, opts: unknown) => { select: (cols: string) => Promise<{ data: unknown; error: unknown }> };
  delete?: () => { eq: (col: string, val: string) => { select: (cols: string) => Promise<{ data: unknown; error: unknown }> } };
}

function makeSupabaseMock(handlers: MockHandlers): SupabaseClient {
  return {
    from() {
      return {
        select: () => (handlers.select ? handlers.select() : Promise.resolve({ data: [], error: null })),
        upsert: (payload: unknown, opts: unknown) =>
          handlers.upsert ? handlers.upsert(payload, opts) : { select: () => Promise.resolve({ data: [], error: null }) },
        delete: () =>
          handlers.delete ? handlers.delete() : { eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) },
      };
    },
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchMyTeamCloudSnapshot", () => {
  it("0件は「クラウドデータなし」としてok:true, data:nullを返す(エラーではない)", async () => {
    const supabase = makeSupabaseMock({ select: () => Promise.resolve({ data: [], error: null }) });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result).toEqual({ ok: true, data: null });
  });

  it("1件の正常な行を取得できる", async () => {
    const supabase = makeSupabaseMock({ select: () => Promise.resolve({ data: [validRow()], error: null }) });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.id).toBe("row-1");
      expect(result.data?.itemCount).toBe(0);
    }
  });

  it("2件以上返ってきた場合はMULTIPLE_ROWSとして安全に停止する", async () => {
    const supabase = makeSupabaseMock({ select: () => Promise.resolve({ data: [validRow(), validRow({ id: "row-2" })], error: null }) });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result).toEqual({ ok: false, error: "MULTIPLE_ROWS" });
  });

  it("未知のschema_versionの行はINVALID_CLOUD_DATAとして拒否する(実行しない)", async () => {
    const supabase = makeSupabaseMock({
      select: () => Promise.resolve({ data: [validRow({ schema_version: "my-team-cloud/2099-01-01.v9" })], error: null }),
    });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result).toEqual({ ok: false, error: "INVALID_CLOUD_DATA" });
  });

  it("不正なteam_data構造の行はINVALID_CLOUD_DATAとして拒否する", async () => {
    const supabase = makeSupabaseMock({
      select: () => Promise.resolve({ data: [validRow({ team_data: { items: "not-an-array" } })], error: null }),
    });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result).toEqual({ ok: false, error: "INVALID_CLOUD_DATA" });
  });

  it("401エラーはUNAUTHENTICATEDへ分類する", async () => {
    const supabase = makeSupabaseMock({ select: () => Promise.resolve({ data: null, error: { status: 401 } }) });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("生のエラーメッセージを外部へ渡さない(理由コードだけを返す)", async () => {
    const supabase = makeSupabaseMock({
      select: () => Promise.resolve({ data: null, error: { message: "some raw db internal detail", status: 500 } }),
    });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result).toEqual({ ok: false, error: "UNKNOWN" });
    expect(JSON.stringify(result)).not.toContain("raw db internal detail");
  });

  it("ネットワーク例外はNETWORKへ分類する", async () => {
    const supabase = makeSupabaseMock({ select: () => Promise.reject(new Error("fetch failed")) });
    const result = await fetchMyTeamCloudSnapshot(supabase);
    expect(result).toEqual({ ok: false, error: "NETWORK" });
  });

  it("応答が返らない場合はタイムアウトとして扱う", async () => {
    vi.useFakeTimers();
    const supabase = makeSupabaseMock({ select: () => new Promise(() => {}) });
    const promise = fetchMyTeamCloudSnapshot(supabase);
    await vi.advanceTimersByTimeAsync(20000);
    const result = await promise;
    expect(result).toEqual({ ok: false, error: "TIMEOUT" });
  });
});

describe("saveMyTeamCloudSnapshot", () => {
  it("正常に保存し、再取得で一致することを検証してから成功を返す", async () => {
    // 実装が計算した実際のpayload(item_count/payload_hash等)をそのままDBの応答として
    // 返す、より現実に近いモック(サーバーは送られてきた値をそのまま保存して返す想定)。
    let lastRow: Record<string, unknown> | null = null;
    let refetchCount = 0;
    const supabase = makeSupabaseMock({
      upsert: (payload) => {
        lastRow = validRow(payload as Record<string, unknown>);
        return { select: () => Promise.resolve({ data: [lastRow], error: null }) };
      },
      select: () => {
        refetchCount += 1;
        return Promise.resolve({ data: [lastRow], error: null });
      },
    });
    const result = await saveMyTeamCloudSnapshot(supabase, [makeRecord()], "2026-09-01T00:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(refetchCount).toBe(1); // 保存後に再フェッチして確認している
  });

  it("上限件数を超えるローカルデータはINVALID_LOCAL_DATAとして送信前に拒否する", async () => {
    const supabase = makeSupabaseMock({});
    const tooMany = Array.from({ length: MY_TEAM_CLOUD_MAX_ITEMS + 1 }, (_, i) => makeRecord({ worldCardId: String(i + 1) }));
    const result = await saveMyTeamCloudSnapshot(supabase, tooMany, "2026-09-01T00:00:00.000Z");
    expect(result).toEqual({ ok: false, error: "INVALID_LOCAL_DATA" });
  });

  it("UPSERTが0件を返した場合は成功として扱わない", async () => {
    const supabase = makeSupabaseMock({ upsert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) });
    const result = await saveMyTeamCloudSnapshot(supabase, [makeRecord()], "2026-09-01T00:00:00.000Z");
    expect(result).toEqual({ ok: false, error: "VERIFICATION_FAILED" });
  });

  it("UPSERTが複数件を返した場合は成功として扱わない", async () => {
    const supabase = makeSupabaseMock({ upsert: () => ({ select: () => Promise.resolve({ data: [validRow(), validRow({ id: "row-2" })], error: null }) }) });
    const result = await saveMyTeamCloudSnapshot(supabase, [makeRecord()], "2026-09-01T00:00:00.000Z");
    expect(result).toEqual({ ok: false, error: "VERIFICATION_FAILED" });
  });

  it("保存直後の再取得結果がハッシュ不一致なら成功として扱わない(部分成功を成功にしない)", async () => {
    const supabase = makeSupabaseMock({
      upsert: () => ({ select: () => Promise.resolve({ data: [validRow({ payload_hash: "b".repeat(64) })], error: null }) }),
      select: () => Promise.resolve({ data: [validRow({ payload_hash: "c".repeat(64) })], error: null }),
    });
    const result = await saveMyTeamCloudSnapshot(supabase, [makeRecord()], "2026-09-01T00:00:00.000Z");
    expect(result).toEqual({ ok: false, error: "VERIFICATION_FAILED" });
  });

  it("未認証エラー(401)はUNAUTHENTICATEDとして拒否する", async () => {
    const supabase = makeSupabaseMock({ upsert: () => ({ select: () => Promise.resolve({ data: null, error: { status: 401 } }) }) });
    const result = await saveMyTeamCloudSnapshot(supabase, [makeRecord()], "2026-09-01T00:00:00.000Z");
    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("payloadにuser_idを一切含めない", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const savedRow = validRow();
    const supabase = makeSupabaseMock({
      upsert: (payload) => {
        capturedPayload = payload as Record<string, unknown>;
        return { select: () => Promise.resolve({ data: [savedRow], error: null }) };
      },
      select: () => Promise.resolve({ data: [savedRow], error: null }),
    });
    await saveMyTeamCloudSnapshot(supabase, [], "2026-09-01T00:00:00.000Z");
    expect(capturedPayload).not.toHaveProperty("user_id");
  });

  it("onConflictはuser_idを指定する", async () => {
    let capturedOpts: Record<string, unknown> | null = null;
    const savedRow = validRow();
    const supabase = makeSupabaseMock({
      upsert: (_payload, opts) => {
        capturedOpts = opts as Record<string, unknown>;
        return { select: () => Promise.resolve({ data: [savedRow], error: null }) };
      },
      select: () => Promise.resolve({ data: [savedRow], error: null }),
    });
    await saveMyTeamCloudSnapshot(supabase, [], "2026-09-01T00:00:00.000Z");
    expect(capturedOpts).toEqual({ onConflict: "user_id" });
  });
});

describe("deleteMyTeamCloudSnapshot", () => {
  it("0件削除(他人の行/存在しない)は成功として扱わない", async () => {
    const supabase = makeSupabaseMock({ delete: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) });
    const result = await deleteMyTeamCloudSnapshot(supabase, "row-1");
    expect(result).toEqual({ ok: false, error: "NOT_FOUND_OR_FORBIDDEN" });
  });

  it("削除成功後、再取得で0件になったことを確認してから成功を返す", async () => {
    const supabase = makeSupabaseMock({
      delete: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: "row-1" }], error: null }) }) }),
      select: () => Promise.resolve({ data: [], error: null }),
    });
    const result = await deleteMyTeamCloudSnapshot(supabase, "row-1");
    expect(result).toEqual({ ok: true, data: { id: "row-1" } });
  });

  it("削除後の再取得でまだ行が残っていた場合は成功として扱わない", async () => {
    const supabase = makeSupabaseMock({
      delete: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: "row-1" }], error: null }) }) }),
      select: () => Promise.resolve({ data: [validRow()], error: null }),
    });
    const result = await deleteMyTeamCloudSnapshot(supabase, "row-1");
    expect(result).toEqual({ ok: false, error: "VERIFICATION_FAILED" });
  });

  it("未認証エラー(401)はUNAUTHENTICATEDとして拒否する", async () => {
    const supabase = makeSupabaseMock({ delete: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { status: 401 } }) }) }) });
    const result = await deleteMyTeamCloudSnapshot(supabase, "row-1");
    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });
});
