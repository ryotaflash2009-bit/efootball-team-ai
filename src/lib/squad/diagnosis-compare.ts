import {
  SHARE_CATEGORY_IDS,
  decodeShareToken,
  encodeSharePayload,
  validateSharePayload,
  type ShareFinding,
  type SquadDiagnosisSharePayloadV1,
} from "./squad-diagnosis-share-url";
import type { SquadDiagnosisCategoryId, SquadDiagnosisTier } from "./squad-diagnosis";

/**
 * 改善前後カード（F-043）。確定済みの診断結果（共有URLと同じ要約 payload）2つの差だけを計算する純関数。
 *
 * - 比較できるのは同じ診断規則の版（`r`）同士だけ。版が違えば比較しない（点数の基準が違う可能性があるため）。
 * - before/after は利用者の選択順ではなく日時で決める（古い方が before）。取り違えを防ぐ。
 * - 差は点数の差だけ。変化の原因（選手の入れ替え等）は判定しない（表示側で明示する）。
 * - 生成AIや推測は使わない。
 */

export type Trend = "improved" | "worsened" | "unchanged" | "not_comparable";

export interface ScoreChange {
  before: number | null;
  after: number | null;
  beforeTier: SquadDiagnosisTier | null;
  afterTier: SquadDiagnosisTier | null;
  delta: number | null;
  trend: Trend;
}

export interface DiagnosisComparison {
  rulesVersion: string;
  beforeDate: string;
  afterDate: string;
  overall: ScoreChange;
  categories: { id: Exclude<SquadDiagnosisCategoryId, "squadCompleteness">; change: ScoreChange }[];
  strength: { before: ShareFinding | null; after: ShareFinding | null; changed: boolean };
  weakness: { before: ShareFinding | null; after: ShareFinding | null; changed: boolean };
  counts: { improved: number; worsened: number; unchanged: number; notComparable: number };
}

export type CompareFailure = "rules_mismatch" | "invalid" | "same_entry";
export type CompareResult = { ok: true; comparison: DiagnosisComparison } | { ok: false; reason: CompareFailure };

function change(before: readonly [number | null, SquadDiagnosisTier | null], after: readonly [number | null, SquadDiagnosisTier | null]): ScoreChange {
  const [b, bt] = before;
  const [a, at] = after;
  if (b == null || a == null) return { before: b, after: a, beforeTier: bt, afterTier: at, delta: null, trend: "not_comparable" };
  const delta = a - b;
  return { before: b, after: a, beforeTier: bt, afterTier: at, delta, trend: delta > 0 ? "improved" : delta < 0 ? "worsened" : "unchanged" };
}

const sameFinding = (x: ShareFinding | null, y: ShareFinding | null) => JSON.stringify(x) === JSON.stringify(y);

/**
 * 2つの診断を比較する。`first`/`second` の順番に関係なく、`at`（保存日時 ISO、無ければ診断日）の古い方を before にする。
 * 日時が同じ場合は引数の順（first を before）とする。
 */
export function compareDiagnoses(
  first: { payload: SquadDiagnosisSharePayloadV1; at: string; key?: string },
  second: { payload: SquadDiagnosisSharePayloadV1; at: string; key?: string },
): CompareResult {
  if (validateSharePayload(first.payload) !== null || validateSharePayload(second.payload) !== null) return { ok: false, reason: "invalid" };
  if (first.key != null && first.key === second.key) return { ok: false, reason: "same_entry" };
  if (first.payload.r !== second.payload.r) return { ok: false, reason: "rules_mismatch" };
  const [before, after] = second.at < first.at ? [second, first] : [first, second];
  const categories = SHARE_CATEGORY_IDS.map((id) => ({ id, change: change(before.payload.c[id], after.payload.c[id]) }));
  const counts = { improved: 0, worsened: 0, unchanged: 0, notComparable: 0 };
  for (const c of categories) {
    if (c.change.trend === "improved") counts.improved++;
    else if (c.change.trend === "worsened") counts.worsened++;
    else if (c.change.trend === "unchanged") counts.unchanged++;
    else counts.notComparable++;
  }
  return {
    ok: true,
    comparison: {
      rulesVersion: before.payload.r,
      beforeDate: before.payload.d,
      afterDate: after.payload.d,
      overall: change(before.payload.o, after.payload.o),
      categories,
      strength: { before: before.payload.s, after: after.payload.s, changed: !sameFinding(before.payload.s, after.payload.s) },
      weakness: { before: before.payload.w, after: after.payload.w, changed: !sameFinding(before.payload.w, after.payload.w) },
      counts,
    },
  };
}

// ---------------------------------------------------------------------------
// 共有URL（比較）: 既存の v1 トークン2つを `~` でつなぐだけ（新しい payload 形式は作らない）
// ---------------------------------------------------------------------------

export const COMPARE_SHARE_PATH = "/share/compare";

export function buildCompareShareUrl(origin: string, before: SquadDiagnosisSharePayloadV1, after: SquadDiagnosisSharePayloadV1): string {
  return `${origin.replace(/\/+$/, "")}${COMPARE_SHARE_PATH}#${encodeSharePayload(before)}~${encodeSharePayload(after)}`;
}

export type CompareShareDecode = { ok: true; comparison: DiagnosisComparison } | { ok: false; reason: CompareFailure | "bad_format" | "unsupported_version" | "empty" };

/** `/share/compare#<before>~<after>` を復元する。各トークンは共有URLと同じ検証を通す。順番はURLのとおり（before, after）。 */
export function decodeCompareShare(fragment: string): CompareShareDecode {
  const s = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (s.length === 0) return { ok: false, reason: "empty" };
  const parts = s.split("~");
  if (parts.length !== 2) return { ok: false, reason: "bad_format" };
  const a = decodeShareToken(parts[0]);
  const b = decodeShareToken(parts[1]);
  if (!a.ok || !b.ok) {
    const r = !a.ok ? a.reason : !b.ok ? b.reason : "invalid";
    return { ok: false, reason: r === "unsupported_version" ? "unsupported_version" : r === "empty" ? "empty" : "invalid" };
  }
  // URL の順番を尊重する（共有した人の端末で before/after を決めてからURLを作るため）。
  const r = compareDiagnoses({ payload: a.payload, at: "0" }, { payload: b.payload, at: "1" });
  return r.ok ? r : { ok: false, reason: r.reason };
}
