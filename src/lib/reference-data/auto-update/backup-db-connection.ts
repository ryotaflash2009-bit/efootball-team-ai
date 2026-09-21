import { sanitizeErrorMessage } from "../real-import-guards";

/**
 * Production PostgreSQL(Supabase)への接続設定を、`REFERENCE_DATA_BACKUP_DB_URL`と
 * `REFERENCE_DATA_BACKUP_DB_CA_CERT`という2つのSecretから、安全に組み立てる。
 *
 * 2026-09-21追記(workflow Run #2の失敗): `new Client({ connectionString, ssl: {
 * rejectUnauthorized: true } })`は、`ca`を指定していなかったため、Node標準のTLSが
 * Supabase側の証明書チェーンをシステム既定のCAストアだけで検証しようとして
 * `self-signed certificate in certificate chain`で拒否された。
 *
 * 修正方針: TLS検証を弱める(`rejectUnauthorized: false`・`NODE_TLS_REJECT_UNAUTHORIZED=0`・
 * カスタム`checkServerIdentity`での迂回等)ことは一切行わない。代わりに、Supabase
 * Dashboardから本人が取得したServer root certificateを`REFERENCE_DATA_BACKUP_DB_CA_CERT`
 * Secretとして渡し、それを`ssl.ca`として明示的に信頼する(証明書チェーン検証・
 * hostname検証はいずれも維持したまま)。
 *
 * `connectionString`はpg.Clientへ一切渡さない。接続文字列自体にTLS設定を上書きし得る
 * query parameter(`sslmode`等)が含まれていても、pgの内部パーサーがそれを一切
 * 参照する余地が無いように、host/port/database/user/passwordを自前でURLから
 * 抽出し、`ssl`オブジェクトだけをこのモジュールの返り値(単一の真実源)にする。
 */

export interface ParsedBackupDbUrl {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/** TLS設定を上書きし得る、pg/libpqが解釈するquery parameter名。1つでも含まれていればblockedにする。 */
const FORBIDDEN_CONNECTION_QUERY_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl", "sslpassword", "sslnegotiation", "gssencmode"];

/**
 * `REFERENCE_DATA_BACKUP_DB_URL`を安全に解析する。TLS設定を上書きし得るquery
 * parameterが含まれていればblockedにする(pgへ`connectionString`をそのまま渡さない
 * ことで、この関数を経由しない限りそれらが一切参照されない設計と対応する)。
 * 例外メッセージにはURL・password等の値を一切含めない。
 */
export function parseBackupDbUrl(rawUrl: string): ParsedBackupDbUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("REFERENCE_DATA_BACKUP_DB_URLが不正なURLである(blocked)");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("REFERENCE_DATA_BACKUP_DB_URLはpostgres://またはpostgresql://である必要がある(blocked)");
  }
  for (const param of FORBIDDEN_CONNECTION_QUERY_PARAMS) {
    if (url.searchParams.has(param)) {
      throw new Error(
        `REFERENCE_DATA_BACKUP_DB_URLにTLS設定を上書きし得るquery parameter(${param})が含まれている(blocked、TLS設定はコード側だけの単一の真実源にする)`,
      );
    }
  }
  if (!url.hostname) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_URLにhostが含まれていない(blocked)");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_URLにdatabase名が含まれていない(blocked)");
  }
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_URLのportが不正(blocked)");
  }
  return {
    host: url.hostname,
    port,
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

const CA_CERT_MAX_LENGTH = 16_384;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

/**
 * `REFERENCE_DATA_BACKUP_DB_CA_CERT`の内容を検証する。証明書(PEM、複数連結可)
 * だけを許可し、秘密鍵・age秘密鍵・接続文字列・token様文字列が混入していれば
 * blockedにする。改行は(内部の複数行PEM構造として)維持したまま、前後の空白だけを
 * 取り除いて返す。
 */
export function validateCaCertificatePem(raw: string): string {
  if (raw === undefined || raw === null || raw.length === 0) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTが空(blocked)");
  }
  if (raw.length > CA_CERT_MAX_LENGTH) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTが大きすぎる(blocked)");
  }
  if (CONTROL_CHAR_PATTERN.test(raw)) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTに制御文字が含まれている(blocked)");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTが空白のみ(blocked)");
  }
  if (!trimmed.includes("-----BEGIN CERTIFICATE-----") || !trimmed.includes("-----END CERTIFICATE-----")) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTがPEM形式(-----BEGIN/END CERTIFICATE-----)ではない(blocked)");
  }
  if (/PRIVATE KEY/i.test(trimmed)) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTに秘密鍵らしき内容が含まれている(blocked、証明書だけを許可する)");
  }
  if (/AGE-SECRET-KEY/i.test(trimmed)) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTにage秘密鍵らしき内容が含まれている(blocked)");
  }
  if (/postgres(?:ql)?:\/\//i.test(trimmed)) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTに接続文字列らしき内容が含まれている(blocked)");
  }
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(trimmed)) {
    throw new Error("REFERENCE_DATA_BACKUP_DB_CA_CERTにtoken(JWT様)らしき内容が含まれている(blocked)");
  }
  return trimmed;
}

/** `pg.Client`へそのまま渡せる設定。`rejectUnauthorized`はリテラル型`true`固定であり、`false`を代入するとTypeScriptの型エラーになる。 */
export interface ProductionPgClientConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: {
    rejectUnauthorized: true;
    ca: string;
  };
}

/**
 * `REFERENCE_DATA_BACKUP_DB_URL`と`REFERENCE_DATA_BACKUP_DB_CA_CERT`から、
 * pg.Clientへそのまま渡せる設定を組み立てる。`connectionString`は使わない
 * (host/port/database/user/passwordを個別に渡すことで、接続文字列内の
 * query parameterがpg内部でTLS設定として再解釈される余地を構造的に無くす)。
 * 失敗時の例外メッセージにはURL・password・証明書本文のいずれも含めない。
 */
export function buildProductionPgClientConfig(dbUrl: string, caCertPem: string): ProductionPgClientConfig {
  try {
    const parsed = parseBackupDbUrl(dbUrl);
    const ca = validateCaCertificatePem(caCertPem);
    return {
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      password: parsed.password,
      ssl: { rejectUnauthorized: true, ca },
    };
  } catch (err) {
    // parseBackupDbUrl/validateCaCertificatePem自体が既にsanitizeされた理由文字列を
    // 投げているため、ここでは再度sanitizeErrorMessageを通すだけで十分(接続情報の
    // 混入を防ぐ最終防御)。
    throw new Error(sanitizeErrorMessage(err instanceof Error ? err.message : String(err)));
  }
}
