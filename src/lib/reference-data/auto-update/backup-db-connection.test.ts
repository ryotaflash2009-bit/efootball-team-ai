import { describe, it, expect } from "vitest";
import { parseBackupDbUrl, validateCaCertificatePem, buildProductionPgClientConfig } from "./backup-db-connection";

/**
 * workflow Run #2が「self-signed certificate in certificate chain」で失敗した
 * (`ssl: { rejectUnauthorized: true }`のみでcaを渡していなかった)ことの回帰テスト。
 * ここでは実Supabase/実Production/実R2への接続は一切行わず、文字列レベルの
 * 解析・検証ロジックだけを検証する(実TLSハンドシェイクを伴う往復は
 * backup-db-tls-integration.test.ts側でローカルの自己署名CA/TLSサーバーを使って行う)。
 */

const VALID_CA = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBpTCCAUugAwIBAgIUTest0000000000000000000000000000000wCgYIKoZI",
  "test-body-line-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN",
  "-----END CERTIFICATE-----",
].join("\n");

describe("parseBackupDbUrl(URL query paramによるTLS設定上書きの防止)", () => {
  it("正常なpostgres URLをhost/port/database/user/passwordへ分解できる", () => {
    const parsed = parseBackupDbUrl("postgres://backup_user:s3cr3t@db.example.supabase.co:6543/postgres");
    expect(parsed).toEqual({
      host: "db.example.supabase.co",
      port: 6543,
      database: "postgres",
      user: "backup_user",
      password: "s3cr3t",
    });
  });

  it("portが省略されていれば5432を既定値にする", () => {
    const parsed = parseBackupDbUrl("postgres://u:p@host/db");
    expect(parsed.port).toBe(5432);
  });

  it("postgresql://スキームも許可する", () => {
    expect(() => parseBackupDbUrl("postgresql://u:p@host:5432/db")).not.toThrow();
  });

  it("不正なURL文字列はblocked(例外メッセージにURL自体を含めない)", () => {
    try {
      parseBackupDbUrl("not-a-url");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).not.toMatch(/not-a-url/);
    }
  });

  it("postgres/postgresql以外のスキームはblocked", () => {
    expect(() => parseBackupDbUrl("http://host/db")).toThrow(/postgres/);
  });

  it("hostが無ければblocked", () => {
    expect(() => parseBackupDbUrl("postgres:///db")).toThrow();
  });

  it("database名が無ければblocked", () => {
    expect(() => parseBackupDbUrl("postgres://u:p@host:5432/")).toThrow();
  });

  for (const param of ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl", "sslpassword", "sslnegotiation", "gssencmode"]) {
    it(`query parameter(${param})によるTLS設定の上書きはblocked`, () => {
      expect(() => parseBackupDbUrl(`postgres://u:p@host:5432/db?${param}=disable`)).toThrow(new RegExp(param));
    });
  }

  it("TLSと無関係なquery parameterは許可される(application_name等)", () => {
    expect(() => parseBackupDbUrl("postgres://u:p@host:5432/db?application_name=backup")).not.toThrow();
  });

  it("例外メッセージにpasswordを一切含めない(sslmode混入ケースでも)", () => {
    try {
      parseBackupDbUrl("postgres://u:very-secret-password@host:5432/db?sslmode=disable");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).not.toMatch(/very-secret-password/);
    }
  });
});

describe("validateCaCertificatePem(CA入力検証)", () => {
  it("正しいPEM形式のCAは受理される", () => {
    expect(validateCaCertificatePem(VALID_CA)).toBe(VALID_CA);
  });

  it("前後の空白はtrimされるが、内部の改行は維持される", () => {
    const result = validateCaCertificatePem(`\n  ${VALID_CA}  \n`);
    expect(result).toBe(VALID_CA);
    expect(result.split("\n").length).toBe(VALID_CA.split("\n").length);
  });

  it("複数の証明書を連結したものも許可する", () => {
    const chained = `${VALID_CA}\n${VALID_CA}`;
    expect(() => validateCaCertificatePem(chained)).not.toThrow();
  });

  it("未定義/null/空文字はblocked", () => {
    expect(() => validateCaCertificatePem("")).toThrow();
    expect(() => validateCaCertificatePem(undefined as unknown as string)).toThrow();
    expect(() => validateCaCertificatePem(null as unknown as string)).toThrow();
  });

  it("空白のみはblocked", () => {
    expect(() => validateCaCertificatePem("   \n\t  ")).toThrow();
  });

  it("BEGIN/END CERTIFICATEマーカーが無ければblocked(不正なPEM形式)", () => {
    expect(() => validateCaCertificatePem("this is not a certificate")).toThrow(/PEM/);
  });

  it("BEGINだけ・ENDだけの片方欠けもblocked", () => {
    expect(() => validateCaCertificatePem("-----BEGIN CERTIFICATE-----\nabc")).toThrow();
    expect(() => validateCaCertificatePem("abc\n-----END CERTIFICATE-----")).toThrow();
  });

  it("秘密鍵(PRIVATE KEY)マーカーの混入はblocked", () => {
    const withKey = `${VALID_CA}\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----`;
    expect(() => validateCaCertificatePem(withKey)).toThrow(/秘密鍵/);
  });

  it("age秘密鍵(AGE-SECRET-KEY)マーカーの混入はblocked", () => {
    const withAgeKey = `${VALID_CA}\nAGE-SECRET-KEY-1QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQQYQSZQ`;
    expect(() => validateCaCertificatePem(withAgeKey)).toThrow(/age/);
  });

  it("接続文字列(postgres://)らしき内容の混入はblocked", () => {
    const withConnString = `${VALID_CA}\npostgres://user:pass@host/db`;
    expect(() => validateCaCertificatePem(withConnString)).toThrow(/接続文字列/);
  });

  it("JWT様のtoken文字列の混入はblocked", () => {
    const withJwt = `${VALID_CA}\neyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dummySignaturePart`;
    expect(() => validateCaCertificatePem(withJwt)).toThrow(/token/);
  });

  it("上限サイズを超える入力はblocked", () => {
    const huge = `-----BEGIN CERTIFICATE-----\n${"A".repeat(20_000)}\n-----END CERTIFICATE-----`;
    expect(() => validateCaCertificatePem(huge)).toThrow(/大きすぎる/);
  });

  it("NUL文字・制御文字を含む入力はblocked", () => {
    expect(() => validateCaCertificatePem(`${VALID_CA}\u0000`)).toThrow(/制御文字/);
    expect(() => validateCaCertificatePem(`${VALID_CA}\u0007`)).toThrow(/制御文字/);
  });

  it("改行(\\n)自体は制御文字判定の対象外(PEMの構造上必須)", () => {
    expect(() => validateCaCertificatePem(VALID_CA)).not.toThrow();
  });
});

describe("buildProductionPgClientConfig(pg.Client設定の単一の真実源)", () => {
  it("正しいURL・CAからrejectUnauthorized:true固定の設定を組み立てる", () => {
    const config = buildProductionPgClientConfig("postgres://backup_user:s3cr3t@db.example.supabase.co:6543/postgres", VALID_CA);
    expect(config).toEqual({
      host: "db.example.supabase.co",
      port: 6543,
      database: "postgres",
      user: "backup_user",
      password: "s3cr3t",
      ssl: { rejectUnauthorized: true, ca: VALID_CA },
    });
  });

  it("connectionStringフィールドを一切含まない(pg内部でのsslmode等の再解釈を構造的に排除する)", () => {
    const config = buildProductionPgClientConfig("postgres://u:p@host:5432/db", VALID_CA);
    expect(config).not.toHaveProperty("connectionString");
  });

  it("不正なCAが渡された場合、DB URLが正しくてもblocked(DB接続を試みる前に拒否)", () => {
    expect(() => buildProductionPgClientConfig("postgres://u:p@host:5432/db", "not-a-cert")).toThrow();
  });

  it("不正なURLが渡された場合、CAが正しくてもblocked", () => {
    expect(() => buildProductionPgClientConfig("not-a-url", VALID_CA)).toThrow();
  });

  it("URLにTLS上書きquery paramが含まれていればblocked(CAが正しくても)", () => {
    expect(() => buildProductionPgClientConfig("postgres://u:p@host:5432/db?sslmode=no-verify", VALID_CA)).toThrow(/sslmode/);
  });

  it("失敗時の例外メッセージにURL・password・証明書本文のいずれも含めない", () => {
    try {
      buildProductionPgClientConfig("postgres://u:very-secret-password@host:5432/db", "not-a-cert");
      expect.fail("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toMatch(/very-secret-password/);
      expect(message).not.toMatch(/not-a-cert/);
    }
  });
});
