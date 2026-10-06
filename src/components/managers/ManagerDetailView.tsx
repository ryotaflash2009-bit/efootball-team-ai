"use client";

import "@/lib/i18n/dictionaries/ja-ns/managerDetail";
import Link from "next/link";
import type { ManagerDetail } from "@/lib/managers/types";
import { ProficiencyBar } from "@/components/managers/ProficiencyBar";
import { topTactic, tacticTier, TACTIC_TEXT, managerInitials } from "@/components/managers/tactics";
import { PageContainer } from "@/components/ui/PageContainer";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { DISPLAY_TIME_ZONE, formatDateTime } from "@/lib/i18n/format";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Locale } from "@/lib/i18n/locale";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { fillMessage } from "@/lib/i18n/message-format";

const fill = (s: string, vars: Record<string, string>) => fillMessage(s, vars);

function fmt(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (locale !== "ja") return formatDateTime(d, locale);
  // サーバー(Vercel、UTC)の時間帯に依存せず、日本時間で時間帯名を付けて表示する(src/lib/i18n/format.tsと同じ方針)。
  return d.toLocaleString("ja-JP", { hour12: false, timeZone: DISPLAY_TIME_ZONE, timeZoneName: "short" });
}

function useTm() {
  const t = useT();
  return (k: keyof Dictionary["managerDetail"]) => t("managerDetail", k);
}

/** 監督データが読めないとき（表示言語に合わせる）。 */
export function ManagerUnavailableView() {
  const tm = useTm();
  return (
    <PageContainer>
      <EmptyState
        variant="error"
        icon="database"
        title={tm("unavailableTitle")}
        action={
          <Link href="/managers" className="text-sm text-accent">
            {tm("backToList")}
          </Link>
        }
      />
    </PageContainer>
  );
}

/**
 * 監督詳細の表示（2026-10-04: 英語表示で日本語が残っていたため、サーバーのページから表示部分を分けて翻訳した）。
 * データの取得・404 はサーバーのページ（app/managers/[managerId]/page.tsx）のまま。
 */
export function ManagerDetailView({ manager }: { manager: ManagerDetail }) {
  const tm = useTm();
  const { locale } = useLocale();
  const top = topTactic(manager.proficiencies);

  const NOT_IN_SOURCE = [
    { label: tm("labelAge"), value: manager.age },
    { label: tm("labelNationality"), value: manager.nationality },
    { label: tm("labelTeam"), value: manager.teamName },
    { label: tm("labelRating"), value: manager.managerRating },
    { label: "Coaching Affinity", value: manager.coachingAffinity },
    { label: tm("labelFormation"), value: manager.formation },
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <Link href="/managers" className="inline-flex w-fit items-center gap-1 text-sm text-text-dim hover:text-accent">
          <Icon name="chevron-left" size={16} />
          {tm("backToList")}
        </Link>

        {/* ヒーロー */}
        <Surface tone="raised" padding="lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-3 text-xl font-black text-text-dim">
              {managerInitials(manager.nameEn)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold">{manager.nameEn}</h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone="neutral">{fill(tm("releaseBadgeTemplate"), { date: manager.releasedAt ?? tm("unknown") })}</Badge>
                <Badge tone="outline">ID {manager.internalManagerId}</Badge>
                <Badge tone="outline">{fill(tm("sourceBadgeTemplate"), { id: String(manager.sourceManagerId) })}</Badge>
                {manager.hasLinkUpPlay ? <Badge tone="info">Link-Up Play</Badge> : null}
              </div>
            </div>
            {top ? (
              <div className="shrink-0 rounded-md border border-border bg-surface px-4 py-2 text-center">
                <p className="text-2xs text-text-muted">{tm("bestTactic")}</p>
                <p className="text-sm font-semibold">{top.en}</p>
                <p className={`text-2xl font-black tabular-nums ${TACTIC_TEXT[tacticTier(top.value)]}`}>{top.value}</p>
              </div>
            ) : null}
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 戦術適性 */}
          <Surface>
            <SectionHeader title={tm("proficiencyTitle")} as="h2" hint={tm("proficiencyHint")} />
            <ProficiencyBar proficiencies={manager.proficiencies} showRank />
          </Surface>

          {/* 監督ブースター */}
          <Surface>
            <SectionHeader
              title={tm("boosterTitle")}
              as="h2"
              action={
                manager.boosterConfirmation === "confirmed" ? (
                  <Badge tone="success" size="xs">{tm("boosterConfirmed")}</Badge>
                ) : (
                  <Badge tone="warning" size="xs">{tm("boosterUnconfirmed")}</Badge>
                )
              }
            />
            {manager.boosters.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {manager.boosters.map((b, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-surface-2/40 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{b.statNameEn}</span>
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-xs font-bold text-success tabular-nums">
                      {b.rawValue}
                    </span>
                    <span className="ms-auto text-2xs text-text-dim">
                      {b.applicationCondition ?? tm("boosterUnconditional")}
                    </span>
                    <Badge tone={b.confirmationStatus === "confirmed" && b.statKey ? "success" : "warning"} size="xs">
                      {b.confirmationStatus === "confirmed" && b.statKey ? "confirmed" : `${b.confirmationStatus}${b.statKey ? "" : tm("boosterKeyUnmapped")}`}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-dim">{tm("boosterNone")}</p>
            )}
            <p className="mt-2 text-2xs text-text-muted">
              {tm("boosterNote")}
            </p>
          </Surface>
        </div>

        {/* Link-Up Play */}
        <Surface>
          <SectionHeader title="Link-Up Play" as="h2" hint={tm("linkUpHint")} />
          {manager.linkUpPlays.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {manager.linkUpPlays.map((lu, i) => (
                <li key={i} className="rounded-md border border-border bg-surface-2/40 p-3 text-sm">
                  <p className="font-semibold">{lu.name}</p>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt className="text-2xs text-text-muted">{tm("centerPieceLabel")}</dt>
                      <dd className="mt-0.5">
                        {lu.centerPiece
                          ? `${lu.centerPiece.playingStyle ?? "?"} / ${lu.centerPiece.positions.join(", ") || "?"}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-2xs text-text-muted">{tm("keyManLabel")}</dt>
                      <dd className="mt-0.5">
                        {lu.keyMan
                          ? `${lu.keyMan.playingStyle ?? "?"} / ${lu.keyMan.positions.join(", ") || "?"}`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-dim">{tm("linkUpNone")}</p>
          )}
        </Surface>

        {/* ソース非収録 */}
        <Surface tone="outline">
          <SectionHeader title={tm("notInSourceTitle")} as="h2" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
            {NOT_IN_SOURCE.map((r) => (
              <div key={r.label}>
                <dt className="text-2xs text-text-muted">{r.label}</dt>
                <dd className="mt-0.5 font-medium">{r.value ?? tm("notInSourceValue")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-2xs text-text-muted">
            {fill(tm("dataSourceTemplate"), { source: String(manager.source), fetchedAt: fmt(manager.fetchedAt, locale) })}
            {manager.sourceUrl ? (
              <>
                {" "}
                ・
                <a
                  href={manager.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-1 text-accent underline underline-offset-2"
                >
                  {tm("openSource")}
                </a>
              </>
            ) : null}
          </p>
        </Surface>
      </div>
    </PageContainer>
  );
}
