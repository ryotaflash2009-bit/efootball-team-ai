"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import type {
  PlayerBoosterInfo,
  SelectedConditionalBooster,
  SelectedPlayerBooster,
  ConditionalBoosterSelection,
} from "@/lib/progression/types";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { Badge } from "@/components/ui/Badge";
import { ConditionalBoosterControl } from "./ConditionalBoosterControl";
import { localizeLibText } from "@/lib/progression/lib-text-en";

type Tp = (k: keyof Dictionary["progressionTab"]) => string;

/** 発動方式の証拠レベル → 短い日本語ラベル。 */
function activationEvidenceLabel(ev: PlayerBoosterInfo["activationEvidence"], tp: Tp): string {
  switch (ev) {
    case "official_verified":
      return tp("boostActEvOfficial");
    case "screenshot_verified":
      return tp("boostActEvScreenshot");
    case "external_cross_verified":
      return tp("boostActEvExternal");
    case "conflicted":
      return tp("boostActEvConflicted");
    case "unresolved":
      return tp("boostActEvUnresolved");
    default:
      return tp("boostActEvInferred");
  }
}

/** 証拠レベル → 表示ラベル・色。「確認済み」の一語で参考画面の実測と外部照合を混同しない。 */
function evidenceBadge(b: PlayerBoosterInfo, tp: Tp): { text: string; tone: "success" | "info" | "warning" } {
  if (b.activationType === "power_of_many") {
    return { text: tp("boostEvidencePom"), tone: "warning" };
  }
  switch (b.evidenceLevel) {
    case "game_client_verified":
    case "screenshot_verified":
      return { text: tp("boostEvidenceMeasured"), tone: "success" };
    case "external_cross_verified":
      return { text: tp("boostEvidenceExternal"), tone: "info" };
    case "conditional_unverified":
      return { text: tp("boostEvidenceConditional"), tone: "warning" };
    case "unresolved":
      return { text: tp("boostEvidenceUnresolved"), tone: "warning" };
    default:
      return { text: tp("boostEvidencePending"), tone: "warning" };
  }
}

function stageLabel(b: PlayerBoosterInfo, tp: Tp): string {
  if (b.activationType === "power_of_many") {
    return tp("boostStagePom");
  }
  switch (b.evidenceLevel) {
    case "unresolved":
      return tp("boostStageUnresolved");
    case "effect_provisional":
      return tp("boostStageProvisional");
    case "conditional_unverified":
      return tp("boostStageConditional");
    case "external_cross_verified":
      return `${tp("boostStageExternal")}${b.activationConfirmed === false ? tp("boostStageExternalProvisional") : ""}`;
    case "screenshot_verified":
      return `${tp("boostStageScreenshot")}${b.activationConfirmed === false ? tp("boostStageScreenshotProvisional") : ""}`;
    case "game_client_verified":
      return tp("boostStageGameClient");
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
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const { locale } = useLocale();
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
        {tp("boostAttachedHeading")}
      </p>
      {attached.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1.5 text-xs">
          {attached.map((b) => {
            const eb = evidenceBadge(b, tp);
            const stage = stageLabel(b, tp);
            return (
              <li
                key={b.slot}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-border/60 bg-surface-2/30 px-2 py-1.5"
              >
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium">{tp("boostSlot").replace("{slot}", String(b.slot))}</span>
                <span className="text-text-dim">ID {b.boosterId}</span>
                {b.boosterNameEn ? (
                  <>
                    <span className="font-semibold">
                      {locale === "ja" && b.boosterNameJa
                        ? tp("boostNameWithEn").replace("{ja}", b.boosterNameJa).replace("{en}", b.boosterNameEn)
                        : b.boosterNameEn}
                      {b.level != null ? ` +${b.level}` : ""}
                    </span>
                    <Badge tone="outline" size="xs">{tp("boostCardFixed")}</Badge>
                    {b.activationType !== "power_of_many" && b.activationConfirmed === false ? (
                      <Badge tone="warning" size="xs">{tp("boostFixedProvisional")}</Badge>
                    ) : null}
                    <Badge tone={eb.tone} size="xs">
                      {eb.text}
                    </Badge>
                    <Badge tone={b.autoApplied ? "success" : "outline"} size="xs">
                      {b.autoApplied ? tp("boostAppliedInMode") : tp("boostNotAppliedNormal")}
                    </Badge>
                    <span className="w-full text-2xs text-text-muted">
                      {tp("boostTargetsPrefix")}
                      {b.affectedStats.map((k) => abilityName(k, locale)).join(" / ")}
                      {b.level != null
                        ? tp(b.autoApplied ? "boostEachLevel" : "boostEachCandidateLevel").replace("{level}", String(b.level))
                        : ""}
                    </span>
                    <details className="w-full text-2xs text-text-muted">
                      <summary className="cursor-pointer text-text-dim hover:text-text">{tp("boostDetailsSummary")}</summary>
                      <div className="mt-1 flex flex-col gap-1">
                        <span>{tp("boostStageLine").replace("{stage}", stage)}</span>
                        <span>
                          {tp("boostActivationLine").replace(
                            "{value}",
                            b.activationType === "power_of_many"
                              ? tp("boostActivationPom").replace("{evidence}", activationEvidenceLabel(b.activationEvidence, tp))
                              : b.activationConfirmed === false
                                ? tp("boostActivationFixedAssumed")
                                : tp("boostActivationFixed").replace("{evidence}", activationEvidenceLabel(b.activationEvidence, tp)),
                          )}
                        </span>
                        <span className="text-text-muted/80">
                          {tp("boostSourceWorld")}
                          {b.evidenceLevel === "external_cross_verified" ? tp("boostSourceEfscout") : ""}
                          {b.evidenceLevel === "screenshot_verified" || b.evidenceLevel === "game_client_verified" ? tp("boostSourceScreenshot") : ""}
                        </span>
                        {b.evidenceLevel === "screenshot_verified" ? (
                          <span className="text-text-muted/80">
                            {tp("boostScreenshotNote")}
                          </span>
                        ) : null}
                      </div>
                    </details>
                    {b.evidenceLevel === "conditional_unverified" && b.conditionText ? (
                      <span className="block w-full rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
                        {tp("boostConditionLine").replace("{text}", localizeLibText(b.conditionText, locale))}
                      </span>
                    ) : null}
                    {b.activationType === "power_of_many" ? (
                      <div className="w-full">
                        <p className="mb-1 text-2xs font-semibold text-warning">{tp("boostConditionalHeading")}</p>
                        <span className="block w-full rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
                          {tp("boostPomExplain")
                            .replace("{name}", (locale === "ja" ? b.boosterNameJa : null) ?? b.boosterNameEn)
                            .replace("{nameEn}", b.boosterNameEn)}
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
                      <span className="w-full text-2xs text-info">{tp("boostOverriddenNote")}</span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Badge tone="warning" size="xs">
                      {tp("boostUnresolvedNotApplied")}
                    </Badge>
                    <span className="w-full text-2xs text-text-muted">{tp("boostStageLine").replace("{stage}", stage)}</span>
                    <span className="w-full text-2xs text-text-muted">
                      {tp("boostUnresolvedNotAppliedNote")}
                      {localizeLibText(b.unresolvedReason ?? "", locale)}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-text-dim">{tp("boostNoAttachedPlayer")}</p>
      )}
      {attachedNote ? <p className="mt-1.5 text-2xs text-text-muted">{localizeLibText(attachedNote, locale)}</p> : null}
    </div>
  );
}
