"use client";

import Link from "next/link";
import type { ManagerListItem } from "@/lib/managers/types";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { ProficiencyBar } from "./ProficiencyBar";
import { topTactic, tacticTier, TACTIC_TEXT, managerInitials } from "./tactics";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";

/** 監督一覧の1カード。名前 → 得意戦術 → ブースター → 残り適性 の優先順位。 */
export function ManagerCard({ manager }: { manager: ManagerListItem }) {
  const t = useT();
  const { locale } = useLocale();
  const top = topTactic(manager.proficiencies);
  const initials = managerInitials(manager.nameEn);
  const displayName = resolvePlayerDisplayName(manager, locale, manager.nameEn);

  return (
    <Link
      href={`/managers/${manager.internalManagerId}`}
      className="group flex h-full flex-col rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-surface-2 text-sm font-black text-text-dim">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{displayName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-text-muted">
            <span>
              {t("managerPicker", "releasedPrefix")}
              {manager.releasedAt ?? t("managerPicker", "unknownReleased")}
            </span>
            <span>
              {t("managerPicker", "idPrefix")}
              {manager.internalManagerId}
            </span>
          </p>
        </div>
        <Icon
          name="chevron-right"
          size={16}
          className="mt-1 shrink-0 text-text-muted transition-colors group-hover:text-accent"
        />
      </div>

      {/* 得意戦術 */}
      {top ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xs text-text-muted">{t("managerCard", "bestTacticLabel")}</span>
          <span className="text-sm font-semibold">{top.en}</span>
          <span className="text-2xs text-text-dim">{top.ja}</span>
          <span className={`ml-auto text-lg font-black tabular-nums ${TACTIC_TEXT[tacticTier(top.value)]}`}>
            {top.value}
          </span>
        </div>
      ) : null}

      {/* ブースター & Link-Up */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {manager.hasLinkUpPlay ? (
          <Badge tone="info" size="xs">
            <Icon name="sparkles" size={10} />
            Link-Up Play
          </Badge>
        ) : null}
        {manager.boosterSummary.length > 0 ? (
          manager.boosterSummary.map((b, i) => (
            <Badge key={i} tone="accent" size="xs">
              {b}
            </Badge>
          ))
        ) : (
          <Badge tone="outline" size="xs">
            {t("managerPicker", "noBoosterBadge")}
          </Badge>
        )}
      </div>

      {/* 残りの戦術適性 */}
      <div className="mt-3 border-t border-border/60 pt-2.5">
        <ProficiencyBar proficiencies={manager.proficiencies} compact />
      </div>
    </Link>
  );
}
