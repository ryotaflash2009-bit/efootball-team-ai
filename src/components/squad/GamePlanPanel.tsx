"use client";

import "@/lib/i18n/dictionaries/ja-ns/gamePlan";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { fillMessage } from "@/lib/i18n/message-format";
import { FORMATIONS } from "@/lib/squad/formations";
import type { StoredSquad } from "@/lib/squad/types";
import { TACTICS, tacticName } from "@/components/managers/tactics";
import { downloadBlobFile } from "@/lib/share-image";
import {
  ADJUSTMENT_IDS,
  ALT_TRIGGERS,
  ATTACKING_STYLES,
  DEFENSIVE_LINES,
  LABEL_MAX,
  MAX_OPPONENT_PLANS,
  MAX_SUBSTITUTIONS,
  NOTE_MAX,
  PRESSING_LEVELS,
  SUB_REASONS,
  activeGamePlanStorageKey,
  cleanText,
  emptyGamePlan,
  exportGamePlan,
  importGamePlan,
  loadGamePlan,
  saveGamePlan,
  validateGamePlan,
  type AttackingStyle,
  type GamePlan,
} from "@/lib/squad/game-plan";

type Key = keyof Dictionary["gamePlan"];

const STYLE_TACTIC: Record<AttackingStyle, (typeof TACTICS)[number]["key"]> = {
  possession: "possessionGame",
  quick_counter: "quickCounter",
  long_ball_counter: "longBallCounter",
  out_wide: "outWide",
  long_ball: "longBall",
};

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * ゲームプランの欄（2026-10-07）。スカッドの編集の下に置く。端末の localStorage（アカウントごとのキー）だけに保存する。
 * 変更はすぐに保存する。問題（控えにいない選手など）は保存を止めず、一覧で知らせる。
 */
export function GamePlanPanel({
  squad,
  starterOptions,
  benchOptions,
}: {
  squad: StoredSquad;
  starterOptions: { slotId: string; label: string }[];
  benchOptions: { worldCardId: string; label: string }[];
}) {
  const t = useT();
  const { displayLocale } = useLocale();
  const tg = useCallback((k: Key) => t("gamePlan", k), [t]);
  const [plan, setPlan] = useState<GamePlan | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const key = activeGamePlanStorageKey();
    setPlan((key ? loadGamePlan(storage(), key, squad.squadId) : null) ?? emptyGamePlan(squad.squadId, new Date().toISOString()));
  }, [squad.squadId]);

  const update = useCallback(
    (fn: (p: GamePlan) => GamePlan) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const next = { ...fn(prev), updatedAt: new Date().toISOString() };
        const key = activeGamePlanStorageKey();
        if (!key || !saveGamePlan(storage(), key, next)) setMessage({ tone: "error", text: tg("saveFailed") });
        return next;
      });
    },
    [tg],
  );

  const issues = useMemo(() => (plan ? validateGamePlan(plan, squad) : []), [plan, squad]);
  if (!plan) return null;

  const sel = "min-h-[36px] rounded border border-border bg-surface px-2 text-xs";
  const otherFormations = FORMATIONS.filter((f) => f.id !== squad.formationId);

  const onExport = () => {
    const text = exportGamePlan(plan, squad.formationId);
    downloadBlobFile(new Blob([text], { type: "application/json" }), `efootball-team-ai-game-plan-${squad.formationId}-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 32 * 1024) {
      setMessage({ tone: "error", text: tg("importTooLarge") });
      return;
    }
    const r = importGamePlan(await file.text(), squad, new Date().toISOString());
    if (!r.ok) {
      setMessage({ tone: "error", text: tg(r.reason === "too_large" ? "importTooLarge" : "importInvalid") });
      return;
    }
    update(() => r.plan);
    setMessage({ tone: r.formationMismatch ? "warn" : "ok", text: tg(r.formationMismatch ? "importFormationMismatch" : "importSuccess") });
  };

  return (
    <details className="mt-3 rounded-card border border-border bg-surface p-3 text-xs sm:p-4" data-testid="game-plan">
      <summary className="cursor-pointer text-sm font-semibold text-text">{tg("heading")}</summary>
      <p className="mt-1 text-text-dim">{tg("intro")}</p>
      <p className="mt-0.5 text-2xs text-text-muted">{tg("localOnlyNote")}</p>

      {/* チームの指示 */}
      <fieldset className="mt-3 flex flex-col gap-2">
        <legend className="font-semibold text-text-dim">{tg("instructionsHeading")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span>{tg("attackingLabel")}</span>
            <select
              className={sel}
              value={plan.instructions.attacking ?? ""}
              onChange={(e) => update((p) => ({ ...p, instructions: { ...p.instructions, attacking: (e.target.value || null) as GamePlan["instructions"]["attacking"] } }))}
            >
              <option value="">{tg("notSet")}</option>
              {ATTACKING_STYLES.map((s) => (
                <option key={s} value={s}>
                  {tacticName(TACTICS.find((x) => x.key === STYLE_TACTIC[s])!, displayLocale)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>{tg("defensiveLineLabel")}</span>
            <select
              className={sel}
              value={plan.instructions.defensiveLine ?? ""}
              onChange={(e) => update((p) => ({ ...p, instructions: { ...p.instructions, defensiveLine: (e.target.value || null) as GamePlan["instructions"]["defensiveLine"] } }))}
            >
              <option value="">{tg("notSet")}</option>
              {DEFENSIVE_LINES.map((s) => (
                <option key={s} value={s}>
                  {tg(`line_${s}` as Key)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>{tg("pressingLabel")}</span>
            <select
              className={sel}
              value={plan.instructions.pressing ?? ""}
              onChange={(e) => update((p) => ({ ...p, instructions: { ...p.instructions, pressing: (e.target.value || null) as GamePlan["instructions"]["pressing"] } }))}
            >
              <option value="">{tg("notSet")}</option>
              {PRESSING_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {tg(`press_${s}` as Key)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span>{tg("noteLabel")}</span>
          <textarea
            className="min-h-[56px] rounded border border-border bg-surface p-2 text-xs"
            maxLength={NOTE_MAX}
            value={plan.instructions.note}
            onChange={(e) => update((p) => ({ ...p, instructions: { ...p.instructions, note: cleanText(e.target.value, NOTE_MAX) } }))}
          />
        </label>
      </fieldset>

      {/* 交代の計画 */}
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="font-semibold text-text-dim">{tg("subsHeading")}</legend>
        {plan.substitutions.length === 0 ? <p className="text-text-muted">{tg("subsEmpty")}</p> : null}
        <ol className="flex flex-col gap-2">
          {plan.substitutions.map((s, i) => (
            <li key={i} className="grid gap-2 rounded border border-border/60 p-2 sm:grid-cols-[5rem_1fr_1fr_1fr_auto]" aria-label={fillMessage(tg("subIndexTemplate"), { n: String(i + 1) })}>
              <label className="flex flex-col gap-1">
                <span>{tg("minuteLabel")}</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  inputMode="numeric"
                  className={sel}
                  value={s.minute ?? ""}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    const minute = e.target.value === "" || !Number.isInteger(n) || n < 1 || n > 120 ? null : n;
                    update((p) => ({ ...p, substitutions: p.substitutions.map((x, j) => (j === i ? { ...x, minute } : x)) }));
                  }}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span>{tg("outLabel")}</span>
                <select className={sel} value={s.outSlotId} onChange={(e) => update((p) => ({ ...p, substitutions: p.substitutions.map((x, j) => (j === i ? { ...x, outSlotId: e.target.value } : x)) }))}>
                  {starterOptions.some((o) => o.slotId === s.outSlotId) ? null : <option value={s.outSlotId}>{s.outSlotId.toUpperCase()}</option>}
                  {starterOptions.map((o) => (
                    <option key={o.slotId} value={o.slotId}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span>{tg("inLabel")}</span>
                <select className={sel} value={s.inWorldCardId} onChange={(e) => update((p) => ({ ...p, substitutions: p.substitutions.map((x, j) => (j === i ? { ...x, inWorldCardId: e.target.value } : x)) }))}>
                  {benchOptions.some((o) => o.worldCardId === s.inWorldCardId) ? null : <option value={s.inWorldCardId}>—</option>}
                  {benchOptions.map((o) => (
                    <option key={o.worldCardId} value={o.worldCardId}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span>{tg("reasonLabel")}</span>
                <select
                  className={sel}
                  value={s.reason}
                  onChange={(e) => update((p) => ({ ...p, substitutions: p.substitutions.map((x, j) => (j === i ? { ...x, reason: e.target.value as typeof s.reason } : x)) }))}
                >
                  {SUB_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {tg(`reason_${r}` as Key)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="min-h-[36px] self-end rounded border border-border px-2 text-text-dim hover:border-danger hover:text-danger"
                onClick={() => update((p) => ({ ...p, substitutions: p.substitutions.filter((_, j) => j !== i) }))}
              >
                {tg("removeSub")}
              </button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="min-h-[36px] rounded border border-border px-3 text-text-dim hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
            disabled={plan.substitutions.length >= MAX_SUBSTITUTIONS || starterOptions.length === 0 || benchOptions.length === 0}
            onClick={() =>
              update((p) => ({
                ...p,
                substitutions: [
                  ...p.substitutions,
                  { minute: null, outSlotId: starterOptions[0].slotId, inWorldCardId: (benchOptions.find((b) => !p.substitutions.some((x) => x.inWorldCardId === b.worldCardId)) ?? benchOptions[0]).worldCardId, reason: "fatigue" },
                ],
              }))
            }
          >
            {tg("addSub")}
          </button>
          <span className="text-2xs text-text-muted">{fillMessage(tg("subsMaxTemplate"), { max: String(MAX_SUBSTITUTIONS) })}</span>
        </div>
      </fieldset>

      {/* 代わりの計画 */}
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="font-semibold text-text-dim">{tg("altHeading")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span>{tg("altFormationLabel")}</span>
            <select className={sel} value={plan.alternative.formationId ?? ""} onChange={(e) => update((p) => ({ ...p, alternative: { ...p.alternative, formationId: e.target.value || null } }))}>
              <option value="">{tg("notSet")}</option>
              {otherFormations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>{tg("altTriggerLabel")}</span>
            <select
              className={sel}
              value={plan.alternative.trigger ?? ""}
              onChange={(e) => update((p) => ({ ...p, alternative: { ...p.alternative, trigger: (e.target.value || null) as GamePlan["alternative"]["trigger"] } }))}
            >
              <option value="">{tg("notSet")}</option>
              {ALT_TRIGGERS.map((tr) => (
                <option key={tr} value={tr}>
                  {tg(`trigger_${tr}` as Key)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span>{tg("noteLabel")}</span>
          <textarea
            className="min-h-[48px] rounded border border-border bg-surface p-2 text-xs"
            maxLength={NOTE_MAX}
            value={plan.alternative.note}
            onChange={(e) => update((p) => ({ ...p, alternative: { ...p.alternative, note: cleanText(e.target.value, NOTE_MAX) } }))}
          />
        </label>
      </fieldset>

      {/* 相手ごとの計画 */}
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="font-semibold text-text-dim">{tg("oppHeading")}</legend>
        {plan.opponents.length === 0 ? <p className="text-text-muted">{tg("oppEmpty")}</p> : null}
        {plan.opponents.map((o, i) => (
          <div key={i} className="flex flex-col gap-2 rounded border border-border/60 p-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span>{tg("oppLabel")}</span>
                <input
                  className={sel}
                  maxLength={LABEL_MAX}
                  value={o.label}
                  onChange={(e) => update((p) => ({ ...p, opponents: p.opponents.map((x, j) => (j === i ? { ...x, label: e.target.value.slice(0, LABEL_MAX) } : x)) }))}
                />
              </label>
              <button
                type="button"
                className="min-h-[36px] rounded border border-border px-2 text-text-dim hover:border-danger hover:text-danger"
                onClick={() => update((p) => ({ ...p, opponents: p.opponents.filter((_, j) => j !== i) }))}
              >
                {tg("removeOpp")}
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {(["possession", "pressing", "counter"] as const).map((k) => (
                <label key={k} className="inline-flex min-h-[32px] items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={o.style[k]}
                    onChange={(e) => update((p) => ({ ...p, opponents: p.opponents.map((x, j) => (j === i ? { ...x, style: { ...x.style, [k]: e.target.checked } } : x)) }))}
                  />
                  {tg(k === "possession" ? "oppStylePossession" : k === "pressing" ? "oppStylePressing" : "oppStyleCounter")}
                </label>
              ))}
            </div>
            <div>
              <p className="text-text-dim">{tg("oppAdjustmentsLabel")}</p>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {ADJUSTMENT_IDS.map((a) => (
                  <label key={a} className="inline-flex min-h-[32px] items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={o.adjustments.includes(a)}
                      onChange={(e) =>
                        update((p) => ({
                          ...p,
                          opponents: p.opponents.map((x, j) =>
                            j === i ? { ...x, adjustments: e.target.checked ? ADJUSTMENT_IDS.filter((id) => id === a || x.adjustments.includes(id)) : x.adjustments.filter((id) => id !== a) } : x,
                          ),
                        }))
                      }
                    />
                    {tg(`adj_${a}` as Key)}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span>{tg("noteLabel")}</span>
              <textarea
                className="min-h-[48px] rounded border border-border bg-surface p-2 text-xs"
                maxLength={NOTE_MAX}
                value={o.note}
                onChange={(e) => update((p) => ({ ...p, opponents: p.opponents.map((x, j) => (j === i ? { ...x, note: cleanText(e.target.value, NOTE_MAX) } : x)) }))}
              />
            </label>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="min-h-[36px] rounded border border-border px-3 text-text-dim hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
            disabled={plan.opponents.length >= MAX_OPPONENT_PLANS}
            onClick={() =>
              update((p) => ({
                ...p,
                opponents: [...p.opponents, { label: `#${p.opponents.length + 1}`, style: { possession: false, pressing: false, counter: false }, adjustments: [], note: "" }],
              }))
            }
          >
            {tg("addOpp")}
          </button>
        </div>
      </fieldset>

      {issues.length > 0 ? (
        <div className="mt-4 rounded border border-warning/50 bg-warning/5 p-2" role="status" data-testid="game-plan-issues">
          <p className="font-semibold text-warning">{tg("issuesHeading")}</p>
          <ul className="mt-1 list-disc ps-4 text-text-dim">
            {issues.map((iss, k) => (
              <li key={k}>{fillMessage(tg(`issue_${iss.id}` as Key), { n: String((iss.index ?? 0) + 1) })}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-[36px] rounded border border-border px-3 text-text-dim hover:border-accent" onClick={onExport}>
          {tg("exportButton")}
        </button>
        <button type="button" className="min-h-[36px] rounded border border-border px-3 text-text-dim hover:border-accent" onClick={() => fileRef.current?.click()}>
          {tg("importButton")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="game-plan-import"
          onChange={(e) => {
            void onImportFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {message ? (
          <span role="status" aria-live="polite" className={message.tone === "error" ? "text-danger" : message.tone === "warn" ? "text-warning" : "text-success"}>
            {message.text}
          </span>
        ) : null}
      </div>
    </details>
  );
}
