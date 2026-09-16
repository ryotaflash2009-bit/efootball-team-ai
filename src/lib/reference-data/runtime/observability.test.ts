import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyReferenceDataFailure, logReferenceDataFailure } from "./observability";

describe("classifyReferenceDataFailure", () => {
  it("statusが0かつmessageにabortを含む場合はtimeout", () => {
    expect(classifyReferenceDataFailure(0, { message: "AbortError: The operation was aborted" })).toBe("timeout");
  });

  it("statusが0かつmessageにtimeoutを含む場合はtimeout", () => {
    expect(classifyReferenceDataFailure(0, { message: "TimeoutError: signal timed out" })).toBe("timeout");
  });

  it("statusが0でabort/timeoutを含まない場合はnetwork", () => {
    expect(classifyReferenceDataFailure(0, { message: "TypeError: fetch failed" })).toBe("network");
  });

  it("statusが0でmessageが無い場合はnetwork", () => {
    expect(classifyReferenceDataFailure(0, {})).toBe("network");
  });

  it("401はunauthorized", () => {
    expect(classifyReferenceDataFailure(401, { message: "JWT expired" })).toBe("unauthorized");
  });

  it("403はforbidden", () => {
    expect(classifyReferenceDataFailure(403, { message: "permission denied" })).toBe("forbidden");
  });

  it("429はrate_limited", () => {
    expect(classifyReferenceDataFailure(429, { message: "too many requests" })).toBe("rate_limited");
  });

  it("500はserver_error", () => {
    expect(classifyReferenceDataFailure(500, { message: "internal server error" })).toBe("server_error");
  });

  it("503はserver_error", () => {
    expect(classifyReferenceDataFailure(503, { message: "service unavailable" })).toBe("server_error");
  });

  it("statusがundefinedの場合はunknown(クライアント生成失敗等、HTTP応答が存在しないケース)", () => {
    expect(classifyReferenceDataFailure(undefined, { message: "config error" })).toBe("unknown");
  });

  it("404等の未分類ステータスはunknown(推測で他カテゴリに割り当てない)", () => {
    expect(classifyReferenceDataFailure(404, { message: "not found" })).toBe("unknown");
  });

  it("errが文字列やnullでも例外を投げない", () => {
    expect(classifyReferenceDataFailure(0, null)).toBe("network");
    expect(classifyReferenceDataFailure(0, "plain string error")).toBe("network");
    expect(classifyReferenceDataFailure(500, undefined)).toBe("server_error");
  });
});

describe("logReferenceDataFailure", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function loggedPayload(): Record<string, unknown> {
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const arg = consoleErrorSpy.mock.calls[0][0];
    expect(typeof arg).toBe("string");
    return JSON.parse(arg as string);
  }

  it("固定イベント名・operation・dataSource・errorCategoryを出力する", () => {
    logReferenceDataFailure({ operation: "world.list", errorCategory: "server_error" });
    const payload = loggedPayload();
    expect(payload).toMatchObject({
      event: "reference_data_query_failed",
      operation: "world.list",
      dataSource: "supabase",
      errorCategory: "server_error",
    });
  });

  it("statusCode/elapsedMs/pageIndexは指定時のみ出力する", () => {
    logReferenceDataFailure({ operation: "world.facets", errorCategory: "server_error", status: 503, elapsedMs: 1234, pageIndex: 3 });
    const payload = loggedPayload();
    expect(payload.statusCode).toBe(503);
    expect(payload.elapsedMs).toBe(1234);
    expect(payload.pageIndex).toBe(3);
  });

  it("statusCode/elapsedMs/pageIndex未指定時はキー自体を含めない", () => {
    logReferenceDataFailure({ operation: "managers.count", errorCategory: "unknown" });
    const payload = loggedPayload();
    expect("statusCode" in payload).toBe(false);
    expect("elapsedMs" in payload).toBe(false);
    expect("pageIndex" in payload).toBe(false);
  });

  it("dataSourceは常にsupabaseと記録する", () => {
    logReferenceDataFailure({ operation: "analysis.detail", errorCategory: "network" });
    expect(loggedPayload().dataSource).toBe("supabase");
  });

  it("operationは許可された固定識別子だけが出力される(型で保証、実行時もそのまま反映)", () => {
    logReferenceDataFailure({ operation: "managers.detail", errorCategory: "forbidden" });
    expect(loggedPayload().operation).toBe("managers.detail");
  });

  it("ログ出力内容にSupabase URLらしき文字列を含めない", () => {
    logReferenceDataFailure({ operation: "world.detail", errorCategory: "unauthorized", status: 401 });
    const raw = JSON.stringify(loggedPayload());
    expect(raw).not.toMatch(/supabase\.co/i);
  });

  it("ログ出力内容にpublishable/secret keyらしき値を含めない", () => {
    logReferenceDataFailure({ operation: "world.detail", errorCategory: "unauthorized", status: 401 });
    const raw = JSON.stringify(loggedPayload());
    expect(raw).not.toMatch(/sb_publishable_|sb_secret_|eyJ/);
  });

  it("ログ出力内容にAuthorizationやCookieらしき文字列を含めない", () => {
    logReferenceDataFailure({ operation: "world.list", errorCategory: "server_error", status: 500 });
    const raw = JSON.stringify(loggedPayload());
    expect(raw.toLowerCase()).not.toContain("authorization");
    expect(raw.toLowerCase()).not.toContain("cookie");
  });

  it("Errorオブジェクトをそのまま渡しても、ログにはmessage/stackが含まれない(呼び出し側の設計として、渡すのは分類済みcontextのみ)", () => {
    logReferenceDataFailure({ operation: "world.list", errorCategory: "server_error", status: 500 });
    const raw = JSON.stringify(loggedPayload());
    expect(raw).not.toContain("at ");
    expect(raw).not.toContain(".ts:");
  });

  it("console.errorが例外を投げても呼び出し元へ伝播しない(ログ失敗が元の処理を壊さない)", () => {
    consoleErrorSpy.mockImplementation(() => {
      throw new Error("logging backend down");
    });
    expect(() => logReferenceDataFailure({ operation: "world.list", errorCategory: "unknown" })).not.toThrow();
  });
});
