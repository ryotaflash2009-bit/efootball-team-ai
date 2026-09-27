import type {
  StatBreakdown,
  BoosterApplicationMode,
  ProgressionResult,
} from "@/lib/progression/types";
import type { WorldStatGroup } from "@/lib/world/types";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { StatBadge } from "@/components/world/StatBadge";
import { localizeLibText } from "@/lib/progression/lib-text-en";

/**
 * 育成前後の能力値比較。
 *  厳密モード: 基礎/育成/選手B/監督/厳密最終
 *  標準モード（既定）: 基礎/育成/選手B/監督/標準最終
 *  実験モード: 上記 + 試算B/試算最終（ゲーム内の正式値ではない）
 *  条件手動指定時: 標準最終 と 条件反映後 を別列で表示（同じものとして表示しない）。
 * 「確認済み」の一語で参考画面の実測確認と外部照合を混同しない。
 */
const GROUP_ORDER: WorldStatGroup[] = ["offense", "defense", "physical", "gk"];

type ByStat = Record<
  string,
  {
    gameMeasured: number;
    externalVerified: number;
    conditional: number;
    manualTrial: number;
    confirmedB2: number;
    experimentalExtra: number;
  }
>;

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-text-dim/50">±0</span>;
  const positive = value > 0;
  return (
    <span className={positive ? "text-lime-300" : "text-danger"}>
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

const NORMAL_LABEL: Record<BoosterApplicationMode, keyof Dictionary["progressionTab"]> = {
  strict: "anStrictFinal",
  standard: "anStandardFinal",
  experimental: "anStandardFinal",
};

const GROUP_LABEL: Record<WorldStatGroup, keyof Dictionary["abilityEditor"]> = {
  offense: "groupOffense",
  defense: "groupDefense",
  physical: "groupPhysical",
  gk: "groupGk",
};

export function StatComparison({
  stats,
  byStat,
  mode = "standard",
  showExperimental = false,
  showConditional = false,
  conditionalSelections = [],
}: {
  stats: StatBreakdown[];
  byStat?: ByStat;
  mode?: BoosterApplicationMode;
  showExperimental?: boolean;
  /** Total Package の条件段階を手動指定していて「条件反映後」列を出すか。 */
  showConditional?: boolean;
  conditionalSelections?: ProgressionResult["booster"]["conditionalSelections"];
}) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const { locale } = useLocale();
  const byGroup = new Map<WorldStatGroup, StatBreakdown[]>();
  for (const s of stats) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s);
    byGroup.set(s.group, arr);
  }
  const normalCol = tp(NORMAL_LABEL[mode]);
  const condDesc = conditionalSelections.map((c) => `${c.nameEn} ${localizeLibText(c.description, locale)}`).join(" / ");

  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((g) => {
        const rows = byGroup.get(g);
        if (!rows || rows.length === 0) return null;
        return (
          <section key={g} className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[440px] text-sm">
              <caption className="bg-surface-2/50 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-text-dim">
                {t("abilityEditor", GROUP_LABEL[g])}
              </caption>
              <thead className="text-left text-[11px] text-text-dim">
                <tr>
                  <th className="px-3 py-1 font-medium">{tp("anColAbility")}</th>
                  <th className="px-2 py-1 text-right font-medium">{tp("anColBase")}</th>
                  <th className="px-2 py-1 text-right font-medium">{tp("anColProgression")}</th>
                  <th className="px-2 py-1 text-right font-medium">{tp("anColPlayerB")}</th>
                  {showConditional ? (
                    <th className="px-2 py-1 text-right font-medium text-accent">{tp("anColConditional")}</th>
                  ) : null}
                  <th className="px-2 py-1 text-right font-medium">{tp("anColManager")}</th>
                  <th className="px-3 py-1 text-right font-medium">{normalCol}</th>
                  {showConditional ? (
                    <th className="px-3 py-1 text-right font-medium text-accent">{tp("anColAfterConditional")}</th>
                  ) : null}
                  {showExperimental ? (
                    <>
                      <th className="px-2 py-1 text-right font-medium text-yellow-300/80">{tp("anColTrialB")}</th>
                      <th className="px-3 py-1 text-right font-medium text-yellow-300/80">{tp("anColTrialFinal")}</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const bs = byStat?.[s.key];
                  const boosterBreakdownParts: string[] = [];
                  if (bs?.gameMeasured) boosterBreakdownParts.push(tp("anMeasuredPlus").replace("{n}", String(bs.gameMeasured)));
                  if (bs?.externalVerified) boosterBreakdownParts.push(tp("anExternalPlus").replace("{n}", String(bs.externalVerified)));
                  if (bs?.confirmedB2) boosterBreakdownParts.push(tp("anConfirmedB2Plus").replace("{n}", String(bs.confirmedB2)));
                  const showBoosterBreakdown = boosterBreakdownParts.length >= 2;
                  return (
                    <tr key={s.key} className="border-t border-border/60">
                      <td className="px-3 py-1.5" title={s.nameEn}>{abilityName(s.key, locale)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text-dim">{s.baseValue}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        <Delta value={s.progressionDelta} />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        <Delta value={s.playerBoosterDelta} />
                        {showBoosterBreakdown ? (
                          <span className="ml-1 block text-[9px] text-text-dim">
                            {boosterBreakdownParts.join(" / ")}
                          </span>
                        ) : null}
                      </td>
                      {showConditional ? (
                        <td className="px-2 py-1.5 text-right tabular-nums text-accent">
                          <Delta value={s.conditionalBoosterDelta} />
                        </td>
                      ) : null}
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        <Delta value={s.managerBoosterDelta} />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <StatBadge value={s.finalValue} />
                        {s.capApplied ? <span className="ml-1 text-[9px] text-yellow-300/80">{tp("anCap")}</span> : null}
                      </td>
                      {showConditional ? (
                        <td className="px-3 py-1.5 text-right">
                          <span
                            className={`tabular-nums ${
                              s.conditionalFinalValue !== s.standardFinalValue
                                ? "font-bold text-accent"
                                : "text-text-dim"
                            }`}
                          >
                            {s.conditionalFinalValue}
                          </span>
                          {s.conditionalCapApplied ? (
                            <span className="ml-1 text-[9px] text-yellow-300/80">{tp("anCap")}</span>
                          ) : null}
                        </td>
                      ) : null}
                      {showExperimental ? (
                        <>
                          <td className="px-2 py-1.5 text-right tabular-nums text-yellow-300/90">
                            <Delta value={s.experimentalPlayerBoosterDelta} />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span
                              className={`tabular-nums ${
                                s.experimentalFinalValue !== s.finalValue ? "font-bold text-yellow-300" : "text-text-dim"
                              }`}
                            >
                              {s.experimentalFinalValue}
                            </span>
                            {s.experimentalCapApplied ? (
                              <span className="ml-1 text-[9px] text-yellow-300/80">{tp("anCap")}</span>
                            ) : null}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
      <div className="space-y-1 text-[10px] text-text-dim/70">
        <p>
          {tp("anColumnsLabel")}
          {tp("anColBase")} / {tp("anColProgression")} / {tp("anColPlayerB")}
          {showConditional ? ` / ${tp("anColConditional")}` : ""} / {tp("anColManager")} / <b>{normalCol}</b>
          {showConditional ? ` / ${tp("anColAfterConditional")}` : ""}
          {showExperimental ? ` / ${tp("anColTrialB")} / ${tp("anColTrialFinal")}` : ""}
          {tp("anPeriod")}
        </p>
        {mode === "strict" ? (
          <p>
            <b>{tp("anStrictFinal")}</b>
            {tp("anStrictFormulaA")}
            <b>{tp("anStrictBold")}</b>
            {tp("anStrictFormulaB")}
          </p>
        ) : (
          <p>
            <b>{tp("anStandardFinal")}</b>
            {tp("anStandardFormula")}
            <b className="text-info">{tp("anStandardNotOfficial")}</b>
          </p>
        )}
        {showConditional ? (
          <p className="text-accent">
            <b>{tp("anColAfterConditional")}</b>
            {tp("anCondFormula")}
            {condDesc}
            {tp("anPeriod")}
            <b>{tp("anCondUserSpecified")}</b>
            {tp("anCondSeparate")}
          </p>
        ) : null}
        {showExperimental ? (
          <p className="text-yellow-300/80">
            <b>{tp("anColTrialFinal")}</b>
            {tp("anTrialFormula")}
            <b>{tp("anTrialNotOfficial")}</b>
          </p>
        ) : (
          <p>{tp("anExcludedNote")}</p>
        )}
        <p>{tp("anManagerNote")}</p>
      </div>
    </div>
  );
}
