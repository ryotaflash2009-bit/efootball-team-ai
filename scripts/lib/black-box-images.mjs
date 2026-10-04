/**
 * 一覧の選手画像の読み込みの契約（2026-10-04 から）。SSR の HTML で確認する。
 *
 * - 最初の画面の数枚（最大 4 枚）だけ <img loading="eager"> ですぐに読み込む。
 * - 残りは画面の近くに来てから <img> を置く（WorldCardImage）。SSR では aria-label つきの枠（role="img"）だけ。
 * - 以前の「すべて loading="lazy"」はブラウザーが画面から遠い画像まで読み込み、一覧で約 4MB になっていた（計測）。
 *   「画面外の画像を先に読み込まない」という目的は同じで、より厳しくした。
 */
export const MAX_EAGER_LIST_IMAGES = 4;

export function listImageLoading(html) {
  const imgs = html.match(/<img\b[^>]*\/api\/(?:world\/)?player-image\/[^>]*>/g) ?? [];
  const eager = imgs.filter((t) => /loading="eager"/.test(t)).length;
  const lazy = imgs.filter((t) => /loading="lazy"/.test(t)).length;
  const deferred = (html.match(/<span role="img" aria-label="[^"]*" class="absolute inset-0"><\/span>/g) ?? []).length;
  const ok = imgs.length === eager + lazy && eager <= MAX_EAGER_LIST_IMAGES && deferred + lazy > 0;
  return { ok, eager, lazy, deferred, detail: `eager ${eager} / lazy ${lazy} / deferred ${deferred}` };
}
