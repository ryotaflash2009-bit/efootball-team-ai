/**
 * PostgreSQLのSCRAM-SHA-256 password verifier(RFC 5802 / PostgreSQLの保存形式)を計算する純関数。
 *
 * `ALTER ROLE ... PASSWORD '<verifier>'` にverifierを渡すと、PostgreSQLは平文passwordを受け取らずに
 * そのverifierをそのまま保存する。これにより、平文passwordがSupabase SQL Editorの入力・履歴に残らない。
 * verifierはpasswordのhashに相当するため、秘密情報として扱い、チャット・Git・ログへ出さない。
 */
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

export const SCRAM_ITERATIONS = 4096;
export const MIN_PASSWORD_LENGTH = 24;

/** SASLprepの差異を避けるため、印字可能なASCIIだけを受け付ける(空白を含まない)。 */
export function validatePasswordForScram(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return `passwordは${MIN_PASSWORD_LENGTH}文字以上が必要`;
  if (!/^[\x21-\x7e]+$/.test(password)) return "passwordは空白を含まない印字可能なASCII文字だけにする";
  if (/['\\]/.test(password)) return "passwordにシングルクォート・バックスラッシュを使わない";
  return null;
}

export function buildScramSha256Verifier(password, salt = randomBytes(16), iterations = SCRAM_ITERATIONS) {
  const problem = validatePasswordForScram(password);
  if (problem) throw new Error(problem);
  const salted = pbkdf2Sync(Buffer.from(password, "utf8"), salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

export function buildAlterRolePasswordSql(roleName, verifier) {
  if (!/^[a-z_][a-z0-9_]*$/.test(roleName)) throw new Error("role名が不正");
  if (!/^SCRAM-SHA-256\$\d+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(verifier)) throw new Error("verifierの形式が不正");
  return `alter role ${roleName} with password '${verifier}';`;
}
