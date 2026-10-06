"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import { useState, type ReactNode } from "react";
import type { PlayerBoosterInfo } from "@/lib/progression/types";
import { getStatDef } from "@/lib/world/stats";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { Modal } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { BoosterIcon } from "./BoosterIcon";

/**
 * 固定（青色）ブースターの効果説明ダイアログ。**数値変更 UI は出さない**。
 * カード本来の付属ブースターであることと、対象能力ごとの上昇量・証拠レベル・適用状況を示すだけ。
 */

function evidenceText(
  level: string,
  tp: (k: keyof Dictionary["progressionTab"]) => string,
): { text: string; tone: "success" | "info" | "warning" } {
  switch (level) {
    case "game_client_verified":
    case "screenshot_verified":
      return { text: tp("boostEvidenceMeasured"), tone: "success" };
    case "external_cross_verified":
      return { text: tp("boostEvidenceExternal"), tone: "info" };
    default:
      return { text: tp("boostEvidencePending"), tone: "warning" };
  }
}

export function FixedBoosterDetails({
  booster,
  open,
  onClose,
}: {
  booster: PlayerBoosterInfo;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const { locale } = useLocale();
  const fallbackName = tp("boostFallbackName");
  const name =
    locale === "ja" && booster.boosterNameJa
      ? tp("boostNameWithEn").replace("{ja}", booster.boosterNameJa).replace("{en}", String(booster.boosterNameEn))
      : booster.boosterNameEn ?? fallbackName;
  const ev = evidenceText(booster.evidenceLevel, tp);
  const level = booster.level ?? 0;
  const activationProvisional = booster.activationConfirmed === false;

  return (
    <Modal open={open} onClose={onClose} title={tp("boostFixedDialogTitle").replace("{name}", booster.boosterNameEn ?? fallbackName)} size="sm">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <BoosterIcon variant="fixed" />
          <span className="font-semibold">
            {name}
            {booster.level != null ? ` +${booster.level}` : ""}
          </span>
          <Badge tone={activationProvisional ? "warning" : "info"} size="xs">
            {activationProvisional ? tp("boostFixedProvisional") : tp("boostFixedType")} +{booster.level ?? "?"}
          </Badge>
          <Badge tone={ev.tone} size="xs">
            {ev.text}
          </Badge>
        </div>

        <p className="text-xs text-text-dim">
          {tp("boostFixedIntro")}
          {activationProvisional ? tp("boostFixedNoTierProvisional") : tp("boostFixedNoTier")}
          {booster.autoApplied ? tp("boostFixedAppliedStandard") : tp("boostFixedNotAppliedMode")}
        </p>

        {activationProvisional ? (
          <p className="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
            {tp("boostFixedProvisionalPre")}
            <b>{tp("boostFixedProvisionalBold")}</b>
            {tp("boostFixedProvisionalPost")}
          </p>
        ) : null}

        <div>
          <p className="text-xs font-semibold text-text-dim">{tp("boostIncreasePerAbility")}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {booster.affectedStats.map((k) => (
              <li key={k} className="flex items-center justify-between rounded border border-border/60 bg-surface-2/40 px-2 py-1 text-xs">
                <span title={getStatDef(k)?.nameEn ?? k}>{abilityName(k, locale)}</span>
                <span className="font-bold tabular-nums text-lime-300">+{level}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-2xs text-text-muted">
          {tp("boostFixedSourceNote")}
        </p>
      </div>
    </Modal>
  );
}

/** チップ全体をボタンにして詳細ダイアログを開くラッパー。 */
export function FixedBoosterChip({
  booster,
  children,
}: {
  booster: PlayerBoosterInfo;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-md border border-info/40 bg-info/5 px-2 py-1.5 text-start text-xs transition-colors hover:border-info"
      >
        {children}
      </button>
      <FixedBoosterDetails booster={booster} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
