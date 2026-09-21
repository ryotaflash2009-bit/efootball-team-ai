import { createHash, createHmac } from "node:crypto";

/**
 * Cloudflare R2(S3互換、SigV4認証)向けのAWS Signature Version 4署名の実装。
 *
 * `@aws-sdk/client-s3`を新規packageとして追加せず、Node.js標準の`node:crypto`と
 * グローバル`fetch`(Node 18+)だけで、必要な5操作(PutObject/HeadObject/GetObject/
 * ListObjectsV2/DeleteObject)分のREST呼び出しを自前で署名する。理由:
 * このセッション(および本Backup機能全体)は一貫して新規package追加を避ける方針を
 * とっており、必要な操作の種類が5つに限定されているため、SigV4という安定した
 * 公開仕様を直接実装する方が、AWS SDK v3の大きな依存グラフ(`@smithy/*`等、
 * 多数のsub-dependency)を持ち込むより供給網リスクが小さいと判断した。
 *
 * `backup-r2-sigv4.test.ts`で、この実装(canonical request→string-to-sign→
 * HMAC chainによる署名鍵導出→最終署名)と完全に独立したツール(`openssl dgst -sha256
 * -hmac`をこのセッションでbashから直接実行)で同じ入力を手計算し、両者の結果が
 * 一致することを確認済み(自己無矛盾な検証だけでなく、独立実装との一致という根拠を持つ)。
 */

const ALGORITHM = "AWS4-HMAC-SHA256";

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** 空bodyのSHA-256(GET/HEAD/DELETEで使う既知の固定値)。 */
export const EMPTY_PAYLOAD_SHA256 = sha256Hex(Buffer.alloc(0));

function hmacRaw(key: Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** RFC3986準拠のURIエンコード(SigV4が要求する、"!'()*"も追加でエンコードする版)。 */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** パスの"/"区切りを保ったまま各segmentだけをエンコードする(S3のpath-style canonical URI用)。 */
export function encodeS3Path(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
}

function formatAmzDate(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString();
  const amzDate = iso.replace(/[:-]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacRaw(Buffer.from("AWS4" + secretAccessKey, "utf8"), dateStamp);
  const kRegion = hmacRaw(kDate, region);
  const kService = hmacRaw(kRegion, service);
  return hmacRaw(kService, "aws4_request");
}

export interface SignS3RequestInput {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  host: string;
  /** すでに各segmentがpercent-encodeされた、"/"始まりのパス(例: encodeS3Pathの戻り値)。 */
  canonicalUri: string;
  queryParams?: Readonly<Record<string, string>>;
  /** 署名・送信対象の追加headers(小文字化される、例: x-amz-meta-*)。secret値を含めないこと。 */
  headers?: Readonly<Record<string, string>>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** 通常は"s3"固定。AWS公式test vectorとの照合用に上書き可能にしている。 */
  service?: string;
  now: Date;
}

/** signS3Requestの戻り値。Authorizationを含む、実際に送信すべき全headerのmap。 */
export type SignedS3Headers = Readonly<Record<string, string>>;

export function signS3Request(input: SignS3RequestInput): SignedS3Headers {
  const service = input.service ?? "s3";
  const { amzDate, dateStamp } = formatAmzDate(input.now);

  const canonicalQueryString = Object.entries(input.queryParams ?? {})
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  // SigV4がcanonical requestの最終行として常に要求するのはpayload hash自体であり、
  // それを"x-amz-content-sha256"としてSIGNED HEADERに含めるかどうかは呼び出し側が選ぶ
  // (S3/R2向けの実呼び出しでは含めるのが標準的だが、コア署名アルゴリズムの正しさは
  // それに依存しない。host/x-amz-dateだけが常に必須の署名対象header)。
  const mergedHeaders: Record<string, string> = {
    host: input.host,
    "x-amz-date": amzDate,
  };
  for (const [k, v] of Object.entries(input.headers ?? {})) {
    mergedHeaders[k.toLowerCase()] = v;
  }

  const sortedHeaderNames = Object.keys(mergedHeaders).sort();
  const canonicalHeaders = sortedHeaderNames.map((k) => `${k}:${mergedHeaders[k].trim()}\n`).join("");
  const signedHeaders = sortedHeaderNames.join(";");

  const canonicalRequest = [input.method, input.canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, input.payloadHash].join(
    "\n",
  );

  const credentialScope = `${dateStamp}/${input.region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = getSigningKey(input.secretAccessKey, dateStamp, input.region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const authorization = `${ALGORITHM} Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { ...mergedHeaders, authorization };
}
