/**
 * サインアップ/パスワード更新で使うパスワード強度ルール(純関数)。
 *
 * Supabaseダッシュボード側で設定済みの「12文字以上・小文字/大文字/数字/記号を必須」という
 * ポリシーと同じ基準をクライアント側でも事前検証する(二重チェック)。
 * ここでは入力されたパスワードの値そのものを返り値に含めない(不合格理由のコードのみ)。
 */

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRuleFailure =
  | "TOO_SHORT"
  | "MISSING_LOWERCASE"
  | "MISSING_UPPERCASE"
  | "MISSING_DIGIT"
  | "MISSING_SYMBOL";

const LOWERCASE_RE = /[a-z]/;
const UPPERCASE_RE = /[A-Z]/;
const DIGIT_RE = /[0-9]/;
/** 英数字以外を「記号」として扱う(スペースも記号扱い)。 */
const SYMBOL_RE = /[^A-Za-z0-9]/;

/** 不合格理由の一覧を返す(空配列なら合格)。値そのものは含めない。 */
export function validatePasswordRules(password: string): PasswordRuleFailure[] {
  const failures: PasswordRuleFailure[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) failures.push("TOO_SHORT");
  if (!LOWERCASE_RE.test(password)) failures.push("MISSING_LOWERCASE");
  if (!UPPERCASE_RE.test(password)) failures.push("MISSING_UPPERCASE");
  if (!DIGIT_RE.test(password)) failures.push("MISSING_DIGIT");
  if (!SYMBOL_RE.test(password)) failures.push("MISSING_SYMBOL");
  return failures;
}

export function isPasswordValid(password: string): boolean {
  return validatePasswordRules(password).length === 0;
}

/** 簡易的なメールアドレス形式チェック(厳密なRFC準拠ではなく、明らかな誤入力の検出用)。 */
export function isValidEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
