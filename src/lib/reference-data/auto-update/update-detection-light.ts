import { fetchSourceWithRetry, type SourceTransport } from "./source-transport";
import { createHash } from "node:crypto";
import { buildWorldSearchRequest, normalizeWorldPlayerRecord, parseWorldSearchPage } from "./source-world";

/**
 * 毎時の検出（2026-10-04、本人の決定: 24 時間・1 時間おき）の World の軽い確認。
 *
 * - Managers は managers.json 1 件の全体を毎時取得して、従来どおり完全に比較する（軽量化しない）。
 * - World の全件取得は約 445 request になるため毎時は行わない。毎時は World の検索の 1 ページ目（作成日の新しい順）と
 *   総件数・総ページ数だけを取得し（1 request）、前回の完全な検出の時点の値と比べる。
 * - 上流は「更新の有無」を示す metadata（ETag・Last-Modified 等）の契約を提供していない。1 ページ目と総件数は
 *   新しいカードの追加は示すが、既存カードの能力値の変更までは示さない。そのため、軽い確認で変化が無くても
 *   「World は変更なし」とは判定しない（decision は "not_scanned"）。完全な検出は次のどれかで行う:
 *     1. 1 ページ目・総件数・総ページ数のどれかが変わった（world_signal_changed）
 *     2. 前回の完全な検出から WORLD_FULL_SCAN_INTERVAL_MS 以上たった（full_scan_due）
 *     3. 前回の状態が無い・壊れている・未来の時刻（no_previous_state / invalid_state）
 *     4. 前回の完全な検出が失敗し、WORLD_FAILURE_RETRY_MS 以上たった（retry_after_failure）
 * - 状態は GitHub Actions の cache（Secret なし・公開情報の要約だけ）に保存する。消えても完全な検出に戻るだけ（fail-safe）。
 */

export const WORLD_LIGHT_STATE_SCHEMA = "reference-data-detection-world-light-state/v1";
/** 完全な World の検出の最大間隔（既存カードの能力値の変更は、遅くともこの間隔で検出する）。 */
export const WORLD_FULL_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** 完全な検出が失敗した後、毎時の再試行で上流へ全件取得を繰り返さないための待ち時間。 */
export const WORLD_FAILURE_RETRY_MS = 2 * 60 * 60 * 1000;

export interface WorldLightSignal {
  totalCount: number;
  totalPages: number;
  page1ContentHash: string;
}

export interface WorldLightState {
  schema: typeof WORLD_LIGHT_STATE_SCHEMA;
  signal: WorldLightSignal;
  lastFullAt: string;
  lastFullOutcome: "complete" | "failed";
  /** 直近の完全な検出の World の checksum の先頭 12 文字（記録だけ。判定には使わない）。 */
  lastFullWorldChecksum12: string | null;
}

export type WorldScanDecision =
  | { scan: "full"; reason: "no_previous_state" | "invalid_state" | "world_signal_changed" | "full_scan_due" | "retry_after_failure" | "manual_trigger" }
  | { scan: "light"; reason: "world_signal_unchanged" | "failure_backoff" };

const isInt0 = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function parseWorldLightState(text: string | null | undefined): WorldLightState | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    const s = o.signal as Record<string, unknown> | undefined;
    if (o.schema !== WORLD_LIGHT_STATE_SCHEMA || !s) return null;
    if (!isInt0(s.totalCount) || !isInt0(s.totalPages) || typeof s.page1ContentHash !== "string" || !/^[0-9a-f]{16,128}$/.test(s.page1ContentHash)) return null;
    if (typeof o.lastFullAt !== "string" || Number.isNaN(Date.parse(o.lastFullAt))) return null;
    if (o.lastFullOutcome !== "complete" && o.lastFullOutcome !== "failed") return null;
    const c = o.lastFullWorldChecksum12;
    if (c !== null && (typeof c !== "string" || !/^[0-9a-f]{12}$/.test(c))) return null;
    return {
      schema: WORLD_LIGHT_STATE_SCHEMA,
      signal: { totalCount: s.totalCount, totalPages: s.totalPages, page1ContentHash: s.page1ContentHash },
      lastFullAt: o.lastFullAt,
      lastFullOutcome: o.lastFullOutcome,
      lastFullWorldChecksum12: c as string | null,
    };
  } catch {
    return null;
  }
}

/** 完全な World の検出を行うかの判定（pure・fail-safe: 迷ったら完全な検出）。 */
export function decideWorldScan(input: { signal: WorldLightSignal; stateText: string | null | undefined; now: string; trigger: string }): WorldScanDecision {
  if (input.trigger !== "schedule") return { scan: "full", reason: "manual_trigger" };
  if (!input.stateText) return { scan: "full", reason: "no_previous_state" };
  const state = parseWorldLightState(input.stateText);
  if (!state) return { scan: "full", reason: "invalid_state" };
  const now = Date.parse(input.now);
  const last = Date.parse(state.lastFullAt);
  if (Number.isNaN(now) || last > now) return { scan: "full", reason: "invalid_state" };
  const s = state.signal;
  if (s.totalCount !== input.signal.totalCount || s.totalPages !== input.signal.totalPages || s.page1ContentHash !== input.signal.page1ContentHash) {
    return { scan: "full", reason: "world_signal_changed" };
  }
  if (state.lastFullOutcome === "failed") {
    return now - last >= WORLD_FAILURE_RETRY_MS ? { scan: "full", reason: "retry_after_failure" } : { scan: "light", reason: "failure_backoff" };
  }
  if (now - last >= WORLD_FULL_SCAN_INTERVAL_MS) return { scan: "full", reason: "full_scan_due" };
  return { scan: "light", reason: "world_signal_unchanged" };
}

/** 完全な検出の後の状態（成功・失敗のどちらも記録する。失敗の後は WORLD_FAILURE_RETRY_MS の間、全件取得を繰り返さない）。 */
export function nextWorldLightState(input: { signal: WorldLightSignal; fullAt: string; outcome: "complete" | "failed"; worldChecksum12: string | null }): WorldLightState {
  return {
    schema: WORLD_LIGHT_STATE_SCHEMA,
    signal: input.signal,
    lastFullAt: input.fullAt,
    lastFullOutcome: input.outcome,
    lastFullWorldChecksum12: input.worldChecksum12 && /^[0-9a-f]{12}$/.test(input.worldChecksum12) ? input.worldChecksum12 : null,
  };
}

/** World の軽い確認（1 request）。検索の 1 ページ目（作成日の新しい順）の内容の hash と総件数・総ページ数。 */
export async function fetchWorldLightSignal(
  transport: SourceTransport,
  opts: { sleep: (ms: number) => Promise<void> },
): Promise<{ ok: true; signal: WorldLightSignal } | { ok: false; code: string }> {
  try {
    const r = await fetchSourceWithRetry(transport, buildWorldSearchRequest(1, "CREATED_AT"), { sleep: opts.sleep });
    const p = parseWorldSearchPage(r.response.bodyText);
    if (!isInt0(p.totalCount) || !isInt0(p.totalPages) || p.players.length === 0) return { ok: false, code: "world_signal_incomplete" };
    return { ok: true, signal: { totalCount: p.totalCount, totalPages: p.totalPages, page1ContentHash: worldPage1Fingerprint(p.players) } };
  } catch {
    return { ok: false, code: "world_signal_fetch_failed" };
  }
}

/**
 * 1 ページ目の指紋。応答の本文そのもの（揮発する値を含みうる）ではなく、正規化したカードの ID と
 * 表示内容の更新時刻（appearance_updated_at）の組だけから作る（同じ内容なら毎回同じ値）。
 */
export function worldPage1Fingerprint(players: readonly unknown[]): string {
  const pairs = players.map((raw) => {
    const n = normalizeWorldPlayerRecord(raw as Parameters<typeof normalizeWorldPlayerRecord>[0]);
    return [n.world_card_id ?? "", n.appearance_updated_at ?? ""];
  });
  return createHash("sha256").update(JSON.stringify(pairs)).digest("hex");
}

// ---------------------------------------------------------------------------
// 同じ候補の重複処理の防止（毎時の検出で、同じ checksum の update_available を毎回 Pipeline へ渡さない）
// ---------------------------------------------------------------------------

export const CANDIDATE_STATE_SCHEMA = "reference-data-detection-candidates/v1";
/** 同じ dataset・同じ checksum の候補を、この間は再び Pipeline へ渡さない（1 日 1 回は再試行する）。 */
export const REPEAT_CANDIDATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CandidateDataset = "world" | "managers";
export interface CandidateState {
  schema: typeof CANDIDATE_STATE_SCHEMA;
  reported: Partial<Record<CandidateDataset, { checksum12: string; at: string }>>;
}

export function parseCandidateState(text: string | null | undefined): CandidateState {
  const empty: CandidateState = { schema: CANDIDATE_STATE_SCHEMA, reported: {} };
  if (!text) return empty;
  try {
    const o = JSON.parse(text) as { schema?: unknown; reported?: Record<string, { checksum12?: unknown; at?: unknown }> };
    if (o.schema !== CANDIDATE_STATE_SCHEMA || !o.reported || typeof o.reported !== "object") return empty;
    const reported: CandidateState["reported"] = {};
    for (const ds of ["world", "managers"] as const) {
      const r = o.reported[ds];
      if (r && typeof r.checksum12 === "string" && /^[0-9a-f]{12}$/.test(r.checksum12) && typeof r.at === "string" && !Number.isNaN(Date.parse(r.at))) reported[ds] = { checksum12: r.checksum12, at: r.at };
    }
    return { schema: CANDIDATE_STATE_SCHEMA, reported };
  } catch {
    return empty;
  }
}

/**
 * update_available の候補を記録し、24 時間以内に同じ checksum を報告済みなら repeat とする（pure）。
 * 新しい checksum・24 時間を過ぎた・記録が無い・時刻が未来 → repeat ではない（Pipeline へ渡し、記録を更新）。
 */
export function markRepeatCandidate(input: { state: CandidateState; dataset: CandidateDataset; checksum12: string; now: string }): { repeat: boolean; state: CandidateState } {
  const prev = input.state.reported[input.dataset];
  const now = Date.parse(input.now);
  if (prev && prev.checksum12 === input.checksum12) {
    const at = Date.parse(prev.at);
    if (!Number.isNaN(now) && at <= now && now - at < REPEAT_CANDIDATE_WINDOW_MS) return { repeat: true, state: input.state };
  }
  return { repeat: false, state: { ...input.state, reported: { ...input.state.reported, [input.dataset]: { checksum12: input.checksum12, at: input.now } } } };
}
