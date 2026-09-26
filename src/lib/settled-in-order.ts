/**
 * 並列に実行した照会(Promise.allSettled)を、従来の直列実行と同じ規則で解釈する。
 *
 * - `failure`: 照会順で最初に失敗したものの理由(無ければnull)。直列実行ならそこで止まっていた。
 * - `usable(i)`: 直列実行でi番目の結果まで到達していたか(=最初の失敗より前で、かつ成功している)。
 */
export function settledInOrder(results: readonly PromiseSettledResult<unknown>[]): { failure: { reason: unknown } | null; usable: (index: number) => boolean } {
  const firstFailed = results.findIndex((r) => r.status === "rejected");
  const upTo = firstFailed === -1 ? results.length : firstFailed;
  const failure = firstFailed === -1 ? null : { reason: (results[firstFailed] as PromiseRejectedResult).reason };
  return { failure, usable: (index) => index < upTo && results[index]?.status === "fulfilled" };
}
