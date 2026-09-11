import { WORLD_CARD_ID_RE, BUILD_ID_RE } from "./types";

/**
 * My Team の「スカッドで使用」からスカッド選択・スカッド編集画面へ引き継ぐ「追加予定」情報の
 * URLクエリパラメーター(`?card=`・`?build=`)を検証する純関数。
 *
 * - カードとビルドは常にセットで扱う: `card` が無効ならビルドIDも無視する(孤立したビルドIDだけを
 *   引き継がない)。ビルドは省略可能(My Team側で保存ビルドを選んでいなかった場合は null のままでよい)。
 * - JSON全体やその他の内部データをURLへ含めない。値はこの2つのIDのみ。
 * - 形式が既存のワールドカードID・保存ビルドIDの正規表現と一致しない場合は安全に無視する
 *   (存在しないスカッドやビルドを不正に参照できないようにする最初の防御)。
 */
export interface PendingSquadAddition {
  worldCardId: string | null;
  buildId: string | null;
}

export function resolvePendingSquadAddition(
  cardParam: string | null | undefined,
  buildParam: string | null | undefined,
): PendingSquadAddition {
  const worldCardId = typeof cardParam === "string" && WORLD_CARD_ID_RE.test(cardParam) ? cardParam : null;
  if (!worldCardId) return { worldCardId: null, buildId: null };
  const buildId = typeof buildParam === "string" && BUILD_ID_RE.test(buildParam) ? buildParam : null;
  return { worldCardId, buildId };
}

/** `resolvePendingSquadAddition` の結果から、次の画面へ引き継ぐクエリ文字列(先頭`?`つき、無ければ空文字)を作る。 */
export function pendingSquadAdditionQuery(addition: PendingSquadAddition): string {
  if (!addition.worldCardId) return "";
  const card = `card=${encodeURIComponent(addition.worldCardId)}`;
  const build = addition.buildId ? `&build=${encodeURIComponent(addition.buildId)}` : "";
  return `?${card}${build}`;
}
