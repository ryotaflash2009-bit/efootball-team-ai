import { describe, it, expect, afterEach, vi } from "vitest";
import { getReferenceDataClient, setReferenceDataClientForTesting, ReferenceDataEnvError } from "./supabase-client";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setReferenceDataClientForTesting(null);
  vi.resetModules();
});

describe("getReferenceDataClient", () => {
  it("環境変数が未設定ならReferenceDataEnvErrorを投げる", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(() => getReferenceDataClient()).toThrow(ReferenceDataEnvError);
  });

  it("service_role/secret key相当の値ならReferenceDataEnvErrorを投げる(getSupabaseEnvの検証を再利用)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_should_be_rejected";
    expect(() => getReferenceDataClient()).toThrow(ReferenceDataEnvError);
  });

  it("正常な環境変数ならクライアントを返す(reference_dataスキーマ固定)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test1234567890";
    const client = getReferenceDataClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe("function");
  });

  it("テスト用オーバーライドを設定すると、それが使われる", () => {
    const fakeClient = { from: () => "fake" } as never;
    setReferenceDataClientForTesting(() => fakeClient);
    expect(getReferenceDataClient()).toBe(fakeClient);
  });

  it("オーバーライド解除後は再び環境変数ベースの生成に戻る", () => {
    setReferenceDataClientForTesting(() => ({ from: () => "fake" }) as never);
    setReferenceDataClientForTesting(null);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getReferenceDataClient()).toThrow(ReferenceDataEnvError);
  });
});
