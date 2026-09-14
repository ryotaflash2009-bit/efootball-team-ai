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

type Tab = "overview" | "shape" | "players" | "metrics" | "roles" | "boosters" | "skills" | "warnings";
const TABS: [Tab, string][] = [
  ["overview", "概要"],
  ["shape", "配置"],
  ["players", "選手"],
  ["metrics", "能力値"],
  ["roles", "役割"],
  ["boosters", "ブースター"],
  ["skills", "スキル / 適性"],
  ["warnings", "警告"],
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

const nameOf = (u: CompareCardUnit) => u.nameJa || u.nameEn || `カード ${u.worldCardId}`;

export function SquadCompareBoard() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawA = sp.get("a");
  const rawB = sp.get("b");
  const dupParams = sp.getAll("a").length > 1 || sp.getAll("b").length > 1;

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
    if (restored) return;
    setRestored(true);
    if (rawA || rawB) return;
    const pref = getComparisonPref();
    if (pref.squadIdA || pref.squadIdB) setParams(pref.squadIdA, pref.squadIdB);
  }, [restored, rawA, rawB, setParams]);

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
          aria-label={`${label}のスカッド`}
          className="h-10 w-full rounded-md border border-border bg-surface-2 px-2 text-sm"
        >
          <option value="">スカッドを選択…</option>
          {validEntries.map((e) => (
            <option key={e.squadId} value={e.squadId} disabled={e.squadId === exclude}>
              {e.squadName}（{e.formationName} / 先発{e.startingCount} / ベンチ{e.benchCount} /{" "}
              {e.managerId != null ? "監督あり" : "監督なし"}
              {e.hasCustomPositioning ? " / カスタム配置" : ""}）
            </option>
          ))}
        </select>
        {cur ? (
          <p className="flex flex-wrap items-center gap-x-2 text-2xs text-text-muted">
            <span>更新 {fmtDate(cur.updatedAt)}</span>
            <Link href={`/squads/${cur.squadId}`} className="text-accent hover:underline">
              開く
            </Link>
            {value ? (
              <button type="button" onClick={() => onChange(null)} className="text-text-dim hover:text-accent">
                選択を解除
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
        ← スカッド一覧へ
      </Link>

      {!data.storageOk ? (
        <Surface tone="outline" className="text-center text-sm text-text-dim">
          この環境ではスカッドを保存・比較できません（localStorage 不可・プライベートモード等）。
        </Surface>
      ) : null}

      {/* 選択 */}
      <Surface tone="raised" className="flex flex-col gap-3">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <Selector label="比較対象A" value={rawA} exclude={rawB} onChange={(v) => setParams(v, rawB)} />
          <button
            type="button"
            onClick={() => setParams(rawB, rawA)}
            aria-label="比較対象AとBを入れ替える"
            disabled={!rawA && !rawB}
            className="mx-auto h-10 shrink-0 self-center rounded-md border border-border px-3 text-sm hover:border-accent disabled:opacity-40 sm:self-end"
          >
            ⇄ 入れ替え
          </button>
          <Selector label="比較対象B" value={rawB} exclude={rawA} onChange={(v) => setParams(rawA, v)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(rawA || rawB) ? (
            <button
              type="button"
              onClick={() => setParams(null, null)}
              className="rounded border border-border px-2 py-1 text-text-dim hover:border-accent"
            >
              比較を解除
            </button>
          ) : null}
          <span className="text-text-muted">
            比較URLはこのブラウザ内の保存スカッドを参照します。別端末では同じスカッドを表示できない場合があります。
          </span>
        </div>
        {dupParams ? (
          <p className="text-2xs text-warning">URL に同じパラメーターが重複しています。最初の値だけを使用します。</p>
        ) : null}
      </Surface>

      {/* 空状態・エラー状態 */}
      {!canCompare && entries != null ? (
        <Surface tone="outline" className="flex flex-col items-center gap-3 py-8 text-center text-sm">
          <p className="font-semibold">比較には 2 つ以上の保存済みスカッドが必要です。</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <Link href="/squads#create-squad" className={buttonClasses("primary", "sm")}>
              新しいスカッドを作成
            </Link>
            <Link href="/squads/templates" className={buttonClasses("secondary", "sm")}>
              テンプレートから作成
            </Link>
            <Link href="/squads" className={buttonClasses("secondary", "sm")}>
              スカッド一覧へ
            </Link>
          </div>
        </Surface>
      ) : sameSquad ? (
        <Surface tone="outline" className="py-8 text-center text-sm font-semibold text-warning">
          同じスカッド同士は比較できません。
        </Surface>
      ) : data.aMissing || data.bMissing ? (
        <Surface tone="outline" className="py-6 text-center text-sm">
          <p className="font-semibold text-danger">
            指定されたスカッドが見つかりません（削除済み、または存在しない ID）。
          </p>
          <p className="mt-1 text-xs text-text-dim">
            {data.aMissing ? "比較対象A" : ""}
            {data.aMissing && data.bMissing ? " と " : ""}
            {data.bMissing ? "比較対象B" : ""} を選び直してください。
          </p>
        </Surface>
      ) : !rawA || !rawB ? (
        <Surface tone="outline" className="py-8 text-center text-sm text-text-dim">
          {!rawA && !rawB
            ? "比較するスカッドを 2 つ選択してください。"
            : "もう 1 つのスカッドを選択してください。"}
        </Surface>
      ) : data.loadingSquads || (!result && !data.cardError) ? (
        <p aria-live="polite" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
          スカッドと選手データを読み込み中…
        </p>
      ) : result ? (
        <>
          {data.externalUpdate ? (
            <div aria-live="polite" className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning">
              <span>別のタブでスカッドが更新されました。比較結果が古くなっている可能性があります。</span>
              <button type="button" onClick={data.reload} className="rounded border border-warning px-2 py-0.5">
                再読込
              </button>
            </div>
          ) : null}
          {data.loadingCards ? (
            <p aria-live="polite" className="text-xs text-text-dim">
              選手データを読み込み中…
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
                {lbl}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-text-dim">
              <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
              差分のみ表示
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
        <p className="text-xs text-danger">{data.cardError} 時間をおいて再読込してください。</p>
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
  const { a, b } = result.summary;
  return (
    <Surface tone="raised" className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <SummaryCard s={a} tag="A" />
        <div className="flex flex-col items-center gap-1 self-center text-center text-2xs text-text-dim">
          <span className="rounded border border-border px-2 py-1">
            共通カード<br />
            <b className="text-sm text-text">{result.summary.commonCardCount}</b>
          </span>
          <span>Aだけ {result.summary.onlyACardCount}</span>
          <span>Bだけ {result.summary.onlyBCardCount}</span>
        </div>
        <SummaryCard s={b} tag="B" />
      </div>
      <p className="text-2xs text-text-muted">
        スカッドの優劣は自動判定しません。数値は「Aの値 / Bの値 / 差」で並べています。
      </p>
    </Surface>
  );
}

function SummaryCard({ s, tag }: { s: SquadComparisonResult["summary"]["a"]; tag: "A" | "B" }) {
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
        <dt>フォーメーション</dt>
        <dd className="text-text">{s.formationName}{s.hasCustomPositioning ? "（カスタム配置）" : ""}</dd>
        <dt>先発 / ベンチ</dt>
        <dd className="text-text">{s.startingCount}/11・{s.benchCount}</dd>
        <dt>監督</dt>
        <dd className="text-text">{s.hasManager ? s.managerName ?? "（取得中）" : "なし"}</dd>
        <dt>キャプテン</dt>
        <dd className="text-text">{s.captainName ?? "未設定"}{s.captainRole ? `（${s.captainRole}）` : ""}</dd>
        <dt>更新</dt>
        <dd className="text-text">{fmtDate(s.updatedAt)}</dd>
        <dt>警告数</dt>
        <dd className="text-text">{s.warningCount}</dd>
      </dl>
    </div>
  );
}

function OverviewTab({ result }: { result: SquadComparisonResult }) {
  const f = result.formationComparison;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">フォーメーション</h3>
        <ABPair
          a={
            <>
              <p className="font-semibold">{f.aName}</p>
              <p className="text-text-dim">
                {f.aRoleBreakdown.map((r) => `${r.count} ${r.role}`).join(" / ")}
              </p>
              <p className="text-text-muted">左 {f.aZones.left} / 中央 {f.aZones.center} / 右 {f.aZones.right}</p>
              {f.aHasCustomPositioning ? <p className="text-accent">カスタム配置あり</p> : <p className="text-text-muted">プリセット配置</p>}
            </>
          }
          b={
            <>
              <p className="font-semibold">{f.bName}</p>
              <p className="text-text-dim">
                {f.bRoleBreakdown.map((r) => `${r.count} ${r.role}`).join(" / ")}
              </p>
              <p className="text-text-muted">左 {f.bZones.left} / 中央 {f.bZones.center} / 右 {f.bZones.right}</p>
              {f.bHasCustomPositioning ? <p className="text-accent">カスタム配置あり</p> : <p className="text-text-muted">プリセット配置</p>}
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">
          {f.same ? "同じフォーメーション ID です。" : "フォーメーション ID が異なります。"}
          {f.roleBreakdownSame ? " FW/MF/DF/GK の人数構成は同じです（配置座標はミニピッチで確認）。" : ""}
          左右バランス・中央配置数は事実として並べています（自動評価はしません）。
        </p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">主要指標</h3>
        <MetricTable rows={result.metricComparison} diffOnly={false} />
      </section>

      <NotesBlock notes={result.metricsNotes} />
    </div>
  );
}

function MetricTable({ rows, diffOnly }: { rows: SquadComparisonResult["metricComparison"]; diffOnly: boolean }) {
  const shown = diffOnly ? rows.filter((r) => r.higher !== "equal" && r.higher !== "na") : rows;
  if (shown.length === 0) return <p className="text-xs text-text-dim">差分のある指標はありません。</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-dim">
            <th className="py-1 pr-2 font-medium">指標</th>
            <th className="py-1 pr-2 text-right font-medium">A</th>
            <th className="py-1 pr-2 text-right font-medium">B</th>
            <th className="py-1 text-right font-medium">差 (A−B)</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-b border-border/50">
              <td className="py-1 pr-2 text-text-dim">
                {r.label}
                {r.lowerIsCalmer ? <span className="ml-1 text-2xs text-text-muted">(少ない方が穏当)</span> : null}
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
  return (
    <details className="rounded-md border border-border bg-surface-2/30 p-2 text-2xs text-text-muted">
      <summary className="cursor-pointer font-semibold text-text-dim">平均値・比較の注意書き</summary>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </details>
  );
}

function ShapeTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
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
        <h3 className="mb-1.5 text-sm font-semibold">共通カードの配置差（先発同士）</h3>
        {changes.length === 0 ? (
          <p className="text-xs text-text-dim">先発で共通するカードの配置差はありません。</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {changes.map((c) => (
              <li key={c.worldCardId} className="rounded border border-border bg-surface-2/40 p-2 text-xs">
                <p className="font-semibold">{c.name}</p>
                <div className="mt-0.5 grid grid-cols-2 gap-2 text-text-dim">
                  <span>A: {c.aRole ?? "?"} / x {fmt(c.aX)} · y {fmt(c.aY)}</span>
                  <span>B: {c.bRole ?? "?"} / x {fmt(c.bX)} · y {fmt(c.bY)}</span>
                </div>
                <p className="mt-0.5 text-text-muted">
                  {c.roleChanged ? `変化: ${c.aRole} → ${c.bRole}・` : ""}
                  x差 {fmtDiff(c.aX, c.bX)} / y差 {fmtDiff(c.aY, c.bY)}（正規化座標）
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
  const rows = result.playerComparison.areaChanges;
  if (rows.length === 0) return <p className="text-xs text-text-dim">先発 / ベンチの入れ替わりはありません。</p>;
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold">先発 / ベンチの変化（共通カード）</h3>
      <ul className="flex flex-col gap-1">
        {rows.map((c) => (
          <li key={c.worldCardId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface-2/40 px-2 py-1 text-xs">
            <span className="font-semibold">{c.name}</span>
            <span className="text-text-dim">
              A: {c.aLabel} → B: {c.bLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerCardMini({ u, note }: { u: CompareCardUnit; note?: string }) {
  return (
    <div className="flex gap-2 rounded border border-border bg-surface-2/40 p-2 text-xs">
      <div className="w-10 shrink-0">
        {u.resolved ? (
          <WorldCardImage sources={cardSources(u)} alt={nameOf(u)} size="card" />
        ) : (
          <div className="grid aspect-[3/4] w-full place-items-center rounded bg-surface-2 text-2xs text-text-muted">
            取得失敗
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{nameOf(u)}</p>
        <p className="text-2xs text-text-muted">
          World ID {u.worldCardId}
          {u.cardType ? ` / ${u.cardType}` : ""}
        </p>
        <p className="text-2xs text-text-dim">
          登録 {u.registeredPosition ?? "—"}
          {u.area === "starter" ? ` / 配置 ${u.placementRole ?? "?"}` : " / ベンチ"}
          {u.suitability ? ` / ${u.suitability.label}` : ""}
        </p>
        <p className="text-2xs text-text-dim">
          表示OVR {fmtInt(u.displayedOvr)} / 基礎OVR {fmtInt(u.baseOvr)}
          {u.savedBuildName ? ` / ビルド「${u.savedBuildName}」` : u.buildMode !== "none" ? ` / ${u.buildMode}` : ""}
        </p>
        <p className="flex flex-wrap gap-1 text-2xs">
          {u.isCaptain ? <Badge tone="accent" size="xs">キャプテン</Badge> : null}
          {u.setPieceRoles.map((r) => (
            <Badge key={r} tone="outline" size="xs">
              {r}
            </Badge>
          ))}
          {u.hasConditionalSelection ? <Badge tone="warning" size="xs">PoM/条件指定</Badge> : null}
        </p>
        {note ? <p className="mt-0.5 text-2xs text-warning">{note}</p> : null}
        <p className="mt-0.5 flex gap-2 text-2xs">
          <Link href={`/players/world/${u.worldCardId}`} className="text-accent hover:underline">
            選手詳細
          </Link>
          <Link href={`/players/world/${u.worldCardId}#progression`} className="text-accent hover:underline">
            育成
          </Link>
        </p>
      </div>
    </div>
  );
}

function PlayersTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const pc = result.playerComparison;
  const bc = result.benchComparison;
  const both = diffOnly ? pc.starterBoth.filter((p) => p.anyChange) : pc.starterBoth;
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">先発 — 両方にいる（{pc.starterBoth.length}）</h3>
        {both.length === 0 ? (
          <p className="text-xs text-text-dim">{diffOnly ? "設定差のある共通先発はいません。" : "共通する先発はいません。"}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {both.map((p) => (
              <div key={p.worldCardId} className="grid grid-cols-2 gap-1.5">
                <PlayerCardMini u={p.a} />
                <PlayerCardMini
                  u={p.b}
                  note={
                    [
                      p.roleChanged ? `配置 ${p.a.placementRole}→${p.b.placementRole}` : "",
                      p.areaChanged ? "先発↔ベンチ" : "",
                      p.buildModeChanged ? "育成方針差" : "",
                      p.savedBuildChanged ? "保存ビルド差" : "",
                      p.captainChanged ? "キャプテン差" : "",
                      p.setPieceChanged ? "セットプレー差" : "",
                      p.pomChanged ? "Power of Many 指定差" : "",
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
          <h3 className="mb-1.5 text-sm font-semibold">先発 — Aだけ（{pc.starterOnlyA.length}）</h3>
          <div className="flex flex-col gap-1.5">
            {pc.starterOnlyA.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {pc.starterOnlyA.length === 0 ? <p className="text-xs text-text-dim">なし</p> : null}
          </div>
        </div>
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">先発 — Bだけ（{pc.starterOnlyB.length}）</h3>
          <div className="flex flex-col gap-1.5">
            {pc.starterOnlyB.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {pc.starterOnlyB.length === 0 ? <p className="text-xs text-text-dim">なし</p> : null}
          </div>
        </div>
      </section>

      {pc.sameNameDifferentCard.length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">同名の別カード</h3>
          <p className="mb-1 text-2xs text-text-muted">
            worldCardId が異なるため共通カードとしては扱いません（確認済みの選手識別子が無いため「同名の別カード」）。
          </p>
          <div className="flex flex-col gap-1.5">
            {pc.sameNameDifferentCard.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-1.5">
                <PlayerCardMini u={s.a} note="Aのカード" />
                <PlayerCardMini u={s.b} note="Bのカード" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">
          ベンチ（A {bc.aCount} / B {bc.bCount}）
        </h3>
        {bc.orderChanged ? <p className="mb-1 text-2xs text-text-muted">ベンチの並び順が異なります（順序は優劣ではありません）。</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-2xs font-semibold text-text-muted">Bと共通</p>
            {bc.both.map((p) => (
              <PlayerCardMini key={p.worldCardId} u={p.a} />
            ))}
            {bc.both.length === 0 ? <p className="text-xs text-text-dim">なし</p> : null}
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">Aのベンチだけ</p>
            {bc.onlyA.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {bc.onlyA.length === 0 ? <p className="text-xs text-text-dim">なし</p> : null}
          </div>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-2xs font-semibold text-text-muted">Bのベンチだけ</p>
            {bc.onlyB.map((u) => (
              <PlayerCardMini key={u.worldCardId} u={u} />
            ))}
            {bc.onlyB.length === 0 ? <p className="text-xs text-text-dim">なし</p> : null}
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">先発↔ベンチの変化</p>
            {[...bc.starterToBench, ...bc.benchToStarter].map((c) => (
              <p key={c.worldCardId} className="text-xs text-text-dim">
                {c.name}: {c.aLabel} → {c.bLabel}
              </p>
            ))}
            {bc.starterToBench.length + bc.benchToStarter.length === 0 ? (
              <p className="text-xs text-text-dim">なし</p>
            ) : null}
          </div>
        </div>
      </section>

      {result.dataAvailability.aFailed.length + result.dataAvailability.bFailed.length > 0 ? (
        <p className="text-2xs text-warning">
          一部の選手情報を取得できませんでした（「警告」タブに対象を表示）。保存済みの worldCardId は保持しています。
        </p>
      ) : null}
    </div>
  );
}

function MetricsTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const cats = diffOnly
    ? result.categoryComparison.filter((c) => c.higher !== "equal" && c.higher !== "na")
    : result.categoryComparison;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">平均・指標</h3>
        <MetricTable rows={result.metricComparison} diffOnly={diffOnly} />
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">カテゴリ平均（単純平均）</h3>
        {cats.length === 0 ? (
          <p className="text-xs text-text-dim">差分のあるカテゴリはありません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cats.map((c) => (
              <li key={c.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{c.label}</span>
                  <span className="tabular-nums text-text-dim">
                    A {fmt(c.a)} / B {fmt(c.b)} / 差{" "}
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
        <h3 className="mb-1.5 text-sm font-semibold">適性</h3>
        <ABPair
          a={
            <>
              <p>登録一致 {result.suitabilityComparison.aExact}</p>
              <p>適性未確認 {result.suitabilityComparison.aUnresolved}</p>
              <p>不適性の可能性 {result.suitabilityComparison.aGkMismatch}</p>
            </>
          }
          b={
            <>
              <p>登録一致 {result.suitabilityComparison.bExact}</p>
              <p>適性未確認 {result.suitabilityComparison.bUnresolved}</p>
              <p>不適性の可能性 {result.suitabilityComparison.bGkMismatch}</p>
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">
          副ポジション適性データは未収録です。適性が多い方を自動的に優秀とは判定しません。ポジション別 OVR は推測しません。
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
  const stateLabel = (s: string) =>
    s === "same" ? "同一" : s === "different" ? "相違" : s === "onlyA" ? "Aのみ" : s === "onlyB" ? "Bのみ" : "両方なし";
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">監督（{stateLabel(m.state)}）</h3>
        <ABPair
          a={
            <>
              <p className="font-semibold">{m.aHasManager ? m.aName ?? "（取得中）" : "監督なし"}</p>
              <p className="text-text-muted">managerBoosterDelta 合計 {m.aBoosterDelta}</p>
              {m.aConfirmedBoosters.length ? (
                <p className="text-text-dim">
                  確認済み: {m.aConfirmedBoosters.map((x) => `${x.statNameEn} +${x.delta}`).join(", ")}
                </p>
              ) : (
                <p className="text-text-muted">確認済み監督ブースターなし</p>
              )}
            </>
          }
          b={
            <>
              <p className="font-semibold">{m.bHasManager ? m.bName ?? "（取得中）" : "監督なし"}</p>
              <p className="text-text-muted">managerBoosterDelta 合計 {m.bBoosterDelta}</p>
              {m.bConfirmedBoosters.length ? (
                <p className="text-text-dim">
                  確認済み: {m.bConfirmedBoosters.map((x) => `${x.statNameEn} +${x.delta}`).join(", ")}
                </p>
              ) : (
                <p className="text-text-muted">確認済み監督ブースターなし</p>
              )}
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">{m.orderNote} 監督画像は表示しません。</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">キャプテン（{stateLabel(c.state)}）</h3>
        <ABPair
          a={<p>{c.aName ? `${c.aName}（${c.aRole ?? "?"}）` : "未設定"}</p>}
          b={<p>{c.bName ? `${c.bName}（${c.bRole ?? "?"}）` : "未設定"}</p>}
        />
        <p className="mt-1 text-2xs text-text-muted">キャプテンは役割情報として比較します（能力効果は加算しません）。</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">セットプレー担当</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-text-dim">
                <th className="py-1 pr-2 font-medium">種別</th>
                <th className="py-1 pr-2 font-medium">A</th>
                <th className="py-1 pr-2 font-medium">B</th>
                <th className="py-1 font-medium">判定</th>
              </tr>
            </thead>
            <tbody>
              {result.setPieceComparison
                .filter((r) => !diffOnly || (r.state !== "same" && r.state !== "neither"))
                .map((r) => (
                  <tr key={r.key} className="border-b border-border/50">
                    <td className="py-1 pr-2 text-text-dim">{r.label}</td>
                    <td className="py-1 pr-2">{r.aName ?? "未設定"}</td>
                    <td className="py-1 pr-2">{r.bName ?? "未設定"}</td>
                    <td className="py-1">{stateLabel(r.state)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-2xs text-text-muted">既存キー（CK / FK / PK）のみを比較します。左右 FK・近距離 FK は扱いません。</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">Link-Up（{stateLabel(lu.state)}）</h3>
        <ABPair
          a={
            <>
              <p>{lu.aHasSelection ? "Link-Up 設定あり" : "設定なし"}</p>
              {lu.aPlays.map((p, i) => (
                <p key={i} className="text-text-dim">
                  {p.name}: {p.status}（{p.confirmationStatus}）
                </p>
              ))}
            </>
          }
          b={
            <>
              <p>{lu.bHasSelection ? "Link-Up 設定あり" : "設定なし"}</p>
              {lu.bPlays.map((p, i) => (
                <p key={i} className="text-text-dim">
                  {p.name}: {p.status}（{p.confirmationStatus}）
                </p>
              ))}
            </>
          }
        />
        <p className="mt-1 text-2xs text-text-muted">{lu.notice}</p>
      </section>
    </div>
  );
}

function BoostersTab({ result, diffOnly }: { result: SquadComparisonResult; diffOnly: boolean }) {
  const kindLabel: Record<string, string> = {
    fixed: "固定型",
    fixed_provisional: "固定型（推定）",
    power_of_many: "Power of Many",
    conditional: "条件型（Total Package）",
    unresolved: "未解決",
    other: "その他",
  };
  const boosterRows = diffOnly
    ? result.boosterComparison.filter((r) => r.userSelectionChanged)
    : result.boosterComparison;
  const buildRows = diffOnly ? result.buildComparison.filter((r) => r.changed) : result.buildComparison;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">fixed booster / Power of Many（共通カード）</h3>
        <p className="mb-1 text-2xs text-text-muted">
          カード付属ブースターの効果は同一カードなら同じです。ここでは主に Power of Many（金色）・Total Package の
          ユーザー指定段階の違いを比較します。ユーザー指定値は標準値として扱いません。
        </p>
        {boosterRows.length === 0 ? (
          <p className="text-xs text-text-dim">{diffOnly ? "指定差のあるブースターはありません。" : "対象の共通カードがありません。"}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {boosterRows.map((r) => (
              <li key={r.worldCardId} className="rounded border border-border bg-surface-2/40 p-2 text-xs">
                <p className="font-semibold">{r.name}</p>
                <div className="mt-0.5 grid grid-cols-2 gap-2">
                  {(["a", "b"] as const).map((side) => (
                    <div key={side}>
                      <p className="text-2xs font-semibold text-text-muted">{side.toUpperCase()}</p>
                      {(side === "a" ? r.a : r.b).map((v) => (
                        <p key={v.slot} className="text-text-dim">
                          slot{v.slot}: {v.nameEn ?? `ID ${v.boosterId}`}
                          {v.level != null ? ` +${v.level}` : ""} · {kindLabel[v.kind]}
                          {v.kind === "power_of_many"
                            ? ` · 指定 ${v.userSelection && v.userSelection !== "none" ? `+${v.userLevel}` : "未指定"}`
                            : ""}
                          {v.kind === "fixed" && v.autoApplied ? " · 標準適用" : ""}
                        </p>
                      ))}
                      {(side === "a" ? r.a : r.b).length === 0 ? <p className="text-text-muted">なし</p> : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-2xs text-text-muted">
          「固定型（推定）」= 効果内容は外部照合済みですが、Power of Many である具体的証拠がないため固定型と推定して標準値へ暫定適用しています（「確認済み固定型」ではありません）。
        </p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">保存ビルド（共通カード）</h3>
        {buildRows.length === 0 ? (
          <p className="text-xs text-text-dim">{diffOnly ? "ビルド差のある共通カードはありません。" : "対象の共通カードがありません。"}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {buildRows.map((r) => (
              <li key={r.worldCardId} className="rounded border border-border bg-surface-2/40 p-2 text-xs">
                <p className="font-semibold">{r.name}</p>
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
                        <p>方針 {bm}</p>
                        <p>{bn ? `ビルド「${bn}」` : "保存ビルドなし"}</p>
                        {rv ? <p>規則 {rv}</p> : null}
                        {del ? <p className="text-warning">参照先ビルドが削除されています（計算は方針のみ）。</p> : null}
                        {stale ? <p className="text-warning">旧規則ビルド（現行規則で再計算）</p> : null}
                        {cond ? <p>条件段階の指定あり（試算）</p> : null}
                        <p>標準表示OVR {fmtInt(ovr)}</p>
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
  const sc = result.skillComparison;
  const rows = diffOnly ? sc.rows.filter((r) => r.state !== "same" || r.aAllStarters !== r.bAllStarters) : sc.rows;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">先発全員が持つ共通スキル</h3>
        <ABPair
          a={<p>{result.summary.a.squadName}: {sc.onlyA.length + sc.both.length} 種</p>}
          b={<p>{result.summary.b.squadName}: {sc.onlyB.length + sc.both.length} 種</p>}
        />
        <p className="mt-1 text-2xs text-text-dim">
          両方: {sc.both.join(", ") || "なし"}
        </p>
        <p className="text-2xs text-text-dim">Aだけ（全先発共通）: {sc.onlyA.map((s) => s.name).join(", ") || "なし"}</p>
        <p className="text-2xs text-text-dim">Bだけ（全先発共通）: {sc.onlyB.map((s) => s.name).join(", ") || "なし"}</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">スキル所有人数（先発）</h3>
        <div className="max-h-80 overflow-y-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-text-dim">
                <th className="px-2 py-1 font-medium">スキル</th>
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
                      <span className="ml-1 text-2xs text-accent">全先発共通</span>
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
          カード本来のスキルは同じ worldCardId なら同一として扱います。スキル効果からスカッドの優劣は判定しません。
        </p>
      </section>

      {result.suitabilityComparison.cards.filter((c) => !diffOnly || c.changed).length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">共通カードの適性</h3>
          <ul className="flex flex-col gap-1">
            {result.suitabilityComparison.cards
              .filter((c) => !diffOnly || c.changed)
              .map((c) => (
                <li key={c.worldCardId} className="rounded border border-border bg-surface-2/40 px-2 py-1 text-xs">
                  <span className="font-semibold">{c.name}</span>
                  <span className="ml-2 text-text-dim">
                    A: {c.aRole ?? "—"}（{c.aLabel ?? "—"}）/ B: {c.bRole ?? "—"}（{c.bLabel ?? "—"}）
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
  const w = result.warningComparison;
  const da = result.dataAvailability;
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-1.5 text-sm font-semibold">
          警告（A {w.aCount} / B {w.bCount}）
        </h3>
        <p className="mb-1 text-2xs text-text-muted">警告数が少ない方を自動的に「勝ち」とはしません。</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <p className="text-2xs font-semibold text-text-muted">両方</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-dim">
              {w.both.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
              {w.both.length === 0 ? <li className="list-none text-text-muted">なし</li> : null}
            </ul>
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">Aだけ</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-dim">
              {w.onlyA.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
              {w.onlyA.length === 0 ? <li className="list-none text-text-muted">なし</li> : null}
            </ul>
          </div>
          <div>
            <p className="text-2xs font-semibold text-text-muted">Bだけ</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-dim">
              {w.onlyB.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
              {w.onlyB.length === 0 ? <li className="list-none text-text-muted">なし</li> : null}
            </ul>
          </div>
        </div>
      </section>

      {da.aFailed.length + da.bFailed.length > 0 ? (
        <section aria-live="polite">
          <h3 className="mb-1.5 text-sm font-semibold text-warning">選手情報を取得できなかったカード</h3>
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
                      {r.area === "starter" ? `先発 ${r.placementRole ?? r.slotId}` : `ベンチ ${(r.benchIndex ?? 0) + 1}番`}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="mt-1 text-2xs text-text-muted">
            平均・スキル集計からは除外されています。時間をおいて再読込すると再取得します。保存済み worldCardId は削除していません。
          </p>
        </section>
      ) : null}
    </div>
  );
}
