"use client";

import "@/lib/i18n/dictionaries/ja-ns/basePercentile";
import "@/lib/i18n/dictionaries/ja-ns/titles";
import { useMemo } from "react";
import type { WorldStatValue } from "@/lib/world/types";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { useWorldBasePercentiles } from "@/lib/percentiles/use-world-base-percentiles";
import { cardBasePercentiles, scopeKeyFor } from "@/lib/percentiles/card-percentiles";
import { evaluatePlayerTitles, type PlayerTitle, type PlayerTitleRuleId } from "@/lib/titles/player-titles";
import { BUCKET_LABEL_KEY } from "@/components/world/WorldBasePercentilePanel";
import { TitleStrip, type TitleItem } from "./TitleStrip";

type TKey = keyof Dictionary["titles"];
export const RULE_LABEL_KEY: Record<PlayerTitleRuleId, TKey> = {
  pace: "rulePace",
  finishing: "ruleFinishing",
  dribbling: "ruleDribbling",
  passing: "rulePassing",
  setPieces: "ruleSetPieces",
  aerial: "ruleAerial",
  ballWinning: "ruleBallWinning",
  physicality: "rulePhysicality",
  stamina: "ruleStamina",
  shotStopping: "ruleShotStopping",
  handling: "ruleHandling",
  gkAwareness: "ruleGkAwareness",
};

/**
 * F-072: 選手詳細の称号・バッジ。F-071 の分布が照合できないときは何も表示しない（照合できない旨はパーセンタイルの枠が出す）。
 */
export function PlayerTitles({ stats, registeredPosition }: { stats: WorldStatValue[]; registeredPosition: string | null }) {
  const t = useT();
  const { locale } = useLocale();
  const data = useWorldBasePercentiles();
  const scopeKey = scopeKeyFor("role", registeredPosition);
  const result = useMemo(() => {
    if (data.state !== "ready" || !scopeKey) return null;
    return evaluatePlayerTitles(scopeKey === "gk" ? "gk" : "field", cardBasePercentiles(data.scopes.get(scopeKey), stats));
  }, [data, scopeKey, stats]);
  if (!result) return null;

  const scopeName = result.role === "gk" ? t("basePercentile", "scopeGk") : t("basePercentile", "scopeField");
  const toItem = (x: PlayerTitle): TitleItem => ({
    id: x.ruleId,
    label: t("titles", RULE_LABEL_KEY[x.ruleId]),
    reason: x.evidence.map((e) => `${abilityName(e.statKey, locale)} ${t("basePercentile", BUCKET_LABEL_KEY[e.bucket])}`).join(" / "),
  });
  return (
    <div className="mb-3" data-testid="player-titles-wrap">
      <TitleStrip
        testId="player-titles"
        primary={result.primary ? toItem(result.primary) : null}
        badges={result.badges.map(toItem)}
        explanation={t("titles", "playerExplanationTemplate").replace("{scope}", scopeName)}
        rulesVersion={result.rulesVersion}
      />
    </div>
  );
}
