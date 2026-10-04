"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import type { PlayerAnalysis } from "@/lib/world/player-analysis";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 選手スキル + AI・COM プレースタイル（能力値一覧の下＝中央カラム）。
 *  - データは `buildPlayerAnalysis` の整形結果を再利用（取得・重複除去は済んでいる）。
 *  - Highlight Skill / Skill FX の判別情報が無いため、すべて「選手スキル」として表示（推測分類しない）。
 *  - 右レールと二重表示しない（このコンポーネントだけがスキルを描画する）。
 */
export function PlayerSkillsPanel({ skills }: { skills: PlayerAnalysis["skills"] }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const aiList = skills.aiStyles.length > 0 ? skills.aiStyles : skills.comSkillsFallback;

  return (
    <section className="rounded-md border border-border bg-surface p-3">
      <SectionHeader title={tp("anSkillsTitle")} as="h3" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-2xs font-semibold text-text-dim">{tp("anPlayerSkillsCount").replace("{n}", String(skills.playerSkills.length))}</p>
          {skills.playerSkills.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {skills.playerSkills.map((s) => (
                <li key={s}>
                  <Badge tone="neutral" size="xs">
                    {s}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-text-muted">{tp("anNoSkills")}</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-2xs font-semibold text-text-dim">{tp("anAiStylesCount").replace("{n}", String(aiList.length))}</p>
          {aiList.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {aiList.map((s) => (
                <li key={s}>
                  <Badge tone="accent" size="xs">
                    {s}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-text-muted">{tp("anNoAiStyles")}</p>
          )}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-text-muted">{tp("anSkillsNote")}</p>
    </section>
  );
}
