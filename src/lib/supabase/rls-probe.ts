import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `rls_probe_records`(RLS分離検証専用テーブル)への安全なアクセス層。
 *
 * - どの操作でも`user_id`をクライアントのpayloadへ一切含めない。作成時のuser_idは
 *   DB側の`default auth.uid()`に完全に委ねる。所有者判定はRLSポリシーだけが行う。
 * - `.eq("user_id", ...)`のようなクライアント側フィルターも使わない
 *   (RLSを第一防衛線として維持し、クライアント側の絞り込みを安全性の根拠にしない)。
 * - UPDATE/DELETEは`.select(...)`を連結し、実際に変更された行を読み戻す。
 *   0件だった場合(存在しない/他人の行)を「成功」として誤扱いしない。
 * - Supabaseの生エラー(メッセージ文字列)はこのモジュールの外へ一切渡さない。
 *   呼び出し側は`RlsProbeErrorReason`という閉じた集合の理由コードだけを受け取る。
 */

const TABLE = "rls_probe_records";
const SELECT_COLUMNS = "id,label,created_at,updated_at";

export const RLS_PROBE_LABEL_MAX_LENGTH = 100;

export type LabelValidationError = "EMPTY" | "TOO_LONG";

/** 前後空白を除去し、空文字列(空白だけの入力を含む)・長さ超過を検証する。 */
export function validateProbeLabel(raw: string): { ok: true; value: string } | { ok: false; error: LabelValidationError } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "EMPTY" };
  if (trimmed.length > RLS_PROBE_LABEL_MAX_LENGTH) return { ok: false, error: "TOO_LONG" };
  return { ok: true, value: trimmed };
}

export interface RlsProbeRecord {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export type RlsProbeErrorReason = "UNAUTHENTICATED" | "NOT_FOUND_OR_FORBIDDEN" | "INVALID_INPUT" | "NETWORK" | "UNKNOWN";

export type RlsProbeResult<T> = { ok: true; data: T } | { ok: false; error: RlsProbeErrorReason };

interface PostgrestErrorLike {
  message?: string | null;
  code?: string | null;
  status?: number | null;
}

interface RawProbeRow {
  id: string;
  label: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawProbeRow): RlsProbeRecord {
  return { id: row.id, label: row.label, createdAt: row.created_at, updatedAt: row.updated_at };
}

/** Postgrest/Supabaseの生エラーを、閉じた理由コードへ一般化する(生のメッセージは返さない)。 */
function classifyError(error: PostgrestErrorLike | null | undefined): RlsProbeErrorReason {
  if (!error) return "UNKNOWN";
  if (error.status === 401 || error.code === "PGRST301") return "UNAUTHENTICATED";
  return "UNKNOWN";
}

export async function listOwnProbes(supabase: SupabaseClient): Promise<RlsProbeResult<RlsProbeRecord[]>> {
  try {
    const { data, error } = await supabase.from(TABLE).select(SELECT_COLUMNS).order("created_at", { ascending: false });
    if (error) return { ok: false, error: classifyError(error) };
    return { ok: true, data: ((data ?? []) as RawProbeRow[]).map(mapRow) };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

/** 作成。payloadにはlabelだけを含め、user_idは一切送らない(DB側のauth.uid()既定値に委ねる)。 */
export async function createProbe(supabase: SupabaseClient, rawLabel: string): Promise<RlsProbeResult<RlsProbeRecord>> {
  const validated = validateProbeLabel(rawLabel);
  if (!validated.ok) return { ok: false, error: "INVALID_INPUT" };
  try {
    const { data, error } = await supabase.from(TABLE).insert({ label: validated.value }).select(SELECT_COLUMNS).single();
    if (error || !data) return { ok: false, error: classifyError(error) };
    return { ok: true, data: mapRow(data as RawProbeRow) };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

/** 更新。payloadにはlabelだけを含め、user_idは更新対象に含めない。0件は成功扱いにしない。 */
export async function updateProbeLabel(supabase: SupabaseClient, id: string, rawLabel: string): Promise<RlsProbeResult<RlsProbeRecord>> {
  const validated = validateProbeLabel(rawLabel);
  if (!validated.ok) return { ok: false, error: "INVALID_INPUT" };
  try {
    const { data, error } = await supabase.from(TABLE).update({ label: validated.value }).eq("id", id).select(SELECT_COLUMNS);
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as RawProbeRow[];
    if (rows.length === 0) return { ok: false, error: "NOT_FOUND_OR_FORBIDDEN" };
    return { ok: true, data: mapRow(rows[0]) };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

/** 削除。0件は成功扱いにしない。 */
export async function deleteProbe(supabase: SupabaseClient, id: string): Promise<RlsProbeResult<{ id: string }>> {
  try {
    const { data, error } = await supabase.from(TABLE).delete().eq("id", id).select("id");
    if (error) return { ok: false, error: classifyError(error) };
    const rows = (data ?? []) as { id: string }[];
    if (rows.length === 0) return { ok: false, error: "NOT_FOUND_OR_FORBIDDEN" };
    return { ok: true, data: { id: rows[0].id } };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}
