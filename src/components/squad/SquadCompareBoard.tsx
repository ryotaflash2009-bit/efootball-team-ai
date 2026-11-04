"use client";

import "@/lib/i18n/dictionaries/ja-ns/linkUp";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { listSquadEntries } from "@/lib/squad/squad-storage";
import { getComparisonPref, setComparisonPref } from "@/lib/squad/comparison-store";
import { SQUAD_ID_RE, type SquadListEntry } from "@/lib/squad/types";
import { fmtDate } from "@/lib/squad/compare-format";
import { useSquadCompareData } from "./useSquadCompareData";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { Surface } from "@/components/ui/Surface";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSquadCompareText } from "./useSquadCompareText";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import type { Tab } from "./SquadCompareResult";

const loadSquadCompareResult = () => import("./SquadCompareResult").then((m) => m.SquadCompareResult);
const SquadCompareResult = dynamic(loadSquadCompareResult, { ssr: false });

export function SquadCompareBoard() {
  const { tx, lib } = useSquadCompareText();
  // 日本語以外の表示言語では、タブの題名も表示言語にする（2026-10-07）。
  usePageTitle(tx("pageTitle"));
  const router = useRouter();
  const sp = useSearchParams();
  // React #418 の対策（2026-10-04）: このページは force-static で、サーバーは検索パラメーターを空として描く。
  // hydration の描画で ?a=&b= を読むと「比較を解除」等の有無が server の HTML と食い違うため、
  // パラメーターはマウント後（hydrated）に読む。直前のペアの復元もマウント後にだけ判断する。
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  // 結果の表示チャンクを、マウント直後に先読みしておく（選択してから待たせない）。
  useEffect(() => {
    const id = window.setTimeout(() => void loadSquadCompareResult(), 300);
    return () => window.clearTimeout(id);
  }, []);
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

  // 比較の計算と結果の表示は別チャンク（SquadCompareResult）に分け、2 つ選んだときだけ読み込む（2026-11-04）。
  // sameSquad は上の分岐で先に扱うため、ここでは両方のスカッドが読めたかだけを見る。
  const bothLoaded = !sameSquad && !!data.a && !!data.b;

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
      ) : data.loadingSquads || (!bothLoaded && !data.cardError) ? (
        <p aria-live="polite" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          {tx("loadingAll")}
        </p>
      ) : bothLoaded ? (
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

          <SquadCompareResult a={data.a} b={data.b} tab={tab} onTab={setTab} diffOnly={diffOnly} onDiffOnly={setDiffOnly} />
        </>
      ) : data.cardError ? (
        <p className="text-xs text-danger">{lib(data.cardError)} {tx("retryLater")}</p>
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
