/** 「新しいカード」の期間（最近 N 日に追加・2026-10-20 に一か所へまとめた）。/players/new・一覧の NEW の印・トップの件数・API で共通。 */
export const NEW_CARD_DAYS = 7;
/** その期間に追加されるカードの上限の目安（日ごとの枚数が途中で切れないよう多めに）。 */
export const RECENT_LIMIT = 500;

/** 最近 NEW_CARD_DAYS 日に追加されたカードか（追加の時刻が無ければ false）。 */
export function isRecentlyAdded(addedAt: string | null | undefined, now: number = Date.now()): boolean {
  const t = addedAt ? Date.parse(addedAt) : Number.NaN;
  return Number.isFinite(t) && now - t >= 0 && now - t < NEW_CARD_DAYS * 86_400_000;
}
