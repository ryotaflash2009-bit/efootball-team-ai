"use client";

import { useCallback, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { saveBuild } from "@/lib/progression/build-storage";
import type { ComparisonPlayerInput } from "@/lib/comparison/types";
import type { ProgressionGroup, SavedBuild, StatBreakdown } from "@/lib/progression/types";
import { groupLabelJa } from "@/lib/world/stat-labels";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";

/**
 * 比較コックピットで調整した現在の育成を、既存の保存ビルド（build-storage）として保存する。
 *  - 比較専用ストレージは作らない。保存後は選手詳細 / My Team / 各スカッド編集画面から同じ buildId を参照できる。
 *  - 保存するのは育成配分 ＋ 任意で Power of Many 指定。実験的試算・監督は保存ビルド仕様に含まれないため保存しない。
 *  - 新規保存 / 既存ビルド上書き（同一カードのみ・buildId 指定）。上書きは確認する。
 *  - 保存失敗は成功表示しない・比較の配分は消さない。
 */

function uniqueDefaultName(existing: SavedBuild[], defaultName: string): string {
  const taken = new Set(existing.map((b) => b.buildName));
  if (!taken.has(defaultName)) return defaultName;
  for (let i = 2; i < 100; i++) {
    const n = `${defaultName} ${i}`;
    if (!taken.has(n)) return n;
  }
  return defaultName;
}

const POM_LEVEL: Record<string, string> = {
  league_1_13: "+1",
  league_14_19: "+2",
  league_20_plus: "+3",
};

export function CompareSaveBuildDialog({
  open,
  onClose,
  player,
  index,
  allocation,
  groups,
  pointsUsed,
  pointsTotal,
  resultStats,
  calculatedOvr,
  calculationMode,
  rulesVersion,
  existingBuilds,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  player: ComparisonPlayerInput;
  index: number;
  allocation: Record<string, number>;
  groups: ProgressionGroup[];
  pointsUsed: number;
  pointsTotal: number;
  resultStats: StatBreakdown[];
  calculatedOvr: number | null;
  calculationMode: SavedBuild["calculationMode"];
  rulesVersion: string;
  existingBuilds: SavedBuild[];
  onSaved: (build: SavedBuild) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tsb = useCallback((k: keyof Dictionary["compareSaveBuildDialog"]) => t("compareSaveBuildDialog", k), [t]);
  const fillSb = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s),
    [],
  );
  const name0 = useMemo(() => uniqueDefaultName(existingBuilds, tsb("defaultName")), [existingBuilds, tsb]);
  const [name, setName] = useState(name0);
  const [mode, setMode] = useState<"new" | "overwrite">("new");
  const [overwriteId, setOverwriteId] = useState<string>(existingBuilds[0]?.buildId ?? "");
  const pomSel = player.selectedConditionalBoosters?.[0]?.selection ?? "none";
  const hasPom = pomSel !== "none";
  const [includePoM, setIncludePoM] = useState<boolean>(hasPom);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cardName = resolvePlayerDisplayName(
    player.display,
    locale,
    fillSb(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: player.display.worldCardId }),
  );
  const canOverwrite = existingBuilds.length > 0;
  const overwriteTarget = existingBuilds.find((b) => b.buildId === overwriteId) ?? null;

  function cleanName(raw: string): string {
    let out = "";
    for (const ch of raw) {
      const code = ch.codePointAt(0) ?? 0;
      out += code < 0x20 || code === 0x7f ? " " : ch;
    }
    return out.replace(/\s+/g, " ").trim().slice(0, 60);
  }

  function doSave() {
    setError(null);
    const cleaned = cleanName(name);
    if (!cleaned) {
      setError(tsb("nameRequiredError"));
      return;
    }
    setSaving(true);
    try {
      const finalStats: Record<string, number> = {};
      for (const s of resultStats) finalStats[s.key] = s.finalValue;
      const conditional =
        includePoM && hasPom && player.selectedConditionalBoosters ? player.selectedConditionalBoosters : undefined;
      const r = saveBuild({
        worldCardId: player.display.worldCardId,
        buildName: cleaned,
        progressionAllocation: allocation,
        selectedPlayerBooster: null,
        conditionalBoosterSelections: conditional,
        calculatedStats: finalStats,
        calculatedOvr,
        calculationMode,
        rulesVersion,
        buildId: mode === "overwrite" ? overwriteId : undefined,
      });
      setSaving(false);
      if (!r.ok) {
        setError(fillSb(tsb("saveFailedTemplate"), { error: r.error }));
        return;
      }
      onSaved(r.build);
    } catch {
      setSaving(false);
      setError(tsb("saveErrorGeneric"));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={fillSb(tsb("modalTitleTemplate"), { index: String(index + 1), name: cardName })} size="md">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-xs text-text-dim">{tsb("intro")}</p>

        <div className="rounded border border-border bg-surface-2/40 p-2 text-xs">
          <p className="mb-1 font-semibold">
            {fillSb(tsb("allocationHeadingTemplate"), { used: String(pointsUsed), total: String(pointsTotal) })}
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
            {groups.map((g) => (
              <li key={g.groupId} className={g.allocatedPoints > 0 ? "text-text" : "text-text-muted"}>
                {groupLabelJa(g.groupId)}: Lv {g.allocatedPoints}
              </li>
            ))}
          </ul>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          {tsb("buildNameLabel")}
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            aria-label={tsb("buildNameAriaLabel")}
            className="rounded border border-border bg-surface-2 px-2 py-1.5 text-sm"
          />
        </label>

        <fieldset className="flex flex-col gap-1.5 text-xs">
          <legend className="font-semibold">{tsb("saveMethodLegend")}</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="save-mode"
              checked={mode === "new"}
              onChange={() => {
                setMode("new");
                setConfirming(false);
              }}
            />
            {tsb("saveAsNewOption")}
          </label>
          <label className={`flex items-center gap-2 ${canOverwrite ? "" : "text-text-muted"}`}>
            <input
              type="radio"
              name="save-mode"
              disabled={!canOverwrite}
              checked={mode === "overwrite"}
              onChange={() => setMode("overwrite")}
            />
            {tsb("overwriteExistingOption")}
          </label>
          {mode === "overwrite" && canOverwrite ? (
            <select
              value={overwriteId}
              onChange={(e) => {
                setOverwriteId(e.target.value);
                setConfirming(false);
              }}
              aria-label={tsb("overwriteSelectAriaLabel")}
              className="ml-6 rounded border border-border bg-surface-2 px-2 py-1 text-xs"
            >
              {existingBuilds.map((b) => (
                <option key={b.buildId} value={b.buildId}>
                  {b.buildName}
                </option>
              ))}
            </select>
          ) : null}
        </fieldset>

        <label className="flex flex-wrap items-center gap-2 text-xs">
          <input type="checkbox" checked={includePoM} disabled={!hasPom} onChange={(e) => setIncludePoM(e.target.checked)} />
          {tsb("includePomLabel")}
          <span className="text-text-muted">
            {hasPom
              ? fillSb(tsb("pomCurrentTemplate"), { tier: POM_LEVEL[pomSel] ?? tsb("pomNoSpecificValue") })
              : tsb("pomUnspecifiedNote")}
          </span>
        </label>
        <p className="text-[10px] text-text-muted">{tsb("footnote")}</p>

        {error ? (
          <p role="alert" className="rounded border border-danger/50 bg-danger/10 px-2 py-1 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs">
            {tsb("cancelButton")}
          </button>
          {mode === "overwrite" && confirming ? (
            <>
              <span className="text-xs text-warning">
                {fillSb(tsb("overwriteWarningTemplate"), { name: overwriteTarget?.buildName ?? "" })}
              </span>
              <button
                type="button"
                onClick={doSave}
                disabled={saving}
                className="rounded border border-warning bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning disabled:opacity-50"
              >
                {saving ? tsb("savingButton") : tsb("overwriteSaveButton")}
              </button>
            </>
          ) : mode === "overwrite" ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={saving || !overwriteId}
              className="rounded border border-warning bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning disabled:opacity-50"
            >
              {tsb("confirmOverwriteButton")}
            </button>
          ) : (
            <button
              type="button"
              onClick={doSave}
              disabled={saving}
              className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
            >
              {saving ? tsb("savingButton") : tsb("saveButton")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
