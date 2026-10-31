"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/packCheck";
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { Surface } from "@/components/ui/Surface";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { MyTeamButton } from "@/components/user-cards/MyTeamButton";
import { addToMyTeam } from "@/lib/user-cards/my-team-storage";
import { fillMessage } from "@/lib/i18n/message-format";

/**
 * スカッドのうち My Team で「所持」になっていないカード（2026-10-31）。My Team に所持のカードが 1 枚以上ある人だけに出す。
 * 「欲しい」などで登録済みのカードは MyTeamButton が「登録済み」と出す（状態は My Team で変える）。
 */
export function SquadNotOwnedPanel({ cards }: { cards: { worldCardId: string; nameJa: string | null; nameEn: string | null; position: string }[] }) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const { myTeam, getByWorldId } = useMyTeam();
  const rows = useMemo(() => {
    const owned = new Set(myTeam.filter((r) => r.ownershipStatus === "owned" && !r.deletedAt).map((r) => r.worldCardId));
    if (owned.size === 0) return [];
    const seen = new Set<string>();
    return cards.filter((c) => !owned.has(c.worldCardId) && !seen.has(c.worldCardId) && seen.add(c.worldCardId));
  }, [myTeam, cards]);
  // まだ My Team に無いカードを「所持」でまとめて追加（パック診断と同じ・2026-11-01）。「欲しい」などで登録済みのカードは変えない
  const notRegistered = rows.filter((c) => !getByWorldId(c.worldCardId));
  if (rows.length === 0) return null;
  return (
    <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="squad-not-owned">
      <h2 className="font-semibold">{tp("squadNotOwnedHeading")}</h2>
      <p className="text-xs text-text-dim">{tp("squadNotOwnedIntro")}</p>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((c) => {
          const name = resolvePlayerDisplayName(c, locale, c.worldCardId);
          return (
            <li key={c.worldCardId} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5" data-world-card-id={c.worldCardId}>
              <span className="w-10 shrink-0 text-xs font-bold text-text-dim">{c.position}</span>
              <Link href={`/players/world/${c.worldCardId}`} className="font-semibold text-accent hover:underline">
                {name}
              </Link>
              <MyTeamButton worldCardId={c.worldCardId} playerName={name} variant="compact" className="ms-auto" />
            </li>
          );
        })}
      </ul>
      {notRegistered.length > 0 ? (
        <button
          type="button"
          onClick={() => notRegistered.forEach((c) => addToMyTeam({ worldCardId: c.worldCardId, ownershipStatus: "owned" }))}
          className="inline-flex min-h-[36px] w-fit items-center rounded-md border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent-soft"
          data-testid="squad-not-owned-add-all"
        >
          {fillMessage(t("packCheck", "addAllTemplate"), { count: String(notRegistered.length) })}
        </button>
      ) : null}
    </Surface>
  );
}
