import type {
  StatBreakdown,
  BoosterApplicationMode,
  ProgressionResult,
} from "@/lib/progression/types";
import type { WorldStatGroup } from "@/lib/world/types";
import { WORLD_STAT_GROUP_LABELS } from "@/lib/world/stats";
import { statLabelJa } from "@/lib/world/stat-labels";
import { StatBadge } from "@/components/world/StatBadge";

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

const NORMAL_LABEL: Record<BoosterApplicationMode, string> = {
  strict: "厳密最終",
  standard: "標準最終",
  experimental: "標準最終",
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
  const byGroup = new Map<WorldStatGroup, StatBreakdown[]>();
  for (const s of stats) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s);
    byGroup.set(s.group, arr);
  }
  const normalCol = NORMAL_LABEL[mode];
  const condDesc = conditionalSelections.map((c) => `${c.nameEn} ${c.description}`).join(" / ");

  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((g) => {
        const rows = byGroup.get(g);
        if (!rows || rows.length === 0) return null;
        return (
          <section key={g} className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[440px] text-sm">
              <caption className="bg-surface-2/50 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-text-dim">
                {WORLD_STAT_GROUP_LABELS[g]}
              </caption>
              <thead className="text-left text-[11px] text-text-dim">
                <tr>
                  <th className="px-3 py-1 font-medium">能力値</th>
                  <th className="px-2 py-1 text-right font-medium">基礎</th>
                  <th className="px-2 py-1 text-right font-medium">育成</th>
                  <th className="px-2 py-1 text-right font-medium">選手B</th>
                  {showConditional ? (
                    <th className="px-2 py-1 text-right font-medium text-accent">条件指定</th>
                  ) : null}
                  <th className="px-2 py-1 text-right font-medium">監督</th>
                  <th className="px-3 py-1 text-right font-medium">{normalCol}</th>
                  {showConditional ? (
                    <th className="px-3 py-1 text-right font-medium text-accent">条件反映後</th>
                  ) : null}
                  {showExperimental ? (
                    <>
                      <th className="px-2 py-1 text-right font-medium text-yellow-300/80">試算B</th>
                      <th className="px-3 py-1 text-right font-medium text-yellow-300/80">試算最終</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const bs = byStat?.[s.key];
                  const boosterBreakdownParts: string[] = [];
                  if (bs?.gameMeasured) boosterBreakdownParts.push(`実測+${bs.gameMeasured}`);
                  if (bs?.externalVerified) boosterBreakdownParts.push(`外部照合+${bs.externalVerified}`);
                  if (bs?.confirmedB2) boosterBreakdownParts.push(`確認済みB2+${bs.confirmedB2}`);
                  const showBoosterBreakdown = boosterBreakdownParts.length >= 2;
                  return (
                    <tr key={s.key} className="border-t border-border/60">
                      <td className="px-3 py-1.5" title={s.nameEn}>{statLabelJa(s.key)}</td>
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
                        {s.capApplied ? <span className="ml-1 text-[9px] text-yellow-300/80">上限</span> : null}
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
                            <span className="ml-1 text-[9px] text-yellow-300/80">上限</span>
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
                              <span className="ml-1 text-[9px] text-yellow-300/80">上限</span>
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
          列: 基礎 / 育成 / 選手B{showConditional ? " / 条件指定" : ""} / 監督 / <b>{normalCol}</b>
          {showConditional ? " / 条件反映後" : ""}
          {showExperimental ? " / 試算B / 試算最終" : ""}。
        </p>
        {mode === "strict" ? (
          <p>
            <b>厳密最終</b> = 基礎 + 育成 + <b>ユーザー保存済みスクリーンショットで実測できたカード付属ブースター</b>（現状 2 種）+ 監督補正。
          </p>
        ) : (
          <p>
            <b>標準最終</b> = 基礎 + 育成 + カード付属ブースター（スクリーンショット実測 2 種 ＋ eFootball World と EFScout の外部2ソースで整合 27 種）+ 確認済みB2（ユーザーが手動選択した確認済みブースター）+ 監督補正。
            <b className="text-info"> KONAMI 公式の計算結果として確認された値ではありません。</b>
          </p>
        )}
        {showConditional ? (
          <p className="text-accent">
            <b>条件反映後</b> = 標準最終 + 金色・可変ブースターのユーザー指定段階（その効果名の対象能力へだけ）。{condDesc}。
            <b>この値はユーザーが自身の Game Plan を確認して指定したものです。アプリが編成人数を自動検証した値ではありません。</b>
            標準最終値とは別の値です。
          </p>
        ) : null}
        {showExperimental ? (
          <p className="text-yellow-300/80">
            <b>試算最終</b> = 標準最終 + 検証中の付属ブースター + 条件手動指定 + 未確認の手動試算（B2）。確認済みB2は標準最終に含めているため二重加算しません。<b>ゲーム内の正式値ではありません。</b>
          </p>
        ) : (
          <p>効果検証中・金色の可変ブースター（未指定時）・未解決の付属ブースターと未確認の手動試算（B2）は含めません（実験モードで別表示）。架空の上昇量は生成しません。</p>
        )}
        <p>「監督」= 選択した監督のブースター効果（複数ソースで確認済みのもののみ）。</p>
      </div>
    </div>
  );
}
