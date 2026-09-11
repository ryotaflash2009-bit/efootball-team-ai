import type { WorldPlayerListItem } from "./types";
import { resolveCardImageSources } from "./image";
import { resolveAttachedBooster } from "@/lib/progression/booster-resolution";
import type { Locale } from "@/lib/i18n/locale";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { translate } from "@/lib/i18n/translate";

/**
 * 選手検索結果カードの表示データ生成（純関数・スカッド検索 / 選手比較検索で共通）。
 *
 *  - 画像解決は既存の `resolveCardImageSources`（外部取得なし・複製保存なし・優先順位はそのまま）。
 *  - 欠損値は別カードから補完しない（`null` のまま返し、表示側で「情報なし」等にする）。
 *  - `0` を欠損扱いしない（`ovrBase: 0` はそのまま `0`）。
 *  - ポジション別 OVR は扱わない。保存済みのカード全体 OVR（`ovrMax` 優先・無ければ `ovrBase`）だけ。
 */

export type SearchBoosterChip =
  | { kind: "fixed"; nameEn: string; level: number; provisional: boolean }
  | { kind: "pom"; nameEn: string; level: number }
  | { kind: "unresolved" };

/**
 * カード付属ブースターの短いチップ情報。
 *  - 解決できた → 固定型(fixed・青) / Power of Many(pom・金)。fixed は `provisional`（＝固定型推定）を持つ。
 *  - ID はあるが対応表に無い → unresolved（未解決）。
 *  - ID なし（0 / null）→ 返さない。
 */
export function boosterChipsForCard(card: { boost1: number | null; boost2: number | null }): SearchBoosterChip[] {
  const out: SearchBoosterChip[] = [];
  for (const [slot, id] of [
    [1, card.boost1] as const,
    [2, card.boost2] as const,
  ]) {
    if (!id) continue;
    const r = resolveAttachedBooster("world", slot, id);
    if (!r) {
      out.push({ kind: "unresolved" });
    } else if (r.activation === "power_of_many") {
      out.push({ kind: "pom", nameEn: r.nameEn, level: r.level });
    } else {
      out.push({
        kind: "fixed",
        nameEn: r.nameEn,
        level: r.level,
        // 発動方式が確定していない（＝「固定型と推定」）
        provisional: !r.activationConfirmed,
      });
    }
  }
  return out;
}

export interface PlayerSearchCardView {
  worldCardId: string;
  /** 表示名（nameJa → nameEn → フォールバック）。 */
  name: string;
  nameEn: string | null;
  nameJa: string | null;
  cardType: string | null;
  registeredPosition: string | null;
  /** 表示 OVR（`ovrMax` 優先・無ければ `ovrBase`・両方 null なら null）。 */
  ovr: number | null;
  ovrMax: number | null;
  ovrBase: number | null;
  maximumLevel: number | null;
  playingStyle: string | null;
  /** チーム・国籍を「 · 」で連結（両方無ければ null）。 */
  teamLine: string | null;
  /** <img src> 候補（優先順位順・空ならプレースホルダー）。 */
  imageSources: string[];
  /** カード画像の alt。 */
  imageAlt: string;
  /** カードを一意に説明するラベル（同名別カードの識別・aria 用）。 */
  identityLabel: string;
  boosterChips: SearchBoosterChip[];
}

export function buildPlayerSearchCardView(player: WorldPlayerListItem, locale: Locale): PlayerSearchCardView {
  const fallback = translate(locale, "squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", player.worldCardId);
  const name = resolvePlayerDisplayName(player, locale, fallback);
  const ovr = player.ovrMax ?? player.ovrBase;
  const teamLine = [player.team, player.nationality].filter((v): v is string => !!v).join(" · ") || null;
  const imageSources = resolveCardImageSources({
    worldCardId: player.worldCardId,
    efhubCardId: player.efhubCardId,
    hasEfhubLink: player.hasEfhubLink,
    hasWorldImage: player.imageUrlCandidate != null && player.imageUrlCandidate !== "",
    hasWorldMobileImage: player.mobileImageUrlCandidate != null && player.mobileImageUrlCandidate !== "",
  });
  const identityLabel = [
    player.cardType ?? translate(locale, "worldPlayerSearchCard", "unknownCardType"),
    player.registeredPosition ?? translate(locale, "worldPlayerSearchCard", "unknownPosition"),
    ovr != null
      ? translate(locale, "worldPlayerSearchCard", "maxOvrTemplate").replace("{value}", String(ovr))
      : translate(locale, "worldPlayerSearchCard", "noOvrInfoLabel"),
    `World ID ${player.worldCardId}`,
  ].join(" / ");

  return {
    worldCardId: player.worldCardId,
    name,
    nameEn: player.nameEn,
    nameJa: player.nameJa,
    cardType: player.cardType,
    registeredPosition: player.registeredPosition,
    ovr,
    ovrMax: player.ovrMax,
    ovrBase: player.ovrBase,
    maximumLevel: player.maximumLevel,
    playingStyle: player.playingStyle,
    teamLine,
    imageSources,
    imageAlt: translate(locale, "worldPlayerSearchCard", "cardImageAltTemplate")
      .replace("{name}", name)
      .replace("{cardType}", player.cardType ?? "")
      .replace(/\s+/g, " ")
      .trim(),
    identityLabel,
    boosterChips: boosterChipsForCard(player),
  };
}
