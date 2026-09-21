import { describe, it, expect, vi } from "vitest";
import { R2RealClient, parseListObjectsV2Xml } from "./backup-r2-real-client";

const ENDPOINT = "https://test-account-id.r2.cloudflarestorage.com";
const BUCKET = "test-bucket";
const ACCESS_KEY_ID = "test-access-key-id";
const SECRET_ACCESS_KEY = "test-secret-access-key-value";

function makeResponse(init: { status: number; headers?: Record<string, string>; body?: string | ArrayBuffer }): Response {
  const headers = new Headers(init.headers ?? {});
  return new Response(init.body ?? null, { status: init.status, headers });
}

describe("R2RealClient(fake fetchだけを使用、実ネットワーク通信は一切行わない)", () => {
  it("コンストラクタがendpoint/bucket/credentialの不足を拒否する", () => {
    expect(() => new R2RealClient({ endpoint: "http://insecure", bucket: BUCKET, accessKeyId: "a", secretAccessKey: "b" })).toThrow();
    expect(() => new R2RealClient({ endpoint: ENDPOINT, bucket: "", accessKeyId: "a", secretAccessKey: "b" })).toThrow();
    expect(() => new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: "", secretAccessKey: "b" })).toThrow();
    expect(() => new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: "a", secretAccessKey: "" })).toThrow();
  });

  it("putObjectは署名済みPUTリクエストを送り、metadataをx-amz-meta-*headerへ変換する", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init: init ?? {} });
      return makeResponse({ status: 200, headers: { etag: '"abc123"' } });
    });
    const client = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.putObject({ key: "daily/2026-09-21/job-1/abc.age", body: Buffer.from("hello"), metadata: { sha256: "deadbeef", jobId: "job-1" } });

    expect(result.etag).toBe('"abc123"');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${ENDPOINT}/${BUCKET}/daily/2026-09-21/job-1/abc.age`);
    expect(calls[0].init.method).toBe("PUT");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-amz-meta-sha256"]).toBe("deadbeef");
    expect(headers["x-amz-meta-jobid"]).toBe("job-1");
    expect(headers.authorization).toContain("AWS4-HMAC-SHA256");
    expect(headers.authorization).toContain(ACCESS_KEY_ID);
    expect(JSON.stringify(headers)).not.toContain(SECRET_ACCESS_KEY);
  });

  it("headObjectは404でnullを返し、それ以外の失敗はHTTP status以外を含まない例外を投げる", async () => {
    const fetch404 = vi.fn(async () => makeResponse({ status: 404 }));
    const client404 = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetch404 as unknown as typeof fetch });
    expect(await client404.headObject("daily/x.age")).toBeNull();

    const fetch500 = vi.fn(async () => makeResponse({ status: 500, body: "<Error><Message>internal detail leak</Message></Error>" }));
    const client500 = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetch500 as unknown as typeof fetch });
    await expect(client500.headObject("daily/x.age")).rejects.toThrow(/HTTP 500/);
    await client500.headObject("daily/x.age").catch((err: Error) => {
      expect(err.message).not.toContain("internal detail leak");
    });
  });

  it("headObjectはsize/etag/metadataをresponse headerから読み取る", async () => {
    const fetchImpl = vi.fn(async () =>
      makeResponse({ status: 200, headers: { "content-length": "1234", etag: '"e1"', "x-amz-meta-sha256": "aaa111", "x-amz-meta-jobid": "job-9" } }),
    );
    const client = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    const head = await client.headObject("daily/x.age");
    expect(head).toEqual({ size: 1234, etag: '"e1"', metadata: { sha256: "aaa111", jobId: "job-9" } });
  });

  it("getObjectは404でnull、成功時はBufferを返す", async () => {
    const fetchImpl = vi.fn(async () => makeResponse({ status: 200, body: "payload-bytes" }));
    const client = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    const body = await client.getObject("daily/x.age");
    expect(body?.toString("utf8")).toBe("payload-bytes");

    const fetch404 = vi.fn(async () => makeResponse({ status: 404 }));
    const client404 = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetch404 as unknown as typeof fetch });
    expect(await client404.getObject("daily/x.age")).toBeNull();
  });

  it("deleteObjectは404を成功扱いにする(冪等な削除)", async () => {
    const fetch404 = vi.fn(async () => makeResponse({ status: 404 }));
    const client = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetch404 as unknown as typeof fetch });
    await expect(client.deleteObject("daily/x.age")).resolves.toBeUndefined();
  });

  it("listObjectsはlist-type=2とprefixをquery paramへ含め、bucketのURLだけへ問い合わせる(keyへは問い合わせない)", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      calls.push(url.toString());
      return makeResponse({
        status: 200,
        body: `<?xml version="1.0"?><ListBucketResult><Contents><Key>daily/2026-09-21/job-1/abc.age</Key><Size>42</Size><ETag>"e1"</ETag></Contents></ListBucketResult>`,
      });
    });
    const client = new R2RealClient({ endpoint: ENDPOINT, bucket: BUCKET, accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    const summaries = await client.listObjects("daily/");
    expect(calls[0]).toContain(`${ENDPOINT}/${BUCKET}?`);
    expect(calls[0]).toContain("list-type=2");
    expect(calls[0]).toContain("prefix=daily%2F");
    expect(summaries).toEqual([{ key: "daily/2026-09-21/job-1/abc.age", size: 42, etag: '"e1"' }]);
  });
});

describe("parseListObjectsV2Xml", () => {
  it("複数<Contents>を正しく抽出する", () => {
    const xml = `<ListBucketResult>
      <Contents><Key>daily/a.age</Key><Size>10</Size><ETag>"e1"</ETag></Contents>
      <Contents><Key>daily/b.manifest.json</Key><Size>5</Size><ETag>"e2"</ETag></Contents>
    </ListBucketResult>`;
    expect(parseListObjectsV2Xml(xml)).toEqual([
      { key: "daily/a.age", size: 10, etag: '"e1"' },
      { key: "daily/b.manifest.json", size: 5, etag: '"e2"' },
    ]);
  });

  it("<Contents>が無ければ空配列を返す(例外にしない)", () => {
    expect(parseListObjectsV2Xml("<ListBucketResult></ListBucketResult>")).toEqual([]);
  });

  it("XMLエンティティをデコードする", () => {
    const xml = `<Contents><Key>daily/a&amp;b.age</Key><Size>1</Size><ETag>"e"</ETag></Contents>`;
    expect(parseListObjectsV2Xml(xml)[0].key).toBe("daily/a&b.age");
  });
});
