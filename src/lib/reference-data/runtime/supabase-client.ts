/**
 * 参照データ(reference_dataスキーマ)専用の、サーバー側だけで使うSupabaseクライアント。
 *
 * - 個人データ用のクライアント(`src/lib/supabase/server.ts`)とは完全に分離する。
 *   あちらはCookie/セッションに紐づく`@supabase/ssr`の`createServerClient`だが、
 *   参照データは「認証済みセッションの有無に関わらず同じ公開結果」であるべきため、
 *   Cookie不要なプレーンな`@supabase/supabase-js`の`createClient`を使う。
 * - 使う環境変数は既存の`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`のみ
 *   (`src/lib/supabase/env.ts`の検証関数をそのまま再利用し、Secret key/service_role混入も拒否する)。
 * - 対象スキーマは`reference_data`に固定する。管理用インポート(`scripts/migration/`)の
 *   PostgreSQL直接接続とは完全に別経路であり、DBパスワード・接続文字列・CA証明書は使わない。
 * - このクライアントはプロセス内で使い回す(リクエストごとに作り直さない。Cookie等の
 *   リクエスト固有状態を持たないため、使い回して問題ない)。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** `reference_data`スキーマ固定のSupabaseクライアント型(生成済み型定義を持たないため`any`ベース)。 */
export type ReferenceDataClient = SupabaseClient<any, "reference_data", "reference_data">;

export class ReferenceDataEnvError extends Error {
  readonly code = "REFERENCE_DATA_ENV_INVALID";
  constructor() {
    super("Supabase reference data client is not configured");
    this.name = "ReferenceDataEnvError";
  }
}

let cached: ReferenceDataClient | null = null;
let clientOverride: (() => ReferenceDataClient) | null = null;

function buildClient(): ReferenceDataClient {
  const env = getSupabaseEnv();
  if (!env.ok) throw new ReferenceDataEnvError();
  return createClient(env.config.url, env.config.publishableKey, {
    db: { schema: "reference_data" },
    // 参照データはCookie/セッションと無関係の公開読み取りのみ。認証状態を保持・自動更新しない。
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) }),
    },
  });
}

/** 検証済み環境変数からクライアントを取得する。未設定/不正な場合は`ReferenceDataEnvError`を投げる。 */
export function getReferenceDataClient(): ReferenceDataClient {
  if (clientOverride) return clientOverride();
  if (cached) return cached;
  cached = buildClient();
  return cached;
}

/** テスト専用: 実際のSupabase通信を伴わない差し替えを可能にする(本番コードから呼び出さない)。 */
export function setReferenceDataClientForTesting(factory: (() => ReferenceDataClient) | null): void {
  clientOverride = factory;
  cached = null;
}
