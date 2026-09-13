"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/user-cards/ConfirmDialog";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { useStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { detectAllLegacyData, type LegacyDataSummary } from "@/lib/local-storage-scope/legacy-detect";
import { previewMigration, type MigrationPreview } from "@/lib/local-storage-scope/migration-preview";
import { executeMigrationForKind, type MigrationExecutionResult } from "@/lib/local-storage-scope/migration-execute";
import { getLegacyStorageKey, buildScopedStorageKey } from "@/lib/local-storage-scope/keys";
import { readRawJson } from "@/lib/local-storage-scope/storage-access";
import { saveTextFile } from "@/lib/browser-save-file";
import { DATA_KINDS, type DataKind, type StorageScope } from "@/lib/local-storage-scope/types";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type LdmKey = keyof Dictionary["localDataMigration"];
type AuthKey = keyof Dictionary["auth"];

/** Stage 2で実際に移行できるのはMy Teamだけ(他4種は準備中の状態表示のみ)。 */
const MIGRATABLE_KINDS: readonly DataKind[] = ["myTeam"];

/**
 * ローカルデータ移行センター(`/account/local-data-migration`)。
 *
 * - レガシー(アカウント分離前)の共通データを、現在ログイン中のアカウント専用領域へ
 *   コピーする、明示操作のみの機能。自動移行・自動削除・自動クラウド送信は一切行わない。
 * - 今回実際に移行できるのはMy Teamだけ。他の4種類は件数・状態表示のみで、
 *   操作可能に見えるボタンは出さない。
 * - user_id・内部UUID・アカウントスコープハッシュ・メールアドレス・Token・Cookie・
 *   内部localStorageキー全文は画面に一切表示しない。「現在ログイン中のアカウント」とだけ表示する。
 */
export function LocalDataMigrationView() {
  const t = useT();
  const ta = useCallback((key: LdmKey) => t("localDataMigration", key), [t]);
  const taAuth = useCallback((key: AuthKey) => t("auth", key), [t]);
  const fill = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s),
    [],
  );

  const session = useSupabaseSession();
  const scopeState = useStorageScope();
  const accountScope: StorageScope | null = scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope : null;

  const [legacy, setLegacy] = useState<Record<DataKind, LegacyDataSummary> | null>(null);
  const refreshLegacy = useCallback(() => setLegacy(detectAllLegacyData()), []);
  useEffect(() => {
    refreshLegacy();
  }, [refreshLegacy]);

  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migrateAck, setMigrateAck] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<MigrationExecutionResult | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handlePreview = useCallback(() => {
    if (!accountScope) return;
    const legacyRaw = readRawJson(getLegacyStorageKey("myTeam"));
    const targetRaw = readRawJson(buildScopedStorageKey(accountScope, "myTeam"));
    setPreview(previewMigration("myTeam", legacyRaw, targetRaw));
    setResult(null);
  }, [accountScope]);

  function openMigrateConfirm() {
    setMigrateAck(false);
    setShowMigrateConfirm(true);
  }

  async function handleMigrateConfirmed() {
    if (migrating || !migrateAck || !accountScope) return;
    setMigrating(true);
    try {
      const legacyKey = getLegacyStorageKey("myTeam");
      const targetKey = buildScopedStorageKey(accountScope, "myTeam");
      const execResult = await executeMigrationForKind("myTeam", legacyKey, targetKey);
      setResult(execResult);
      setShowMigrateConfirm(false);
      setMigrateAck(false);
      refreshLegacy();
      // 実行後、最新の状態でプレビューを更新する(結果表示と矛盾しないように)。
      const legacyRaw = readRawJson(legacyKey);
      const targetRaw = readRawJson(targetKey);
      setPreview(previewMigration("myTeam", legacyRaw, targetRaw));
    } finally {
      setMigrating(false);
    }
  }

  async function handleDownloadLegacyBackup() {
    const legacyRaw = readRawJson(getLegacyStorageKey("myTeam"));
    const payload = { exportedAt: new Date().toISOString(), dataKind: "myTeam", data: legacyRaw };
    const outcome = await saveTextFile("my-team-legacy-backup.json", JSON.stringify(payload, null, 2));
    setDownloadNotice(outcome.ok ? ta("backupDownloadSuccessMessage") : ta("backupDownloadFailureMessage"));
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("pageTitle")} icon="database" />

      <Surface tone="outline" padding="md" className="flex flex-col gap-1.5">
        <p className="text-sm text-text-dim">{ta("introBody")}</p>
        <p className="text-xs text-text-muted">{ta("noAutoMigrationNotice")}</p>
      </Surface>

      <Surface padding="md" className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-text">{ta("legacySummaryHeading")}</p>
        {legacy ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {DATA_KINDS.map((kind) => (
              <div key={kind}>
                <dt className="text-2xs text-text-muted">{ta(`kindLabel_${kind}` as LdmKey)}</dt>
                <dd className="font-bold tabular-nums">{legacy[kind].itemCount}</dd>
                {!MIGRATABLE_KINDS.includes(kind) ? <p className="text-2xs text-text-muted">{ta("notYetMigratableNotice")}</p> : null}
              </div>
            ))}
          </dl>
        ) : null}
        <p className="text-2xs text-text-muted">{ta("notYetCloudSyncedForOthersNotice")}</p>
      </Surface>

      {session.status === "loading" || (session.status === "authenticated" && !accountScope) ? (
        <Surface padding="md">
          <p className="text-sm text-text-dim">{ta("loadingMessage")}</p>
        </Surface>
      ) : session.status !== "authenticated" ? (
        <Surface padding="md" className="flex flex-col gap-3">
          <p className="text-sm text-text-dim">{ta("loginRequiredMessage")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/auth/sign-in">
              <Button variant="primary" size="sm">
                {taAuth("navSignIn")}
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button variant="secondary" size="sm">
                {taAuth("navSignUp")}
              </Button>
            </Link>
          </div>
        </Surface>
      ) : (
        <>
          <Surface padding="md" className="flex flex-col gap-2">
            <p className="text-sm text-text-dim">{ta("currentAccountLabel")}</p>
            <p className="text-xs text-text-muted">{ta("myTeamMigrationIntro")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={handlePreview}>
                {ta("previewButton")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadLegacyBackup}>
                {ta("downloadBackupButton")}
              </Button>
            </div>
            {downloadNotice ? (
              <p aria-live="polite" className="text-2xs text-text-muted">
                {downloadNotice}
              </p>
            ) : null}
          </Surface>

          {preview ? (
            <Surface padding="md" className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-text">{ta("previewHeading")}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewLegacyCountLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.legacyCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewTargetCountLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.targetCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewAddCountLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.addCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewDuplicateCountLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.duplicateCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewConflictCountLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.conflictCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewInvalidCountLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.invalidCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewResultCountLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.resultCountIfApplied}</dd>
                </div>
              </dl>
              <p className="text-xs text-text-muted">{ta("legacyPreservedNotice")}</p>
              <p className="text-xs text-text-muted">{ta("noCloudSendNotice")}</p>
              <p className="text-xs text-text-muted">{ta("cloudUnchangedNotice")}</p>
              {preview.conflictCount > 0 ? <p className="text-xs text-warning">{ta("conflictNotMigratedNotice")}</p> : null}
              {preview.addCount > 0 ? (
                <div>
                  <Button size="sm" onClick={openMigrateConfirm}>
                    {ta("migrateButton")}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{ta("nothingToMigrateMessage")}</p>
              )}
            </Surface>
          ) : null}

          {result ? (
            <Surface padding="md" className="flex flex-col gap-2">
              {result.ok ? (
                <p aria-live="polite" className="text-sm text-success">
                  {fill(ta("migrationSuccessMessageTemplate"), { count: String(result.addedCount) })}
                </p>
              ) : (
                <p role="alert" className="text-sm text-danger">
                  {result.rolledBack ? ta("migrationFailedRolledBackMessage") : ta("migrationFailedMessage")}
                </p>
              )}
              <p className="text-2xs text-text-muted">{ta("legacyPreservedNotice")}</p>
            </Surface>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={showMigrateConfirm}
        title={ta("migrateConfirmTitle")}
        confirmLabel={ta("migrateConfirmExecuteButton")}
        cancelLabel={ta("cancelButton")}
        confirmDisabled={!migrateAck}
        onCancel={() => setShowMigrateConfirm(false)}
        onConfirm={handleMigrateConfirmed}
        body={
          <div className="flex flex-col gap-1.5">
            <p>{ta("migrateConfirmIntro")}</p>
            <p className="font-semibold">{fill(ta("migrateConfirmCountTemplate"), { count: String(preview?.addCount ?? 0) })}</p>
            <p className="text-2xs text-text-muted">{fill(ta("migrateConfirmDuplicateTemplate"), { count: String(preview?.duplicateCount ?? 0) })}</p>
            <p className="text-2xs text-text-muted">{fill(ta("migrateConfirmConflictTemplate"), { count: String(preview?.conflictCount ?? 0) })}</p>
            <p>{ta("migrateConfirmLegacyKeptNotice")}</p>
            <p>{ta("migrateConfirmNoCloudNotice")}</p>
            <p>{ta("migrateConfirmNoOverwriteNotice")}</p>
            <p>{ta("migrateConfirmConflictSkippedNotice")}</p>
            <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-2.5 text-2xs">
              <input
                type="checkbox"
                name="local-data-migration-ack"
                checked={migrateAck}
                onChange={(e) => setMigrateAck(e.target.checked)}
                className="mt-0.5"
              />
              <span>{ta("migrateConfirmCheckboxLabel")}</span>
            </label>
          </div>
        }
      />
    </div>
  );
}
