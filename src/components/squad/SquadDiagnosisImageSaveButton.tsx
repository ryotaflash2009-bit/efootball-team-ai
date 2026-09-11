"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SquadDiagnosisResult } from "@/lib/squad/squad-diagnosis";
import { buildSquadDiagnosisShareData, buildSquadDiagnosisFileName } from "@/lib/squad/squad-diagnosis-share";
import { saveSquadDiagnosisImageAsPng } from "@/lib/squad/squad-diagnosis-image";
import { Button } from "@/components/ui/Button";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";

type SaveStatus = "idle" | "generating" | "success" | "error";

/**
 * 診断結果をPNG画像として端末へ保存するボタン（読み取り専用・自動再試行なし）。
 * - 生成中は連打防止（ボタン無効化）。
 * - 成功/失敗を画面内テキストで通知（色だけに依存しない）。
 * - アンマウント後の setState を防ぐため mounted フラグで保護。
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
  const [status, setStatus] = useState<SaveStatus>("idle");
  const mountedRef = useRef(true);
  const resetTimerRef = useRef<number | null>(null);
  const { locale } = useLocale();
  const t = useT();

  useEffect(() => {
    // マウント毎に true へ戻す（React 18 StrictMode の開発時二重マウント＝
    // マウント→クリーンアップ→再マウントでも mounted 状態を正しく保つため）。
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current != null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (status === "generating") return; // 連打防止
    setStatus("generating");
    try {
      const now = new Date();
      const data = buildSquadDiagnosisShareData(result, {
        squadName,
        formationLabel,
        generatedAtIso: now.toISOString(),
      });
      const filename = buildSquadDiagnosisFileName(data.squadName, now);
      const outcome = await saveSquadDiagnosisImageAsPng(data, filename, locale);
      if (!mountedRef.current) return;
      setStatus(outcome.ok ? "success" : "error");
    } catch {
      if (mountedRef.current) setStatus("error");
    } finally {
      if (mountedRef.current) {
        resetTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) setStatus("idle");
        }, 3000);
      }
    }
  }, [result, squadName, formationLabel, status, locale]);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleSave}
        disabled={status === "generating"}
        aria-label={t("diagnosis", "pngSaveButtonAriaLabel")}
        aria-busy={status === "generating"}
        className="min-h-[44px]"
      >
        {status === "generating" ? t("diagnosis", "pngSaveGenerating") : t("diagnosis", "pngSaveButton")}
      </Button>
      {status === "success" ? (
        <span role="status" aria-live="polite" className="text-2xs text-success">
          {t("diagnosis", "pngSaveSuccess")}
        </span>
      ) : null}
      {status === "error" ? (
        <span role="alert" className="text-2xs text-danger">
          {t("diagnosis", "pngSaveError")}
        </span>
      ) : null}
    </div>
  );
}
