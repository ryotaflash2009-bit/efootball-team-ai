import { readFileSync } from "node:fs";
import type { GuardCheck } from "./real-import-guards";

/**
 * 実Supabase(PostgreSQL Session pooler)へのSSL/TLS接続設定を組み立てる純関数群。
 *
 * 設計上の絶対条件(緩めない):
 *   - `rejectUnauthorized`は常に`true`固定。falseを返す経路は存在しない。
 *   - `NODE_TLS_REJECT_UNAUTHORIZED`のような環境変数やグローバル設定には一切触れない。
 *   - ホスト名検証(`checkServerIdentity`)は上書きしない(Node標準の検証をそのまま使う)。
 *   - CA証明書の「内容」はログ・戻り値の説明文字列に一切含めない(バイト数等のメタ情報のみ)。
 *
 * "self-signed certificate in certificate chain" エラーの原因:
 *   Supabase Session poolerが提示する証明書チェーンの終端CAが、Node.jsの既定バンドルCA
 *   (Mozilla CAストア相当)に含まれていないため。`rejectUnauthorized: true`のままCA証明書だけを
 *   明示的に指定する(Supabase公式が提供するプロジェクト固有のCA証明書)ことで、
 *   検証を緩めずに解決する。
 */

export interface PgSslConfig {
  rejectUnauthorized: true;
  ca?: string;
}

/**
 * CA証明書のパスが指定されていることを確認する(実接続前の必須チェック)。
 * Supabase Session poolerの証明書チェーンがNode既定のCAストアに含まれない環境があり、
 * その場合は"self-signed certificate in certificate chain"で実接続が失敗するため、
 * `--validate-only`/`--execute`いずれの経路でもCA証明書パスの指定を必須とする
 * (初回投入ツール・差分投入ツールの両方に同じ条件を適用する)。
 * パスの値自体はreasonに含めない(reasonは常に定型文)。
 */
export function checkCaCertPathProvided(caCertPath: string | undefined | null): GuardCheck {
  if (!caCertPath || caCertPath.trim() === "") {
    return {
      ok: false,
      reason: "CA証明書のパスが指定されていない(実接続にはCA証明書の指定が必須。--CaCertPathでSupabase公式のCA証明書ファイルを指定すること)",
    };
  }
  return { ok: true };
}

/** CA証明書ファイルを読み込む(内容はそのまま返すが、呼び出し側はログへ出力しないこと)。 */
export function loadCaCertificateFromFile(path: string): string {
  const content = readFileSync(path, "utf8");
  if (!content.includes("BEGIN CERTIFICATE")) {
    throw new Error("指定されたファイルはPEM形式のCA証明書として認識できない(BEGIN CERTIFICATEが見つからない)");
  }
  return content;
}

/**
 * SSL設定を組み立てる。CA証明書が渡されなかった場合もrejectUnauthorizedはtrueのまま
 * (Node既定のCAストアで検証を続行する。安全側にフォールバックし、検証無効化はしない)。
 */
export function buildPgSslConfig(caCertPem?: string | null): PgSslConfig {
  if (caCertPem && caCertPem.trim() !== "") {
    return { rejectUnauthorized: true, ca: caCertPem };
  }
  return { rejectUnauthorized: true };
}

/** ログ・画面表示に安全な説明文字列(証明書の中身は一切含めない)。 */
export function describeSslConfigForLog(config: PgSslConfig): string {
  if (config.ca) {
    return `rejectUnauthorized=true, CA証明書=指定あり(${config.ca.length}バイト、内容は非表示)`;
  }
  return "rejectUnauthorized=true, CA証明書=指定なし(Node既定のCAストアを使用)";
}
