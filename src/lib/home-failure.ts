import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";

/**
 * ホームの照会が失敗したときの扱い。
 * - データがまだ無い（WorldDataUnavailableError）: 部分表示＋準備中の案内
 * - 一時的な照会の失敗（WorldQueryError）: 部分表示＋「一時的に読み込めなかった」の案内（サーバー側には分類つきで記録済み）
 * - それ以外: error boundary へ（想定外の不具合を隠さない）
 */
export type HomeFailureHandling = "none" | "unavailable" | "temporary" | "throw";

export function classifyHomeFailure(reason: unknown | undefined): HomeFailureHandling {
  if (reason === undefined) return "none";
  if (reason instanceof WorldDataUnavailableError) return "unavailable";
  if (reason instanceof WorldQueryError) return "temporary";
  return "throw";
}
