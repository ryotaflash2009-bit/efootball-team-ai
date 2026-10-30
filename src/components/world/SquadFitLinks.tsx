"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/squadEditor";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import type { SquadFit } from "@/lib/new-cards/card-squad-fit";
import { fillMessage } from "@/lib/i18n/message-format";

/**
 * 1 枚のカードで強くなる保存スカッドの短い一覧（見出し・スカッドへのリンク・枠のポジション・2026-10-28）。無ければ何も出さない。
 * onApply を渡すと、スカッドごとに「入れ替える」（空いている枠は「<ポジション> へ追加」）を出す（2026-10-31）。
 */
export function SquadFitLinks({ fits, testId, onApply }: { fits: readonly SquadFit[] | undefined; testId: string; onApply?: (fit: SquadFit) => void }) {
  const t = useT();
  if (!fits || fits.length === 0) return null;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-xs" data-testid={testId}>
      <span className="text-text-dim">{t("provisionalCards", "squadFitHeading")}</span>
      {fits.map((f) => (
        <span key={f.squadId} className="inline-flex items-baseline gap-1">
          <Link href={`/squads/${encodeURIComponent(f.squadId)}`} className="text-accent hover:underline">
            {f.squadName}
          </Link>
          <span className="font-bold text-text-dim">{f.position}</span>
          {onApply ? (
            <button
              type="button"
              onClick={() => onApply(f)}
              className="rounded border border-accent px-1.5 text-2xs font-semibold text-accent hover:bg-accent-soft"
              data-testid={`${testId}-apply`}
            >
              {f.current ? t("squadEditor", "samePlayerSwapButton") : fillMessage(t("squadEditor", "addToSlotLabelTemplate"), { position: f.position })}
            </button>
          ) : null}
        </span>
      ))}
    </span>
  );
}
