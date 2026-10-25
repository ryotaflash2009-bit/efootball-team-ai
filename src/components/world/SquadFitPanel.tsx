"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { Surface } from "@/components/ui/Surface";
import { squadsStrengthenedByCard } from "@/lib/new-cards/card-squad-fit";
import { useSavedSquadFitInputs } from "./useSavedSquadFitInputs";
import type { ImpactCard } from "@/lib/new-cards/team-impact";

/** 最初に出す行数（残りは「すべて表示」）。 */
const INITIAL_ROWS = 5;

/**
 * 選手の詳細: このカードで強くなる保存スカッド（2026-10-26）。スカッドはブラウザーの中だけ（hydration の後に読む）。
 * 当てられるスカッドが無ければ何も出さない。カードを読めていない枠は「空き」と誤って扱わないよう除く。
 */
export function SquadFitPanel({ card }: { card: ImpactCard }) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const inputs = useSavedSquadFitInputs();
  const [all, setAll] = useState(false);
  const fits = useMemo(() => (inputs && inputs.length > 0 ? squadsStrengthenedByCard(card, inputs) : []), [inputs, card]);

  if (fits.length === 0) return null;
  const name = (c: ImpactCard) => resolvePlayerDisplayName(c, locale);
  const basis = (b: "max" | "base") => tp(b === "max" ? "impactBasisMax" : "impactBasisBase");
  return (
    <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="squad-fit">
      <h2 className="font-semibold">{tp("squadFitHeading")}</h2>
      <p className="text-xs text-text-dim">{tp("squadFitIntro")}</p>
      <ul className="flex flex-col divide-y divide-border">
        {(all ? fits : fits.slice(0, INITIAL_ROWS)).map((f) => (
          <li key={f.squadId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5" data-squad-id={f.squadId}>
            <Link href={`/squads/${encodeURIComponent(f.squadId)}`} className="min-w-0 truncate font-semibold text-accent hover:underline">
              {f.squadName}
            </Link>
            <span className="text-xs font-bold text-text-dim">{f.position}</span>
            <span className="text-xs text-text-dim">
              {f.delta == null
                ? fillMessage(tp("squadSuggestEmptySlotTemplate"), { basis: basis(f.basis), newOvr: String(f.newOvr) })
                : fillMessage(tp("squadSuggestRowTemplate"), {
                    basis: basis(f.basis),
                    newOvr: String(f.newOvr),
                    currentName: f.current ? name(f.current) : "—",
                    currentOvr: String(f.currentOvr),
                    delta: String(f.delta),
                  })}
            </span>
          </li>
        ))}
      </ul>
      {fits.length > INITIAL_ROWS ? (
        <button type="button" className="w-fit rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2" onClick={() => setAll((v) => !v)}>
          {all ? tp("showLess") : fillMessage(tp("showAllTemplate"), { count: String(fits.length) })}
        </button>
      ) : null}
    </Surface>
  );
}
