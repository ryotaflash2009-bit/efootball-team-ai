import { SOURCE_ENDPOINTS, SourceFetchError, type SourceId, type SourceRequest, type SourceResponse, type SourceTransport } from "./source-transport";

/**
 * 自動更新 Stage 1: upstreamへの実HTTP transport(読み取り専用)。
 *
 * 本人が承認した手動検証(Stage 1)でだけ使う。定期実行(schedule)からは使わない
 * (REAL_NETWORK_ACCESS_ENABLEDはfalseのまま)。安全境界:
 *   - 許可済みendpoint(SOURCE_ENDPOINTS)と完全一致するrequestだけ。URL・method・bodyの形を変えられない
 *   - Cookie・Authorizationを送らない(credentials: "omit"、headerはbuildSourceRequestの固定値のみ)
 *   - redirectは追跡しない(manual。3xxはassertAcceptableSourceResponseでredirectとして停止)
 *   - 同時1件・source別の最小間隔・固定timeout・応答byte上限(超過したら読み込みを中断)
 *   - source別の1回の実行あたりのrequest上限(超過は送信前に停止)
 *   - 応答本文はメモリ上だけで扱い、このmoduleはファイル・ログへ書かない
 */

export const STAGE1_APPROVAL_TOKEN = "stage1-upstream-read-verification-2026-09-23" as const;

export interface UpstreamHttpTransportOptions {
  /** 本人承認の明示。STAGE1_APPROVAL_TOKEN以外では作成できない。 */
  readonly approval: string;
  /** source別の1回の実行あたりのrequest上限。 */
  readonly maxRequests: Readonly<Record<SourceId, number>>;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly nowMs?: () => number;
}

export interface UpstreamRequestLogEntry {
  readonly sourceId: SourceId;
  readonly status: number | null;
  readonly outcome: "response" | "timeout" | "network_error" | "too_large" | "cap_exceeded";
  readonly durationMs: number;
  readonly bytes: number;
}

export interface UpstreamHttpTransport extends SourceTransport {
  readonly kind: "real_http";
  /** 送信したrequestの安全な記録(URL・本文・header値を含まない)。 */
  readonly log: readonly UpstreamRequestLogEntry[];
}

async function readBodyWithCap(res: Response, maxBytes: number): Promise<{ text: string; bytes: number } | null> {
  if (!res.body) return { text: "", bytes: 0 };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8"), bytes: total };
}

export function createUpstreamHttpTransport(options: UpstreamHttpTransportOptions): UpstreamHttpTransport {
  if (options.approval !== STAGE1_APPROVAL_TOKEN) throw new SourceFetchError("approval_missing");
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const nowMs = options.nowMs ?? (() => Date.now());
  const counts: Record<SourceId, number> = { "efootball-world": 0, "managers-json": 0 };
  const lastRequestAt: Partial<Record<SourceId, number>> = {};
  const log: UpstreamRequestLogEntry[] = [];
  let inFlight = false;

  return {
    kind: "real_http",
    log,
    async request(req: SourceRequest): Promise<SourceResponse> {
      const endpoint = SOURCE_ENDPOINTS[req.sourceId];
      if (!endpoint || endpoint.url !== req.url || endpoint.method !== req.method || req.timeoutMs !== endpoint.timeoutMs) {
        throw new SourceFetchError("endpoint_not_allowed");
      }
      const headerNames = Object.keys(req.headers).map((h) => h.toLowerCase());
      if (headerNames.some((h) => h === "cookie" || h === "authorization")) throw new SourceFetchError("endpoint_not_allowed");
      if (inFlight) throw new SourceFetchError("endpoint_not_allowed"); // 同時実行は1件だけ
      if (counts[req.sourceId] >= (options.maxRequests[req.sourceId] ?? 0)) {
        log.push({ sourceId: req.sourceId, status: null, outcome: "cap_exceeded", durationMs: 0, bytes: 0 });
        throw new SourceFetchError("request_cap_exceeded");
      }
      const last = lastRequestAt[req.sourceId];
      if (last != null) {
        const wait = endpoint.minIntervalMs - (nowMs() - last);
        if (wait > 0) await sleep(wait);
      }
      inFlight = true;
      counts[req.sourceId]++;
      lastRequestAt[req.sourceId] = nowMs();
      const started = nowMs();
      try {
        let res: Response;
        try {
          res = await fetchImpl(endpoint.url, {
            method: endpoint.method,
            headers: { ...req.headers },
            body: req.body ?? undefined,
            redirect: "manual",
            credentials: "omit",
            cache: "no-store",
            signal: AbortSignal.timeout(endpoint.timeoutMs),
          });
        } catch (err) {
          const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
          log.push({ sourceId: req.sourceId, status: null, outcome: timeout ? "timeout" : "network_error", durationMs: nowMs() - started, bytes: 0 });
          throw new SourceFetchError(timeout ? "timeout" : "network_error");
        }
        const headers: Record<string, string> = {};
        res.headers.forEach((value, name) => {
          headers[name.toLowerCase()] = value;
        });
        let body: { text: string; bytes: number } | null;
        try {
          body = await readBodyWithCap(res, endpoint.maxResponseBytes);
        } catch (err) {
          const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
          log.push({ sourceId: req.sourceId, status: res.status, outcome: timeout ? "timeout" : "network_error", durationMs: nowMs() - started, bytes: 0 });
          throw new SourceFetchError(timeout ? "timeout" : "network_error", res.status);
        }
        if (body == null) {
          log.push({ sourceId: req.sourceId, status: res.status, outcome: "too_large", durationMs: nowMs() - started, bytes: endpoint.maxResponseBytes });
          throw new SourceFetchError("response_too_large", res.status);
        }
        log.push({ sourceId: req.sourceId, status: res.status, outcome: "response", durationMs: nowMs() - started, bytes: body.bytes });
        return { status: res.status, headers, bodyText: body.text };
      } finally {
        inFlight = false;
      }
    },
  };
}
