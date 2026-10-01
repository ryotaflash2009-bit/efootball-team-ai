"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { getSafeLocalStorage } from "@/lib/local-storage-scope/storage-access";
import { decideVisibility, REPORT_REASONS, type ReportReason } from "@/lib/safety/safety-model";
import { readSafety, setRelation, submitReport, withdrawReport, type SafetyState } from "@/lib/safety/safety-store";

type SkKey = keyof Dictionary["safetyMock"];
/** 自分（この端末の試作での識別子。公開 ID はまだ無い）。 */
const SELF = "me_local";
/** 架空のサンプル投稿（実在の利用者・データではない）。 */
const SAMPLES = [
  { id: "sample_post_1", owner: "sample_a", textKey: "sample1" as SkKey, moderation: "visible" as const },
  { id: "sample_post_2", owner: "sample_b", textKey: "sample2" as SkKey, moderation: "visible" as const },
  { id: "sample_post_3", owner: "sample_c", textKey: "sample3" as SkKey, moderation: "hidden_by_admin" as const },
  { id: "sample_post_4", owner: SELF, textKey: "sample4" as SkKey, moderation: "visible" as const },
];

/**
 * F-056 安全機能のモック: 架空のサンプル投稿で、通報・ブロック・ミュート・管理者の非表示の見え方を確かめる。
 * 保存はこの端末・この領域だけ。誰にも送られない。
 */
export function LocalSafetySample({ scopeKey }: { scopeKey: string }) {
  const t = useT();
  const sk = (k: SkKey) => t("safetyMock", k);
  const [state, setState] = useState<SafetyState>({ reports: [], blocked: [], muted: [], blockLog: [] });
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(() => {
    const ls = getSafeLocalStorage();
    if (ls) setState(readSafety(ls, scopeKey));
  }, [scopeKey]);
  useEffect(() => refresh(), [refresh]);

  const rel = { blocked: new Set(state.blocked), muted: new Set(state.muted), blockedBy: new Set<string>() };
  const ls = getSafeLocalStorage();

  function report(target: (typeof SAMPLES)[number]) {
    if (!ls) return;
    const r = submitReport(ls, scopeKey, { reporter: SELF, targetKind: "post", targetId: target.id, targetOwner: target.owner, reason, note }, new Date(), () => `rep_${crypto.getRandomValues(new Uint32Array(2)).join("")}`.slice(0, 40));
    setMessage(sk(r.ok ? "reportDone" : r.reason === "own_content" ? "reportOwn" : r.reason === "duplicate" ? "reportDuplicate" : r.reason === "rate_limited" ? "reportRateLimited" : "reportFailed"));
    setReporting(null);
    setNote("");
    refresh();
  }
  function toggle(kind: "block" | "mute", owner: string, on: boolean) {
    if (!ls) return;
    const r = setRelation(ls, scopeKey, SELF, kind, owner, on, new Date());
    setMessage(r.ok ? null : sk("relationFailed"));
    refresh();
  }

  return (
    <Surface padding="md" className="flex flex-col gap-2" data-testid="safety-sample">
      <h2 className="text-sm font-semibold">{sk("heading")}</h2>
      <p className="text-2xs text-warning">{sk("fictionalNote")}</p>
      <ul className="flex flex-col gap-2">
        {SAMPLES.map((s) => {
          const decision = decideVisibility({ id: s.id, owner: s.owner, deleted: false, moderation: s.moderation }, SELF, rel);
          const own = s.owner === SELF;
          return (
            <li key={s.id} className="rounded border border-border p-2 text-xs" data-testid="sample-post" data-decision={decision} data-owner={s.owner}>
              <p className="font-semibold">{own ? sk("ownLabel") : `${sk("sampleUser")} ${s.owner}`}</p>
              {decision === "show" ? <p className="mt-1">{sk(s.textKey)}</p> : <p className="mt-1 text-text-muted">{sk(`hidden_${decision}` as SkKey)}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => setReporting(s.id)} data-testid="sample-report">{sk("reportButton")}</Button>
                {!own ? (
                  <>
                    <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => toggle("block", s.owner, !rel.blocked.has(s.owner))} data-testid="sample-block">{sk(rel.blocked.has(s.owner) ? "unblock" : "block")}</Button>
                    <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => toggle("mute", s.owner, !rel.muted.has(s.owner))} data-testid="sample-mute">{sk(rel.muted.has(s.owner) ? "unmute" : "mute")}</Button>
                  </>
                ) : null}
              </div>
              {reporting === s.id ? (
                <div className="mt-2 flex flex-col gap-1.5 rounded border border-border bg-surface-2/40 p-2" data-testid="report-form">
                  <label className="flex flex-col gap-1">
                    {sk("reasonLabel")}
                    <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="min-h-[44px] rounded border border-border bg-surface px-2">
                      {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>{sk(`reason_${r}` as SkKey)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    {sk("noteLabel")}
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="rounded border border-border bg-surface px-2 py-1" />
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="min-h-[44px]" onClick={() => report(s)} data-testid="report-submit">{sk("submitReport")}</Button>
                    <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={() => setReporting(null)}>{sk("cancel")}</Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {state.reports.length > 0 ? (
        <div className="text-2xs text-text-dim" data-testid="my-reports">
          <p className="font-semibold">{sk("myReports")}</p>
          <ul>
            {state.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>{`${r.targetId} · ${sk(`reason_${r.reason}` as SkKey)} · ${sk(`status_${r.status}` as SkKey)}`}</span>
                {r.status === "open" ? (
                  <button type="button" className="min-h-[36px] underline" onClick={() => { if (ls) withdrawReport(ls, scopeKey, r.id, new Date()); refresh(); }}>{sk("withdraw")}</button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {message ? <p role="status" aria-live="polite" className="text-xs text-text-dim" data-testid="safety-message">{message}</p> : null}
    </Surface>
  );
}
