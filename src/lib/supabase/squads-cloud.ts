import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredSquad } from "@/lib/squad/types";
import {
  SQUADS_CLOUD_SCHEMA_VERSION,
  computeSquadsPayloadHash,
  validateSquadsForSave,
  validateFetchedSquadsPayload,
  type CloudSquadsPayload,
} from "./squads-cloud-schema";

/**
 * `saved_squads_snapshots`（保存スカッドのクラウド保存・手動・任意・2026-10-11）への安全なアクセス層。
 * `my-team-cloud.ts` と同じ方針:
 *  - user_id を送らない・クライアント側で絞り込まない（所有者の判定は RLS だけ）。
 *  - 保存・削除は変更した行を読み戻し、0 件・複数件を成功にしない。保存・削除の後は再取得して一致を確かめる。
 *  - Supabase の生のエラーの文はこのモジュールの外へ出さない。
 *  - どの関数も利用者の明示の操作からだけ呼ぶ（ログイン・画面の表示で自動に呼ばない）。
 */
const TABLE = "saved_squads_snapshots";
const SELECT_COLUMNS = "id,schema_version,squads_data,item_count,payload_hash,client_updated_at,created_at,updated_at";
const REQUEST_TIMEOUT_MS = 15000;

export interface SquadsCloudSnapshot {
  /** React の key・削除の引数だけに使う（画面に文字として出さない）。 */
  id: string;
  schemaVersion: string;
  payload: CloudSquadsPayload;
  itemCount: number;
  payloadHash: string;
  clientUpdatedAt: string;
  updatedAt: string;
}

export type SquadsCloudErrorReason = "UNAUTHENTICATED" | "NOT_FOUND_OR_FORBIDDEN" | "MULTIPLE_ROWS" | "INVALID_LOCAL_DATA" | "INVALID_CLOUD_DATA" | "VERIFICATION_FAILED" | "NETWORK" | "TIMEOUT" | "UNKNOWN";
export type SquadsCloudResult<T> = { ok: true; data: T } | { ok: false; error: SquadsCloudErrorReason };

interface RawRow {
  id: string;
  schema_version: string;
  squads_data: unknown;
  item_count: number;
  payload_hash: string;
  client_updated_at: string;
  updated_at: string;
}

class TimeoutError extends Error {}
function withTimeout<T>(promise: PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
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
const classifyError = (error: { code?: string | null; status?: number | null } | null | undefined): SquadsCloudErrorReason =>
  error && (error.status === 401 || error.code === "PGRST301") ? "UNAUTHENTICATED" : "UNKNOWN";
const classifyThrown = (e: unknown): SquadsCloudErrorReason => (e instanceof TimeoutError ? "TIMEOUT" : "NETWORK");

function mapRow(row: RawRow): SquadsCloudResult<SquadsCloudSnapshot> {
  const v = validateFetchedSquadsPayload(row.squads_data, row.schema_version);
  if (!v.ok) return { ok: false, error: "INVALID_CLOUD_DATA" };
  return { ok: true, data: { id: row.id, schemaVersion: row.schema_version, payload: v.payload, itemCount: row.item_count, payloadHash: row.payload_hash, clientUpdatedAt: row.client_updated_at, updatedAt: row.updated_at } };
}

/** 本人の（高々 1 件の）スナップショット。0 件は成功の `null`。2 件以上は異常として止める。 */
export async function fetchSquadsCloudSnapshot(supabase: SupabaseClient): Promise<SquadsCloudResult<SquadsCloudSnapshot | null>> {
  try {
    const { data, error } = await withTimeout(supabase.from(TABLE).select(SELECT_COLUMNS));
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as RawRow[];
    if (rows.length === 0) return { ok: true, data: null };
    if (rows.length > 1) return { ok: false, error: "MULTIPLE_ROWS" };
    return mapRow(rows[0]);
  } catch (e) {
    return { ok: false, error: classifyThrown(e) };
  }
}

/** 端末の保存スカッドの全体を保存（user_id の unique で UPSERT）。読み戻しと再取得でハッシュが一致するまで成功にしない。 */
export async function saveSquadsCloudSnapshot(supabase: SupabaseClient, squads: readonly StoredSquad[], clientUpdatedAtIso: string): Promise<SquadsCloudResult<SquadsCloudSnapshot>> {
  const v = validateSquadsForSave(squads);
  if (!v.ok) return { ok: false, error: "INVALID_LOCAL_DATA" };
  const expectedHash = await computeSquadsPayloadHash(v.payload);
  try {
    const { data, error } = await withTimeout(
      supabase
        .from(TABLE)
        .upsert(
          { schema_version: SQUADS_CLOUD_SCHEMA_VERSION, squads_data: v.payload, item_count: v.payload.items.length, payload_hash: expectedHash, client_updated_at: clientUpdatedAtIso },
          { onConflict: "user_id" },
        )
        .select(SELECT_COLUMNS),
    );
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as RawRow[];
    if (rows.length !== 1) return { ok: false, error: "VERIFICATION_FAILED" };
    const mapped = mapRow(rows[0]);
    if (!mapped.ok) return mapped;
    if (mapped.data.itemCount !== v.payload.items.length || mapped.data.payloadHash !== expectedHash) return { ok: false, error: "VERIFICATION_FAILED" };
    const re = await fetchSquadsCloudSnapshot(supabase);
    if (!re.ok) return re;
    if (!re.data || re.data.payloadHash !== expectedHash) return { ok: false, error: "VERIFICATION_FAILED" };
    return { ok: true, data: re.data };
  } catch (e) {
    return { ok: false, error: classifyThrown(e) };
  }
}

/** スナップショットを削除（本人の行・id 指定）。0 件は成功にしない。削除の後に再取得して 0 件を確かめる。 */
export async function deleteSquadsCloudSnapshot(supabase: SupabaseClient, id: string): Promise<SquadsCloudResult<{ id: string }>> {
  try {
    const { data, error } = await withTimeout(supabase.from(TABLE).delete().eq("id", id).select("id"));
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as { id: string }[];
    if (rows.length === 0) return { ok: false, error: "NOT_FOUND_OR_FORBIDDEN" };
    const re = await fetchSquadsCloudSnapshot(supabase);
    if (!re.ok) return re;
    if (re.data !== null) return { ok: false, error: "VERIFICATION_FAILED" };
    return { ok: true, data: { id: rows[0].id } };
  } catch (e) {
    return { ok: false, error: classifyThrown(e) };
  }
}
