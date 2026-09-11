"use client";

import Link from "next/link";
import type { ComparisonPlayerInput } from "@/lib/comparison/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { boosterChipsForCard } from "@/lib/world/search-card";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Badge } from "@/components/ui/Badge";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";

/**
 * 比較列の上部に出すコンパクトなカード識別表示。
 * 検索結果カードと同じ画像解決・ブースターチップを再利用（外部取得なし・複製なし）。
 * 4 人比較でも潰れないよう、詳細情報は折りたたむ。
 */
export function ComparePlayerIdentityCard({
  player,
  trainingLabel,
  columnCount,
}: {
  player: ComparisonPlayerInput;
  /** 現在の育成状態の短い説明（「育成なし」「手動育成」「保存ビルド: X」「攻撃重視」など）。 */
  trainingLabel: string;
  /** 現在の比較人数（4 人ならさらにコンパクトに）。 */
  columnCount: number;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tci = (k: keyof Dictionary["comparePlayerIdentityCard"]) => t("comparePlayerIdentityCard", k);
  const fillCi = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const d = player.display;
  const name = resolvePlayerDisplayName(d, locale, fillCi(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: d.worldCardId }));
  const sources = resolveCardImageSources({
    worldCardId: d.worldCardId,
    efhubCardId: d.efhubCardId,
    hasEfhubLink: d.hasEfhubLink,
    hasWorldImage: d.imageUrlCandidate != null && d.imageUrlCandidate !== "",
    hasWorldMobileImage: d.mobileImageUrlCandidate != null && d.mobileImageUrlCandidate !== "",
  });
  const chips = boosterChipsForCard({ boost1: player.card.boost1, boost2: player.card.boost2 });
  const pom = (player.selectedConditionalBoosters ?? []).find((c) => c.selection !== "none") ?? null;
  const teamLine = [d.team, d.nationality].filter((v): v is string => !!v).join(" · ");
  const compact = columnCount >= 3;

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`mx-auto ${compact ? "w-16" : "w-24"}`}>
        <WorldCardImage sources={sources} alt={fillCi(tci("cardImageAltTemplate"), { name, cardType: d.cardType ?? "" })} size="card" />
      </div>

      <div className="text-center">
        <p className="truncate text-sm font-semibold" title={name}>
          {name}
        </p>
        <p className="truncate text-[11px] text-text-dim" title={d.nameEn ?? ""}>
          {d.nameEn || tci("noEnglishName")}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
          {d.registeredPosition ? <Badge tone="neutral" size="xs">{d.registeredPosition}</Badge> : null}
          {d.cardType ? <Badge tone="outline" size="xs">{d.cardType}</Badge> : null}
          <span className="text-[10px] text-text-muted" title={tci("ovrTooltip")}>
            {fillCi(tci("ovrLineTemplate"), { max: String(d.ovrMax ?? "—"), base: String(d.ovrBase ?? "—") })}
          </span>
        </div>
        <p className="truncate text-[10px] text-text-dim/80" title={String(d.worldCardId)}>
          World ID {d.worldCardId}
        </p>
      </div>

      {/* 付属ブースター（短いチップ・色＋文字） */}
      {chips.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-1">
          {chips.map((b, i) => (
            <li key={i}>
              <span
                className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold ${
                  b.kind === "pom"
                    ? "bg-warning/15 text-warning"
                    : b.kind === "fixed"
                      ? "bg-info/15 text-info"
                      : "bg-surface-3 text-text-dim"
                }`}
                title={
                  b.kind === "pom"
                    ? tci("pomChipTooltip")
                    : b.kind === "fixed"
                      ? b.provisional
                        ? tci("fixedProvisionalTooltip")
                        : tci("fixedTooltip")
                      : tci("unresolvedTooltip")
                }
              >
                {b.kind === "pom"
                  ? fillCi(tci("pomChipTemplate"), { nameEn: b.nameEn, level: String(b.level) })
                  : b.kind === "fixed"
                    ? fillCi(tci("fixedChipTemplate"), { nameEn: b.nameEn, level: String(b.level) }) +
                      (b.provisional ? tci("provisionalSuffix") : "")
                    : tci("unresolvedChip")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-[9px] text-text-muted">{tci("noAttachedBoosters")}</p>
      )}
      {pom ? (
        <p className="text-center text-[9px] text-warning">
          {fillCi(tci("pomSelectionLabelTemplate"), {
            tier: pom.selection === "league_1_13" ? "+1" : pom.selection === "league_14_19" ? "+2" : "+3",
          })}
        </p>
      ) : null}

      {!compact && teamLine ? (
        <p className="truncate text-center text-[10px] text-text-muted">{teamLine}</p>
      ) : null}

      <p className="rounded bg-surface-2/40 px-1 py-0.5 text-center text-[10px] text-text-dim">
        {fillCi(tci("currentTrainingTemplate"), { label: trainingLabel })}
      </p>

      <div className="flex justify-center gap-2 text-[10px]">
        <Link
          href={`/players/world/${encodeURIComponent(d.worldCardId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline hover:opacity-80"
        >
          {tci("playerDetailLink")}
        </Link>
        <Link
          href={`/players/world/${encodeURIComponent(d.worldCardId)}#progression`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline hover:opacity-80"
        >
          {tci("progressionScreenLink")}
        </Link>
      </div>
    </div>
  );
}
