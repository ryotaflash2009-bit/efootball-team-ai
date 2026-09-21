import { signS3Request, sha256Hex, EMPTY_PAYLOAD_SHA256, encodeS3Path } from "./backup-r2-sigv4";
import type { R2Client, R2PutObjectInput, R2PutObjectResult, R2HeadObjectResult, R2ObjectSummary } from "./backup-r2-client";

/**
 * Cloudflare R2(S3互換)への実接続を行う`R2Client`実装。
 *
 * 新規npm packageを追加せず、`backup-r2-sigv4.ts`のSigV4署名とNode標準の
 * グローバル`fetch`だけで実装する(理由は`backup-r2-sigv4.ts`のdocコメント参照)。
 *
 * 資格情報(`accessKeyId`/`secretAccessKey`)・接続先(`endpoint`/`bucket`)は、
 * すべてコンストラクタへ呼び出し側(GitHub Actions workflow実行時は
 * `process.env`経由でSecretから)が渡す。このクラス自体はSecretの値を
 * ログ出力・例外メッセージへ含めない(HTTPエラー時はstatus codeだけを含める)。
 *
 * このセッションでは実R2への接続を一切行っていない(fetchはテストでは
 * 差し替え可能にしており、`backup-r2-real-client.test.ts`は常に注入したfake fetchだけを使う)。
 */

const REGION = "auto";
const CHECKSUM_METADATA_HEADER = "x-amz-meta-sha256";

/**
 * Cloudflare R2のS3互換エンドポイントとして許可するホスト名の形式。
 * `<32桁16進数のaccount id>[.eu|.fips].r2.cloudflarestorage.com`のみを許可し、
 * それ以外の任意のhttps://ホスト(SSRF・endpoint誤設定・Secret誤入力の踏み台化)を拒否する。
 * `REFERENCE_DATA_BACKUP_R2_ENDPOINT`はGitHub Secretから来る値であり利用者からの
 * 直接入力ではないが、値の誤り・混入を早期に(実際にfetchする前に)検出するための
 * 多層防御として、プロトコルだけでなくホスト名の形式も検証する。
 */
const R2_ENDPOINT_HOST_PATTERN = /^[a-f0-9]{32}(\.(eu|fips))?\.r2\.cloudflarestorage\.com$/i;

export interface R2RealClientConfig {
  /** R2のS3互換エンドポイントURL(例: https://<account-id>.r2.cloudflarestorage.com)。Secretから取得する想定。 */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** テスト専用の注入ポイント。省略時はグローバル`fetch`を使う。 */
  fetchImpl?: typeof fetch;
}

function sanitizeHttpError(operation: string, status: number): Error {
  // R2からのエラーレスポンス本文には、bucket構成の詳細が含まれる場合があるため、
  // 例外メッセージにはHTTP status codeだけを含め、レスポンス本文は一切含めない。
  return new Error(`R2 ${operation}失敗: HTTP ${status}`);
}

/** endpointがhttps://かつCloudflare R2の想定ホスト名形式であることを確認し、そのoriginを返す。 */
function assertSafeR2Endpoint(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("R2RealClient: endpointが不正なURLである");
  }
  if (url.protocol !== "https:") {
    throw new Error("R2RealClient: endpointはhttps://である必要がある");
  }
  if (!R2_ENDPOINT_HOST_PATTERN.test(url.hostname)) {
    throw new Error("R2RealClient: endpointのホスト名がCloudflare R2の想定形式(<account-id>.r2.cloudflarestorage.com)と一致しない");
  }
  return url.origin;
}

export class R2RealClient implements R2Client {
  private readonly config: R2RealClientConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly endpointOrigin: string;

  constructor(config: R2RealClientConfig) {
    this.endpointOrigin = assertSafeR2Endpoint(config.endpoint);
    if (!config.bucket) throw new Error("R2RealClient: bucketが指定されていない");
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error("R2RealClient: accessKeyId/secretAccessKeyが指定されていない");
    }
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private objectUrl(key: string): URL {
    const path = `/${encodeS3Path(this.config.bucket)}/${encodeS3Path(key)}`;
    return new URL(path, this.endpointOrigin);
  }

  async putObject(input: R2PutObjectInput): Promise<R2PutObjectResult> {
    const url = this.objectUrl(input.key);
    const payloadHash = sha256Hex(input.body);
    const headers: Record<string, string> = { "x-amz-content-sha256": payloadHash };
    for (const [k, v] of Object.entries(input.metadata)) {
      headers[`x-amz-meta-${k.toLowerCase()}`] = v;
    }
    const now = new Date();
    const signed = signS3Request({
      method: "PUT",
      host: url.host,
      canonicalUri: url.pathname,
      headers,
      payloadHash,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: REGION,
      now,
    });
    const res = await this.fetchImpl(url, { method: "PUT", headers: signed, body: input.body });
    if (!res.ok) throw sanitizeHttpError("putObject", res.status);
    return { etag: res.headers.get("etag") ?? "" };
  }

  async headObject(key: string): Promise<R2HeadObjectResult | null> {
    const url = this.objectUrl(key);
    const now = new Date();
    const signed = signS3Request({
      method: "HEAD",
      host: url.host,
      canonicalUri: url.pathname,
      headers: { "x-amz-content-sha256": EMPTY_PAYLOAD_SHA256 },
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: REGION,
      now,
    });
    const res = await this.fetchImpl(url, { method: "HEAD", headers: signed });
    if (res.status === 404) return null;
    if (!res.ok) throw sanitizeHttpError("headObject", res.status);
    const size = Number(res.headers.get("content-length") ?? "0");
    const metadata: Record<string, string> = {};
    const sha = res.headers.get(CHECKSUM_METADATA_HEADER);
    if (sha) metadata.sha256 = sha;
    const jobId = res.headers.get("x-amz-meta-jobid");
    if (jobId) metadata.jobId = jobId;
    return { size, etag: res.headers.get("etag") ?? "", metadata };
  }

  async getObject(key: string): Promise<Buffer | null> {
    const url = this.objectUrl(key);
    const now = new Date();
    const signed = signS3Request({
      method: "GET",
      host: url.host,
      canonicalUri: url.pathname,
      headers: { "x-amz-content-sha256": EMPTY_PAYLOAD_SHA256 },
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: REGION,
      now,
    });
    const res = await this.fetchImpl(url, { method: "GET", headers: signed });
    if (res.status === 404) return null;
    if (!res.ok) throw sanitizeHttpError("getObject", res.status);
    return Buffer.from(await res.arrayBuffer());
  }

  async listObjects(prefix: string): Promise<R2ObjectSummary[]> {
    const url = new URL(`/${encodeS3Path(this.config.bucket)}`, this.endpointOrigin);
    const queryParams = { "list-type": "2", prefix };
    const now = new Date();
    const signed = signS3Request({
      method: "GET",
      host: url.host,
      canonicalUri: url.pathname,
      queryParams,
      headers: { "x-amz-content-sha256": EMPTY_PAYLOAD_SHA256 },
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: REGION,
      now,
    });
    const listUrl = new URL(url);
    for (const [k, v] of Object.entries(queryParams)) listUrl.searchParams.set(k, v);
    const res = await this.fetchImpl(listUrl, { method: "GET", headers: signed });
    if (!res.ok) throw sanitizeHttpError("listObjects", res.status);
    const xml = await res.text();
    return parseListObjectsV2Xml(xml);
  }

  async deleteObject(key: string): Promise<void> {
    const url = this.objectUrl(key);
    const now = new Date();
    const signed = signS3Request({
      method: "DELETE",
      host: url.host,
      canonicalUri: url.pathname,
      headers: { "x-amz-content-sha256": EMPTY_PAYLOAD_SHA256 },
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: REGION,
      now,
    });
    const res = await this.fetchImpl(url, { method: "DELETE", headers: signed });
    if (!res.ok && res.status !== 404) throw sanitizeHttpError("deleteObject", res.status);
  }
}

/**
 * S3 ListObjectsV2の`<Contents>`要素だけを、依存追加なしの最小限のregexで抽出する。
 * このXMLは常にこちらが所有するR2 bucketからの応答であり、外部から注入された
 * 信頼できないXMLではないため、フルXMLパーサーではなくこの簡易抽出で十分と判断する。
 */
export function parseListObjectsV2Xml(xml: string): R2ObjectSummary[] {
  const results: R2ObjectSummary[] = [];
  const contentsBlocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];
  for (const block of contentsBlocks) {
    const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/);
    const sizeMatch = block.match(/<Size>(\d+)<\/Size>/);
    const etagMatch = block.match(/<ETag>([\s\S]*?)<\/ETag>/);
    if (!keyMatch) continue;
    results.push({
      key: decodeXmlEntities(keyMatch[1]),
      size: sizeMatch ? Number(sizeMatch[1]) : 0,
      etag: etagMatch ? decodeXmlEntities(etagMatch[1]) : "",
    });
  }
  return results;
}

const XML_ENTITY_REPLACEMENTS: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/**
 * CodeQL(Double escaping or unescaping)修正: 以前は`&amp;`→`&lt;`→...と複数回に
 * 分けて`.replace()`を連鎖させていたため、`&amp;lt;`(本来は文字列`&lt;`という
 * 4文字そのものを表す、正しくエスケープされた値)が、`&amp;`を先に`&`へ戻した
 * 時点で`&lt;`という文字列になり、次の`.replace(/&lt;/g, "<")`によって誤って
 * `<`へさらに変換されてしまう(二重アンエスケープ)。1回のregex.replaceで
 * すべてのentityを同時に置換することで、置換後の文字列が同じパスで再度
 * マッチされることを防ぐ(String.prototype.replaceの1回のグローバルマッチは
 * 元の文字列だけを走査し、置換結果を再走査しないため安全)。
 */
function decodeXmlEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITY_REPLACEMENTS[entity] ?? entity);
}
