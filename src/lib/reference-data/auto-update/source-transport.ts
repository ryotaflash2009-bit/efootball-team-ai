import { createHash } from "node:crypto";
import { isRetryAllowed, type RetryReason, type RetryStage } from "./update-batch-state";

/**
 * 自動更新 Phase B: upstream取得のtransport抽象。
 *
 * このmoduleは実ネットワークへ一切アクセスしない。実HTTP transportは、upstreamへの初回実通信が
 * 別途承認されるまで実装しない(Stage 1)。Phase Bで使えるtransportは次の2つだけ:
 *   - 記録済みfixtureを返すtransport(テスト・隔離dry run用)
 *   - 常に拒否するtransport(既定。誤って実取得経路へ繋がっても何も送信しない)
 *
 * 応答の判定(redirect非追跡・429/403/CAPTCHA即停止・Set-Cookie/認証情報の兆候で停止・
 * サイズ上限)は既存スクリプト(scripts/sync-world-players-*.mjs・scripts/sync-managers.mjs)と
 * 同じ基準を純関数として持ち、エラーメッセージへ応答本文・ヘッダー値を含めない。
 */

export type SourceId = "efootball-world" | "managers-json";

export interface SourceEndpoint {
  readonly sourceId: SourceId;
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly host: string;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  /** 取得1回あたりの最大試行回数(既存スクリプトと同じ: Worldは再試行2回、managers.jsonは再試行なし)。 */
  readonly maxAttempts: number;
  /** 再試行前の待機(ms)。attempt 1回目の失敗後がindex 0。 */
  readonly retryBackoffMs: readonly number[];
  /** 同一sourceへの連続リクエスト間隔(ms)。 */
  readonly minIntervalMs: number;
  /** 受け付けるContent-Type(先頭一致・小文字)。これ以外はschema driftとして停止する。 */
  readonly allowedContentTypes: readonly string[];
}

export const SOURCE_USER_AGENT = "eFootball-Team-AI-dev/0.1 (project data sync; single-threaded; contact: project owner)";

export const SOURCE_ENDPOINTS: Readonly<Record<SourceId, SourceEndpoint>> = Object.freeze({
  "efootball-world": Object.freeze({
    sourceId: "efootball-world",
    method: "POST",
    url: "https://efootball-world.com/api/proxy/v1/api/players/search",
    host: "efootball-world.com",
    timeoutMs: 20_000,
    maxResponseBytes: 20_000_000,
    maxAttempts: 3,
    retryBackoffMs: Object.freeze([5_000, 15_000]),
    minIntervalMs: 3_000,
    allowedContentTypes: Object.freeze(["application/json"]),
  }),
  "managers-json": Object.freeze({
    sourceId: "managers-json",
    method: "GET",
    url: "https://raw.githubusercontent.com/amine250/efootball-managers/main/data/managers.json",
    host: "raw.githubusercontent.com",
    timeoutMs: 20_000,
    maxResponseBytes: 5_000_000,
    maxAttempts: 1,
    retryBackoffMs: Object.freeze([]),
    minIntervalMs: 0,
    // raw.githubusercontent.comはJSONファイルをtext/plainで返す。
    allowedContentTypes: Object.freeze(["application/json", "text/plain"]),
  }),
});

/**
 * 定期実行(schedule)からの実ネットワーク利用は未承認のまま(false)。
 * Stage 1で承認されたのは、手動のupstream検証CLIからの読み取りだけで、それは
 * upstream-http-transport.tsの明示的な承認token付きtransportでのみ行う。
 */
export const REAL_NETWORK_ACCESS_ENABLED = false as const;

export interface SourceRequest {
  readonly sourceId: SourceId;
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
  readonly timeoutMs: number;
}

export interface SourceResponse {
  readonly status: number;
  /** header名は小文字。値はエラーメッセージ・Evidenceへ出さない。 */
  readonly headers: Readonly<Record<string, string>>;
  readonly bodyText: string;
}

export interface SourceTransport {
  readonly kind: "recorded_fixture" | "disabled" | "real_http";
  request(req: SourceRequest): Promise<SourceResponse>;
}

export type SourceErrorCode =
  | "network_disabled"
  | "fixture_missing"
  | "endpoint_not_allowed"
  | "network_error"
  | "timeout"
  | "redirect"
  | "http_401"
  | "http_403"
  | "http_429"
  | "http_5xx"
  | "unexpected_status"
  | "captcha"
  | "set_cookie"
  | "sensitive_content"
  | "response_too_large"
  | "empty_body"
  | "unexpected_content_type"
  | "request_cap_exceeded"
  | "transfer_cap_exceeded"
  | "approval_missing";

const ERROR_RETRY_REASON: Readonly<Record<SourceErrorCode, RetryReason>> = Object.freeze({
  network_disabled: "unknown",
  fixture_missing: "unknown",
  endpoint_not_allowed: "unknown",
  network_error: "network_error",
  timeout: "timeout",
  redirect: "unknown",
  http_401: "http_403",
  http_403: "http_403",
  http_429: "http_429",
  http_5xx: "http_5xx",
  unexpected_status: "unknown",
  captcha: "captcha",
  set_cookie: "unknown",
  sensitive_content: "unknown",
  response_too_large: "unknown",
  empty_body: "schema_drift",
  unexpected_content_type: "schema_drift",
  request_cap_exceeded: "unknown",
  transfer_cap_exceeded: "unknown",
  approval_missing: "unknown",
});

/** 取得失敗。messageは固定文言+HTTP status番号だけで、応答本文・ヘッダー値・URLのqueryを含めない。 */
export class SourceFetchError extends Error {
  readonly code: SourceErrorCode;
  readonly retryReason: RetryReason;
  readonly status: number | null;
  /** fetchSourceWithRetryが失敗時に設定する試行記録(Evidence用)。 */
  attempts: readonly SourceAttemptRecord[] = [];
  /** 上流がRetry-Afterを返した場合の待機時間(ms、上限60秒)。再試行可能な失敗のときだけ使う。 */
  retryAfterMs: number | null = null;

  constructor(code: SourceErrorCode, status: number | null = null) {
    super(`source取得失敗: ${code}${status != null ? ` (HTTP ${status})` : ""}`);
    this.name = "SourceFetchError";
    this.code = code;
    this.retryReason = ERROR_RETRY_REASON[code];
    this.status = status;
  }
}

export function isSourceFetchError(value: unknown): value is SourceFetchError {
  return value instanceof SourceFetchError;
}

/** 既存 scripts/sqlite/world.mjs の looksSensitive と同じ基準(本文の兆候だけを返し、値は返さない)。 */
export function detectSensitiveSignals(text: string): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  if (/"(access_?token|refresh_?token|id_?token|session_?token|jwt)"\s*:/.test(t)) hits.push("token field");
  if (/"(password|passwd|secret|api_?key|private_?key)"\s*:/.test(t)) hits.push("credential field");
  if (/"(email|phone_?number|credit_?card|card_?number|cvv|ssn)"\s*:/.test(t)) hits.push("PII field");
  if (/set-cookie/i.test(t)) hits.push("set-cookie");
  return hits;
}

const CAPTCHA_RE = /captcha|cf-challenge|challenge-platform|cf_chl_|attention required/i;

/**
 * 応答を判定する。成功なら何も返さず、失敗ならSourceFetchErrorをthrowする。
 * redirectは追跡しない。Set-Cookieは保存せず停止する(Cookieを使わない方針)。
 */
export function assertAcceptableSourceResponse(endpoint: SourceEndpoint, res: SourceResponse): void {
  const s = res.status;
  if (s >= 300 && s < 400) throw new SourceFetchError("redirect", s);
  if (s === 429) throw new SourceFetchError("http_429", s);
  if (s === 403) throw new SourceFetchError(CAPTCHA_RE.test(res.bodyText) ? "captcha" : "http_403", s);
  if (s === 401) throw new SourceFetchError("http_401", s);
  if (s >= 500 && s < 600) {
    const e = new SourceFetchError("http_5xx", s);
    e.retryAfterMs = parseRetryAfterMs(res.headers["retry-after"]);
    throw e;
  }
  if (s !== 200) throw new SourceFetchError("unexpected_status", s);
  const headerNames = Object.keys(res.headers).map((h) => h.toLowerCase());
  if (headerNames.includes("set-cookie")) throw new SourceFetchError("set_cookie", s);
  if (Buffer.byteLength(res.bodyText, "utf8") > endpoint.maxResponseBytes) throw new SourceFetchError("response_too_large", s);
  if (res.bodyText.trim() === "") throw new SourceFetchError("empty_body", s);
  const contentType = res.headers["content-type"] ?? "";
  if (/text\/html/i.test(contentType) && CAPTCHA_RE.test(res.bodyText)) throw new SourceFetchError("captcha", s);
  if (!endpoint.allowedContentTypes.some((t) => contentType.toLowerCase().startsWith(t))) throw new SourceFetchError("unexpected_content_type", s);
  if (detectSensitiveSignals(res.bodyText + "\n" + headerNames.join(",")).length > 0) throw new SourceFetchError("sensitive_content", s);
}

const MAX_RETRY_AFTER_MS = 60_000;

/** Retry-After(秒またはHTTP日付)をmsへ。不正・負値はnull、上限60秒。 */
export function parseRetryAfterMs(value: string | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  const v = value.trim();
  let ms: number | null = null;
  if (/^\d+$/.test(v)) ms = Number(v) * 1000;
  else {
    const t = Date.parse(v);
    if (Number.isFinite(t)) ms = t - now.getTime();
  }
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}

/** 許可済みendpointへのrequestだけを組み立てる(host・method・URLは固定値で、呼び出し側は変更できない)。 */
export function buildSourceRequest(sourceId: SourceId, body: string | null): SourceRequest {
  const endpoint = SOURCE_ENDPOINTS[sourceId];
  if (!endpoint) throw new SourceFetchError("endpoint_not_allowed");
  if (endpoint.method === "GET" && body !== null) throw new SourceFetchError("endpoint_not_allowed");
  const headers: Record<string, string> = { "User-Agent": SOURCE_USER_AGENT, Accept: "application/json" };
  if (endpoint.method === "POST") headers["Content-Type"] = "application/json";
  return Object.freeze({ sourceId, method: endpoint.method, url: endpoint.url, headers: Object.freeze(headers), body, timeoutMs: endpoint.timeoutMs });
}

/** requestの同一性(fixture照合・Evidence用)。bodyはJSONとして正規化せず、そのままのbyte列で比較する。 */
export function sourceRequestKey(req: Pick<SourceRequest, "method" | "url" | "body">): string {
  return createHash("sha256").update(JSON.stringify([req.method, req.url, req.body])).digest("hex");
}

/** 既定のtransport。どのrequestも送信せずに拒否する。 */
export function createDisabledSourceTransport(): SourceTransport {
  return Object.freeze({
    kind: "disabled" as const,
    async request(): Promise<SourceResponse> {
      throw new SourceFetchError("network_disabled");
    },
  });
}

export interface RecordedExchange {
  readonly request: Pick<SourceRequest, "method" | "url" | "body">;
  /** 同じrequestへ順番に返す応答(再試行の検証用)。transport errorは{ error }で表す。 */
  readonly responses: readonly (SourceResponse | { readonly error: "network_error" | "timeout" })[];
}

export interface RecordedFixtureTransport extends SourceTransport {
  readonly kind: "recorded_fixture";
  /** 実際に受けたrequestの記録(順序どおり)。 */
  readonly calls: readonly SourceRequest[];
}

/** 記録済み応答だけを返すtransport。記録に無いrequestはfixture_missingで拒否する(暗黙の実通信なし)。 */
export function createRecordedFixtureTransport(exchanges: readonly RecordedExchange[]): RecordedFixtureTransport {
  const queues = new Map<string, RecordedExchange["responses"][number][]>();
  for (const ex of exchanges) {
    const key = sourceRequestKey(ex.request);
    if (queues.has(key)) throw new Error("同じrequestのfixtureが重複している");
    queues.set(key, [...ex.responses]);
  }
  const calls: SourceRequest[] = [];
  return {
    kind: "recorded_fixture",
    calls,
    async request(req: SourceRequest): Promise<SourceResponse> {
      calls.push(req);
      const queue = queues.get(sourceRequestKey(req));
      const next = queue?.shift();
      if (!next) throw new SourceFetchError("fixture_missing");
      if ("error" in next) throw new SourceFetchError(next.error);
      return next;
    },
  };
}

export interface SourceAttemptRecord {
  readonly stage: RetryStage;
  readonly attempt: number;
  readonly reason: RetryReason | "ok";
  readonly code: SourceErrorCode | "ok";
  readonly at: string;
}

export interface FetchSourceOptions {
  readonly stage?: Extract<RetryStage, "update_detection" | "source_fetch">;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => Date;
}

export interface FetchSourceResult {
  readonly response: SourceResponse;
  readonly attempts: readonly SourceAttemptRecord[];
}

/**
 * transport経由で1 requestを取得する。retryはRETRY_POLICIES(network/5xx/timeoutのみ)と
 * endpointの最大試行回数の両方が許す場合だけ行う。429・403・CAPTCHA等は即停止。
 * 失敗時はSourceFetchErrorに attempts を添えてthrowする。
 */
export async function fetchSourceWithRetry(
  transport: SourceTransport,
  req: SourceRequest,
  options: FetchSourceOptions = {},
): Promise<FetchSourceResult> {
  const endpoint = SOURCE_ENDPOINTS[req.sourceId];
  if (!endpoint || endpoint.url !== req.url || endpoint.method !== req.method) throw new SourceFetchError("endpoint_not_allowed");
  const stage = options.stage ?? "source_fetch";
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? (() => new Date());
  const attempts: SourceAttemptRecord[] = [];
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await transport.request(req);
      assertAcceptableSourceResponse(endpoint, res);
      attempts.push({ stage, attempt, reason: "ok", code: "ok", at: now().toISOString() });
      return { response: res, attempts };
    } catch (err) {
      const e = isSourceFetchError(err) ? err : new SourceFetchError("network_error");
      attempts.push({ stage, attempt, reason: e.retryReason, code: e.code, at: now().toISOString() });
      const retry = attempt < endpoint.maxAttempts && isRetryAllowed(stage, e.retryReason, attempt);
      if (!retry) {
        e.attempts = [...attempts];
        throw e;
      }
      const backoff = endpoint.retryBackoffMs[attempt - 1] ?? endpoint.retryBackoffMs.at(-1) ?? 0;
      await sleep(Math.max(backoff, e.retryAfterMs ?? 0));
    }
  }
}
