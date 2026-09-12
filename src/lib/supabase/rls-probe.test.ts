import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateProbeLabel, listOwnProbes, createProbe, updateProbeLabel, deleteProbe, RLS_PROBE_LABEL_MAX_LENGTH } from "./rls-probe";

/**
 * 実Supabaseへは一切接続しない、この単体テスト専用の最小限のPostgrestクエリビルダー偽物。
 * `rls-probe.ts`が実際に呼び出す最小のチェーン(`from().select().order()` /
 * `from().insert().select().single()` / `from().update().eq().select()` /
 * `from().delete().eq().select()`)だけを実装する。
 */
function makeFakeSupabase(behavior: {
  selectResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
  deleteResult?: { data: unknown; error: unknown };
  throwOn?: "select" | "insert" | "update" | "delete";
  captureInsertPayload?: (payload: Record<string, unknown>) => void;
  captureUpdatePayload?: (payload: Record<string, unknown>) => void;
  captureEqCall?: (column: string, value: unknown) => void;
}) {
  const from = (_table: string) => ({
    select: (_cols: string) => {
      if (behavior.throwOn === "select") throw new Error("network down");
      return {
        order: async (_col: string, _opts: unknown) => behavior.selectResult ?? { data: [], error: null },
      };
    },
    insert: (payload: Record<string, unknown>) => {
      behavior.captureInsertPayload?.(payload);
      return {
        select: (_cols: string) => ({
          single: async () => {
            if (behavior.throwOn === "insert") throw new Error("network down");
            return behavior.insertResult ?? { data: null, error: null };
          },
        }),
      };
    },
    update: (payload: Record<string, unknown>) => {
      behavior.captureUpdatePayload?.(payload);
      return {
        eq: (column: string, value: unknown) => {
          behavior.captureEqCall?.(column, value);
          return {
            select: async (_cols: string) => {
              if (behavior.throwOn === "update") throw new Error("network down");
              return behavior.updateResult ?? { data: [], error: null };
            },
          };
        },
      };
    },
    delete: () => ({
      eq: (column: string, value: unknown) => {
        behavior.captureEqCall?.(column, value);
        return {
          select: async (_cols: string) => {
            if (behavior.throwOn === "delete") throw new Error("network down");
            return behavior.deleteResult ?? { data: [], error: null };
          },
        };
      },
    }),
  });

  return { from } as unknown as SupabaseClient;
}

describe("validateProbeLabel", () => {
  it("空文字は拒否される", () => {
    expect(validateProbeLabel("")).toEqual({ ok: false, error: "EMPTY" });
  });
  it("空白だけは拒否される", () => {
    expect(validateProbeLabel("   \n\t  ")).toEqual({ ok: false, error: "EMPTY" });
  });
  it("1文字は受理される", () => {
    expect(validateProbeLabel("a")).toEqual({ ok: true, value: "a" });
  });
  it(`${RLS_PROBE_LABEL_MAX_LENGTH}文字ちょうどは受理される`, () => {
    const s = "a".repeat(RLS_PROBE_LABEL_MAX_LENGTH);
    expect(validateProbeLabel(s)).toEqual({ ok: true, value: s });
  });
  it(`${RLS_PROBE_LABEL_MAX_LENGTH + 1}文字は拒否される`, () => {
    const s = "a".repeat(RLS_PROBE_LABEL_MAX_LENGTH + 1);
    expect(validateProbeLabel(s)).toEqual({ ok: false, error: "TOO_LONG" });
  });
  it("非常に長い文字列は拒否される", () => {
    expect(validateProbeLabel("a".repeat(5000))).toEqual({ ok: false, error: "TOO_LONG" });
  });
  it("前後の空白は安全に取り除かれる", () => {
    expect(validateProbeLabel("  Probe A  ")).toEqual({ ok: true, value: "Probe A" });
  });
  it("Unicode・絵文字を受理する", () => {
    expect(validateProbeLabel("café🎉テスト")).toEqual({ ok: true, value: "café🎉テスト" });
  });
  it("HTML風・script風・SQL風の文字列も、長さ内なら値として受理する(実行はしない)", () => {
    expect(validateProbeLabel("<script>alert(1)</script>")).toEqual({ ok: true, value: "<script>alert(1)</script>" });
    expect(validateProbeLabel("'; DROP TABLE x; --")).toEqual({ ok: true, value: "'; DROP TABLE x; --" });
  });
  it("改行を含む値も文字列としてはそのまま受理する(表示側で制御する)", () => {
    expect(validateProbeLabel("line1\nline2")).toEqual({ ok: true, value: "line1\nline2" });
  });
});

describe("listOwnProbes", () => {
  it("成功時、行をcamelCaseへ変換して返す", async () => {
    const supabase = makeFakeSupabase({
      selectResult: { data: [{ id: "id-1", label: "Probe A", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }], error: null },
    });
    const result = await listOwnProbes(supabase);
    expect(result).toEqual({ ok: true, data: [{ id: "id-1", label: "Probe A", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }] });
  });

  it("未認証相当(0件)は空配列として成功扱いになる(一覧としては安全)", async () => {
    const supabase = makeFakeSupabase({ selectResult: { data: [], error: null } });
    expect(await listOwnProbes(supabase)).toEqual({ ok: true, data: [] });
  });

  it("認証エラー(status 401)はUNAUTHENTICATEDへ一般化される", async () => {
    const supabase = makeFakeSupabase({ selectResult: { data: null, error: { status: 401, message: "raw db detail that must not leak" } } });
    const result = await listOwnProbes(supabase);
    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("ネットワーク失敗はNETWORKへ一般化される", async () => {
    const supabase = makeFakeSupabase({ throwOn: "select" });
    expect(await listOwnProbes(supabase)).toEqual({ ok: false, error: "NETWORK" });
  });

  it("生のDBエラーメッセージを一切含まない", async () => {
    const supabase = makeFakeSupabase({ selectResult: { data: null, error: { message: "secret internal detail", code: "42501" } } });
    const result = await listOwnProbes(supabase);
    expect(JSON.stringify(result)).not.toContain("secret internal detail");
  });
});

describe("createProbe", () => {
  it("バリデーション失敗時はネットワークへ到達しない", async () => {
    let called = false;
    const supabase = makeFakeSupabase({ captureInsertPayload: () => { called = true; } });
    const result = await createProbe(supabase, "   ");
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(called).toBe(false);
  });

  it("作成payloadにuser_idを一切含めない", async () => {
    let captured: Record<string, unknown> | null = null;
    const supabase = makeFakeSupabase({
      captureInsertPayload: (p) => { captured = p; },
      insertResult: { data: { id: "id-1", label: "Probe A", created_at: "t", updated_at: "t" }, error: null },
    });
    await createProbe(supabase, "Probe A");
    expect(captured).toEqual({ label: "Probe A" });
    expect(Object.keys(captured ?? {})).not.toContain("user_id");
  });

  it("成功時、trimされた値で作成しレコードを返す", async () => {
    const supabase = makeFakeSupabase({
      insertResult: { data: { id: "id-1", label: "Probe A", created_at: "t1", updated_at: "t1" }, error: null },
    });
    const result = await createProbe(supabase, "  Probe A  ");
    expect(result).toEqual({ ok: true, data: { id: "id-1", label: "Probe A", createdAt: "t1", updatedAt: "t1" } });
  });

  it("ネットワーク失敗はNETWORKへ一般化される", async () => {
    const supabase = makeFakeSupabase({ throwOn: "insert" });
    expect(await createProbe(supabase, "Probe A")).toEqual({ ok: false, error: "NETWORK" });
  });

  it("RLSで拒否された場合(dataなし)を安全に失敗として扱う", async () => {
    const supabase = makeFakeSupabase({ insertResult: { data: null, error: { code: "42501", message: "row-level security policy violation" } } });
    const result = await createProbe(supabase, "Probe A");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("row-level security policy violation");
  });
});

describe("updateProbeLabel", () => {
  it("バリデーション失敗時はネットワークへ到達しない", async () => {
    let called = false;
    const supabase = makeFakeSupabase({ captureUpdatePayload: () => { called = true; } });
    const result = await updateProbeLabel(supabase, "id-1", "");
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(called).toBe(false);
  });

  it("更新payloadにuser_idを一切含めない", async () => {
    let captured: Record<string, unknown> | null = null;
    const supabase = makeFakeSupabase({
      captureUpdatePayload: (p) => { captured = p; },
      updateResult: { data: [{ id: "id-1", label: "Updated probe", created_at: "t", updated_at: "t2" }], error: null },
    });
    await updateProbeLabel(supabase, "id-1", "Updated probe");
    expect(captured).toEqual({ label: "Updated probe" });
    expect(Object.keys(captured ?? {})).not.toContain("user_id");
  });

  it("対象idでeqフィルターする", async () => {
    let capturedCol: string | null = null;
    let capturedVal: unknown = null;
    const supabase = makeFakeSupabase({
      captureEqCall: (col, val) => { capturedCol = col; capturedVal = val; },
      updateResult: { data: [{ id: "id-1", label: "x", created_at: "t", updated_at: "t" }], error: null },
    });
    await updateProbeLabel(supabase, "id-1", "x");
    expect(capturedCol).toBe("id");
    expect(capturedVal).toBe("id-1");
  });

  it("0件更新は成功として誤表示しない(他人の行・存在しないID)", async () => {
    const supabase = makeFakeSupabase({ updateResult: { data: [], error: null } });
    const result = await updateProbeLabel(supabase, "someone-elses-id", "x");
    expect(result).toEqual({ ok: false, error: "NOT_FOUND_OR_FORBIDDEN" });
  });

  it("成功時はレコードを返す", async () => {
    const supabase = makeFakeSupabase({ updateResult: { data: [{ id: "id-1", label: "Updated probe", created_at: "t1", updated_at: "t2" }], error: null } });
    const result = await updateProbeLabel(supabase, "id-1", "Updated probe");
    expect(result).toEqual({ ok: true, data: { id: "id-1", label: "Updated probe", createdAt: "t1", updatedAt: "t2" } });
  });

  it("ネットワーク失敗はNETWORKへ一般化される", async () => {
    const supabase = makeFakeSupabase({ throwOn: "update" });
    expect(await updateProbeLabel(supabase, "id-1", "x")).toEqual({ ok: false, error: "NETWORK" });
  });
});

describe("deleteProbe", () => {
  it("対象idでeqフィルターする", async () => {
    let capturedCol: string | null = null;
    let capturedVal: unknown = null;
    const supabase = makeFakeSupabase({
      captureEqCall: (col, val) => { capturedCol = col; capturedVal = val; },
      deleteResult: { data: [{ id: "id-1" }], error: null },
    });
    await deleteProbe(supabase, "id-1");
    expect(capturedCol).toBe("id");
    expect(capturedVal).toBe("id-1");
  });

  it("0件削除は成功として誤表示しない", async () => {
    const supabase = makeFakeSupabase({ deleteResult: { data: [], error: null } });
    expect(await deleteProbe(supabase, "someone-elses-id")).toEqual({ ok: false, error: "NOT_FOUND_OR_FORBIDDEN" });
  });

  it("成功時はidを返す", async () => {
    const supabase = makeFakeSupabase({ deleteResult: { data: [{ id: "id-1" }], error: null } });
    expect(await deleteProbe(supabase, "id-1")).toEqual({ ok: true, data: { id: "id-1" } });
  });

  it("ネットワーク失敗はNETWORKへ一般化される", async () => {
    const supabase = makeFakeSupabase({ throwOn: "delete" });
    expect(await deleteProbe(supabase, "id-1")).toEqual({ ok: false, error: "NETWORK" });
  });

  it("生のDBエラーメッセージを一切含まない", async () => {
    const supabase = makeFakeSupabase({ deleteResult: { data: null, error: { message: "secret internal detail" } } });
    const result = await deleteProbe(supabase, "id-1");
    expect(JSON.stringify(result)).not.toContain("secret internal detail");
  });
});

describe("秘密情報非表示(全操作共通)", () => {
  it("いずれの結果オブジェクトにもuser_id/token/cookieというキーが含まれない", async () => {
    const supabase = makeFakeSupabase({
      selectResult: { data: [{ id: "id-1", label: "Probe A", created_at: "t", updated_at: "t" }], error: null },
    });
    const result = await listOwnProbes(supabase);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/user_id|token|cookie/i);
  });
});
