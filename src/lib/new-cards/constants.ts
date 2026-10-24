/** 「新しいカード」の期間（最近 N 日に追加・2026-10-20 に一か所へまとめた）。/players/new・一覧の NEW の印・トップの件数・API で共通。 */
export const NEW_CARD_DAYS = 7;
/** その期間に追加されるカードの上限の目安（日ごとの枚数が途中で切れないよう多めに）。 */
export const RECENT_LIMIT = 500;

/** 最近 NEW_CARD_DAYS 日に追加されたカードか（追加の時刻が無ければ false）。 */
export function isRecentlyAdded(addedAt: string | null | undefined, now: number = Date.now()): boolean {
  const t = addedAt ? Date.parse(addedAt) : Number.NaN;
  return Number.isFinite(t) && now - t >= 0 && now - t < NEW_CARD_DAYS * 86_400_000;
}

/** 正式なデータの取り込みが止まっていると見なす日数（最近 N 日の正式な追加が空になる日数と同じ・2026-10-24）。 */
export const OFFICIAL_STALE_DAYS = NEW_CARD_DAYS;

/**
 * 正式なデータの取り込みが止まっている日数（止まっていなければ null）。
 * 「最後の取り込み（= 最後に変更を適用した時刻）」だけでは、新しいカードの無い静かな週も止まって見えるため、
 * その後に見つかった暫定のカード（World に無い新しいカード）があるときだけ「止まっている」とする。
 */
export function officialStaleDays(lastImportAt: string | null | undefined, newestProvisionalAt: string | null | undefined, now: number = Date.now()): number | null {
  const t = lastImportAt ? Date.parse(lastImportAt) : Number.NaN;
  const p = newestProvisionalAt ? Date.parse(newestProvisionalAt) : Number.NaN;
  if (!Number.isFinite(t) || !Number.isFinite(p) || p <= t) return null;
  const days = Math.floor((now - t) / 86_400_000);
  return days >= OFFICIAL_STALE_DAYS ? days : null;
}
