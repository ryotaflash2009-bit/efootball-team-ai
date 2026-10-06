"use client";

import "@/lib/i18n/dictionaries/ja-ns/localBackup";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { getSafeLocalStorage } from "@/lib/local-storage-scope/storage-access";
import { downloadTextFile } from "@/lib/browser-download";
import { readUploadedTextFile } from "@/lib/browser-upload";
import {
  BACKUP_SECTIONS,
  LOCAL_BACKUP_MAX_BYTES,
  deleteCurrentScopeData,
  exportLocalBackup,
  importLocalBackup,
  parseLocalBackup,
  summarizeCurrentScope,
  type BackupSection,
  type LocalBackupFile,
  type SectionCounts,
} from "@/lib/data-management/local-backup";

type LbKey = keyof Dictionary["localBackup"];
const SECTION_LABEL: Record<BackupSection, LbKey> = {
  myTeam: "sectionMyTeam",
  favorites: "sectionFavorites",
  myBuilds: "sectionBuilds",
  squads: "sectionSquads",
  squadTemplates: "sectionTemplates",
  diagnosisHistory: "sectionHistory",
};
const NOTICE_KEY = "efb:local-backup-notice";

function CountList({ counts, label }: { counts: SectionCounts; label: (k: LbKey) => string }) {
  const rows = BACKUP_SECTIONS.filter((s) => counts[s] != null);
  return (
    <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-text-dim sm:grid-cols-2" data-testid="local-backup-counts">
      {rows.map((s) => (
        <li key={s} className="flex justify-between gap-2">
          <span>{label(SECTION_LABEL[s])}</span>
          <span className="tabular-nums">{counts[s]}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * F-023b: 現在の領域（ゲスト / ログイン中のアカウント）のデータの書き出し・読み込み・削除。
 * 読み込みと削除は確認のあとに行い、成功したら画面を読み直す（各画面が新しいデータを読むように）。
 */
export function LocalBackupPanel() {
  const t = useT();
  const lb = (k: LbKey) => t("localBackup", k);
  const scopeState = useSyncedStorageScope();
  const scope = scopeState.status === "resolved" ? scopeState.scope : null;
  const [counts, setCounts] = useState<SectionCounts>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // 読み込む領域は、ファイルを選んだ時点の領域に固定する（確認までの間にログイン状態が変わったら取り消す）。
  const [pending, setPending] = useState<{ file: LocalBackupFile; counts: SectionCounts; scopeKey: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    const ls = getSafeLocalStorage();
    setCounts(ls && scope ? summarizeCurrentScope(ls, scope) : {});
  }, [scope]);

  useEffect(() => {
    refresh();
    try {
      const n = window.sessionStorage.getItem(NOTICE_KEY);
      if (n === "imported" || n === "deleted") {
        setMessage({ tone: "ok", text: lb(n === "imported" ? "importDone" : "deleteDone") });
        window.sessionStorage.removeItem(NOTICE_KEY);
      }
    } catch {
      /* sessionStorage が使えない環境では通知を省く */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const finish = (kind: "imported" | "deleted") => {
    try {
      window.sessionStorage.setItem(NOTICE_KEY, kind);
    } catch {
      /* 通知だけを省く */
    }
    window.location.reload();
  };

  const scopeKey = scope ? (scope.kind === "guest" ? "guest" : `account:${scope.scopeId}`) : null;
  useEffect(() => {
    if (pending && pending.scopeKey !== scopeKey) {
      setPending(null);
      setMessage({ tone: "error", text: lb("importScopeChanged") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const ls = getSafeLocalStorage();
  const regionName = scope?.kind === "account" ? lb("regionAccount") : lb("regionGuest");
  const hasData = Object.keys(counts).length > 0;

  function handleExport() {
    if (!ls || !scope) return;
    const { file, skipped } = exportLocalBackup(ls, scope, new Date());
    const r = downloadTextFile(`efootball-team-ai-backup-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify(file, null, 2)}\n`);
    setMessage(r.ok ? { tone: "ok", text: skipped.length > 0 ? lb("exportDoneWithSkipped") : lb("exportDone") } : { tone: "error", text: lb("exportFailed") });
  }

  async function handleFile(file: File | null | undefined) {
    setMessage(null);
    setPending(null);
    const read = await readUploadedTextFile(file, LOCAL_BACKUP_MAX_BYTES);
    if (fileRef.current) fileRef.current.value = "";
    if (!read.ok) {
      setMessage({ tone: "error", text: read.reason === "too-large" ? lb("importTooLarge") : lb("importReadFailed") });
      return;
    }
    const parsed = parseLocalBackup(read.text);
    if (!parsed.ok) {
      setMessage({ tone: "error", text: parsed.reason === "invalid_section" && parsed.section ? lb("importInvalidSectionTemplate").replace("{section}", lb(SECTION_LABEL[parsed.section])) : parsed.reason === "too_large" ? lb("importTooLarge") : lb("importNotBackup") });
      return;
    }
    if (!scopeKey) return;
    setPending({ file: parsed.file, counts: parsed.counts, scopeKey });
  }

  function handleImport() {
    if (!ls || !scope || !pending || busy || pending.scopeKey !== scopeKey) return;
    setBusy(true);
    const r = importLocalBackup(ls, scope, pending.file);
    setBusy(false);
    if (r.ok) finish("imported");
    else setMessage({ tone: "error", text: r.rolledBack ? lb("importFailedRolledBack") : lb("importFailedPartial") });
  }

  function handleDelete() {
    if (!ls || !scope || busy) return;
    setBusy(true);
    const r = deleteCurrentScopeData(ls, scope);
    setBusy(false);
    setConfirmDelete(false);
    if (r.ok) finish("deleted");
    else setMessage({ tone: "error", text: lb("deleteFailed") });
  }

  return (
    <Surface padding="md" data-testid="local-backup">
      <h2 className="text-sm font-semibold text-text">{lb("heading")}</h2>
      <p className="mt-1.5 text-sm text-text-dim">{lb("intro").replace("{region}", regionName)}</p>
      {!scope ? (
        <p className="mt-2 text-xs text-text-muted" role="status">
          {lb("scopePending")}
        </p>
      ) : !ls ? (
        <p className="mt-2 text-xs text-warning" role="status">
          {lb("storageUnavailable")}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs font-semibold text-text">{lb("currentDataHeading")}</p>
          {hasData ? <CountList counts={counts} label={lb} /> : <p className="mt-1 text-xs text-text-muted">{lb("noData")}</p>}
          <ul className="mt-2 list-disc space-y-1 ps-5 text-2xs text-text-dim">
            <li>{lb("noteNoIdentity")}</li>
            <li>{lb("noteSharing")}</li>
            <li>{lb("noteExcluded")}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" className="min-h-[44px]" onClick={handleExport} disabled={!hasData} data-testid="local-backup-export">
              {lb("exportButton")}
            </Button>
            <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:border-accent">
              {lb("importButton")}
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} data-testid="local-backup-import" />
            </label>
            <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setConfirmDelete(true)} disabled={!hasData} data-testid="local-backup-delete">
              {lb("deleteButton")}
            </Button>
          </div>

          {pending ? (
            <div role="alertdialog" aria-label={lb("importConfirmTitle")} className="mt-3 rounded-md border border-warning/50 bg-warning/5 p-3 text-sm" data-testid="local-backup-import-confirm">
              <p className="font-semibold">{lb("importConfirmTitle")}</p>
              <p className="mt-1 text-xs text-text-dim">{lb("importConfirmBody").replace("{region}", regionName)}</p>
              <CountList counts={pending.counts} label={lb} />
              <p className="mt-1 text-2xs text-text-muted">{lb("importExportFirst")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" className="min-h-[44px]" onClick={handleImport} disabled={busy}>
                  {lb("importConfirmButton")}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setPending(null)}>
                  {lb("cancel")}
                </Button>
              </div>
            </div>
          ) : null}

          {confirmDelete ? (
            <div role="alertdialog" aria-label={lb("deleteConfirmTitle")} className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm" data-testid="local-backup-delete-confirm">
              <p className="font-semibold">{lb("deleteConfirmTitle")}</p>
              <p className="mt-1 text-xs text-text-dim">{lb("deleteConfirmBody").replace("{region}", regionName)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" className="min-h-[44px]" onClick={handleDelete} disabled={busy}>
                  {lb("deleteConfirmButton")}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setConfirmDelete(false)}>
                  {lb("cancel")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-2 text-xs ${message.tone === "error" ? "text-danger" : "text-success"}`} data-testid="local-backup-message">
          {message.text}
        </p>
      ) : null}
    </Surface>
  );
}
