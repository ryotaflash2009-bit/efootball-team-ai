"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import { useState } from "react";
import { comparisonHref } from "@/lib/comparison/schemas";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 育成の配分をリンクで共有する（2026-10-09）。比較の画面の URL（`ids`・`al`）をそのまま使い、新しい形式は作らない。
 * リンクに入るのは World のカード ID とカテゴリのレベルだけ（ビルド名・メモ・端末の保存データは入れない）。
 */
export function buildShareHref(worldCardId: string, allocation: Record<string, number>): string | null {
  if (!Object.values(allocation).some((v) => v > 0)) return null;
  const href = comparisonHref({ ids: [worldCardId], buildModes: ["none"], managerIds: [null], conditionalTiers: ["none"], allocations: [allocation] });
  return href.includes("al=") ? href : null;
}

export function ShareBuildLink({ worldCardId, allocation, compact = false }: { worldCardId: string; allocation: Record<string, number>; compact?: boolean }) {
  const t = useT();
  const tp = (k: "shareBuildLinkButton" | "shareBuildLinkCopied" | "shareBuildLinkFallback" | "shareBuildLinkNote") => t("progressionTab", k);
  const [state, setState] = useState<{ kind: "copied" | "fallback"; url: string } | null>(null);
  const href = buildShareHref(worldCardId, allocation);

  const onCopy = async () => {
    if (!href) return;
    const url = `${window.location.origin}${href}`;
    try {
      // 許可の確認などで終わらないことがあるため、2 秒で諦めてリンクの欄を出す。
      await Promise.race([
        navigator.clipboard.writeText(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
      ]);
      setState({ kind: "copied", url });
    } catch {
      setState({ kind: "fallback", url });
    }
  };

  return (
    <div className={compact ? "text-2xs" : "mt-2 text-2xs"} data-testid="share-build-link">
      <button
        type="button"
        disabled={!href}
        onClick={() => void onCopy()}
        className={`min-h-[36px] rounded-md border border-border ${compact ? "px-2 text-2xs" : "px-3 text-xs"} text-text-dim hover:enabled:border-accent disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {tp("shareBuildLinkButton")}
      </button>
      {state ? (
        <p role="status" aria-live="polite" className={state.kind === "copied" ? "mt-1 text-success" : "mt-1 text-warning"}>
          {tp(state.kind === "copied" ? "shareBuildLinkCopied" : "shareBuildLinkFallback")}
        </p>
      ) : null}
      {state?.kind === "fallback" ? (
        <input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-2xs" data-testid="share-build-link-url" />
      ) : null}
      {compact ? null : <p className="mt-1 text-text-muted">{tp("shareBuildLinkNote")}</p>}
    </div>
  );
}
