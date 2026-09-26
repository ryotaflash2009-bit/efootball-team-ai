"use client";

import Link from "next/link";
import { useState } from "react";
import type { SquadDiagnosisResult } from "@/lib/squad/squad-diagnosis";
import { buildSharePayload } from "@/lib/squad/squad-diagnosis-share-url";
import { addDiagnosisHistory } from "@/lib/squad/diagnosis-history";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LocaleContext";

type Status = { kind: "idle" } | { kind: "saved"; trimmed: number } | { kind: "duplicate" } | { kind: "failed" } | { kind: "pending" };

/** 診断結果をこのブラウザー内の履歴へ保存する（F-060）。保存は利用者の操作でだけ行う。 */
export function SquadDiagnosisHistorySaveButton({
  result,
  squadName,
  formationLabel,
}: {
  result: SquadDiagnosisResult;
  squadName: string;
  formationLabel: string;
}) {
  const t = useT();
  const h = (k: Parameters<typeof t<"diagnosisHistory">>[1]) => t("diagnosisHistory", k);
  useSyncedStorageScope();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function save() {
    try {
      const payload = buildSharePayload(result, { date: new Date(), formationLabel });
      const r = addDiagnosisHistory({ payload, squadId: result.squadId, squadLabel: squadName });
      if (r.ok) setStatus(r.duplicate ? { kind: "duplicate" } : { kind: "saved", trimmed: r.trimmed });
      else setStatus(r.reason === "scope_pending" ? { kind: "pending" } : { kind: "failed" });
    } catch {
      setStatus({ kind: "failed" });
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" onClick={save}>
        {h("saveButton")}
      </Button>
      <Link href="/diagnosis-history" className="inline-flex min-h-[44px] items-center text-xs text-accent underline-offset-2 hover:underline">
        {h("openHistory")}
      </Link>
      {status.kind === "saved" ? (
        <span role="status" aria-live="polite" className="text-2xs text-success" data-history-status="saved">
          {status.trimmed > 0 ? h("savedTrimmed").replace("{count}", String(status.trimmed)) : h("saved")}
        </span>
      ) : null}
      {status.kind === "duplicate" ? (
        <span role="status" aria-live="polite" className="text-2xs text-text-dim" data-history-status="duplicate">
          {h("duplicate")}
        </span>
      ) : null}
      {status.kind === "pending" ? (
        <span role="alert" className="text-2xs text-warning" data-history-status="pending">
          {h("scopePending")}
        </span>
      ) : null}
      {status.kind === "failed" ? (
        <span role="alert" className="text-2xs text-danger" data-history-status="failed">
          {h("saveFailed")}
        </span>
      ) : null}
    </div>
  );
}
