"use client";

import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import type { SquadDiagnosisTier } from "@/lib/squad/squad-diagnosis";
import { evaluateDiagnosisTitles, type DiagnosisTitle, type DiagnosisTitleCategory } from "@/lib/titles/diagnosis-titles";
import { diagnosisCategoryLabel } from "@/components/squad/SharedDiagnosisView";
import { TitleStrip, type TitleItem } from "./TitleStrip";

type TKey = keyof Dictionary["titles"];
const LABEL_KEY: Record<DiagnosisTitleCategory, TKey> = {
  counterAttack: "dgCounterAttack",
  passBuildUp: "dgPassBuildUp",
  dribblePossession: "dgDribblePossession",
  pressResistance: "dgPressResistance",
  speed: "dgSpeed",
  aerial: "dgAerial",
  attack: "dgAttack",
  defense: "dgDefense",
};

/** F-072: スカッド診断（結果画面・共有カード）のスタイル称号とバッジ。 */
export function DiagnosisTitles({
  categories,
}: {
  categories: Partial<Record<string, readonly [number | null, SquadDiagnosisTier | null] | { score: number | null; tier: SquadDiagnosisTier | null }>>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const result = evaluateDiagnosisTitles(categories);
  const toItem = (x: DiagnosisTitle): TitleItem => ({
    id: x.categoryId,
    label: t("titles", LABEL_KEY[x.categoryId]),
    reason: t("titles", "diagnosisReasonTemplate")
      .replace("{category}", diagnosisCategoryLabel(x.categoryId, locale))
      .replace("{score}", String(x.score))
      .replace("{tier}", x.tier),
  });
  return (
    <TitleStrip
      testId="diagnosis-titles"
      primary={result.primary ? toItem(result.primary) : null}
      badges={result.badges.map(toItem)}
      explanation={t("titles", "diagnosisExplanation")}
      rulesVersion={result.rulesVersion}
    />
  );
}
