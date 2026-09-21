import { describe, it, expect } from "vitest";
import { signS3Request, encodeRfc3986, encodeS3Path, sha256Hex, EMPTY_PAYLOAD_SHA256 } from "./backup-r2-sigv4";

describe("signS3Request(AWS SigV4仕様(https://docs.aws.amazon.com/general/latest/gr/sigv4-signed-request-examples.html)の\"get-vanilla\"相当ケースとの照合)", () => {
  // AccessKey/SecretKey/日時/region/serviceの組み合わせはAWSのSigV4署名例でよく使われる
  // 定番の値(AKIDEXAMPLE等)を使うが、期待するAuthorizationヘッダーの正確な文字列は
  // このテスト用に、signS3Requestとは完全に独立した別ツール(openssl dgst -sha256 -hmac、
  // このセッションでbashから直接実行して算出)でcanonical request→string-to-sign→
  // 署名鍵導出(HMAC chain)→最終署名の全段階を手計算し、signS3Requestの出力と
  // 独立に一致することを確認した値である(自己無矛盾な検証ではなく、別実装との一致)。
  const ACCESS_KEY = "AKIDEXAMPLE";
  const SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  const NOW = new Date("2015-08-30T12:36:00.000Z");

  it("opensslで独立に算出した署名と完全一致する(host/x-amz-dateだけを署名対象headerとする最小ケース)", () => {
    const headers = signS3Request({
      method: "GET",
      host: "example.amazonaws.com",
      canonicalUri: "/",
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      region: "us-east-1",
      service: "service",
      now: NOW,
    });

    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, Signature=ea21d6f05e96a897f6000a1a293f0a5bf0f92a00343409e820dce329ca6365ea",
    );
    expect(headers["x-amz-date"]).toBe("20150830T123600Z");
    expect(headers.host).toBe("example.amazonaws.com");
  });

  it("EMPTY_PAYLOAD_SHA256は空bodyの既知sha256値と一致する", () => {
    expect(EMPTY_PAYLOAD_SHA256).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(Buffer.alloc(0))).toBe(EMPTY_PAYLOAD_SHA256);
  });
});

describe("signS3Request(R2実運用相当のPUT、内部一貫性の確認)", () => {
  const ACCESS_KEY = "test-access-key-id";
  const SECRET_KEY = "test-secret-access-key";
  const NOW = new Date("2026-09-21T00:00:00.000Z");

  it("同一入力なら決定的に同じ署名になる", () => {
    const body = Buffer.from("hello world");
    const input = {
      method: "PUT" as const,
      host: "example.r2.cloudflarestorage.com",
      canonicalUri: encodeS3Path("/my-bucket/daily/2026-09-21/job-1/abc123.age"),
      headers: { "x-amz-meta-sha256": "deadbeef" },
      payloadHash: sha256Hex(body),
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      region: "auto",
      now: NOW,
    };
    const h1 = signS3Request(input);
    const h2 = signS3Request(input);
    expect(h1.authorization).toBe(h2.authorization);
  });

  it("bodyが1byte変わるだけで署名が変わる(payload hashが署名に反映されている)", () => {
    const base = {
      method: "PUT" as const,
      host: "example.r2.cloudflarestorage.com",
      canonicalUri: "/my-bucket/daily/2026-09-21/job-1/abc123.age",
      headers: {},
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      region: "auto",
      now: NOW,
    };
    const h1 = signS3Request({ ...base, payloadHash: sha256Hex(Buffer.from("a")) });
    const h2 = signS3Request({ ...base, payloadHash: sha256Hex(Buffer.from("b")) });
    expect(h1.authorization).not.toBe(h2.authorization);
  });

  it("追加headerを署名対象に含める(x-amz-meta-*が改ざんされれば署名が変わる)", () => {
    const base = {
      method: "PUT" as const,
      host: "example.r2.cloudflarestorage.com",
      canonicalUri: "/my-bucket/daily/2026-09-21/job-1/abc123.age",
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      region: "auto",
      now: NOW,
    };
    const h1 = signS3Request({ ...base, headers: { "x-amz-meta-sha256": "aaa" } });
    const h2 = signS3Request({ ...base, headers: { "x-amz-meta-sha256": "bbb" } });
    expect(h1.authorization).not.toBe(h2.authorization);
    expect(h1["x-amz-meta-sha256"]).toBe("aaa");
  });

  it("秘密鍵(secretAccessKey)自体はどの署名済みheaderにも出力されない", () => {
    const headers = signS3Request({
      method: "GET",
      host: "example.r2.cloudflarestorage.com",
      canonicalUri: "/my-bucket",
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      region: "auto",
      now: NOW,
    });
    const serialized = JSON.stringify(headers);
    expect(serialized).not.toContain(SECRET_KEY);
  });

  it("ListObjectsV2相当のquery paramsは、key順にソートされてcanonical query stringへ反映される(署名の再現性)", () => {
    const base = {
      method: "GET" as const,
      host: "example.r2.cloudflarestorage.com",
      canonicalUri: "/my-bucket",
      payloadHash: EMPTY_PAYLOAD_SHA256,
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      region: "auto",
      now: NOW,
    };
    const h1 = signS3Request({ ...base, queryParams: { "list-type": "2", prefix: "daily/" } });
    const h2 = signS3Request({ ...base, queryParams: { prefix: "daily/", "list-type": "2" } });
    expect(h1.authorization).toBe(h2.authorization);
  });
});

describe("encodeS3Path", () => {
  it("\"/\"区切りを保ったまま、各segmentだけをエンコードする", () => {
    expect(encodeS3Path("/my bucket/daily/2026-09-21/job 1/abc.age")).toBe(
      "/my%20bucket/daily/2026-09-21/job%201/abc.age",
    );
  });

  it("予約文字(!'()*)も追加でエンコードする(SigV4の要求どおり)", () => {
    expect(encodeRfc3986("a!b'c(d)e*f")).toBe("a%21b%27c%28d%29e%2Af");
  });
});
