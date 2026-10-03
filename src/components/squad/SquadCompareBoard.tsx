"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listSquadEntries } from "@/lib/squad/squad-storage";
import { getComparisonPref, setComparisonPref } from "@/lib/squad/comparison-store";
import { SQUAD_ID_RE, type SquadListEntry } from "@/lib/squad/types";
import { compareSquads, type SquadComparisonResult, type CompareCardUnit } from "@/lib/squad/compare-squads";
import { fmt, fmtInt, fmtDiff, fmtDate } from "@/lib/squad/compare-format";
import { resolveCardImageSources } from "@/lib/world/image";
import { useSquadCompareData } from "./useSquadCompareData";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { CompareMiniPitch } from "./CompareMiniPitch";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSquadCompareText, useCompareCardName, type ScKey } from "./useSquadCompareText";

type Tab = "overview" | "shape" | "players" | "metrics" | "roles" | "boosters" | "skills" | "warnings";
const TABS: [Tab, ScKey][] = [
  ["overview", "tabOverview"],
  ["shape", "tabShape"],
  ["players", "tabPlayers"],
  ["metrics", "tabMetrics"],
  ["roles", "tabRoles"],
  ["boosters", "tabBoosters"],
  ["skills", "tabSkills"],
  ["warnings", "tabWarnings"],
];

function cardSources(u: CompareCardUnit): string[] {
  return resolveCardImageSources({
    worldCardId: u.worldCardId,
    efhubCardId: u.efhubCardId,
    hasEfhubLink: u.hasEfhubLink,
    hasWorldImage: !!u.imageUrlCandidate,
    hasWorldMobileImage: !!u.mobileImageUrlCandidate,
  });
}


export function SquadCompareBoard() {
  const { tx, lib } = useSquadCompareText();
  const router = useRouter();
  const sp = useSearchParams();
  // React #418 の対策（2026-10-04）: このページは force-static で、サーバーは検索パラメーターを空として描く。
  // hydration の描画で ?a=&b= を読むと「比較を解除」等の有無が server の HTML と食い違うため、
  // パラメーターはマウント後（hydrated）に読む。直前のペアの復元もマウント後にだけ判断する。
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const rawA = hydrated ? sp.get("a") : null;
  const rawB = hydrated ? sp.get("b") : null;
  const dupParams = hydrated && (sp.getAll("a").length > 1 || sp.getAll("b").length > 1);

  // 選択候補一覧(スカッド名のドロップダウン)もアカウント別スコープに従う必要があるため、
  // この画面自身でもスコープを解決する(useSquadCompareDataも内部で同じ共有ストアへ解決するため、
  // 二重解決自体は安全 — session/scopeIdキャッシュを共有する)。
  const scopeState = useSyncedStorageScope();
  const [entries, setEntries] = useState<SquadListEntry[] | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [diffOnly, setDiffOnly] = useState(false);
  const [restored, setRestored] = useState(false);

  const reloadEntries = useCallback(() => {
    if (scopeState.status === "loading") {
      setEntries(null);
      return;
    }
    setEntries(listSquadEntries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]);

  useEffect(() => {
    reloadEntries();
  }, [reloadEntries]);
  useEffect(() => subscribeCurrentScope(reloadEntries), [reloadEntries]);

  const setParams = useCallback(
    (a: string | null, b: string | null) => {
      const p = new URLSearchParams();
      if (a && SQUAD_ID_RE.test(a)) p.set("a", a);
      if (b && SQUAD_ID_RE.test(b)) p.set("b", b);
      const qs = p.toString();
      router.replace(`/squads/compare${qs ? `?${qs}` : ""}`, { scroll: false });
      setComparisonPref(a && SQUAD_ID_RE.test(a) ? a : null, b && SQUAD_ID_RE.test(b) ? b : null);
    },
    [router],
  );

  // URL にパラメーターが無ければ、直前に比較したペアを復元（1 回だけ）。
  useEffect(() => {
    if (!hydrated || restored) return;
    setRestored(true);
    if (rawA || rawB) return;
    const pref = getComparisonPref();
    if (pref.squadIdA || pref.squadIdB) setParams(pref.squadIdA, pref.squadIdB);
  }, [hydrated, restored, rawA, rawB, setParams]);

  // 有効な比較ペアができたら記憶（URL 経由の遷移も拾う）。
  useEffect(() => {
    if (rawA && rawB && SQUAD_ID_RE.test(rawA) && SQUAD_ID_RE.test(rawB) && rawA !== rawB) {
      setComparisonPref(rawA, rawB);
    }
  }, [rawA, rawB]);

  const data = useSquadCompareData(rawA, rawB);
  const sameSquad = !!rawA && rawA === rawB;

  const result: SquadComparisonResult | null = useMemo(() => {
    if (sameSquad || !data.a || !data.b) return null;
    return compareSquads(data.a, data.b);
  }, [sameSquad, data.a, data.b]);

  const validEntries = entries ?? [];
  const canCompare = validEntries.length >= 2;

  // ---- 選択 UI ----
  const Selector = ({ label, value, exclude, onChange }: { label: string; value: string | null; exclude: string | null; onChange: (v: string | null) => void }) => {
    const cur = validEntries.find((e) => e.squadId === value) ?? null;
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label className="text-xs font-semibold text-text-dim">{label}</label>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label={tx("selectorAriaTemplate", { label })}
          className="h-10 w-full rounded-md border border-border bg-surface-2 px-2 text-sm"
        >
          <option value="">{tx("selectPlaceholder")}</option>
          {validEntries.map((e) => (
            <option key={e.squadId} value={e.squadId} disabled={e.squadId === exclude}>
              {tx("optionTemplate", {
                name: e.squadName,
                formation: e.formationName,
                starters: e.startingCount,
                bench: e.benchCount,
                manager: e.managerId != null ? tx("managerYes") : tx("managerNo"),
                custom: e.hasCustomPositioning ? tx("customSuffix") : "",
              })}
            </option>
          ))}
        </select>
        {cur ? (
          <p className="flex flex-wrap items-center gap-x-2 text-2xs text-text-muted">
            <span>{tx("updatedTemplate", { date: fmtDate(cur.updatedAt) })}</span>
            <Link href={`/squads/${cur.squadId}`} className="text-accent hover:underline">
              {tx("open")}
            </Link>
            {value ? (
              <button type="button" onClick={() => onChange(null)} className="text-text-dim hover:text-accent">
                {tx("clearSelection")}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href="/squads" className="w-fit text-sm text-text-dim hover:text-accent">
        {tx("backToList")}
      </Link>

      {!data.storageOk ? (
        <Surface tone="outline" className="text-center text-sm text-text-dim">
          {tx("storageUnavailable")}
        </Surface>
      ) : null}

      {/* 選択 */}
      <Surface tone="raised" className="flex flex-col gap-3">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <Selector label={tx("sideA")} value={rawA} exclude={rawB} onChange={(v) => setParams(v, rawB)} />
          <button
            type="button"
            onClick={() => setParams(rawB, rawA)}
            aria-label={tx("swapAria")}
            disabled={!rawA && !rawB}
            className="mx-auto h-10 shrink-0 self-center rounded-md border border-border px-3 text-sm hover:border-accent disabled:opacity-40 sm:self-end"
          >
            {tx("swap")}
          </button>
          <Selector label={tx("sideB")} value={rawB} exclude={rawA} onChange={(v) => setParams(rawA, v)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(rawA || rawB) ? (
            <button
              type="button"
              onClick={() => setParams(null, null)}
              className="rounded border border-border px-2 py-1 text-text-dim hover:border-accent"
            >
              {tx("clearComparison")}
            </button>
          ) : null}
          <span className="text-text-muted">
            {tx("urlNote")}
          </span>
        </div>
        {dupParams ? (
          <p className="text-2xs text-warning">{tx("dupParams")}</p>
        ) : null}
      </Surface>

      {/* 空状態・エラー状態 */}
      {!canCompare && entries != null ? (
        <Surface tone="outline" className="flex flex-col items-center gap-3 py-8 text-center text-sm">
          <p className="font-semibold">{tx("needTwo")}</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <Link href="/squads#create-squad" className={buttonClasses("primary", "sm")}>
              {tx("createNew")}
            </Link>
            <Link href="/squads/templates" className={buttonClasses("secondary", "sm")}>
              {tx("createFromTemplate")}
            </Link>
            <Link href="/squads" className={buttonClasses("secondary", "sm")}>
              {tx("toList")}
            </Link>
          </div>
        </Surface>
      ) : sameSquad ? (
        <Surface tone="outline" className="py-8 text-center text-sm font-semibold text-warning">
          {tx("sameSquad")}
        </Surface>
      ) : data.aMissing || data.bMissing ? (
        <Surface tone="outline" className="py-6 text-center text-sm">
          <p className="font-semibold text-danger">
            {tx("notFound")}
          </p>
          <p className="mt-1 text-xs text-text-dim">
            {tx("reselectTemplate", {
              sides: [data.aMissing ? tx("sideA") : "", data.bMissing ? tx("sideB") : ""].filter(Boolean).join(tx("andSeparator")),
            })}
          </p>
        </Surface>
      ) : !rawA || !rawB ? (
        <Surface tone="outline" className="py-8 text-center text-sm text-text-dim">
          {!rawA && !rawB
            ? tx("selectTwo")
            : tx("selectOther")}
        </Surface>
      ) : data.loadingSquads || (!result && !data.cardError) ? (
        <p aria-live="polite" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          {tx("loadingAll")}
        </p>
      ) : result ? (
        <>
          {data.externalUpdate ? (
            <div aria-live="polite" className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning">
              <span>{tx("externalUpdate")}</span>
              <button type="button" onClick={data.reload} className="rounded border border-warning px-2 py-0.5">
                {tx("reload")}
              </button>
            </div>
          ) : null}
          {data.loadingCards ? (
            <p aria-live="polite" className="text-xs text-text-dim">
              {tx("loadingCards")}
            </p>
          ) : null}

          <CompareSummary result={result} />

          {/* タブ */}
          <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
            {TABS.map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  tab === id ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"
                }`}
              >
                {tx(lbl)}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-text-dim">
              <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
              {tx("diffOnly")}
            </label>
          </div>

          {tab === "overview" ? <OverviewTab result={result} /> : null}
          {tab === "shape" ? <ShapeTab result={result} diffOnly={diffOnly} /> : null}
          {tab === "players" ? <PlayersTab result={result} diffOnly={diffOnly} /> : null}
          {tab === "metrics" ? <MetricsTab result={result} diffOnly={diffOnly} /> : null}
          {tab === "roles" ? <RolesTab result={result} diffOnly={diffOnly} /> : null}
          {tab === "boosters" ? <BoostersTab result={result} diffOnly={diffOnly} /> : null}
          {tab === "skills" ? <SkillsTab result={result} diffOnly={diffOnly} /> : null}
          {tab === "warnings" ? <WarningsTab result={result} /> : null}
        </>
      ) : data.cardError ? (
        <p className="text-xs text-danger">{lib(data.cardError)} {tx("retryLater")}</p>
      ) : null}
    </div>
  );
}

/* ============================ セクション ============================ */

function ABPair({ a, b, label, className = "" }: { a: React.ReactNode; b: React.ReactNode; label?: string; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {label ? <p className="col-span-2 text-2xs font-semibold text-text-muted">{label}</p> : null}
      <div className="rounded border border-border bg-surface-2/40 p-2 text-xs">{a}</div>
      <div className="rounded border border-border bg-surface-2/40 p-2 text-xs">{b}</div>
    </div>
  );
}

function CompareSummary({ result }: { result: SquadComparisonResult }) {
  const { tx } = useSquadCompareText();
  const { a, b } = result.summary;
  return (
    <Surface tone="raised" className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <SummaryCard s={a} tag="A" />
        <div className="flex flex-col items-center gap-1 self-center text-center text-2xs text-text-dim">
          <span className="rounded border border-border px-2 py-1">
            {tx("commonCards")}<br />
            <b className="text-sm text-text">{result.summary.commonCardCount}</b>
          </span>
          <span>{tx("onlyATemplate", { n: result.summary.onlyACardCount })}</span>
          <span>{tx("onlyBTemplate", { n: result.summary.onlyBCardCount })}</span>
        </div>
        <SummaryCard s={b} tag="B" />
      </div>
      <p className="text-2xs text-text-muted">
        {tx("noAutoVerdict")}
      </p>
    </Surface>
  );
}

function SummaryCard({ s, tag }: { s: SquadComparisonResult["summary"]["a"]; tag: "A" | "B" }) {
  const { tx } = useSquadCompareText();
  return (
    <div className="rounded-md border border-border bg-surface-2/40 p-2.5 text-xs">
      <p className="flex items-center gap-1.5">
        <Badge tone={tag === "A" ? "accent" : "outline"} size="xs">
          {tag}
        </Badge>
        <Link href={`/squads/${s.squadId}`} className="truncate font-bold hover:text-accent">
          {s.squadName}
        </Link>
      </p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-text-dim">
        <dt>{tx("formation")}</dt>
        <dd className="text-text">{s.formationName}{s.hasCustomPositioning ? tx("customParen") : ""}</dd>
        <dt>{tx("startersBench")}</dt>
        <dd className="text-text">{tx("startersBenchValueTemplate", { starters: s.startingCount, bench: s.benchCount })}</dd>
        <dt>{tx("manager")}</dt>
        <dd className="text-text">{s.hasManager ? s.managerName ?? tx("loadingParen") : tx("none")}</dd>
        <dt>{tx("captain")}</dt>
        <dd className="text-text">{s.captainName ?? tx("notSet")}{s.captainRole ? tx("parenTemplate", { v: s.captainRole }) : ""}</dd>
        <dt>{tx("updated")}</dt>
        <dd className="text-text">{fmtDate(s.updatedAt)}</dd>
        <dt>{tx("warningCount")}</dt>
        <dd className="text-text">{s.warningCount}</dd>
      </dl>
    </div>
  );
}

function OverviewTab({ result }: { result: SquadComparisonResult }) {
  const { tx } = useSquadCompareText();
  const f = result.formationComparison;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("formation")}</h3>
        <ABPair
          a={
            <>
              <p className="font-semibold">{f.aName}</p>
              <p className="text-text-dim">
                {f.aRoleBreakdown.map((r) => `${r.count} ${r.role}`).join(" / ")}
              </p>
              <p className="text-text-muted">{tx("zonesTemplate", { left: f.aZones.left, center: f.aZones.center, right: f.aZones.right })}</p>
              {f.aHasCustomPositioning ? <p className="text-accent">{tx("customYes")}</p> : <p className="text-text-muted">{tx("presetPlacement")}</p>}
            </>
          }
          b={
            <>
              <p className="font-semibold">{f.bName}</p>
              <p className="text-text-dim">
                {f.bRoleBreakdown.map((r) => `${r.count} ${r.role}`).join(" / ")}
              </p>
              <p className="text-text-muted">{tx("zonesTemplate", { left: f.bZones.left, center: f.bZones.center, right: f.bZones.right })}</p>
              {f.bHasCustomPositioning ? <p className="text-accent">{tx("customYes")}</p> : <p className="text-text-muted">{tx("presetPlacement")}</p>}
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">
          {f.same ? tx("sameFormation") : tx("differentFormation")}
          {f.roleBreakdownSame ? tx("roleBreakdownSame") : ""}
          {tx("zonesFact")}
        </p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("keyMetrics")}</h3>
        <MetricTable rows={result.metricComparison} diffOnly={false} />
      </section>

      <NotesBlock notes={result.metricsNotes} />
    </div>
  );
}

function MetricTable({ rows, diffOnly }: { rows: SquadComparisonResult["metricComparison"]; diffOnly: boolean }) {
  const { tx, lib } = useSquadCompareText();
  const shown = diffOnly ? rows.filter((r) => r.higher !== "equal" && r.higher !== "na") : rows;
  if (shown.length === 0) return <p className="text-xs text-text-dim">{tx("noMetricDiff")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-dim">
            <th className="py-1 pr-2 font-medium">{tx("metric")}</th>
            <th className="py-1 pr-2 text-right font-medium">A</th>
            <th className="py-1 pr-2 text-right font-medium">B</th>
            <th className="py-1 text-right font-medium">{tx("diffHeader")}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-b border-border/50">
              <td className="py-1 pr-2 text-text-dim">
                {lib(r.label)}
                {r.lowerIsCalmer ? <span className="ml-1 text-2xs text-text-muted">{tx("lowerIsCalmer")}</span> : null}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{fmt(r.a)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{fmt(r.b)}</td>
              <td className={`py-1 text-right tabular-nums ${r.higher === "a" ? "text-accent" : r.higher === "b" ? "text-[#e0a43b]" : "text-text-muted"}`}>
                {fmtDiff(r.a, r.b)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesBlock({ notes }: { notes: string[] }) {
  const { tx, lib } = useSquadCompareText();
  return (
    <details className="rounded-md border border-border bg-surface-2/30 p-2 text-2xs text-text-muted">
      <summary className="cursor-pointer font-semibold text-text-dim">{tx("notesSummary")}</summary>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
        {notes.map((n, i) => (
          <li key={i}>{lib(n)}</li>
        ))}
      </ul>
    </details>
  );
}

function ShapeTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const { tx } = useSquadCompareText();
  const cardName = useCompareCardName(result.units);
  const common = new Set(result.playerComparison.common.map((p) => p.worldCardId));
  const isCommon = (id: string) => common.has(id);
  const changes = diffOnly
    ? result.shapeComparison.placementChanges.filter((c) => c.moved)
    : result.shapeComparison.placementChanges;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <CompareMiniPitch side="A" formationId={result.summary.a.formationId} units={result.units.a} isCommon={isCommon} />
        <CompareMiniPitch side="B" formationId={result.summary.b.formationId} units={result.units.b} isCommon={isCommon} />
      </div>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("placementDiffTitle")}</h3>
        {changes.length === 0 ? (
          <p className="text-xs text-text-dim">{tx("noPlacementDiff")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {changes.map((c) => (
              <li key={c.worldCardId} className="rounded border border-border bg-surface-2/40 p-2 text-xs">
                <p className="font-semibold">{cardName(c.worldCardId, c.name)}</p>
                <div className="mt-0.5 grid grid-cols-2 gap-2 text-text-dim">
                  <span>A: {c.aRole ?? "?"} / x {fmt(c.aX)} · y {fmt(c.aY)}</span>
                  <span>B: {c.bRole ?? "?"} / x {fmt(c.bX)} · y {fmt(c.bY)}</span>
                </div>
                <p className="mt-0.5 text-text-muted">
                  {c.roleChanged ? tx("roleChangeTemplate", { a: c.aRole ?? "?", b: c.bRole ?? "?" }) : ""}
                  {tx("coordDiffTemplate", { dx: fmtDiff(c.aX, c.bX), dy: fmtDiff(c.aY, c.bY) })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AreaChanges result={result} />
    </div>
  );
}

function AreaChanges({ result }: { result: SquadComparisonResult }) {
  const { tx, lib } = useSquadCompareText();
  const cardName = useCompareCardName(result.units);
  const rows = result.playerComparison.areaChanges;
  if (rows.length === 0) return <p className="text-xs text-text-dim">{tx("noAreaChange")}</p>;
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold">{tx("areaChangeTitle")}</h3>
      <ul className="flex flex-col gap-1">
        {rows.map((c) => (
          <li key={c.worldCardId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface-2/40 px-2 py-1 text-xs">
            <span className="font-semibold">{cardName(c.worldCardId, c.name)}</span>
            <span className="text-text-dim">
              A: {lib(c.aLabel)} → B: {lib(c.bLabel)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerCardMini({ u, note }: { u: CompareCardUnit; note?: string }) {
  const { tx, lib, name } = useSquadCompareText();
  return (
    <div className="flex gap-2 rounded border border-border bg-surface-2/40 p-2 text-xs">
      <div className="w-10 shrink-0">
        {u.resolved ? (
          <WorldCardImage sources={cardSources(u)} alt={name(u)} size="card" />
        ) : (
          <div className="grid aspect-[3/4] w-full place-items-center rounded bg-surface-2 text-2xs text-text-muted">
            {tx("fetchFailed")}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name(u)}</p>
        <p className="text-2xs text-text-muted">
          World ID {u.worldCardId}
          {u.cardType ? ` / ${u.cardType}` : ""}
        </p>
        <p className="text-2xs text-text-dim">
          {tx("registeredTemplate", { pos: u.registeredPosition ?? "—" })}
          {u.area === "starter" ? tx("placementSuffixTemplate", { role: u.placementRole ?? "?" }) : tx("benchSuffix")}
          {u.suitability ? ` / ${lib(u.suitability.label)}` : ""}
        </p>
        <p className="text-2xs text-text-dim">
          {tx("ovrTemplate", { shown: fmtInt(u.displayedOvr), base: fmtInt(u.baseOvr) })}
          {u.savedBuildName ? tx("buildSuffixTemplate", { name: u.savedBuildName }) : u.buildMode !== "none" ? ` / ${u.buildMode}` : ""}
        </p>
        <p className="flex flex-wrap gap-1 text-2xs">
          {u.isCaptain ? <Badge tone="accent" size="xs">{tx("captain")}</Badge> : null}
          {u.setPieceRoles.map((r) => (
            <Badge key={r} tone="outline" size="xs">
              {r}
            </Badge>
          ))}
          {u.hasConditionalSelection ? <Badge tone="warning" size="xs">{tx("pomConditional")}</Badge> : null}
        </p>
        {note ? <p className="mt-0.5 text-2xs text-warning">{note}</p> : null}
        <p className="mt-0.5 flex gap-2 text-2xs">
          <Link href={`/players/world/${u.worldCardId}`} className="text-accent hover:underline">
            {tx("playerDetail")}
          </Link>
          <Link href={`/players/world/${u.worldCardId}#progression`} className="text-accent hover:underline">
            {tx("progression")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function PlayersTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const { tx, lib } = useSquadCompareText();
  const cardName = useCompareCardName(result.units);
  const pc = result.playerComparison;
  const bc = result.benchComparison;
  const both = diffOnly ? pc.starterBoth.filter((p) => p.anyChange) : pc.starterBoth;
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("startersBothTemplate", { n: pc.starterBoth.length })}</h3>
        {both.length === 0 ? (
          <p className="text-xs text-text-dim">{diffOnly ? tx("noStarterSettingDiff") : tx("noCommonStarters")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {both.map((p) => (
              <div key={p.worldCardId} className="grid grid-cols-2 gap-1.5">
                <PlayerCardMini u={p.a} />
                <PlayerCardMini
                  u={p.b}
                  note={
                    [
                      p.roleChanged ? tx("notePlacementTemplate", { a: p.a.placementRole ?? "?", b: p.b.placementRole ?? "?" }) : "",
                      p.areaChanged ? tx("noteArea") : "",
                      p.buildModeChanged ? tx("noteBuildMode") : "",
                      p.savedBuildChanged ? tx("noteSavedBuild") : "",
                      p.captainChanged ? tx("noteCaptain") : "",
                      p.setPieceChanged ? tx("noteSetPiece") : "",
                      p.pomChanged ? tx("notePom") : "",
                    ]
                      .filter(Boolean)
                      .join(" / ") || undefined
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">{tx("startersOnlyATemplate", { n: pc.starterOnlyA.length })}</h3>
          <div className="flex flex-col gap-1.5">
            {pc.starterOnlyA.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {pc.starterOnlyA.length === 0 ? <p className="text-xs text-text-dim">{tx("none")}</p> : null}
          </div>
        </div>
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">{tx("startersOnlyBTemplate", { n: pc.starterOnlyB.length })}</h3>
          <div className="flex flex-col gap-1.5">
            {pc.starterOnlyB.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {pc.starterOnlyB.length === 0 ? <p className="text-xs text-text-dim">{tx("none")}</p> : null}
          </div>
        </div>
      </section>

      {pc.sameNameDifferentCard.length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">{tx("sameNameTitle")}</h3>
          <p className="mb-1 text-2xs text-text-muted">
            {tx("sameNameNote")}
          </p>
          <div className="flex flex-col gap-1.5">
            {pc.sameNameDifferentCard.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-1.5">
                <PlayerCardMini u={s.a} note={tx("cardOfA")} />
                <PlayerCardMini u={s.b} note={tx("cardOfB")} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">
          {tx("benchTitleTemplate", { a: bc.aCount, b: bc.bCount })}
        </h3>
        {bc.orderChanged ? <p className="mb-1 text-2xs text-text-muted">{tx("benchOrderNote")}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-2xs font-semibold text-text-muted">{tx("commonWithB")}</p>
            {bc.both.map((p) => (
              <PlayerCardMini key={p.worldCardId} u={p.a} />
            ))}
            {bc.both.length === 0 ? <p className="text-xs text-text-dim">{tx("none")}</p> : null}
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">{tx("onlyABench")}</p>
            {bc.onlyA.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {bc.onlyA.length === 0 ? <p className="text-xs text-text-dim">{tx("none")}</p> : null}
          </div>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-2xs font-semibold text-text-muted">{tx("onlyBBench")}</p>
            {bc.onlyB.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {bc.onlyB.length === 0 ? <p className="text-xs text-text-dim">{tx("none")}</p> : null}
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">{tx("starterBenchChange")}</p>
            {[...bc.starterToBench, ...bc.benchToStarter].map((c) => (
              <p key={c.worldCardId} className="text-xs text-text-dim">
                {cardName(c.worldCardId, c.name)}: {lib(c.aLabel)} → {lib(c.bLabel)}
              </p>
            ))}
            {bc.starterToBench.length + bc.benchToStarter.length === 0 ? (
              <p className="text-xs text-text-dim">{tx("none")}</p>
            ) : null}
          </div>
        </div>
      </section>

      {result.dataAvailability.aFailed.length + result.dataAvailability.bFailed.length > 0 ? (
        <p className="text-2xs text-warning">
          {tx("partialFetchFail")}
        </p>
      ) : null}
    </div>
  );
}

function MetricsTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const { tx, category } = useSquadCompareText();
  const cats = diffOnly
    ? result.categoryComparison.filter((c) => c.higher !== "equal" && c.higher !== "na")
    : result.categoryComparison;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("avgMetrics")}</h3>
        <MetricTable rows={result.metricComparison} diffOnly={diffOnly} />
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("categoryAvgTitle")}</h3>
        {cats.length === 0 ? (
          <p className="text-xs text-text-dim">{tx("noCategoryDiff")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cats.map((c) => (
              <li key={c.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{category(c.categoryId)}</span>
                  <span className="tabular-nums text-text-dim">
                    A {fmt(c.a)} / B {fmt(c.b)} / {tx("diff")}{" "}
                    <span className={c.higher === "a" ? "text-accent" : c.higher === "b" ? "text-[#e0a43b]" : ""}>
                      {fmtDiff(c.a, c.b)}
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  <Bar label="A" value={c.a} tone="accent" />
                  <Bar label="B" value={c.b} tone="gold" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("suitability")}</h3>
        <ABPair
          a={
            <>
              <p>{tx("exactTemplate", { n: result.suitabilityComparison.aExact })}</p>
              <p>{tx("unresolvedTemplate", { n: result.suitabilityComparison.aUnresolved })}</p>
              <p>{tx("mismatchTemplate", { n: result.suitabilityComparison.aGkMismatch })}</p>
            </>
          }
          b={
            <>
              <p>{tx("exactTemplate", { n: result.suitabilityComparison.bExact })}</p>
              <p>{tx("unresolvedTemplate", { n: result.suitabilityComparison.bUnresolved })}</p>
              <p>{tx("mismatchTemplate", { n: result.suitabilityComparison.bGkMismatch })}</p>
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">
          {tx("suitabilityNote")}
        </p>
      </section>

      <NotesBlock notes={result.metricsNotes} />
    </div>
  );
}

function Bar({ label, value, tone }: { label: string; value: number | null; tone: "accent" | "gold" }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-4 shrink-0 text-2xs text-text-muted">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded bg-surface-2">
        <div
          className={tone === "accent" ? "h-full bg-accent" : "h-full"}
          style={tone === "gold" ? { width: `${pct}%`, background: "#e0a43b" } : { width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-text-dim">{fmt(value)}</span>
    </div>
  );
}

function RolesTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const m = result.managerComparison;
  const c = result.captainComparison;
  const lu = result.linkUpComparison;
  const { tx, lib, t } = useSquadCompareText();
  const stateLabel = (s: string) =>
    s === "same"
      ? tx("stateSame")
      : s === "different"
        ? tx("stateDifferent")
        : s === "onlyA"
          ? tx("stateOnlyA")
          : s === "onlyB"
            ? tx("stateOnlyB")
            : tx("stateNeither");
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("managerTitleTemplate", { state: stateLabel(m.state) })}</h3>
        <ABPair
          a={
            <>
              <p className="font-semibold">{m.aHasManager ? m.aName ?? tx("loadingParen") : tx("managerNo")}</p>
              <p className="text-text-muted">{tx("boosterDeltaTemplate", { n: m.aBoosterDelta })}</p>
              {m.aConfirmedBoosters.length ? (
                <p className="text-text-dim">
                  {tx("confirmedTemplate", { list: m.aConfirmedBoosters.map((x) => `${x.statNameEn} +${x.delta}`).join(", ") })}
                </p>
              ) : (
                <p className="text-text-muted">{tx("noConfirmedManagerBoosters")}</p>
              )}
            </>
          }
          b={
            <>
              <p className="font-semibold">{m.bHasManager ? m.bName ?? tx("loadingParen") : tx("managerNo")}</p>
              <p className="text-text-muted">{tx("boosterDeltaTemplate", { n: m.bBoosterDelta })}</p>
              {m.bConfirmedBoosters.length ? (
                <p className="text-text-dim">
                  {tx("confirmedTemplate", { list: m.bConfirmedBoosters.map((x) => `${x.statNameEn} +${x.delta}`).join(", ") })}
                </p>
              ) : (
                <p className="text-text-muted">{tx("noConfirmedManagerBoosters")}</p>
              )}
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">{lib(m.orderNote)} {tx("noManagerImage")}</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("captainTitleTemplate", { state: stateLabel(c.state) })}</h3>
        <ABPair
          a={<p>{c.aName ? tx("nameRoleTemplate", { name: c.aName, role: c.aRole ?? "?" }) : tx("notSet")}</p>}
          b={<p>{c.bName ? tx("nameRoleTemplate", { name: c.bName, role: c.bRole ?? "?" }) : tx("notSet")}</p>}
        />
        <p className="mt-1 text-2xs text-text-muted">{tx("captainNote")}</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("setPieceTitle")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-text-dim">
                <th className="py-1 pr-2 font-medium">{tx("kind")}</th>
                <th className="py-1 pr-2 font-medium">A</th>
                <th className="py-1 pr-2 font-medium">B</th>
                <th className="py-1 font-medium">{tx("verdict")}</th>
              </tr>
            </thead>
            <tbody>
              {result.setPieceComparison
                .filter((r) => !diffOnly || (r.state !== "same" && r.state !== "neither"))
                .map((r) => (
                  <tr key={r.key} className="border-b border-border/50">
                    <td className="py-1 pr-2 text-text-dim">{r.label}</td>
                    <td className="py-1 pr-2">{r.aName ?? tx("notSet")}</td>
                    <td className="py-1 pr-2">{r.bName ?? tx("notSet")}</td>
                    <td className="py-1">{stateLabel(r.state)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-2xs text-text-muted">{tx("setPieceNote")}</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("linkUpTitleTemplate", { state: stateLabel(lu.state) })}</h3>
        <ABPair
          a={
            <>
              <p>{lu.aHasSelection ? tx("linkUpSet") : tx("notConfigured")}</p>
              {lu.aPlays.map((p, i) => (
                <p key={i} className="text-text-dim">
                  {p.name}: {p.status}（{p.confirmationStatus}）
                </p>
              ))}
            </>
          }
          b={
            <>
              <p>{lu.bHasSelection ? tx("linkUpSet") : tx("notConfigured")}</p>
              {lu.bPlays.map((p, i) => (
                <p key={i} className="text-text-dim">
                  {p.name}: {p.status}（{p.confirmationStatus}）
                </p>
              ))}
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">
          {lu.notice === "発動条件の照合のみ対応。ゲーム内効果は追加検証中です。" ? t("linkUp", "notice") : lu.notice}
        </p>
      </section>
    </div>
  );
}

function BoostersTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const { tx } = useSquadCompareText();
  const cardName = useCompareCardName(result.units);
  const kindLabel: Record<string, string> = {
    fixed: tx("kindFixed"),
    fixed_provisional: tx("kindFixedProvisional"),
    power_of_many: "Power of Many",
    conditional: tx("kindConditional"),
    unresolved: tx("kindUnresolved"),
    other: tx("kindOther"),
  };
  const boosterRows = diffOnly
    ? result.boosterComparison.filter((r) => r.userSelectionChanged)
    : result.boosterComparison;
  const buildRows = diffOnly ? result.buildComparison.filter((r) => r.changed) : result.buildComparison;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("boostersTitle")}</h3>
        <p className="mb-1 text-2xs text-text-muted">
          {tx("boostersNote")}
        </p>
        {boosterRows.length === 0 ? (
          <p className="text-xs text-text-dim">{diffOnly ? tx("noBoosterDiff") : tx("noTargetCommonCards")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {boosterRows.map((r) => (
              <li key={r.worldCardId} className="rounded border border-border bg-surface-2/40 p-2 text-xs">
                <p className="font-semibold">{cardName(r.worldCardId, r.name)}</p>
                <div className="mt-0.5 grid grid-cols-2 gap-2">
                  {(["a", "b"] as const).map((side) => (
                    <div key={side}>
                      <p className="text-2xs font-semibold text-text-muted">{side.toUpperCase()}</p>
                      {(side === "a" ? r.a : r.b).map((v) => (
                        <p key={v.slot} className="text-text-dim">
                          slot{v.slot}: {v.nameEn ?? `ID ${v.boosterId}`}
                          {v.level != null ? ` +${v.level}` : ""} · {kindLabel[v.kind]}
                          {v.kind === "power_of_many"
                            ? tx("selectionTemplate", { v: v.userSelection && v.userSelection !== "none" ? `+${v.userLevel}` : tx("notSelected") })
                            : ""}
                          {v.kind === "fixed" && v.autoApplied ? tx("standardApplied") : ""}
                        </p>
                      ))}
                      {(side === "a" ? r.a : r.b).length === 0 ? <p className="text-text-muted">{tx("none")}</p> : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-2xs text-text-muted">
          {tx("provisionalNote")}
        </p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("savedBuildsTitle")}</h3>
        {buildRows.length === 0 ? (
          <p className="text-xs text-text-dim">{diffOnly ? tx("noBuildDiff") : tx("noTargetCommonCards")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {buildRows.map((r) => (
              <li key={r.worldCardId} className="rounded border border-border bg-surface-2/40 p-2 text-xs">
                <p className="font-semibold">{cardName(r.worldCardId, r.name)}</p>
                <div className="mt-0.5 grid grid-cols-2 gap-2 text-text-dim">
                  {(["a", "b"] as const).map((side) => {
                    const bm = side === "a" ? r.aBuildMode : r.bBuildMode;
                    const bn = side === "a" ? r.aBuildName : r.bBuildName;
                    const rv = side === "a" ? r.aRulesVersion : r.bRulesVersion;
                    const del = side === "a" ? r.aDeletedRef : r.bDeletedRef;
                    const stale = side === "a" ? r.aStale : r.bStale;
                    const cond = side === "a" ? r.aHasConditional : r.bHasConditional;
                    const ovr = side === "a" ? r.aDisplayedOvr : r.bDisplayedOvr;
                    return (
                      <div key={side}>
                        <p className="text-2xs font-semibold text-text-muted">{side.toUpperCase()}</p>
                        <p>{tx("policyTemplate", { v: bm })}</p>
                        <p>{bn ? tx("buildNameTemplate", { name: bn }) : tx("noSavedBuild")}</p>
                        {rv ? <p>{tx("rulesTemplate", { v: rv })}</p> : null}
                        {del ? <p className="text-warning">{tx("deletedRef")}</p> : null}
                        {stale ? <p className="text-warning">{tx("staleBuild")}</p> : null}
                        {cond ? <p>{tx("conditionalTrial")}</p> : null}
                        <p>{tx("standardOvrTemplate", { v: fmtInt(ovr) })}</p>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SkillsTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const { tx, lib } = useSquadCompareText();
  const cardName = useCompareCardName(result.units);
  const sc = result.skillComparison;
  const rows = diffOnly ? sc.rows.filter((r) => r.state !== "same" || r.aAllStarters !== r.bAllStarters) : sc.rows;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("sharedSkillsTitle")}</h3>
        <ABPair
          a={<p>{tx("skillKindsTemplate", { name: result.summary.a.squadName, n: sc.onlyA.length + sc.both.length })}</p>}
          b={<p>{tx("skillKindsTemplate", { name: result.summary.b.squadName, n: sc.onlyB.length + sc.both.length })}</p>}
        />
        <p className="mt-1 text-2xs text-text-dim">
          {tx("bothListTemplate", { list: sc.both.join(", ") || tx("none") })}
        </p>
        <p className="text-2xs text-text-dim">{tx("onlyAAllTemplate", { list: sc.onlyA.map((s) => s.name).join(", ") || tx("none") })}</p>
        <p className="text-2xs text-text-dim">{tx("onlyBAllTemplate", { list: sc.onlyB.map((s) => s.name).join(", ") || tx("none") })}</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{tx("skillHoldersTitle")}</h3>
        <div className="max-h-80 overflow-y-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-text-dim">
                <th className="px-2 py-1 font-medium">{tx("skill")}</th>
                <th className="px-2 py-1 text-right font-medium">A</th>
                <th className="px-2 py-1 text-right font-medium">B</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-border/40">
                  <td className="px-2 py-1">
                    {r.name}
                    {r.aAllStarters || r.bAllStarters ? (
                      <span className="ml-1 text-2xs text-accent">{tx("allStarters")}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.aHolders}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.bHolders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-2xs text-text-muted">
          {tx("skillsNote")}
        </p>
      </section>

      {result.suitabilityComparison.cards.filter((c) => !diffOnly || c.changed).length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">{tx("commonSuitabilityTitle")}</h3>
          <ul className="flex flex-col gap-1">
            {result.suitabilityComparison.cards
              .filter((c) => !diffOnly || c.changed)
              .map((c) => (
                <li key={c.worldCardId} className="rounded border border-border bg-surface-2/40 px-2 py-1 text-xs">
                  <span className="font-semibold">{cardName(c.worldCardId, c.name)}</span>
                  <span className="ml-2 text-text-dim">
                    A: {c.aRole ?? "—"}{tx("parenTemplate", { v: c.aLabel ? lib(c.aLabel) : "—" })} / B: {c.bRole ?? "—"}{tx("parenTemplate", { v: c.bLabel ? lib(c.bLabel) : "—" })}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function WarningsTab({ result }: { result: SquadComparisonResult }) {
  const { tx } = useSquadCompareText();
  const w = result.warningComparison;
  const da = result.dataAvailability;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">
          {tx("warningsTitleTemplate", { a: w.aCount, b: w.bCount })}
        </h3>
        <p className="mb-1 text-2xs text-text-muted">{tx("noWinByWarnings")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <p className="text-2xs font-semibold text-text-muted">{tx("both")}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-dim">
              {w.both.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
              {w.both.length === 0 ? <li className="list-none text-text-muted">{tx("none")}</li> : null}
            </ul>
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">{tx("onlyAShort")}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-dim">
              {w.onlyA.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
              {w.onlyA.length === 0 ? <li className="list-none text-text-muted">{tx("none")}</li> : null}
            </ul>
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">{tx("onlyBShort")}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-dim">
              {w.onlyB.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
              {w.onlyB.length === 0 ? <li className="list-none text-text-muted">{tx("none")}</li> : null}
            </ul>
          </div>
        </div>
      </section>

      {da.aFailed.length + da.bFailed.length > 0 ? (
        <section aria-live="polite">
          <h3 className="mb-1.5 text-sm font-semibold text-warning">{tx("fetchFailedTitle")}</h3>
          {(["a", "b"] as const).map((side) => {
            const list = side === "a" ? da.aFailed : da.bFailed;
            if (list.length === 0) return null;
            return (
              <div key={side} className="text-xs text-text-dim">
                <p className="font-semibold">{side.toUpperCase()}</p>
                <ul className="list-disc pl-4">
                  {list.map((r) => (
                    <li key={r.worldCardId}>
                      World ID {r.worldCardId} —{" "}
                      {r.area === "starter" ? tx("starterTemplate", { v: r.placementRole ?? r.slotId ?? "?" }) : tx("benchNumberTemplate", { n: (r.benchIndex ?? 0) + 1 })}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="mt-1 text-2xs text-text-muted">
            {tx("failedNote")}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** ページの見出し（表示言語に合わせる。ページ本体はサーバーの静的ページ）。 */
export function SquadComparePageHeader() {
  const { tx } = useSquadCompareText();
  return <PageHeader title={tx("pageTitle")} icon="squad" description={tx("pageDescription")} backHref="/squads" backLabel={tx("pageBackLabel")} />;
}

export function SquadCompareLoading() {
  const { tx } = useSquadCompareText();
  return <p className="text-sm text-text-dim">{tx("pageLoading")}</p>;
}
