/**
 * Cloudflare R2(S3互換)向けの最小クライアントinterface。
 *
 * 実装候補は将来`@aws-sdk/client-s3`(SigV4、S3互換エンドポイント)で実装する想定だが、
 * このセッションでは新規packageを追加しないため、実装コードは書かない
 * (interfaceとfake実装だけをこのセッションの範囲とする)。
 *
 * `QueryClient`(`apply-orchestrator.ts`)と同じ設計方針: 最小限の操作だけを
 * 要求するinterfaceにし、実装の詳細(SDK・認証方式)から`backup-r2-adapter.ts`の
 * ビジネスロジックを分離する。
 */

export interface R2PutObjectInput {
  key: string;
  body: Buffer;
  /** checksum等、object本体とは別に保持したい少量のmetadata(secretを含めないこと)。 */
  metadata: Readonly<Record<string, string>>;
}

export interface R2PutObjectResult {
  etag: string;
}

export interface R2HeadObjectResult {
  size: number;
  etag: string;
  metadata: Readonly<Record<string, string>>;
}

export interface R2ObjectSummary {
  key: string;
  size: number;
  etag: string;
}

export interface R2Client {
  putObject(input: R2PutObjectInput): Promise<R2PutObjectResult>;
  headObject(key: string): Promise<R2HeadObjectResult | null>;
  getObject(key: string): Promise<Buffer | null>;
  listObjects(prefix: string): Promise<R2ObjectSummary[]>;
  deleteObject(key: string): Promise<void>;
}

/**
 * Unit Test専用のin-memory fake実装。ネットワーク通信を一切行わない。
 * Production・隔離検証のいずれでも使用してはならない(テストコード内だけで使う)。
 */
export class FakeR2Client implements R2Client {
  private objects = new Map<string, { body: Buffer; metadata: Record<string, string>; etag: string }>();
  putCalls = 0;
  deleteCalls = 0;

  private computeFakeEtag(body: Buffer): string {
    // 実S3/R2のETagはMD5相当だが、fakeでは決定的な疑似値で十分(暗号強度は不要)。
    let hash = 0;
    for (const b of body) hash = (hash * 31 + b) >>> 0;
    return hash.toString(16).padStart(8, "0");
  }

  async putObject(input: R2PutObjectInput): Promise<R2PutObjectResult> {
    this.putCalls += 1;
    const etag = this.computeFakeEtag(input.body);
    this.objects.set(input.key, { body: Buffer.from(input.body), metadata: { ...input.metadata }, etag });
    return { etag };
  }

  async headObject(key: string): Promise<R2HeadObjectResult | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return { size: obj.body.length, etag: obj.etag, metadata: { ...obj.metadata } };
  }

  async getObject(key: string): Promise<Buffer | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return Buffer.from(obj.body);
  }

  async listObjects(prefix: string): Promise<R2ObjectSummary[]> {
    const results: R2ObjectSummary[] = [];
    for (const [key, obj] of this.objects) {
      if (key.startsWith(prefix)) results.push({ key, size: obj.body.length, etag: obj.etag });
    }
    return results.sort((a, b) => a.key.localeCompare(b.key));
  }

  async deleteObject(key: string): Promise<void> {
    this.deleteCalls += 1;
    this.objects.delete(key);
  }

  /** テスト専用: 既に保存されているobjectの中身を、テストコードから直接壊すためのヘルパー。 */
  corruptForTest(key: string, mutate: (body: Buffer) => Buffer): void {
    const obj = this.objects.get(key);
    if (!obj) throw new Error(`corruptForTest: object not found: ${key}`);
    obj.body = mutate(obj.body);
  }
}
