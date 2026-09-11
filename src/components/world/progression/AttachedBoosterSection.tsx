"use client";

import type {
  PlayerBoosterInfo,
  SelectedConditionalBooster,
  SelectedPlayerBooster,
  ConditionalBoosterSelection,
} from "@/lib/progression/types";
import { statListJa } from "@/lib/world/stat-labels";
import { Badge } from "@/components/ui/Badge";
import { ConditionalBoosterControl } from "./ConditionalBoosterControl";

/** 発動方式の証拠レベル → 短い日本語ラベル。 */
function activationEvidenceLabel(ev: PlayerBoosterInfo["activationEvidence"]): string {
  switch (ev) {
    case "official_verified":
      return "KONAMI 公式で明記";
    case "screenshot_verified":
      return "ユーザー提供の画面で確認";
    case "external_cross_verified":
      return "外部2ソースで整合";
    case "conflicted":
      return "証拠が矛盾";
    case "unresolved":
      return "未確認";
    default:
      return "推定（状況証拠のみ）";
  }
}

/** 証拠レベル → 表示ラベル・色。「確認済み」の一語で参考画面の実測と外部照合を混同しない。 */
function evidenceBadge(b: PlayerBoosterInfo): { text: string; tone: "success" | "info" | "warning" } {
  if (b.activationType === "power_of_many") {
    return { text: "金色・可変（Game Plan 依存・未適用）", tone: "warning" };
  }
  switch (b.evidenceLevel) {
    case "game_client_verified":
    case "screenshot_verified":
      return { text: "参考画面で実測確認", tone: "success" };
    case "external_cross_verified":
      return { text: "外部照合済み（KONAMI 公式未確認）", tone: "info" };
    case "conditional_unverified":
      return { text: "編成条件付き・未適用", tone: "warning" };
    case "unresolved":
      return { text: "未解決", tone: "warning" };
    default:
      return { text: "効果検証中", tone: "warning" };
  }
}

function stageLabel(b: PlayerBoosterInfo): string {
  if (b.activationType === "power_of_many") {
    return "★ 金色・Power of Many 方式（Game Plan の同一リーグ人数で効果量が変化）。自動判定不可のためユーザーが段階を手動指定。指定した効果名の対象能力へだけ「条件反映後値」に反映";
  }
  switch (b.evidenceLevel) {
    case "unresolved":
      return "① 数値IDのみ取得（対応表に未収録）";
    case "effect_provisional":
      return "③ 名称・レベル確認済み／効果は公開1系統のみ（実験モードで試算）";
    case "conditional_unverified":
      return "③ 名称・レベル・効果候補は確認済み／発動条件（編成の同一リーグ人数）は判明しているが静的画面で評価不可（実験モードで最大効果を試算）";
    case "external_cross_verified":
      return `④ 名称・レベル確認済み／効果は外部2ソースで整合（標準モードで通常値へ・KONAMI 公式実測ではない）${b.activationConfirmed === false ? "／発動方式は固定型と推定（Power of Many である具体的証拠なし・暫定適用）" : ""}`;
    case "screenshot_verified":
      return `⑤ 保存済みスクリーンショットで対象能力・上昇量を確認（厳密モードでも通常値へ）。KONAMI のゲームクライアント画面での確認ではありません${b.activationConfirmed === false ? "／発動方式は固定型と推定" : ""}`;
    case "game_client_verified":
      return "⑥ KONAMI のゲームクライアント画面で変化量を直接確認（厳密モードでも通常値へ）";
  }
}

/**
 * B1（カード付属ブースター）表示。育成ポイントの直下・B2（追加ブースター）の隣に常時表示する。
 *  - 名称・段階・対象能力・現在の適用状況を常時表示。
 *  - 「カード固有・変更不可」を明示（ユーザーは B1 自体を変更できない）。
 *  - 深い根拠（解決段階・発動方式・情報源）は `<details>` へ折りたたむ（SSR には残るので
 *    ブラックボックスの文字列一致チェックには影響しない）。
 *  - Power of Many（金色・可変）は「条件付きブースター」として明示的に区別する。
 */
export function AttachedBoosterSection({
  attached,
  attachedNote,
  conditionalSelections = [],
  onConditionalChange,
  overriddenSlots,
}: {
  attached: PlayerBoosterInfo[];
  attachedNote?: string;
  conditionalSelections?: SelectedConditionalBooster[];
  onConditionalChange?: (next: SelectedConditionalBooster[]) => void;
  /** B2 でスロットを上書き中の場合、この付属ブースターは計算に含めない（既存仕様・変更なし）。 */
  overriddenSlots?: Set<SelectedPlayerBooster["slot"]>;
}) {
  const condBySel = new Map(conditionalSelections.map((c) => [c.boosterKey, c.selection]));
  function setConditional(boosterKey: string, sel: ConditionalBoosterSelection) {
    const rest = conditionalSelections.filter((c) => c.boosterKey !== boosterKey);
    onConditionalChange?.(sel === "none" ? rest : [...rest, { boosterKey, selection: sel }]);
  }
  const overridden = overriddenSlots ?? new Set<SelectedPlayerBooster["slot"]>();

  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-text-dim">
        <Badge tone="neutral" size="xs">B1</Badge>
        カード付属ブースター（カードに収録・自動）
      </p>
      {attached.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1.5 text-xs">
          {attached.map((b) => {
            const eb = evidenceBadge(b);
            return (
              <li
                key={b.slot}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-border/60 bg-surface-2/30 px-2 py-1.5"
              >
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium">スロット{b.slot}</span>
                <span className="text-text-dim">ID {b.boosterId}</span>
                {b.boosterNameEn ? (
                  <>
                    <span className="font-semibold">
                      {b.boosterNameJa ? `${b.boosterNameJa}（${b.boosterNameEn}）` : b.boosterNameEn}
                      {b.level != null ? ` +${b.level}` : ""}
                    </span>
                    <Badge tone="outline" size="xs">カード固有・変更不可</Badge>
                    {b.activationType !== "power_of_many" && b.activationConfirmed === false ? (
                      <Badge tone="warning" size="xs">固定型・推定</Badge>
                    ) : null}
                    <Badge tone={eb.tone} size="xs">
                      {eb.text}
                    </Badge>
                    <Badge tone={b.autoApplied ? "success" : "outline"} size="xs">
                      {b.autoApplied ? "現在モードで適用中" : "通常値へ未適用"}
                    </Badge>
                    <span className="w-full text-2xs text-text-muted">
                      対象: {statListJa(b.affectedStats)}
                      {b.level != null ? `（各 ${b.autoApplied ? "" : "候補 "}+${b.level}）` : ""}
                    </span>
                    <details className="w-full text-2xs text-text-muted">
                      <summary className="cursor-pointer text-text-dim hover:text-text">詳細を見る（解決段階・発動方式・情報源）</summary>
                      <div className="mt-1 flex flex-col gap-1">
                        <span>解決段階: {stageLabel(b)}</span>
                        <span>
                          発動方式:{" "}
                          {b.activationType === "power_of_many"
                            ? `Power of Many（金色・Game Plan 依存）／ 証拠: ${activationEvidenceLabel(b.activationEvidence)}`
                            : b.activationConfirmed === false
                              ? "固定と推定（青/金の判別材料は未確認・ScoreBar 差分だけでは区別不可）"
                              : `固定（青色）／ 証拠: ${activationEvidenceLabel(b.activationEvidence)}`}
                        </span>
                        <span className="text-text-muted/80">
                          情報源: eFootball World（外部コミュニティDB）の個別選手ページ表示
                          {b.evidenceLevel === "external_cross_verified" ? " ＋ EFScout（外部DB）の定義（外部2ソースで整合）" : ""}
                          {b.evidenceLevel === "screenshot_verified" || b.evidenceLevel === "game_client_verified" ? " ＋ 保存済みスクリーンショット" : ""}
                        </span>
                        {b.evidenceLevel === "screenshot_verified" ? (
                          <span className="text-text-muted/80">
                            補足: 保存済みスクリーンショットで対象能力と上昇量を確認。KONAMI のゲームクライアント画面での確認ではありません。
                          </span>
                        ) : null}
                      </div>
                    </details>
                    {b.evidenceLevel === "conditional_unverified" && b.conditionText ? (
                      <span className="block w-full rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
                        発動条件: {b.conditionText}
                      </span>
                    ) : null}
                    {b.activationType === "power_of_many" ? (
                      <div className="w-full">
                        <p className="mb-1 text-2xs font-semibold text-warning">条件付きブースター（Power of Many）</p>
                        <span className="block w-full rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
                          {b.boosterNameJa ?? b.boosterNameEn} は eFHUB 上で金色に表示される可変ブースターです。KONAMI 公式「The Power of Many」= Game Plan の同一リーグ登録人数で効果量が変化します。当アプリでは人数を自動確認できないため標準最終値へは自動適用せず、下でユーザーが段階（+0/+1/+2/+3）を指定します。指定は {b.boosterNameEn} の対象能力へだけ反映します。
                        </span>
                      </div>
                    ) : null}
                    {b.manualConditional && b.boosterKey && onConditionalChange && !overridden.has(b.slot) ? (
                      <div className="w-full">
                        <ConditionalBoosterControl
                          boosterId={b.boosterId}
                          nameEn={b.boosterNameEn}
                          nameJa={b.boosterNameJa}
                          level={b.level}
                          affectedStats={b.affectedStats}
                          selection={condBySel.get(b.boosterKey) ?? "none"}
                          onChange={(sel) => setConditional(b.boosterKey!, sel)}
                          idPrefix={`attached-${b.slot}`}
                        />
                      </div>
                    ) : null}
                    {overridden.has(b.slot) ? (
                      <span className="w-full text-2xs text-info">※ 追加ブースター（B2）で上書き中（この付属ブースターは計算に含めていません）</span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Badge tone="warning" size="xs">
                      未解決・未適用
                    </Badge>
                    <span className="w-full text-2xs text-text-muted">解決段階: {stageLabel(b)}</span>
                    <span className="w-full text-2xs text-text-muted">
                      付属ブースターは未解決のため能力値へは適用していません。{b.unresolvedReason}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-text-dim">このカードに付属する選手ブースターはありません。</p>
      )}
      {attachedNote ? <p className="mt-1.5 text-2xs text-text-muted">{attachedNote}</p> : null}
    </div>
  );
}
