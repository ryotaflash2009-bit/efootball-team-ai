import { describe, it, expect, afterEach } from "vitest";
import { POST } from "./route";
import { setBuildIntentExtractorForTesting, NotConfiguredBuildIntentExtractor } from "@/lib/ai/build-intent-extractor";
import { FREE_TEXT_MAX_LENGTH } from "@/lib/progression/build-intent-analysis";

/**
 * このテストは実ネットワーク・実AIベンダーへ一切接続しない(Next.jsのルートハンドラーを
 * 直接呼び出すだけの決定的なユニットテスト)。既定のextractor解決は
 * RuleBasedBuildIntentExtractor(追加費用ゼロ・外部通信なしのルールベース解析)であり、
 * ここでの「200 + extraction」は実際の本番動作そのものであり、fakeで差し替えていない。
 * 本物の生成AI・外部AI APIには一切接続していない。
 */

function makeRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/build-intent/extract", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  freeText: "ドリブルを優先したい",
  locale: "ja",
  availablePositions: ["RWF"],
  availableComparisonBuilds: [],
};

describe("POST /api/build-intent/extract", () => {
  afterEach(() => {
    setBuildIntentExtractorForTesting(null); // 既定(NotConfigured)へ戻す
  });

  it("Content-Type が application/json 以外なら 400", async () => {
    const res = await POST(makeRequest(validBody, "text/plain"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("不正なJSON本文は 400", async () => {
    const res = await POST(makeRequest("{not valid json", "application/json"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("スキーマ不一致(freeTextなし)は 400", async () => {
    const res = await POST(makeRequest({ locale: "ja", availablePositions: [], availableComparisonBuilds: [] }));
    expect(res.status).toBe(400);
  });

  it(`freeTextが上限(${FREE_TEXT_MAX_LENGTH}字)を超える場合は 400`, async () => {
    const res = await POST(makeRequest({ ...validBody, freeText: "あ".repeat(FREE_TEXT_MAX_LENGTH + 1) }));
    expect(res.status).toBe(400);
  });

  it("不正なlocaleは 400", async () => {
    const res = await POST(makeRequest({ ...validBody, locale: "fr" }));
    expect(res.status).toBe(400);
  });

  it("有効なリクエストは、標準のルールベース解析結果を 200 で返す(外部AI未使用・成功を偽装していない実際の動作)", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeUndefined();
    expect(json.extraction).toBeDefined();
    expect(json.extraction.priorityGroups).toContain("dribbling");
  });

  it("NotConfiguredBuildIntentExtractor へ明示的に差し替えた場合は 200 で NOT_CONFIGURED を返す(設定異常時の安全な経路)", async () => {
    setBuildIntentExtractorForTesting(new NotConfiguredBuildIntentExtractor());
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error?.code).toBe("NOT_CONFIGURED");
    expect(json.extraction).toBeUndefined();
  });

  it("APIキーや内部レスポンスの詳細をエラーへ含めない", async () => {
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    const serialized = JSON.stringify(json);
    expect(serialized).not.toMatch(/api[_-]?key/i);
    expect(serialized).not.toMatch(/sk-[a-zA-Z0-9]/);
  });

  it("大量の連続リクエストはレート制限(429)を返す(プロセス内ベストエフォート)", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => POST(makeRequest(validBody))));
    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(429);
  });
});
