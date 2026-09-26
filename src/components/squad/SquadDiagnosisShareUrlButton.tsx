"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SquadDiagnosisResult } from "@/lib/squad/squad-diagnosis";
import { buildSharePayload, buildShareUrl } from "@/lib/squad/squad-diagnosis-share-url";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LocaleContext";

type CopyStatus = "idle" | "copied" | "copy-failed" | "share-failed";

/**
 * 診断結果の共有URL（F-042）。サーバーへは何も送らない。
 * - 押すとプレビューを開き、URLに含まれる情報を列挙してから URL を作る（共有前の確認）。
 * - スカッド名・選手名・内部IDは含めない（診断の要約だけ）。
 * - コピーは Clipboard API、使えない場合は URL を選択して手動コピーを案内する。Web Share API があれば共有ボタンも出す。
 */
export function SquadDiagnosisShareUrlButton({
  result,
  formationLabel,
}: {
  result: SquadDiagnosisResult;
  formationLabel: string;
}) {
  const t = useT();
  const s = (k: Parameters<typeof t<"diagnosisShare">>[1]) => t("diagnosisShare", k);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [canShare, setCanShare] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const url = useMemo(() => {
    if (!open) return null;
    try {
      const payload = buildSharePayload(result, { date: new Date(), formationLabel });
      return buildShareUrl(window.location.origin, payload);
    } catch {
      return null;
    }
  }, [open, result, formationLabel]);

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

  async function share() {
    if (!url) return;
    try {
      await navigator.share({ title: s("pageTitle"), url });
    } catch (e) {
      // 利用者がキャンセルした場合(AbortError)は失敗として扱わない。
      if (!(e instanceof DOMException && e.name === "AbortError")) setStatus("share-failed");
    }
  }

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-[44px]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
          setStatus("idle");
        }}
      >
        {s("createButton")}
      </Button>
      {open ? (
        <div id={panelId} role="region" aria-label={s("previewTitle")} className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface-2/40 p-3 text-xs" data-share-preview>
          <h3 className="text-sm font-semibold">{s("previewTitle")}</h3>
          <p className="font-medium">{s("previewIncludes")}</p>
          <ul className="list-disc pl-5 text-text-dim">
            <li>{s("includeDate")}</li>
            <li>{s("includeOverall")}</li>
            <li>{s("includeCategories")}</li>
            <li>{s("includeFindings")}</li>
            <li>{s("includeRules")}</li>
            <li>{s("includeFormation")}</li>
          </ul>
          <p className="text-text-dim">{s("notIncluded")}</p>
          <p className="text-text-dim">{s("visibilityNote")}</p>
          <p className="text-text-dim">{s("notSecretNote")}</p>
          {url ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-medium">{s("urlLabel")}</span>
                <input
                  ref={inputRef}
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-md border border-border bg-surface px-2 py-2 font-mono text-2xs text-text"
                  data-share-url
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" className="min-h-[44px]" onClick={copy}>
                  {s("copyButton")}
                </Button>
                {canShare ? (
                  <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" onClick={share}>
                    {s("shareButton")}
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setOpen(false)}>
                  {s("closeButton")}
                </Button>
              </div>
            </>
          ) : (
            <p role="alert" className="text-danger">
              {s("createFailed")}
            </p>
          )}
          {status === "copied" ? (
            <p role="status" aria-live="polite" className="text-success">
              {s("copied")}
            </p>
          ) : null}
          {status === "copy-failed" ? (
            <p role="alert" className="text-danger">
              {s("copyFailed")}
            </p>
          ) : null}
          {status === "share-failed" ? (
            <p role="alert" className="text-danger">
              {s("shareFailed")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
