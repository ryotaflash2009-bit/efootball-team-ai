import { BOOSTER_CATALOG, type BoosterDef, type BoosterEvidenceLevel } from "./booster-catalog";

/**
 * ブースターの一覧（NEW-24・2026-10-07）。`booster-catalog.ts` の効果と証拠の段階をそのまま並べる（新しい判定はしない）。
 * - 並び: 証拠の段階（確かなものから）→ 英語名。決定的。
 * - 絞り込み: 対象の能力（World のキー）・名前（大文字・小文字とアクセントを区別しない部分一致）。
 * - ブースターの名前はデータ元の英語の表記（翻訳しない）。
 */
export const EVIDENCE_ORDER: readonly BoosterEvidenceLevel[] = ["game_client_verified", "screenshot_verified", "external_cross_verified", "effect_provisional", "conditional_unverified"];

export interface BoosterListGroup {
  level: BoosterEvidenceLevel;
  boosters: BoosterDef[];
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function buildBoosterList(filter: { stat?: string | null; query?: string | null } = {}, catalog: readonly BoosterDef[] = BOOSTER_CATALOG): BoosterListGroup[] {
  const q = filter.query ? fold(filter.query.trim()) : "";
  const matched = catalog.filter((b) => (!filter.stat || b.affectedStats.includes(filter.stat)) && (!q || fold(b.nameEn).includes(q) || fold(b.key).includes(q)));
  return EVIDENCE_ORDER.map((level) => ({ level, boosters: matched.filter((b) => b.evidenceLevel === level).sort((a, b) => a.nameEn.localeCompare(b.nameEn, "en") || a.key.localeCompare(b.key)) })).filter((g) => g.boosters.length > 0);
}

/** 絞り込みに出す能力（カタログに出てくるものだけ・重複なし・決まった順）。 */
export function boosterStats(catalog: readonly BoosterDef[] = BOOSTER_CATALOG): string[] {
  return [...new Set(catalog.flatMap((b) => b.affectedStats))].sort();
}
