/**
 * World 選手画像の表示ソース解決（純関数のみ）。
 *
 * 優先順位（docs/phase-world-ui-plan.md §7 / 修正版）:
 *  1. eFHUB と高信頼リンクがある → 既存 `/api/player-image/{efhubId}`（efimg.com・既承認）
 *  2. World 側に保存済みの有効な画像 URL がある → World 画像プロキシ `/api/world/player-image/{worldCardId}`
 *     （プロキシ内部で通常画像 → モバイル画像の順に試す）
 *  3. どれも使えないとき → ローカル SVG プレースホルダー（コンポーネント側）
 *
 * eFHUB リンクが無いことだけを理由にプレースホルダーへ即断しない。
 */

import { WORLD_IMAGE_HOST } from "./player-image";

export { WORLD_IMAGE_HOST };

/**
 * 保存済み URL が API レスポンスの候補として妥当か（https・既知ホスト・クエリ/フラグメントなし・画像拡張子）。
 */
export function isDisplayableWorldImageUrl(url: string | null | undefined): boolean {
  if (typeof url !== "string" || url === "") return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    u.host === WORLD_IMAGE_HOST &&
    u.search === "" &&
    u.hash === "" &&
    /\.(webp|png|jpg|jpeg|avif)$/i.test(u.pathname)
  );
}

/** eFHUB 画像プロキシで使える ID か（数字のみ 1〜20 桁） */
export function isEfhubImageId(id: string | null | undefined): id is string {
  return typeof id === "string" && /^[0-9]{1,20}$/.test(id);
}

const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;

/**
 * カードに対して <img src> の候補を優先順位順で返す。
 * コンポーネントは先頭から順に試し、すべて失敗したらプレースホルダーへ。
 * 空配列ならプレースホルダー。
 */
export function resolveCardImageSources(input: {
  worldCardId: string;
  efhubCardId: string | null;
  hasEfhubLink: boolean;
  hasWorldImage: boolean;
  hasWorldMobileImage: boolean;
}): string[] {
  const sources: string[] = [];

  if (input.hasEfhubLink && isEfhubImageId(input.efhubCardId)) {
    sources.push(`/api/player-image/${encodeURIComponent(input.efhubCardId)}`);
  }

  if (WORLD_CARD_ID_RE.test(input.worldCardId)) {
    if (input.hasWorldImage) {
      // 通常画像。プロキシが通常→モバイルの順で試す。
      sources.push(`/api/world/player-image/${encodeURIComponent(input.worldCardId)}`);
    } else if (input.hasWorldMobileImage) {
      sources.push(
        `/api/world/player-image/${encodeURIComponent(input.worldCardId)}?variant=mobile`,
      );
    }
  }

  return sources;
}
