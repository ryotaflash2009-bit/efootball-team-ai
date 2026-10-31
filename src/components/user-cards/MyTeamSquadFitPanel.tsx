"use client";

import "@/lib/i18n/dictionaries/ja-ns/myTeam";
import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/squadEditor";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";
import { useSavedSquadFitInputs } from "@/components/world/useSavedSquadFitInputs";
import { squadsStrengthenedByCard, type SquadFit } from "@/lib/new-cards/card-squad-fit";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { useSquadQuickApply } from "@/components/world/useSquadQuickApply";
import { SquadQuickAppliedNotice } from "@/components/world/SquadQuickAppliedNotice";

/** 最初に出す行数（残りは「すべて表示」）。 */
const INITIAL_ROWS = 5;

/**
 * My Team: 保存スカッドを強くできる所持カード（2026-10-28）。所持のカードごとに選手の詳細の欄と同じ規則
 * （`squadsStrengthenedByCard`）で当て、当てられたカードだけを最大の差の大きい順に出す。無ければ何も出さない。
 */
export function MyTeamSquadFitPanel() {
  const t = useT();
  const { locale } = useLocale();
  const tm = (k: Parameters<typeof t<"myTeam">>[1]) => t("myTeam", k);
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const { owned } = useOwnedCards();
  // 「入れ替える」でその場でスカッドに入れる（選手の詳細の欄と同じ・2026-10-31）
  const { version, applied, apply, undo } = useSquadQuickApply();
  const inputs = useSavedSquadFitInputs(version);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    if (!inputs || inputs.length === 0) return [];
    const out: { card: WorldPlayerListItem; fits: SquadFit[] }[] = [];
    for (const card of owned) {
      const fits = squadsStrengthenedByCard(card, inputs);
      if (fits.length > 0) out.push({ card, fits });
    }
    const best = (r: (typeof out)[number]) => r.fits[0].delta ?? -1;
    return out.sort((a, b) => best(b) - best(a) || a.card.worldCardId.localeCompare(b.card.worldCardId));
  }, [owned, inputs]);

  if (rows.length === 0 && !applied) return null;
  return (
    <details className="rounded-card border border-border bg-surface p-3" data-testid="my-team-squad-fit" open>
      <summary className="flex min-h-[36px] cursor-pointer items-center text-sm font-semibold">{tm("squadFitHeading")}</summary>
      <p className="mt-1 text-2xs text-text-dim">{tm("squadFitIntro")}</p>
      <SquadQuickAppliedNotice applied={applied} onUndo={undo} testId="my-team-squad-fit-applied" className="mt-1" />
      <ul className="mt-2 flex flex-col divide-y divide-border">
        {(all ? rows : rows.slice(0, INITIAL_ROWS)).map(({ card, fits }) => (
          <li key={card.worldCardId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-xs" data-world-card-id={card.worldCardId}>
            <Link href={`/players/world/${card.worldCardId}`} className="min-w-0 truncate font-semibold text-accent hover:underline">
              {resolvePlayerDisplayName(card, locale)}
            </Link>
            {fits.map((f) => (
              <span key={f.squadId} className="inline-flex items-baseline gap-1">
                <Link href={`/squads/${encodeURIComponent(f.squadId)}`} className="text-accent hover:underline" data-testid="my-team-squad-fit-link">
                  {f.squadName}
                </Link>
                <span className="font-bold text-text-dim">{f.position}</span>
                {f.delta != null ? <span className="tabular-nums text-success">+{f.delta}</span> : null}
                <button
                  type="button"
                  onClick={() => apply(f.squadId, f.slotId, card.worldCardId)}
                  className="rounded border border-accent px-1.5 text-2xs font-semibold text-accent hover:bg-accent-soft"
                  data-testid="my-team-squad-fit-apply"
                >
                  {f.current ? t("squadEditor", "samePlayerSwapButton") : fillMessage(t("squadEditor", "addToSlotLabelTemplate"), { position: f.position })}
                </button>
              </span>
            ))}
          </li>
        ))}
      </ul>
      {rows.length > INITIAL_ROWS ? (
        <button type="button" className="mt-1 w-fit rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2" onClick={() => setAll((v) => !v)}>
          {all ? tp("showLess") : fillMessage(tp("showAllTemplate"), { count: String(rows.length) })}
        </button>
      ) : null}
    </details>
  );
}
