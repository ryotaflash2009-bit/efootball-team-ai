import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import {
  MY_TEAM_CLOUD_SCHEMA_VERSION,
  toCloudItems,
  validateCloudPayloadForSave,
  validateFetchedCloudPayload,
  computeCloudPayloadHash,
  type CloudMyTeamPayload,
} from "./my-team-cloud-schema";

/**
 * `my_team_snapshots`(My Teamクラウド保存・手動/任意PoC)への安全なアクセス層。
 *
 * `rls-probe.ts`と同じ安全方針を踏襲する:
 *  - user_idをクライアントのpayloadへ一切含めない。所有者判定はRLSだけに委ねる。
 *  - `.eq("user_id", ...)`のようなクライアント側フィルターも使わない。
 *  - 保存(UPSERT)・削除は`.select(...)`を連結して実際の変更行を読み戻し、
 *    0件/複数件を「成功」として誤扱いしない。
 *  - 保存後・削除後は必ず再取得(再フェッチ)して一致(ハッシュ/件数/0件)を確認する。
 *    検証に失敗した場合は成功として表示しない。
 *  - Supabaseの生エラーメッセージはこのモジュールの外へ一切渡さない。
 *
 * この関数群はどの操作もアプリの明示的なユーザー操作からしか呼び出されない
 * (ログイン・ページ表示・アプリ起動での自動呼び出しは行わない。呼び出し側=
 * UIコンポーネント側の責務として徹底する)。
 */

const TABLE = "my_team_snapshots";
const SELECT_COLUMNS = "id,schema_version,team_data,item_count,payload_hash,client_updated_at,created_at,updated_at";
const REQUEST_TIMEOUT_MS = 15000;

export interface MyTeamCloudSnapshot {
  /** Reactのkey・削除ハンドラー引数にのみ使う。可視テキストとして描画しないこと。 */
  id: string;
  schemaVersion: string;
  payload: CloudMyTeamPayload;
  itemCount: number;
  payloadHash: string;
  clientUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type MyTeamCloudErrorReason =
  | "UNAUTHENTICATED"
  | "NOT_FOUND_OR_FORBIDDEN"
  | "MULTIPLE_ROWS"
  | "INVALID_LOCAL_DATA"
  | "INVALID_CLOUD_DATA"
  | "VERIFICATION_FAILED"
  | "NETWORK"
  | "TIMEOUT"
  | "UNKNOWN";

export type MyTeamCloudResult<T> = { ok: true; data: T } | { ok: false; error: MyTeamCloudErrorReason };

interface PostgrestErrorLike {
  message?: string | null;
  code?: string | null;
  status?: number | null;
}

interface RawSnapshotRow {
  id: string;
  schema_version: string;
  team_data: unknown;
  item_count: number;
  payload_hash: string;
  client_updated_at: string;
  created_at: string;
  updated_at: string;
}

class TimeoutError extends Error {}

function withTimeout<T>(promise: PromiseLike<T>, ms: number = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError("timeout")), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function classifyError(error: PostgrestErrorLike | null | undefined): MyTeamCloudErrorReason {
  if (!error) return "UNKNOWN";
  if (error.status === 401 || error.code === "PGRST301") return "UNAUTHENTICATED";
  return "UNKNOWN";
}

function classifyThrown(e: unknown): MyTeamCloudErrorReason {
  return e instanceof TimeoutError ? "TIMEOUT" : "NETWORK";
}

function mapRowToSnapshot(row: RawSnapshotRow): MyTeamCloudResult<MyTeamCloudSnapshot> {
  const validated = validateFetchedCloudPayload(row.team_data, row.schema_version);
  if (!validated.ok) return { ok: false, error: "INVALID_CLOUD_DATA" };
  return {
    ok: true,
    data: {
      id: row.id,
      schemaVersion: row.schema_version,
      payload: validated.payload,
      itemCount: row.item_count,
      payloadHash: row.payload_hash,
      clientUpdatedAt: row.client_updated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

/**
 * 本人の(高々1件の)クラウドスナップショットを取得する。
 * 0件は「クラウドデータなし」であり成功として`data: null`を返す(エラーではない)。
 * 2件以上返ってきた場合は異常として安全に停止する(unique(user_id)+RLSにより
 * 通常は起こり得ないが、念のための防御)。
 */
export async function fetchMyTeamCloudSnapshot(supabase: SupabaseClient): Promise<MyTeamCloudResult<MyTeamCloudSnapshot | null>> {
  try {
    const { data, error } = await withTimeout(supabase.from(TABLE).select(SELECT_COLUMNS));
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as RawSnapshotRow[];
    if (rows.length === 0) return { ok: true, data: null };
    if (rows.length > 1) return { ok: false, error: "MULTIPLE_ROWS" };
    return mapRowToSnapshot(rows[0]);
  } catch (e) {
    return { ok: false, error: classifyThrown(e) };
  }
}

/**
 * My Team全体をクラウドへ保存する(UPSERT、conflict対象は`user_id`のunique制約)。
 * payloadにはuser_idを一切含めない。保存後、返ってきた行を検証し、さらに再取得して
 * ハッシュが一致することを確認するまで成功として扱わない。
 */
export async function saveMyTeamCloudSnapshot(
  supabase: SupabaseClient,
  localRecords: readonly MyTeamRecord[],
  clientUpdatedAtIso: string,
): Promise<MyTeamCloudResult<MyTeamCloudSnapshot>> {
  const items = toCloudItems(localRecords);
  const validated = validateCloudPayloadForSave(items);
  if (!validated.ok) return { ok: false, error: "INVALID_LOCAL_DATA" };

  const expectedHash = await computeCloudPayloadHash(validated.payload);

  try {
    const { data, error } = await withTimeout(
      supabase
        .from(TABLE)
        .upsert(
          {
            schema_version: MY_TEAM_CLOUD_SCHEMA_VERSION,
            team_data: validated.payload,
            item_count: validated.payload.items.length,
            payload_hash: expectedHash,
            client_updated_at: clientUpdatedAtIso,
          },
          { onConflict: "user_id" },
        )
        .select(SELECT_COLUMNS),
    );
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as RawSnapshotRow[];
    // 0件・複数件のいずれも成功として扱わない。
    if (rows.length !== 1) return { ok: false, error: "VERIFICATION_FAILED" };

    const mapped = mapRowToSnapshot(rows[0]);
    if (!mapped.ok) return mapped;
    if (mapped.data.itemCount !== validated.payload.items.length || mapped.data.payloadHash !== expectedHash) {
      return { ok: false, error: "VERIFICATION_FAILED" };
    }

    // 再フェッチして最終的な一致を確認する(部分成功を成功として扱わないための仕上げ確認)。
    const refetched = await fetchMyTeamCloudSnapshot(supabase);
    if (!refetched.ok) return refetched;
    if (!refetched.data || refetched.data.payloadHash !== expectedHash) {
      return { ok: false, error: "VERIFICATION_FAILED" };
    }
    return { ok: true, data: refetched.data };
  } catch (e) {
    return { ok: false, error: classifyThrown(e) };
  }
}

/**
 * クラウドスナップショットを削除する(本人の行だけ、`id`指定)。
 * 0件は成功として扱わない。削除後、再取得して0件になったことを確認する。
 */
export async function deleteMyTeamCloudSnapshot(supabase: SupabaseClient, id: string): Promise<MyTeamCloudResult<{ id: string }>> {
  try {
    const { data, error } = await withTimeout(supabase.from(TABLE).delete().eq("id", id).select("id"));
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as { id: string }[];
    if (rows.length === 0) return { ok: false, error: "NOT_FOUND_OR_FORBIDDEN" };

    const refetched = await fetchMyTeamCloudSnapshot(supabase);
    if (!refetched.ok) return refetched;
    if (refetched.data !== null) return { ok: false, error: "VERIFICATION_FAILED" };
    return { ok: true, data: { id: rows[0].id } };
  } catch (e) {
    return { ok: false, error: classifyThrown(e) };
  }
}
