"use client";

import "@/lib/i18n/dictionaries/ja-ns/sourceRatings";
import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { isCardLevelMatch, matchCard, recordBadgeRating, type SourceCardRef, type SourceMatch } from "@/lib/dev/source-ratings";
import { useSameNameOvrCount, useSourceRatings } from "./use-source-ratings";

/**
 * 開発用: 外部ソースの Tier・順位のバッジ（2026-11-04）。呼び出し側が `next dev` のときだけ置く。
 * このカードのものと言える記録（カード番号・能力値・種別などの一致、名前と総合値の一致）だけを出す。
 * 候補が複数ある記録には「?」を付ける。名前と総合値の一致は、同名・同総合値のカードが 1 枚だけと確かめられたときだけ確定の色にする。
 * 一覧（compact）では枚数を数えない（カードごとに API を呼ばない）ため、名前と総合値の一致は常に「?」。
 */
export function SourceRatingsBadges({ card, compact = false }: { card: SourceCardRef; compact?: boolean }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"sourceRatings">>[1]) => t("sourceRatings", k);
  const state = useSourceRatings();
  const matches = useMemo(() => (state.kind === "ok" ? uniqueBySourceAndRating(matchCard(state.index, card).filter((m) => isCardLevelMatch(m.kind))) : []), [state, card]);
  const sameNameOvr = useSameNameOvrCount(card, !compact && matches.some((m) => m.kind === "nameOvr"));

  if (matches.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" data-testid="source-ratings-badges">
      {matches.map((m) => {
        const uncertain = m.kind === "candidate" || (m.kind === "nameOvr" && (compact || sameNameOvr !== 1));
        const title =
          m.kind === "candidate" ? fillMessage(tp("matchCandidateTemplate"), { count: String(m.record.resolved_card_ids.length) }) : uncertain ? tp("badgeUncertainTitle") : undefined;
        return (
          <li key={`${m.record.source}\u0000${recordBadgeRating(m.record)}`} title={title} data-match={m.kind} data-uncertain={uncertain || undefined}>
            <Badge tone={m.kind === "cardId" || m.kind === "stats" ? "accent" : uncertain ? "outline" : "info"} size={compact ? "xs" : "sm"}>
              {fillMessage(tp("badgeTemplate"), { source: m.record.source, rating: recordBadgeRating(m.record) })}
              {uncertain ? "?" : null}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

/** 同じ選手が同じソースの複数の表に載っている場合、同じ表記のバッジは 1 つにする。 */
function uniqueBySourceAndRating(matches: SourceMatch[]): SourceMatch[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const key = `${m.record.source}\u0000${recordBadgeRating(m.record)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
