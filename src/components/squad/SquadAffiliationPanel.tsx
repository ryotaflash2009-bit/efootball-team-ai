"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { SQUAD_AFFILIATION_KINDS, type SquadAffiliationSummary } from "@/lib/squad/affiliation-summary";
import { playersFilterHref } from "@/lib/world/filter-patterns";

/** 先発の国籍・リーグ・チームの内訳（2 人以上の値だけ・2026-10-11）。値は選手一覧の絞り込みへのリンク。 */
export function SquadAffiliationPanel({ summary }: { summary: SquadAffiliationSummary }) {
  const t = useT();
  if (summary.known === 0) return null;
  const any = SQUAD_AFFILIATION_KINDS.some((k) => summary.groups[k].length > 0);
  const label = { nationality: t("squadEditor", "affiliationNationality"), league: t("squadEditor", "affiliationLeague"), team: t("squadEditor", "affiliationTeam") };
  return (
    <section className="rounded-card border border-border bg-surface p-3 text-xs sm:p-4" data-testid="squad-affiliation-summary">
      <h2 className="text-sm font-semibold text-text">{t("squadEditor", "affiliationHeading")}</h2>
      <p className="mt-1 text-2xs text-text-muted">{t("squadEditor", "affiliationNote")}</p>
      {any ? (
        <dl className="mt-2 grid gap-2 sm:grid-cols-3">
          {SQUAD_AFFILIATION_KINDS.map((kind) => (
            <div key={kind}>
              <dt className="text-2xs text-text-muted">{label[kind]}</dt>
              <dd className="mt-0.5 flex flex-col gap-0.5">
                {summary.groups[kind].length > 0
                  ? summary.groups[kind].map((g) => {
                      const href = playersFilterHref(kind, g.value);
                      return (
                        <span key={g.value} data-affiliation-kind={kind}>
                          {href ? (
                            <Link href={href} className="text-accent hover:underline">
                              {g.value}
                            </Link>
                          ) : (
                            g.value
                          )}{" "}
                          <span className="font-semibold text-text">×{g.count}</span>
                        </span>
                      );
                    })
                  : "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-text-dim">{t("squadEditor", "affiliationNoneShared")}</p>
      )}
      {summary.unknown > 0 ? (
        <p className="mt-2 text-2xs text-text-muted">{t("squadEditor", "affiliationUnknownTemplate").replace("{count}", String(summary.unknown))}</p>
      ) : null}
    </section>
  );
}
