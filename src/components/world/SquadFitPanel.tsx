"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { Surface } from "@/components/ui/Surface";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { listSquads } from "@/lib/squad/squad-storage";
import { getFormation } from "@/lib/squad/formations";
import type { StoredSquad } from "@/lib/squad/types";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import { squadsStrengthenedByCard, type SquadFitInput } from "@/lib/new-cards/card-squad-fit";
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
  const scopeState = useSyncedStorageScope();
  const [squads, setSquads] = useState<StoredSquad[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (scopeState.status === "loading") {
      setSquads(null);
      return;
    }
    setSquads(listSquads());
  }, [scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = useMemo(() => [...new Set((squads ?? []).flatMap((s) => s.slots.map((x) => x.worldCardId)).filter((x): x is string => !!x))], [squads]);
  const { cards, loading } = useResolvedCards(ids);
  const fits = useMemo(() => {
    if (!squads || squads.length === 0 || loading) return [];
    const inputs: SquadFitInput[] = squads.map((sq) => {
      const posBySlot = new Map(getFormation(sq.formationId).slots.map((s) => [s.slotId, s.position]));
      return {
        squadId: sq.squadId,
        squadName: sq.squadName,
        slots: sq.slots.flatMap((sl) => {
          const c = sl.worldCardId ? cards.get(sl.worldCardId) : null;
          if (sl.worldCardId && !c) return [];
          return [{ slotId: sl.slotId, position: posBySlot.get(sl.slotId) ?? "", current: c ?? null }];
        }),
        inSquad: new Set([...sq.slots.map((s) => s.worldCardId), ...sq.substitutes.map((s) => s.worldCardId)].filter((x): x is string => !!x)),
      };
    });
    return squadsStrengthenedByCard(card, inputs);
  }, [squads, cards, loading, card]);

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
