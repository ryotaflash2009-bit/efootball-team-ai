"use client";

import type { LinkUpEvaluation, SquadSlotResult, StoredLinkUp } from "@/lib/squad/types";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

function useStatusLabel(): Record<string, string> {
  const t = useT();
  const key = (k: keyof Dictionary["linkUp"]) => t("linkUp", k);
  return {
    met: key("statusMet"),
    partial: key("statusPartial"),
    unmet: key("statusUnmet"),
    indeterminate: key("statusIndeterminate"),
  };
}
const STATUS_CLASS: Record<string, string> = {
  met: "text-lime-300",
  partial: "text-yellow-300",
  unmet: "text-danger",
  indeterminate: "text-text-dim",
};

export function LinkUpPanel({
  linkUps,
  notice,
  slots,
  selection,
  hasManager,
  onSelect,
}: {
  linkUps: LinkUpEvaluation[];
  notice: string;
  slots: SquadSlotResult[];
  selection: StoredLinkUp;
  hasManager: boolean;
  onSelect: (next: StoredLinkUp) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const STATUS_LABEL = useStatusLabel();
  const filled = slots.filter((s) => s.entry != null);
  const label = (slotId: string) => {
    const s = slots.find((x) => x.slotId === slotId);
    if (!s?.entry) return slotId;
    return `${s.position} · ${resolvePlayerDisplayName(s.entry.display, locale, s.entry.display.worldCardId)}`;
  };

  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm">
      <h3 className="font-semibold">Link-Up Play</h3>
      <p className="mt-1 rounded bg-surface-2/50 px-2 py-1 text-[11px] text-yellow-300">
        {notice === "発動条件の照合のみ対応。ゲーム内効果は追加検証中です。" ? t("linkUp", "notice") : notice}
      </p>

      {!hasManager ? (
        <p className="mt-2 text-xs text-text-dim">{t("linkUp", "noManagerNote")}</p>
      ) : linkUps.length === 0 ? (
        <p className="mt-2 text-xs text-text-dim">{t("linkUp", "noDataNote")}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {linkUps.map((lu, i) => (
            <li key={i} className="rounded border border-border/60 bg-surface-2/30 p-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{lu.name}</span>
                <span className={`text-xs ${STATUS_CLASS[lu.status]}`}>{STATUS_LABEL[lu.status]}</span>
              </div>

              {(["centerPiece", "keyMan"] as const).map((role) => {
                const r = lu[role];
                const selKey = role === "centerPiece" ? "centerPieceSlotId" : "keyManSlotId";
                const roleLabel = role === "centerPiece" ? "Center Piece" : "Key Man";
                return (
                  <div key={role} className="mt-1.5 text-xs">
                    <p className="text-text-dim">
                      {roleLabel}:{" "}
                      {r.hasCondition
                        ? `${r.playingStyle ?? t("linkUp", "noStyleSpecified")}${r.positions.length ? " / " + r.positions.join(", ") : ""}`
                        : t("linkUp", "noConditionData")}
                    </p>
                    {r.hasCondition ? (
                      <>
                        <p className="mt-0.5">
                          {t("linkUp", "matchingStartersLabel")}
                          {r.matchingSlotIds.length > 0 ? (
                            r.matchingSlotIds.map((sid) => label(sid)).join(" / ")
                          ) : (
                            <span className="text-danger">{t("linkUp", "noneLabel")}</span>
                          )}
                        </p>
                        <select
                          value={selection[selKey] ?? ""}
                          onChange={(e) =>
                            onSelect({ ...selection, [selKey]: e.target.value || null })
                          }
                          aria-label={t("linkUp", "selectAriaTemplate").replace("{name}", lu.name).replace("{role}", roleLabel)}
                          className="mt-1 w-full rounded border border-border bg-surface px-1 py-1 text-[11px]"
                        >
                          <option value="">{t("linkUp", "noManualSelection")}</option>
                          {filled.map((s) => (
                            <option key={s.slotId} value={s.slotId}>
                              {label(s.slotId)}
                            </option>
                          ))}
                        </select>
                        {r.selectedSlotId ? (
                          <p className={`mt-0.5 ${r.selectedSatisfies ? "text-lime-300" : "text-yellow-300"}`}>
                            {t("linkUp", "selectedPrefix")}
                            {label(r.selectedSlotId)} — {r.selectedSatisfies ? t("linkUp", "satisfiesYes") : t("linkUp", "satisfiesNo")}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
