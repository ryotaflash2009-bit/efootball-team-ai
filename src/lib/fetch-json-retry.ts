/**
 * 一時的な失敗（HTTP 5xx・通信の失敗）のときに 1 回だけやり直して JSON を読む（2026-10-28）。
 * 選手の詳細の「同じ選手の別のカード」「似ているカード」が、API の一時的な遅延・500 で空になっていた。
 * 4xx はやり直さない。中断（AbortSignal）はそのまま投げる。読めなければ null。
 */
export async function fetchJsonRetry<T>(
  url: string,
  { signal, retries = 1, delayMs = 600, fetchImpl = fetch }: { signal?: AbortSignal; retries?: number; delayMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchImpl(url, { signal });
      if (res.ok) return (await res.json()) as T;
      if (res.status < 500 || attempt >= retries) return null;
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt >= retries) return null;
    }
    await new Promise((r) => setTimeout(r, delayMs));
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  }
}
