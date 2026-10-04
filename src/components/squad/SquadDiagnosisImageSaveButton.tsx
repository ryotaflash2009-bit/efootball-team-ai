"use client";

import "@/lib/i18n/dictionaries/ja-ns/diagnosis";
import "@/lib/i18n/dictionaries/ja-ns/shareCard";
import "@/lib/i18n/dictionaries/ja-ns/titles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SquadDiagnosisResult } from "@/lib/squad/squad-diagnosis";
import { buildSquadDiagnosisShareData, buildSquadDiagnosisFileName } from "@/lib/squad/squad-diagnosis-share";
import { drawSquadDiagnosisCard, renderCanvasToPngBlob, withRatioSuffix, SQUAD_CARD_RATIOS, type SquadCardRatio } from "@/lib/squad/squad-diagnosis-card";
import { canShareImageFiles, downloadBlobFile, shareOrSaveImage } from "@/lib/share-image";
import { evaluateDiagnosisTitles } from "@/lib/titles/diagnosis-titles";
import { DIAGNOSIS_TITLE_LABEL_KEY } from "@/components/titles/DiagnosisTitles";
import { Button } from "@/components/ui/Button";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type Status = "idle" | "generating" | "saved" | "shared" | "error";
type SkKey = keyof Dictionary["shareCard"];
const RATIO_KEY: Record<SquadCardRatio, SkKey> = { "3:4": "ratio34", "1:1": "ratio11", "9:16": "ratio916", "16:9": "ratio169" };

/**
 * 診断結果の画像（比率を選べる）を端末へ保存する・OS の共有へ渡す（F-041 / F-041b）。
 * - 3:4 は既存のカード（既定）。1:1・9:16・16:9 は称号とバッジも載せる。
 * - 生成中は操作を受け付けない（連打防止）。プレビューの Object URL は差し替え・アンマウント時に解放する。
 * - 共有シートを閉じたときはエラーにしない。共有できない環境では保存だけを表示する。
 */
export function SquadDiagnosisImageSaveButton({
  result,
  squadName,
  formationLabel,
}: {
  result: SquadDiagnosisResult;
  squadName: string;
  formationLabel: string;
}) {
  const { locale } = useLocale();
  const t = useT();
  const sk = (k: SkKey) => t("shareCard", k);
  const [ratio, setRatio] = useState<SquadCardRatio>("3:4");
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    setCanShare(canShareImageFiles());
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current != null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const titles = useMemo(() => {
    const r = evaluateDiagnosisTitles(Object.fromEntries(result.categories.map((c) => [c.id, { score: c.score, tier: c.tier }])));
    return {
      primary: r.primary ? t("titles", DIAGNOSIS_TITLE_LABEL_KEY[r.primary.categoryId]) : null,
      badges: r.badges.map((b) => t("titles", DIAGNOSIS_TITLE_LABEL_KEY[b.categoryId])),
    };
  }, [result, t]);

  const render = useCallback(
    async (r: SquadCardRatio, now: Date) => {
      const data = buildSquadDiagnosisShareData(result, { squadName, formationLabel, generatedAtIso: now.toISOString() });
      const blob = await renderCanvasToPngBlob((canvas) => drawSquadDiagnosisCard(canvas, data, locale, r, { titles }));
      return { blob, filename: withRatioSuffix(buildSquadDiagnosisFileName(data.squadName, now), r) };
    },
    [result, squadName, formationLabel, locale, titles],
  );

  // プレビューは「カードの内容」が変わったときだけ作り直す（親の再描画で result の参照だけが変わっても作り直さない。
  // 作り直すと古い URL を解放するため、読み込み中の画像が壊れる）。
  const renderRef = useRef(render);
  renderRef.current = render;
  const contentKey = useMemo(
    () =>
      JSON.stringify([
        locale,
        squadName,
        formationLabel,
        result.overall.score,
        result.overall.tier,
        result.categories.map((c) => [c.id, c.score, c.tier]),
        result.strengths[0]?.label ?? null,
        result.weaknesses[0]?.label ?? null,
        titles,
      ]),
    [locale, squadName, formationLabel, result, titles],
  );

  // プレビュー（開いている間だけ・比率や内容が変わるたびに作り直し、古い URL は解放する）。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    void renderRef.current(ratio, new Date()).then(({ blob }) => {
      if (cancelled || !blob || typeof URL.createObjectURL !== "function") return;
      url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [open, ratio, contentKey]);

  const finish = (s: Status) => {
    if (!mountedRef.current) return;
    setStatus(s);
    resetTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setStatus("idle");
    }, 3000);
  };

  const run = useCallback(
    async (mode: "save" | "share") => {
      if (busyRef.current) return; // 連打防止
      busyRef.current = true;
      setStatus("generating");
      try {
        const { blob, filename } = await render(ratio, new Date());
        if (!blob) return finish("error");
        if (mode === "save") return finish(downloadBlobFile(blob, filename) ? "saved" : "error");
        const r = await shareOrSaveImage(blob, filename, sk("shareTitle"));
        if (r.ok) return finish(r.method === "share" ? "shared" : "saved");
        if (r.reason === "cancelled") return finish("idle");
        return finish("error");
      } catch {
        finish("error");
      } finally {
        busyRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [render, ratio],
  );

  const generating = status === "generating";
  return (
    <div className="mt-3 flex flex-col gap-2" data-testid="share-card">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void run("save")}
          disabled={generating}
          aria-label={t("diagnosis", "pngSaveButtonAriaLabel")}
          aria-busy={generating}
          className="min-h-[44px]"
          data-testid="share-card-save"
        >
          {generating ? t("diagnosis", "pngSaveGenerating") : t("diagnosis", "pngSaveButton")}
        </Button>
        {canShare ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void run("share")} disabled={generating} className="min-h-[44px]" data-testid="share-card-share">
            {sk("shareButton")}
          </Button>
        ) : null}
        {status === "saved" ? (
          <span role="status" aria-live="polite" className="text-2xs text-success">
            {t("diagnosis", "pngSaveSuccess")}
          </span>
        ) : null}
        {status === "shared" ? (
          <span role="status" aria-live="polite" className="text-2xs text-success">
            {sk("shared")}
          </span>
        ) : null}
        {status === "error" ? (
          <span role="alert" className="text-2xs text-danger">
            {t("diagnosis", "pngSaveError")}
          </span>
        ) : null}
      </div>
      <details className="rounded-md border border-border bg-surface-2/30 px-3 py-1" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="flex min-h-[44px] cursor-pointer items-center text-xs font-semibold">{sk("optionsSummary")}</summary>
        <div className="flex flex-col gap-2 pb-2">
          <div role="radiogroup" aria-label={sk("ratioLabel")} className="flex flex-wrap gap-1.5">
            {SQUAD_CARD_RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={ratio === r}
                onClick={() => setRatio(r)}
                className={`min-h-[44px] rounded border px-3 text-xs ${ratio === r ? "border-accent bg-accent/15 font-semibold text-text" : "border-border text-text-dim hover:border-accent"}`}
                data-ratio={r}
              >
                {sk(RATIO_KEY[r])}
              </button>
            ))}
          </div>
          <div className="flex max-w-full justify-center rounded bg-black/30 p-2" data-testid="share-card-preview">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ブラウザー内で作った Blob の一時プレビュー
              <img src={previewUrl} alt={sk("previewAltTemplate").replace("{ratio}", sk(RATIO_KEY[ratio]))} className="h-auto max-h-[60vh] w-auto max-w-full rounded" />
            ) : (
              <p className="py-6 text-2xs text-text-muted" role="status">
                {sk("previewLoading")}
              </p>
            )}
          </div>
          <p className="text-2xs text-text-muted">{sk("privacyNote")}</p>
        </div>
      </details>
    </div>
  );
}
