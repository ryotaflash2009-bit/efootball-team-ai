"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import {
  MANAGED_LOCAL_DATA_KEYS,
  isLocalDataStorageAvailable,
  getManagedKeysWithData,
  deleteAllManagedLocalData,
} from "@/lib/data-management/local-data";

type DataManagementKey = keyof Dictionary["dataManagement"];

export function DataManagementView() {
  const t = useT();
  const tdm = (key: DataManagementKey) => t("dataManagement", key);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={tdm("heading")} icon="database" description={tdm("intro")} />

      <Surface tone="inset" padding="sm" className="text-xs text-text-muted">
        {tdm("draftNotice")}
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tdm("storedDataHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{tdm("storedDataBody")}</p>
      </Surface>

      <Surface tone="inset" padding="md">
        <p className="text-sm font-semibold text-warning">{tdm("browserRiskHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{tdm("browserRiskBody")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-dim">
          <li>{tdm("browserRiskSameDeviceDifferentBrowser")}</li>
          <li>{tdm("browserRiskPrivateMode")}</li>
          <li>{tdm("browserRiskBrowserSettings")}</li>
        </ul>
        <p className="mt-2 text-sm text-text-dim">{tdm("noSyncNoCloudBody")}</p>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tdm("jsonBackupHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{tdm("jsonBackupBody")}</p>
        <p className="mt-1.5 text-sm text-text-dim">
          {tdm("jsonBackupWhereBody")}{" "}
          <Link href="/my-builds" className="text-accent hover:underline">
            My Builds
          </Link>
          {" / "}
          <Link href="/build-inventory" className="text-accent hover:underline">
            {t("nav", "buildInventory")}
          </Link>
        </p>
        <p className="mt-1.5 text-sm font-semibold text-accent">{tdm("jsonBackupTimingRecommendation")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-dim">
          <li>{tdm("jsonBackupContentWarning")}</li>
          <li>{tdm("jsonBackupSharingWarning")}</li>
          <li>{tdm("jsonBackupImportWarning")}</li>
        </ul>
      </Surface>

      <Surface padding="md">
        <p className="text-sm font-semibold text-text">{tdm("howToDeleteHeading")}</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-text-dim">
          <li>{tdm("howToDeleteBuild")}</li>
          <li>{tdm("howToDeleteMyTeam")}</li>
          <li>{tdm("howToDeleteSquad")}</li>
          <li>{tdm("howToDeleteIntentOnly")}</li>
        </ul>
      </Surface>

      <DeleteAllDataPanel tdm={tdm} />
    </div>
  );
}

function DeleteAllDataPanel({ tdm }: { tdm: (key: DataManagementKey) => string }) {
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [targetKeys, setTargetKeys] = useState<{ key: string; labelKey: (typeof MANAGED_LOCAL_DATA_KEYS)[number]["labelKey"] }[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ tone: "success" | "failure" | "partial"; text: string } | null>(null);

  const refreshTargets = useCallback(() => {
    setStorageAvailable(isLocalDataStorageAvailable());
    setTargetKeys(getManagedKeysWithData());
  }, []);

  useEffect(() => {
    refreshTargets();
  }, [refreshTargets]);

  const handleStart = () => {
    setResultMessage(null);
    refreshTargets();
    setConfirming(true);
  };

  const handleCancel = () => {
    setConfirming(false);
  };

  const handleConfirmDelete = () => {
    if (deleting) return; // 連打防止
    setDeleting(true);
    const result = deleteAllManagedLocalData();
    setDeleting(false);
    setConfirming(false);
    refreshTargets();
    if (!result.ok && result.attemptedKeys.length === 0) {
      setResultMessage({ tone: "failure", text: tdm("deleteAllStorageUnavailable") });
    } else if (!result.ok) {
      setResultMessage({ tone: "partial", text: tdm("deleteAllPartialFailureMessage") });
    } else {
      setResultMessage({ tone: "success", text: tdm("deleteAllSuccessMessage") });
    }
  };

  if (!storageAvailable) {
    return (
      <Surface tone="outline" padding="md">
        <p className="text-sm font-semibold text-text">{tdm("deleteAllHeading")}</p>
        <p className="mt-1.5 text-sm text-text-dim">{tdm("deleteAllStorageUnavailable")}</p>
      </Surface>
    );
  }

  return (
    <Surface tone="outline" padding="md">
      <div className="flex items-start gap-2">
        <Icon name="trash" size={18} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">{tdm("deleteAllHeading")}</p>
          <p className="mt-1.5 text-sm text-text-dim">{tdm("deleteAllIntro")}</p>

          <p className="mt-3 text-xs font-semibold text-text-dim">{tdm("deleteAllTargetHeading")}</p>
          {targetKeys.length === 0 ? (
            <p className="mt-1 text-sm text-text-muted">{tdm("deleteAllNothingToDelete")}</p>
          ) : (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text-dim">
              {targetKeys.map((entry) => (
                <li key={entry.key}>{tdm(entry.labelKey)}</li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-2xs text-text-muted">{tdm("deleteAllExcludedNote")}</p>
          <p className="mt-1 text-2xs text-text-muted">{tdm("deleteAllScopeNote")}</p>

          {resultMessage ? (
            <p
              role={resultMessage.tone === "success" ? undefined : "alert"}
              aria-live={resultMessage.tone === "success" ? "polite" : undefined}
              className={`mt-2 rounded border px-2 py-1.5 text-sm ${
                resultMessage.tone === "success"
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-danger/40 bg-danger/10 text-danger"
              }`}
            >
              {resultMessage.text}
            </p>
          ) : null}

          {!confirming ? (
            <Button
              variant="danger"
              size="sm"
              iconLeft="trash"
              onClick={handleStart}
              disabled={targetKeys.length === 0}
              className="mt-3"
            >
              {tdm("deleteAllStartButton")}
            </Button>
          ) : (
            <div className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm font-semibold text-danger">{tdm("deleteAllConfirmTitle")}</p>
              <p className="mt-1 text-sm text-text-dim">{tdm("deleteAllConfirmBody")}</p>
              <p className="mt-1.5 text-xs font-semibold text-accent">{tdm("deleteAllBackupReminder")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
                  {deleting ? tdm("deleteAllInProgress") : tdm("deleteAllConfirmButton")}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCancel} disabled={deleting}>
                  {tdm("deleteAllCancelButton")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}
