/**
 * 確認メール再送信の待機時間(クールダウン)を計算する純関数群。
 *
 * Supabase公式のOTP/メール系リンクの既定レート制限が「同一ユーザーへ60秒間隔」であることに
 * 合わせ、このアプリのUI側も60秒の連打防止・待機表示を行う(Supabase側の実際の制限を
 * 正本とし、このUI側の60秒はあくまで「明らかな連打」を防ぐための表示上のガードに過ぎない。
 * ページ再読み込みなどでの完全な回避を防止できるとは保証しない)。
 */

export const RESEND_COOLDOWN_SECONDS = 60;

/** 直前送信時刻(ms)と現在時刻(ms)から、残り待機秒数を返す(0以下なら送信可能)。 */
export function getRemainingCooldownSeconds(lastSentAtMs: number | null, nowMs: number): number {
  if (lastSentAtMs === null) return 0;
  const elapsedSeconds = (nowMs - lastSentAtMs) / 1000;
  const remaining = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
  return remaining > 0 ? Math.ceil(remaining) : 0;
}

export function canResendNow(lastSentAtMs: number | null, nowMs: number): boolean {
  return getRemainingCooldownSeconds(lastSentAtMs, nowMs) <= 0;
}
