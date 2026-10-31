"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/squadEditor";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import type { SquadQuickApplied } from "./useSquadQuickApply";

/** 「「<スカッド名>」に入れました」（スカッドへのリンク）と「元に戻す」（2026-10-31）。 */
export function SquadQuickAppliedNotice({ applied, onUndo, testId, className = "" }: { applied: SquadQuickApplied | null; onUndo: () => void; testId: string; className?: string }) {
  const t = useT();
  if (!applied) return null;
  return (
    <p role="status" className={`flex flex-wrap items-baseline gap-x-3 text-xs text-success ${className}`} data-testid={testId}>
      <Link href={`/squads/${encodeURIComponent(applied.squadId)}`} className="hover:underline">
        {fillMessage(t("provisionalCards", "squadFitAppliedTemplate"), { squad: applied.squadName })}
      </Link>
      <button type="button" onClick={onUndo} className="text-text-dim underline hover:text-text" data-testid={`${testId}-undo`}>
        {t("squadEditor", "undoButton")}
      </button>
    </p>
  );
}
