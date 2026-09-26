"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DiagnosisComparisonCard, useCompareTexts } from "./DiagnosisComparisonCard";
import { diagnosisCategoryLabel } from "./SharedDiagnosisView";
import { buildCompareShareUrl, compareDiagnoses } from "@/lib/squad/diagnosis-compare";
import { drawDiagnosisComparisonImage } from "@/lib/squad/diagnosis-compare-image";
import { saveDrawnCanvasAsPng } from "@/lib/squad/squad-diagnosis-image";
import type { DiagnosisHistoryEntry } from "@/lib/squad/diagnosis-history";
import { SQUAD_DIAGNOSIS_SHARE_SERVICE_NAME } from "@/lib/squad/squad-diagnosis-share";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { SquadDiagnosisCategoryId } from "@/lib/squad/squad-diagnosis";

type Status = "idle" | "image-saved" | "image-failed" | "copied" | "copy-failed";

/**
 * 診断履歴から選んだ2件の改善前後カード（F-043）。before/after は保存日時で自動的に決める（選択順では決めない）。
 * 画像保存（PNG）と比較の共有URL（2つの要約だけ・サーバー保存なし）を提供する。
 */
export function DiagnosisHistoryComparePanel({ entries, selectedIds, onClear }: { entries: DiagnosisHistoryEntry[]; selectedIds: string[]; onClear: () => void }) {
  const { locale } = useLocale();
  const { c, trend } = useCompareTexts();
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const picked = useMemo(() => selectedIds.map((id) => entries.find((e) => e.id === id)).filter((e): e is DiagnosisHistoryEntry => !!e), [entries, selectedIds]);

  const result = useMemo(() => {
    if (picked.length !== 2) return null;
    return compareDiagnoses({ payload: picked[0].payload, at: picked[0].savedAt, key: picked[0].id }, { payload: picked[1].payload, at: picked[1].savedAt, key: picked[1].id });
  }, [picked]);

  const ordered = useMemo(() => (picked.length === 2 && picked[1].savedAt < picked[0].savedAt ? [picked[1], picked[0]] : picked), [picked]);
  const url = useMemo(() => {
    if (!result?.ok || ordered.length !== 2 || typeof window === "undefined") return null;
    try {
      return buildCompareShareUrl(window.location.origin, ordered[0].payload, ordered[1].payload);
    } catch {
      return null;
    }
  }, [result, ordered]);

  if (picked.length < 2) return <p className="text-2xs text-text-muted">{c("selectHint")}</p>;
  if (!result) return null;

  async function saveImage() {
    if (!result?.ok) return;
    const texts = {
      serviceName: SQUAD_DIAGNOSIS_SHARE_SERVICE_NAME,
      title: c("title"),
      before: c("before"),
      after: c("after"),
      overall: c("overall"),
      trend,
      notRated: c("notRated"),
      summary: c("summaryTemplate")
        .replace("{improved}", String(result.comparison.counts.improved))
        .replace("{worsened}", String(result.comparison.counts.worsened))
        .replace("{unchanged}", String(result.comparison.counts.unchanged))
        .replace("{notComparable}", String(result.comparison.counts.notComparable)),
      disclaimer: c("disclaimer"),
      categoryLabel: (id: string) => diagnosisCategoryLabel(id as SquadDiagnosisCategoryId, locale),
    };
    const r = await saveDrawnCanvasAsPng((canvas) => drawDiagnosisComparisonImage(canvas, result.comparison, texts), `efootball-team-ai-before-after-${result.comparison.afterDate}.png`);
    setStatus(r.ok ? "image-saved" : "image-failed");
  }

  async function copy() {
    if (!url) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      inputRef.current?.select();
      setStatus("copy-failed");
    }
  }

  return (
    <div className="flex flex-col gap-3" data-compare-panel>
      {!result.ok ? (
        <p role="alert" className="text-sm text-warning" data-compare-error={result.reason}>
          {result.reason === "rules_mismatch" ? c("rulesMismatch") : result.reason === "same_entry" ? c("sameEntry") : c("invalid")}
        </p>
      ) : (
        <>
          <DiagnosisComparisonCard comparison={result.comparison} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" onClick={saveImage}>
              {c("saveImage")}
            </Button>
          </div>
          {url ? (
            <div className="flex flex-col gap-1 text-xs" data-compare-share>
              <label className="flex flex-col gap-1">
                <span className="font-medium">{c("shareLabel")}</span>
                <input ref={inputRef} readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-md border border-border bg-surface px-2 py-2 font-mono text-2xs" data-compare-url />
              </label>
              <p className="text-2xs text-text-muted">{c("shareNote")}</p>
              <Button type="button" size="sm" className="min-h-[44px] self-start" onClick={copy}>
                {c("copy")}
              </Button>
            </div>
          ) : null}
        </>
      )}
      <Button type="button" variant="ghost" size="sm" className="min-h-[44px] self-start" onClick={onClear}>
        {c("clearSelection")}
      </Button>
      {status === "image-saved" ? <p role="status" className="text-2xs text-success">{c("imageSaved")}</p> : null}
      {status === "image-failed" ? <p role="alert" className="text-2xs text-danger">{c("imageFailed")}</p> : null}
      {status === "copied" ? <p role="status" className="text-2xs text-success">{c("copied")}</p> : null}
      {status === "copy-failed" ? <p role="alert" className="text-2xs text-danger">{c("copyFailed")}</p> : null}
    </div>
  );
}
