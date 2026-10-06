import type { Locale } from "@/lib/i18n/locale";
import type { DisplayLocale } from "@/lib/i18n/locale-registry";
import { getStatDef } from "@/lib/world/stats";
import { groupLabelJa, statLabelJa } from "@/lib/world/stat-labels";
import { getGroupDef } from "./stat-groups";
import { localizedAbilityName, localizedGroupName } from "@/lib/i18n/game-terms";

/**
 * 能力値直接操作UIの表示名（言語別）。日本語は stat-labels.ts、英語は stats.ts / stat-groups.ts の正式名を使う。
 * 日本語画面に英語の内部キーを出さない・英語画面に日本語を混ぜないための唯一の入口。
 */
export function abilityName(statKey: string, locale: Locale | DisplayLocale): string {
  return locale === "ja" ? statLabelJa(statKey) : localizedAbilityName(statKey, locale) ?? getStatDef(statKey)?.nameEn ?? statKey;
}

export function categoryName(groupId: string, locale: Locale | DisplayLocale): string {
  return locale === "ja" ? groupLabelJa(groupId) : localizedGroupName(groupId, locale) ?? getGroupDef(groupId)?.nameEn ?? groupId;
}

/** カテゴリの表示色（CSS 変数名）。未知のカテゴリは accent。 */
export function categoryColorVar(groupId: string): string {
  return getGroupDef(groupId) ? `--cat-${groupId}` : "--color-accent-rgb";
}
