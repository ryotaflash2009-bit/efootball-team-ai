"use client";

import "@/lib/i18n/dictionaries/ja-ns/sourceRatings";
import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { formatDateTime } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import {
  compareStats,
  extraStatEntries,
  isCardLevelMatch,
  matchCard,
  nameKey,
  unknownRecordEntries,
  type SourceCardRef,
  type SourceMatch,
  type SourceRecord,
} from "@/lib/dev/source-ratings";
import { useSameNameOvrCount, useSourceRatings } from "./use-source-ratings";

/** 受け渡しファイルの場所（このファイルは本番のビルドに入らないため、ここにだけ書く）。 */
const SOURCE_RATINGS_FILE_HINT = "data/external/crawler/latest_ratings.json";

type Tp = (k: keyof Dictionary["sourceRatings"]) => string;

/**
 * 開発用: 選手詳細の「外部ソース」タブ（2026-11-04）。呼び出し側が `next dev` のときだけ置く。
 * クローラーが集めた全項目（Tier・ポジション・サブポジション・所属・プレースタイル・スキル・26 能力値・ブースター・その他）を
 * ソースごとに出す。このカードのものと言える記録を上に、同じ選手の別のカード向けの記録を下（閉じた状態）に分ける。
 */
export function SourceRatingsTab({
  card,
  cardStats,
  cardSkills,
}: {
  card: SourceCardRef;
  cardStats: readonly { key: string; value: number | null }[];
  cardSkills: readonly string[];
}) {
  const t = useT();
  const tp: Tp = (k) => t("sourceRatings", k);
  const { displayLocale } = useLocale();
  const state = useSourceRatings();
  const matches = useMemo(() => (state.kind === "ok" ? matchCard(state.index, card) : []), [state, card]);
  const own = matches.filter((m) => isCardLevelMatch(m.kind));
  const others = matches.filter((m) => !isCardLevelMatch(m.kind));
  const sameNameOvr = useSameNameOvrCount(card, own.some((m) => m.kind === "nameOvr"));

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return iso && !Number.isNaN(d.getTime()) ? formatDateTime(d, displayLocale) : "—";
  };

  return (
    <Surface data-testid="source-ratings-tab" data-state={state.kind}>
      <SectionHeader
        title={tp("heading")}
        as="h2"
        hint={state.kind === "ok" ? fillMessage(tp("noteTemplate"), { time: fmtTime(state.index.generatedAt) }) : undefined}
      />
      {state.kind === "loading" ? (
        <p className="text-sm text-text-dim">{tp("loading")}</p>
      ) : state.kind === "off" ? (
        <p className="text-sm text-text-dim">{tp("off")}</p>
      ) : state.kind === "missing" ? (
        <p className="text-sm text-warning">
          {tp("missing")} <code className="text-xs">{SOURCE_RATINGS_FILE_HINT}</code>
        </p>
      ) : state.kind === "invalid" ? (
        <p className="text-sm text-danger">{tp("invalid")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {own.length === 0 ? <p className="text-sm text-text-dim">{tp("noMatch")}</p> : null}
          {own.map((m, i) => (
            <RecordPanel key={i} match={m} matchNote={matchNote(m, sameNameOvr, tp)} cardStats={cardStats} cardSkills={cardSkills} skillNameMap={state.index.skillNameMap} fmtTime={fmtTime} tp={tp} />
          ))}
          {others.length > 0 ? (
            <details className="rounded-card border border-dashed border-border p-3" data-testid="source-ratings-other-cards">
              <summary className="flex min-h-[36px] cursor-pointer items-center text-sm font-semibold">
                {fillMessage(tp("otherCardsHeadingTemplate"), { count: String(others.length) })}
              </summary>
              <div className="mt-3 flex flex-col gap-4">
                {others.map((m, i) => (
                  <RecordPanel key={i} match={m} matchNote={matchNote(m, sameNameOvr, tp)} cardStats={cardStats} cardSkills={cardSkills} skillNameMap={state.index.skillNameMap} fmtTime={fmtTime} tp={tp} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </Surface>
  );
}

function matchNote(m: SourceMatch, sameNameOvr: number | null | "loading", tp: Tp): { text: string; tone: "ok" | "warn" | "dim" } {
  switch (m.kind) {
    case "cardId":
      return { text: tp("matchCardId"), tone: "ok" };
    case "stats":
      return { text: tp("matchStats"), tone: "ok" };
    case "typeLevelOvr":
      return { text: tp("matchTypeLevelOvr"), tone: "ok" };
    case "statsNear":
      return { text: tp("matchStatsNear"), tone: "ok" };
    case "crossSource":
      return { text: tp("matchCrossSource"), tone: "ok" };
    case "skills":
      return { text: tp("matchSkills"), tone: "ok" };
    case "candidate":
      return { text: fillMessage(tp("matchCandidateTemplate"), { count: String(m.record.resolved_card_ids.length) }), tone: "warn" };
    case "cardIdConflict":
      return { text: tp("matchCardIdConflict"), tone: "warn" };
    case "nameOvr":
      if (sameNameOvr === 1) return { text: tp("matchNameOvrConfirmed"), tone: "ok" };
      if (typeof sameNameOvr === "number" && sameNameOvr > 1) {
        return { text: fillMessage(tp("matchNameOvrAmbiguousTemplate"), { count: String(sameNameOvr) }), tone: "warn" };
      }
      return { text: tp("matchNameOvrUnknown"), tone: "warn" };
    case "samePerson":
      return { text: tp("matchSamePerson"), tone: "dim" };
    case "nameOnly":
      return { text: tp(m.record.card_not_in_data ? "matchNotInData" : "matchNameOnly"), tone: "dim" };
  }
}

const NOTE_CLASS = { ok: "text-success", warn: "text-warning", dim: "text-text-dim" } as const;

function RecordPanel({
  match,
  matchNote: note,
  cardStats,
  cardSkills,
  skillNameMap,
  fmtTime,
  tp,
}: {
  match: SourceMatch;
  matchNote: { text: string; tone: "ok" | "warn" | "dim" };
  cardStats: readonly { key: string; value: number | null }[];
  cardSkills: readonly string[];
  skillNameMap: Readonly<Record<string, string>>;
  fmtTime: (iso: string) => string;
  tp: Tp;
}) {
  const r = match.record;
  const or = (v: string) => (v.trim() ? v : "—");
  const info: [string, string][] = [
    [tp("tierLabel"), or(r.rating_or_tier)],
    [tp("tableLabel"), or(r.source_table_type)],
    [tp("positionLabel"), or(r.position)],
    [tp("subPositionsLabel"), or(r.sub_positions.join(" / "))],
    [tp("teamLabel"), or(r.team_and_nationality)],
    [tp("playStyleLabel"), or(r.play_style)],
    [tp("cardIdLabel"), r.card_id ?? "—"],
    [tp("fetchedLabel"), fmtTime(r.fetched_at)],
  ];
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border p-3" data-testid="source-ratings-record" data-source={r.source} data-match={match.kind}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{fillMessage(tp("sourceLabelTemplate"), { source: r.source })}</span>
        <Badge tone={match.kind === "cardId" || match.kind === "stats" ? "accent" : "info"}>{or(r.rating_or_tier)}</Badge>
        <span className={`text-xs ${NOTE_CLASS[note.tone]}`}>{note.text}</span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
        {info.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-2xs text-text-muted">{label}</dt>
            <dd className="mt-0.5 break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <SkillList record={r} cardSkills={cardSkills} skillNameMap={skillNameMap} tp={tp} />
      <StatTable record={r} cardStats={cardStats} tp={tp} />
      <ExtraFields record={r} tp={tp} />
    </section>
  );
}

function SkillList({ record, cardSkills, skillNameMap, tp }: { record: SourceRecord; cardSkills: readonly string[]; skillNameMap: Readonly<Record<string, string>>; tp: Tp }) {
  const cardKeys = new Set(cardSkills.map(nameKey));
  // ソースの日本語名は、カード番号で確定した記録から作った対応で英語名に直して比べる
  const cardName = (s: string) => skillNameMap[nameKey(s)] ?? s;
  // 名前の対応が取れないと全部「無い」になるため、1 つでも共通するときだけ印を付ける
  const comparable = record.skills.some((s) => cardKeys.has(nameKey(cardName(s))));
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-dim">{fillMessage(tp("skillsHeadingTemplate"), { count: String(record.skills.length) })}</h3>
      {record.skills.length === 0 ? (
        <p className="mt-1 text-sm">—</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1">
          {record.skills.map((s) => {
            const missing = comparable && !cardKeys.has(nameKey(cardName(s)));
            return (
              <li key={s}>
                <Badge tone={missing ? "warning" : "neutral"}>
                  {s}
                  {missing ? <span className="text-2xs">{`(${tp("skillNotOnCard")})`}</span> : null}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatTable({ record, cardStats, tp }: { record: SourceRecord; cardStats: readonly { key: string; value: number | null }[]; tp: Tp }) {
  const rows = compareStats(record, cardStats);
  const comparable = rows.filter((r) => r.diff != null);
  const matched = comparable.filter((r) => r.diff === 0).length;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-text-dim">{tp("statsHeading")}</h3>
        {comparable.length > 0 ? (
          <span className="text-2xs text-text-muted" data-testid="source-ratings-stat-match">
            {fillMessage(tp("statMatchTemplate"), { matched: String(matched), total: String(comparable.length) })}
          </span>
        ) : null}
      </div>
      <table className="mt-1 w-full text-xs tabular-nums">
        <thead>
          <tr className="text-text-muted">
            <th className="py-0.5 text-start font-normal" />
            <th className="py-0.5 text-end font-normal">{tp("statSourceColumn")}</th>
            <th className="py-0.5 text-end font-normal">{tp("statCardColumn")}</th>
            <th className="w-12 py-0.5 text-end font-normal" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const differs = row.diff != null && row.diff !== 0;
            return (
              <tr key={row.key} className={`border-t border-border/40 ${differs ? "bg-warning/10" : ""}`} data-differs={differs || undefined}>
                <th scope="row" className="py-0.5 text-start font-normal">{row.labelJa}</th>
                <td className="py-0.5 text-end font-semibold">{row.source ?? "—"}</td>
                <td className="py-0.5 text-end">{row.card ?? "—"}</td>
                <td className={`py-0.5 text-end ${differs ? "font-semibold text-warning" : "text-text-muted"}`}>
                  {row.diff == null ? "" : row.diff > 0 ? `+${row.diff}` : `${row.diff}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-2xs text-text-muted">{tp("statDiffNote")}</p>
    </div>
  );
}

function ExtraFields({ record, tp }: { record: SourceRecord; tp: Tp }) {
  const entries = [...extraStatEntries(record), ...unknownRecordEntries(record)];
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-dim">{tp("extraHeading")}</h3>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3">
        {entries.map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col">
            <dt className="text-text-muted">{k}</dt>
            <dd className="break-words font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** タブの名前（辞書の名前空間ごと、このファイルを読み込んだときだけ登録する）。 */
export function SourceRatingsTabLabel() {
  const t = useT();
  return <>{t("sourceRatings", "tab")}</>;
}
