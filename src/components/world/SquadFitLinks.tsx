"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import type { SquadFit } from "@/lib/new-cards/card-squad-fit";

/** 1 枚のカードで強くなる保存スカッドの短い一覧（見出し・スカッドへのリンク・枠のポジション・2026-10-28）。無ければ何も出さない。 */
export function SquadFitLinks({ fits, testId }: { fits: readonly SquadFit[] | undefined; testId: string }) {
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
        </span>
      ))}
    </span>
  );
}
