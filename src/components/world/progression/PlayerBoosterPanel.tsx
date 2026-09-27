"use client";

import type { BoosterApplicationMode } from "@/lib/progression/types";
import { BOOSTER_APPLICATION_MODES } from "@/lib/progression/booster-resolution";
import { useT } from "@/lib/i18n/LocaleContext";
import { ExperimentalModeToggle } from "./ExperimentalModeToggle";

/** 適用モードの表示名・説明の辞書キー（booster-resolution.ts の BOOSTER_APPLICATION_MODES と同じ文言）。 */
const MODE_TEXT_KEYS = {
  strict: { label: "ruPbModeStrictLabel", description: "ruPbModeStrictDesc" },
  standard: { label: "ruPbModeStandardLabel", description: "ruPbModeStandardDesc" },
  experimental: { label: "ruPbModeExperimentalLabel", description: "ruPbModeExperimentalDesc" },
} as const;

/**
 * 選手ブースターの適用モード設定・検証情報。
 * B1（カード付属ブースター）と B2（追加ブースター・手動選択）の通常表示・選択操作は
 * `AttachedBoosterSection` / `B2BoosterSelector`（育成ポイント直下・常時表示）へ集約済み。
 * ここには「モード設定」と「効果の出所・検証情報」だけを残す（重複表示を避けるため）。
 */
export function PlayerBoosterPanel({
  mode,
  onModeChange,
}: {
  mode: BoosterApplicationMode;
  onModeChange: (m: BoosterApplicationMode) => void;
}) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const experimental = mode === "experimental";

  return (
    <section className="rounded-md border border-border bg-surface p-3 text-sm">
      <h3 className="font-semibold">{tp("ruPbHeading")}</h3>

      {/* ── ブースター適用モード ── */}
      <div className="mt-2 rounded-md border border-border/60 bg-surface-2/30 p-2">
        <p className="text-xs font-semibold text-text-dim">{tp("ruPbModeHeading")}</p>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {BOOSTER_APPLICATION_MODES.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-2 text-2xs">
              <input
                type="radio"
                name="booster-mode"
                value={m.id}
                checked={mode === m.id}
                onChange={() => {
                  if (m.id === "experimental" && mode !== "experimental") return; // 実験モードは下のトグルから
                  onModeChange(m.id);
                }}
                disabled={m.id === "experimental"}
                className="mt-0.5 accent-[color:var(--color-accent)]"
              />
              <span>
                <span className="font-semibold text-text">{MODE_TEXT_KEYS[m.id] ? tp(MODE_TEXT_KEYS[m.id].label) : m.label}</span>
                <span className="block text-text-muted">{MODE_TEXT_KEYS[m.id] ? tp(MODE_TEXT_KEYS[m.id].description) : m.description}</span>
              </span>
            </label>
          ))}
        </div>
        {mode !== "strict" ? (
          <p className="mt-1.5 rounded border border-info/30 bg-info/10 px-2 py-1 text-2xs text-info">
            {tp("ruPbStandardNote")}
          </p>
        ) : null}
      </div>

      {/* ── 検証情報 ── */}
      <div className="mt-3 border-t border-border/60 pt-2.5">
        <p className="text-xs font-semibold text-text-dim">{tp("ruPbDetailsHeading")}</p>
        <p className="mt-0.5 text-2xs text-text-muted">
          {tp("ruPbDetailsBody")}
        </p>
        <div className="mt-2.5">
          <ExperimentalModeToggle
            enabled={experimental}
            onChange={(on) => onModeChange(on ? "experimental" : "standard")}
          />
        </div>
        <p className="mt-2 text-2xs text-text-muted">
          {tp("ruPbSourceNote")}
        </p>
      </div>
    </section>
  );
}
