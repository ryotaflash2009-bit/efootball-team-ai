/** 「新しいカード」の期間（最近 N 日に追加・2026-10-20 に一か所へまとめた）。/players/new・一覧の NEW の印・トップの件数・API で共通。 */
export const NEW_CARD_DAYS = 7;
/** その期間に追加されるカードの上限の目安（日ごとの枚数が途中で切れないよう多めに）。 */
export const RECENT_LIMIT = 500;

/** 最近 NEW_CARD_DAYS 日に追加されたカードか（追加の時刻が無ければ false）。 */
export function isRecentlyAdded(addedAt: string | null | undefined, now: number = Date.now()): boolean {
  const t = addedAt ? Date.parse(addedAt) : Number.NaN;
  return Number.isFinite(t) && now - t >= 0 && now - t < NEW_CARD_DAYS * 86_400_000;
}

/** 正式なデータの取り込みが止まっていると見なす日数（これより長いと /players/new に案内・2026-10-24）。 */
export const OFFICIAL_STALE_DAYS = 7;

/** 最後の取り込みからの日数（OFFICIAL_STALE_DAYS より長いときだけ・それ以外は null）。 */
export function officialStaleDays(lastImportAt: string | null | undefined, now: number = Date.now()): number | null {
  const t = lastImportAt ? Date.parse(lastImportAt) : Number.NaN;
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now - t) / 86_400_000);
  return days > OFFICIAL_STALE_DAYS ? days : null;
}
