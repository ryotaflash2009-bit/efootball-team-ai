import type { StagingRecord } from "./types";
import { computeRecordChecksum } from "./diff";

/**
 * Phase 2: 適用後検証(shadow comparison)の純関数群。
 *
 * 適用処理が「意図した内容と完全に一致する結果」を実際に生んだかどうかを、適用後に
 * 読み戻した実データ(actual)と、適用前に確定していたはずの期待値(expected)を突き合わせて
 * 検証する。既存のPhase D比較(`scripts/migration/phase-d-shadow-compare.mjs`、SQLite経路と
 * Supabase経路の比較)と同じ「差分1件でも成功扱いにしない」という方針を踏襲するが、
 * ここでは実DBへは一切接続せず、呼び出し側が読み戻した結果を渡すだけの純関数にする。
 */
export interface ShadowComparisonMismatch {
  id: string;
  reason: string;
}

export interface ShadowComparisonResult {
  ok: boolean;
  expectedCount: number;
  actualCount: number;
  mismatches: ShadowComparisonMismatch[];
}

export function compareAppliedResult(
  expected: readonly StagingRecord[],
  actual: readonly StagingRecord[],
): ShadowComparisonResult {
  const mismatches: ShadowComparisonMismatch[] = [];
  const expectedById = new Map(expected.map((r) => [r.id, r]));
  const actualById = new Map(actual.map((r) => [r.id, r]));

  for (const [id, exp] of expectedById) {
    const act = actualById.get(id);
    if (!act) {
      mismatches.push({ id, reason: "期待した行が適用後の実データに存在しない" });
      continue;
    }
    const expChecksum = computeRecordChecksum(exp.fields);
    const actChecksum = computeRecordChecksum(act.fields);
    if (expChecksum !== actChecksum) {
      mismatches.push({ id, reason: "フィールド内容が期待値と一致しない" });
    }
  }

  for (const id of actualById.keys()) {
    if (!expectedById.has(id)) {
      mismatches.push({ id, reason: "期待していない行が適用後の実データに存在する" });
    }
  }

  mismatches.sort((a, b) => a.id.localeCompare(b.id));

  return {
    ok: mismatches.length === 0,
    expectedCount: expected.length,
    actualCount: actual.length,
    mismatches,
  };
}
