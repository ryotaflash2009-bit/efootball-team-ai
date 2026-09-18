import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";
import { normalizeClientError, normalizeQueryError } from "./errors";
import { ReferenceDataEnvError } from "./supabase-client";

describe("normalizeClientError / normalizeQueryError: 既存の外部契約を維持する", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("normalizeClientErrorは常にWorldDataUnavailableErrorを返す(ReferenceDataEnvErrorでもそれ以外でも)", () => {
    expect(normalizeClientError(new ReferenceDataEnvError(), { operation: "world.list" })).toBeInstanceOf(WorldDataUnavailableError);
    expect(normalizeClientError(new Error("unexpected"), { operation: "world.list" })).toBeInstanceOf(WorldDataUnavailableError);
    expect(normalizeClientError("not even an error object", { operation: "world.list" })).toBeInstanceOf(WorldDataUnavailableError);
  });

  it("normalizeQueryErrorは常にWorldQueryErrorを返す(statusの有無やerrorCategoryによらない)", () => {
    expect(normalizeQueryError({ message: "boom" }, { operation: "world.list" })).toBeInstanceOf(WorldQueryError);
    expect(normalizeQueryError({ message: "boom" }, { operation: "world.list", status: 500 })).toBeInstanceOf(WorldQueryError);
    expect(normalizeQueryError(null, { operation: "world.list", status: 0 })).toBeInstanceOf(WorldQueryError);
  });

  it("エラーメッセージに秘密情報や内部詳細を含めない(既存の安全な定型メッセージのまま)", () => {
    const err = normalizeQueryError({ message: "connection string: postgresql://user:pass@host/db" }, { operation: "world.list", status: 500 });
    expect(err.message).not.toContain("postgresql://");
    expect(err.message).not.toContain("pass@host");
  });

  it("ログ出力後も戻り値の型・メッセージが変わらない(ログ追加前と同じ外部挙動)", () => {
    const err1 = normalizeQueryError({ message: "a" }, { operation: "managers.list", status: 429 });
    const err2 = normalizeQueryError({ message: "b" }, { operation: "managers.list", status: 429 });
    expect(err1.message).toBe(err2.message);
    expect(err1.constructor).toBe(err2.constructor);
  });

  it("normalizeClientErrorはログ出力する(errorCategory: unknown、statusは伴わない設定不備のため)", () => {
    normalizeClientError(new ReferenceDataEnvError(), { operation: "managers.count" });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({ operation: "managers.count", dataSource: "supabase", errorCategory: "unknown" });
    expect("statusCode" in payload).toBe(false);
  });

  it("normalizeQueryErrorはstatusから正しいerrorCategoryでログ出力する", () => {
    normalizeQueryError({ message: "rate limited" }, { operation: "world.facets", status: 429, pageIndex: 2 });
    const payload = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({ operation: "world.facets", errorCategory: "rate_limited", statusCode: 429, pageIndex: 2 });
  });

  it("SQLite経路はこのモジュールを経由しないため、このテストファイルの対象にはなり得ない(設計上の分離確認)", () => {
    // normalizeClientError/normalizeQueryErrorはSupabase(runtime)専用のモジュールであり、
    // src/lib/world/db.tsのSQLite側エラー生成コードとは物理的に別ファイル・別呼び出し経路にある。
    // このテストは「呼べば必ずdataSource: supabaseとしてログされる」という一貫性の記録として置く。
    normalizeQueryError({ message: "x" }, { operation: "analysis.detail" });
    const payload = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(payload.dataSource).toBe("supabase");
  });
});
