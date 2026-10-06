"use client";

import "@/lib/i18n/dictionaries/ja-ns/managerCompare";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ManagerDetail } from "@/lib/managers/types";
import { compareManagers, MAX_COMPARED_MANAGERS, parseManagerIds } from "@/lib/managers/compare-managers";
import { ManagerPicker } from "@/components/managers/ManagerPicker";
import { TACTICS, tacticName, tacticTier, TACTIC_TEXT, managerInitials } from "@/components/managers/tactics";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Icon } from "@/components/ui/Icon";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import { fillMessage } from "@/lib/i18n/message-format";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * 監督の比較（NEW-23・2026-10-07）。2〜4 人の事実を並べるだけ（総合点・推測はしない）。
 * 選んだ監督は URL の ?ids= に持つ（共有・再読み込みで同じ比較を開ける）。データは既存の /api/managers/:id を読む。
 */
export function ManagerCompareView() {
  const t = useT();
  const tc = (k: keyof Dictionary["managerCompare"]) => t("managerCompare", k);
  const { displayLocale } = useLocale();
  usePageTitle(tc("pageTitle"));
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ids = useMemo(() => parseManagerIds(params.get("ids")), [params]);
  const [cache, setCache] = useState<Record<number, ManagerDetail>>({});
  const [failed, setFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const missing = ids.filter((id) => !cache[id]);
  const missingKey = missing.join(",");
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    setFailed(false);
    Promise.all(
      missingKey.split(",").map((id) =>
        fetch(`/api/managers/${id}`).then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return ((await r.json()) as { manager: ManagerDetail }).manager;
        }),
      ),
    )
      .then((ms) => {
        if (cancelled) return;
        setCache((c) => ({ ...c, ...Object.fromEntries(ms.map((m) => [m.internalManagerId, m])) }));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  const setIds = (next: number[]) => {
    const sp = new URLSearchParams(params.toString());
    if (next.length) sp.set("ids", next.join(","));
    else sp.delete("ids");
    const s = sp.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const managers = ids.map((id) => cache[id]).filter((m): m is ManagerDetail => !!m);
  const ready = managers.length === ids.length;
  const cmp = useMemo(() => (ready ? compareManagers(managers) : null), [ready, managers]);
  const full = ids.length >= MAX_COMPARED_MANAGERS;
  const cols = { gridTemplateColumns: `minmax(8rem, 1.2fr) repeat(${Math.max(ids.length, 1)}, minmax(6.5rem, 1fr))` };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/managers" className="inline-flex w-fit items-center gap-1 text-sm text-text-dim hover:text-accent">
        <Icon name="chevron-left" size={16} />
        {tc("backToList")}
      </Link>
      <PageHeader
        title={tc("heading")}
        icon="managers"
        description={tc("intro")}
        actions={
          <Button size="sm" onClick={() => setPickerOpen(true)} disabled={full}>
            {tc("addManager")}
          </Button>
        }
      />
      {full ? <p className="text-xs text-text-muted">{tc("maxReached")}</p> : null}

      {ids.length === 0 ? (
        <EmptyState icon="managers" title={tc("emptyTitle")} description={tc("emptyDescription")} />
      ) : failed ? (
        <EmptyState variant="error" icon="warning" title={tc("loadFailed")} />
      ) : !cmp ? (
        <LoadingState variant="compare" count={2} />
      ) : (
        <>
          {ids.length < 2 ? <p className="text-sm text-text-dim">{tc("needMoreHint")}</p> : null}
          <div className="overflow-x-auto" data-testid="manager-compare-table">
            <div className="min-w-fit">
              {/* 監督の見出し */}
              <div className="grid gap-2" style={cols}>
                <span className="self-end text-xs text-text-muted">{tc("managerColumn")}</span>
                {managers.map((m) => (
                  <div key={m.internalManagerId} className="flex min-w-0 flex-col items-start gap-1 rounded-md border border-border bg-surface p-2">
                    <span className="grid h-9 w-9 place-items-center rounded bg-surface-3 text-sm font-black text-text-dim">{managerInitials(m.nameEn)}</span>
                    <Link href={`/managers/${m.internalManagerId}`} className="w-full break-words text-sm font-semibold hover:text-accent">
                      {m.nameEn}
                    </Link>
                    <button
                      type="button"
                      className="text-2xs text-text-muted underline hover:text-accent"
                      onClick={() => setIds(ids.filter((id) => id !== m.internalManagerId))}
                      aria-label={fillMessage(tc("removeTemplate"), { name: m.nameEn })}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <Surface className="mt-4">
                <SectionHeader title={tc("tacticsTitle")} as="h2" hint={tc("bestNote")} />
                <div className="flex flex-col divide-y divide-border">
                  {cmp.tactics.map((row) => {
                    const meta = TACTICS.find((x) => x.key === row.key)!;
                    return (
                      <div key={row.key} className="grid items-center gap-2 py-1.5" style={cols}>
                        <span className="text-sm">{tacticName(meta, displayLocale)}</span>
                        {row.values.map((v, i) => (
                          <span key={i} className={`text-sm font-bold tabular-nums ${TACTIC_TEXT[tacticTier(v)]}`}>
                            {v ?? "—"}
                            {row.best.includes(i) && ids.length > 1 ? (
                              <span className="ms-1 text-accent" aria-label={tc("bestMarker")} title={tc("bestMarker")}>
                                ★
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Surface>

              <Surface className="mt-4">
                <SectionHeader title={tc("boostersTitle")} as="h2" />
                {cmp.boosters.length === 0 ? (
                  <p className="text-sm text-text-muted">{tc("noBoosters")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {cmp.boosters.map((row) => (
                      <div key={row.key} className="grid items-center gap-2 py-1.5" style={cols}>
                        <span className="text-sm">{row.mapped ? abilityName(row.key, displayLocale) : row.key}</span>
                        {row.cells.map((c, i) => (
                          <span key={i} className="flex flex-wrap items-center gap-1 text-sm tabular-nums">
                            {c ? (
                              <>
                                <span className="font-bold text-lime-300">+{c.delta}</span>
                                {c.confirmed ? null : <Badge tone="outline">{tc("unconfirmedBadge")}</Badge>}
                              </>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Surface>

              <Surface className="mt-4">
                <SectionHeader title={tc("factsTitle")} as="h2" />
                <div className="flex flex-col divide-y divide-border">
                  {(
                    [
                      [tc("formationLabel"), cmp.formation],
                      [tc("releasedLabel"), cmp.releasedAt],
                      [tc("linkUpLabel"), cmp.linkUpPlays.map(String)],
                    ] as const
                  ).map(([label, values]) => (
                    <div key={label} className="grid items-center gap-2 py-1.5" style={cols}>
                      <span className="text-sm">{label}</span>
                      {values.map((v, i) => (
                        <span key={i} className="text-sm tabular-nums">
                          {v ?? "—"}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </Surface>
            </div>
          </div>
        </>
      )}

      <ManagerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentManagerId={null}
        title={tc("pickerTitle")}
        onSelect={(_ctx, detail) => {
          setPickerOpen(false);
          if (!detail || ids.includes(detail.internalManagerId) || full) return;
          setCache((c) => ({ ...c, [detail.internalManagerId]: detail }));
          setIds([...ids, detail.internalManagerId]);
        }}
      />
    </div>
  );
}
