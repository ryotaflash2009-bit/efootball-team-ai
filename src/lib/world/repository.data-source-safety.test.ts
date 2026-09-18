import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { listPlayers } from "./repository";
import { parseWorldListQuery } from "./schemas";
import { WorldDataUnavailableError } from "./db";
import { listManagers } from "@/lib/managers/repository";
import { parseManagerListQuery } from "@/lib/managers/schemas";
import { getEfhubAnalysisDetail } from "./analysis-repository";

/**
 * Phase E(`WORLD_DATA_SOURCE`既定値のsupabase化)の安全性を、個別関数の
 * 単体テストではなく実際の公開ディスパッチャー(`listPlayers`/`listManagers`/
 * `getEfhubAnalysisDetail`)経由で確認する。
 *
 * - Supabase環境変数が不足している状態で、既定値(未設定 = supabase)を使うと、
 *   安全なエラー(`WorldDataUnavailableError`)を返し、SQLiteへ黙ってフォールバック
 *   しないことを確認する(`src/lib/world/repository.ts`等の分岐にtry/catchによる
 *   自動フォールバックが存在しないことのコードレビュー結果を、実行時にも裏付ける)。
 * - このテストはDB有無(`hasDb`)に依存しない。CI環境(実SQLite・実Supabase環境変数の
 *   いずれも無い)でも常に実行され、まさにその環境でこそ意味を持つ。
 * - エラーメッセージに接続先URL・鍵・スタックトレース等の秘密情報が含まれないことも確認する。
 */
const ENV_KEYS = ["WORLD_DATA_SOURCE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("Phase E: WORLD_DATA_SOURCE未設定・Supabase環境変数不足時の安全性", () => {
  it("listPlayers: 未設定(既定値supabase)でSupabase環境変数が無いとWorldDataUnavailableErrorを返す(SQLiteへの自動フォールバックなし)", async () => {
    await expect(listPlayers(parseWorldListQuery({}))).rejects.toBeInstanceOf(WorldDataUnavailableError);
  });

  it("listManagers: 未設定(既定値supabase)でSupabase環境変数が無いとWorldDataUnavailableErrorを返す", async () => {
    await expect(listManagers(parseManagerListQuery({}))).rejects.toBeInstanceOf(WorldDataUnavailableError);
  });

  it("getEfhubAnalysisDetail: 未設定(既定値supabase)でSupabase環境変数が無いとWorldDataUnavailableErrorを返す", async () => {
    await expect(getEfhubAnalysisDetail("1")).rejects.toBeInstanceOf(WorldDataUnavailableError);
  });

  it("WORLD_DATA_SOURCE=supabaseを明示してもSupabase環境変数が無ければ同様にWorldDataUnavailableError", async () => {
    process.env.WORLD_DATA_SOURCE = "supabase";
    await expect(listPlayers(parseWorldListQuery({}))).rejects.toBeInstanceOf(WorldDataUnavailableError);
  });

  it("エラーメッセージに接続先URLや鍵らしき文字列を含まない", async () => {
    try {
      await listPlayers(parseWorldListQuery({}));
      expect.unreachable();
    } catch (err) {
      const message = String((err as Error).message);
      expect(message).not.toMatch(/supabase\.co/i);
      expect(message).not.toMatch(/sb_(publishable|secret)_/);
      expect(message).not.toContain(String(process.env.NEXT_PUBLIC_SUPABASE_URL));
    }
  });
});
