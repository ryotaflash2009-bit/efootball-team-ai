"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { tierBadgeTone } from "./diagnosis-tier-style";
import { diagnosisCategoryLabel } from "./SharedDiagnosisView";
import { DiagnosisHistoryComparePanel } from "./DiagnosisHistoryComparePanel";
import {
  clearDiagnosisHistory,
  exportDiagnosisHistoryJson,
  readDiagnosisHistory,
  removeDiagnosisHistoryEntry,
  type HistoryRead,
} from "@/lib/squad/diagnosis-history";
import { SHARE_CATEGORY_IDS, SHARE_PATH, encodeSharePayload } from "@/lib/squad/squad-diagnosis-share-url";
import { subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { formatDateTime } from "@/lib/i18n/format";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";

type Notice = { tone: "success" | "danger"; text: string } | null;

/**
 * 診断履歴の一覧（F-060）。ブラウザー内の保存データだけを読み書きする（サーバー通信なし）。
 * 1件削除・全削除は確認を挟み、結果（失敗を含む）を画面に表示する。
 */
export function DiagnosisHistoryView() {
  const t = useT();
  const { locale } = useLocale();
  const h = (k: Parameters<typeof t<"diagnosisHistory">>[1]) => t("diagnosisHistory", k);
  const scopeState = useSyncedStorageScope();
  const [data, setData] = useState<HistoryRead | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // 比較に選んだ履歴（最大2件。3件目を選ぶと古い選択を外す）。
  const [selected, setSelected] = useState<string[]>([]);

  const reload = useCallback(() => {
    const next = readDiagnosisHistory();
    setData(next);
    setSelected((cur) => cur.filter((id) => next.entries.some((e) => e.id === id)));
  }, []);
  useEffect(() => {
    reload();
    return subscribeCurrentScope(reload);
  }, [reload, scopeState.status]);

  if (!data || data.status === "scope_pending") {
    return (
      <p role="status" className="mt-6 text-sm text-text-dim">
        {h("loading")}
      </p>
    );
  }

  function removeOne(id: string) {
    const r = removeDiagnosisHistoryEntry(id);
    setConfirmId(null);
    setNotice(r.ok ? { tone: "success", text: h("deleted") } : { tone: "danger", text: h("deleteFailed") });
    reload();
  }
  function removeAll() {
    const r = clearDiagnosisHistory();
    setConfirmAll(false);
    setNotice(r.ok ? { tone: "success", text: h("deleteAllDone") } : { tone: "danger", text: h("deleteFailed") });
    reload();
  }
  function exportJson() {
    try {
      const blob = new Blob([exportDiagnosisHistoryJson(data!.entries, new Date())], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `efootball-team-ai-diagnosis-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice({ tone: "danger", text: h("exportFailed") });
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4" data-history-state={data.status}>
      <PageHeader title={h("pageTitle")} icon="list" description={h("pageDescription")} />
      <p className="text-2xs text-text-muted">{h("limitNote")}</p>
      {notice ? (
        <p role={notice.tone === "danger" ? "alert" : "status"} aria-live="polite" className={`text-xs ${notice.tone === "danger" ? "text-danger" : "text-success"}`}>
          {notice.text}
        </p>
      ) : null}
      {data.status === "unavailable" ? <p className="text-sm text-text-dim">{h("unavailable")}</p> : null}
      {data.corrupted > 0 ? <p role="note" className="text-xs text-warning">{h("corruptedNotice").replace("{count}", String(data.corrupted))}</p> : null}
      {data.status === "ok" && data.entries.length === 0 ? <p className="text-sm text-text-dim" data-history-empty>{h("empty")}</p> : null}

      {data.entries.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" onClick={exportJson}>
              {h("exportButton")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setConfirmAll(true)}>
              {h("deleteAll")}
            </Button>
          </div>
          <p className="text-2xs text-text-muted">{h("exportNote")}</p>
          {confirmAll ? (
            <div role="alertdialog" aria-label={h("deleteAll")} className="rounded-md border border-danger/40 bg-danger/5 p-3 text-sm">
              <p>{h("deleteAllConfirm")}</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" className="min-h-[44px]" onClick={removeAll}>
                  {h("confirmDelete")}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setConfirmAll(false)}>
                  {h("cancel")}
                </Button>
              </div>
            </div>
          ) : null}
          <DiagnosisHistoryComparePanel entries={data.entries} selectedIds={selected} onClear={() => setSelected([])} />
          <ul className="flex flex-col gap-3" data-history-list>
            {data.entries.map((e) => (
              <li key={e.id} className="rounded-card border border-border bg-surface p-3" data-history-entry>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label className="flex min-h-[44px] min-w-0 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={selected.includes(e.id)}
                      onChange={(ev) => setSelected((cur) => (ev.target.checked ? [...cur.filter((x) => x !== e.id), e.id].slice(-2) : cur.filter((x) => x !== e.id)))}
                      aria-label={`${t("diagnosisCompare", "selectLabel")}: ${e.squadLabel || "—"} ${formatDateTime(new Date(e.savedAt), locale)}`}
                      data-history-select
                    />
                    <span className="min-w-0 truncate text-sm font-semibold">{e.squadLabel || "—"}</span>
                  </label>
                  <span className="text-2xs text-text-muted">
                    {h("savedAt")}: {formatDateTime(new Date(e.savedAt), locale)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-text-dim">{h("overall")}</span>
                  {e.payload.o[0] == null ? (
                    <span className="text-text-muted">{h("notRated")}</span>
                  ) : (
                    <>
                      <span className="text-lg font-black tabular-nums">{e.payload.o[0]}</span>
                      <Badge tone={tierBadgeTone(e.payload.o[1])} size="xs">
                        {e.payload.o[1]}
                      </Badge>
                    </>
                  )}
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-2xs sm:grid-cols-4">
                  {SHARE_CATEGORY_IDS.map((id) => (
                    <li key={id} className="flex justify-between gap-1">
                      <span className="truncate text-text-dim">{diagnosisCategoryLabel(id, locale)}</span>
                      <span className="tabular-nums">{e.payload.c[id][0] ?? "—"}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link href={`${SHARE_PATH}#${encodeSharePayload(e.payload)}`} className="inline-flex min-h-[44px] items-center text-xs text-accent underline-offset-2 hover:underline">
                    {h("openShare")}
                  </Link>
                  {confirmId === e.id ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span>{h("deleteConfirm")}</span>
                      <Button type="button" size="sm" className="min-h-[44px]" onClick={() => removeOne(e.id)}>
                        {h("confirmDelete")}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setConfirmId(null)}>
                        {h("cancel")}
                      </Button>
                    </span>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setConfirmId(e.id)}>
                      {h("deleteButton")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
