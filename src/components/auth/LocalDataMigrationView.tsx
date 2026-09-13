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
import { checkMyTeamBuildReferences, type BuildReferenceCheckResult } from "@/lib/local-storage-scope/build-reference-check";
import { saveTextFile } from "@/lib/browser-save-file";
import { DATA_KINDS, type DataKind, type StorageScope } from "@/lib/local-storage-scope/types";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type LdmKey = keyof Dictionary["localDataMigration"];
type AuthKey = keyof Dictionary["auth"];

/** Stage 3で実際に移行できるのはMy Team・My Builds・お気に入りの3種類(残り2種は準備中の状態表示のみ)。 */
const MIGRATABLE_KINDS: readonly DataKind[] = ["myTeam", "myBuilds", "favorites"];

const BACKUP_FILE_NAME: Record<DataKind, string> = {
  myTeam: "my-team-legacy-backup.json",
  myBuilds: "my-builds-legacy-backup.json",
  favorites: "favorites-legacy-backup.json",
  squads: "squads-legacy-backup.json",
  squadTemplates: "squad-templates-legacy-backup.json",
};

/**
 * ローカルデータ移行センター(`/account/local-data-migration`)。
 *
 * - レガシー(アカウント分離前)の共通データを、現在ログイン中のアカウント専用領域へ
 *   コピーする、明示操作のみの機能。自動移行・自動削除・自動クラウド送信は一切行わない。
 * - Stage 3で実際に移行できるのはMy Team・My Builds・お気に入りの3種類。データ種別ごとに
 *   個別にチェックボックスで選択でき、初期状態ではどれも選択されていない。保存スカッド・
 *   スカッドテンプレートは件数・状態表示のみで、操作可能に見えるボタンは出さない。
 * - 複数種別を同時に選択・プレビューできるが、実際の移行(プレビュー確認→明示チェック→実行→
 *   結果表示)はデータ種別ごとに完全に独立して行う(1つの確認ダイアログは常に単一の種別だけを
 *   対象にする)。一方が失敗しても他方の結果表示には影響しない。
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
  const kindLabel = useCallback((kind: DataKind) => ta(`kindLabel_${kind}` as LdmKey), [ta]);

  const session = useSupabaseSession();
  const scopeState = useStorageScope();
  const accountScope: StorageScope | null = scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope : null;

  const [legacy, setLegacy] = useState<Record<DataKind, LegacyDataSummary> | null>(null);
  const refreshLegacy = useCallback(() => setLegacy(detectAllLegacyData()), []);
  useEffect(() => {
    refreshLegacy();
  }, [refreshLegacy]);

  const [selected, setSelected] = useState<Partial<Record<DataKind, boolean>>>({});
  const [previews, setPreviews] = useState<Partial<Record<DataKind, MigrationPreview>>>({});
  const [results, setResults] = useState<Partial<Record<DataKind, MigrationExecutionResult>>>({});
  const [refIssues, setRefIssues] = useState<BuildReferenceCheckResult | null>(null);
  const [confirmKind, setConfirmKind] = useState<DataKind | null>(null);
  const [migrateAck, setMigrateAck] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<Partial<Record<DataKind, string>>>({});

  function toggleSelected(kind: DataKind) {
    setSelected((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  const refreshReferenceIntegrity = useCallback(() => {
    if (!accountScope) {
      setRefIssues(null);
      return;
    }
    const myTeamRaw = readRawJson(buildScopedStorageKey(accountScope, "myTeam"));
    const myBuildsRaw = readRawJson(buildScopedStorageKey(accountScope, "myBuilds"));
    setRefIssues(checkMyTeamBuildReferences(myTeamRaw, myBuildsRaw));
  }, [accountScope]);

  useEffect(() => {
    refreshReferenceIntegrity();
  }, [refreshReferenceIntegrity]);

  const handlePreview = useCallback(() => {
    if (!accountScope) return;
    const next: Partial<Record<DataKind, MigrationPreview>> = {};
    for (const kind of MIGRATABLE_KINDS) {
      if (!selected[kind]) continue;
      const legacyRaw = readRawJson(getLegacyStorageKey(kind));
      const targetRaw = readRawJson(buildScopedStorageKey(accountScope, kind));
      next[kind] = previewMigration(kind, legacyRaw, targetRaw);
    }
    setPreviews(next);
    setResults({});
    refreshReferenceIntegrity();
  }, [accountScope, selected, refreshReferenceIntegrity]);

  function openMigrateConfirm(kind: DataKind) {
    setConfirmKind(kind);
    setMigrateAck(false);
  }

  async function handleMigrateConfirmed() {
    const kind = confirmKind;
    if (migrating || !migrateAck || !accountScope || !kind) return;
    setMigrating(true);
    try {
      const legacyKey = getLegacyStorageKey(kind);
      const targetKey = buildScopedStorageKey(accountScope, kind);
      const execResult = await executeMigrationForKind(kind, legacyKey, targetKey);
      setResults((prev) => ({ ...prev, [kind]: execResult }));
      setConfirmKind(null);
      setMigrateAck(false);
      refreshLegacy();
      // 実行後、最新の状態でプレビューを更新する(結果表示と矛盾しないように)。
      const legacyRaw = readRawJson(legacyKey);
      const targetRaw = readRawJson(targetKey);
      setPreviews((prev) => ({ ...prev, [kind]: previewMigration(kind, legacyRaw, targetRaw) }));
      refreshReferenceIntegrity();
    } finally {
      setMigrating(false);
    }
  }

  async function handleDownloadBackup(kind: DataKind) {
    const legacyRaw = readRawJson(getLegacyStorageKey(kind));
    const payload = { exportedAt: new Date().toISOString(), dataKind: kind, data: legacyRaw };
    const outcome = await saveTextFile(BACKUP_FILE_NAME[kind], JSON.stringify(payload, null, 2));
    setDownloadNotice((prev) => ({
      ...prev,
      [kind]: outcome.ok ? ta("backupDownloadSuccessMessage") : ta("backupDownloadFailureMessage"),
    }));
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
                <dt className="text-2xs text-text-muted">{kindLabel(kind)}</dt>
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
            <p className="text-xs text-text-muted">{ta("selectionIntro")}</p>
            <div className="flex flex-col gap-1.5">
              {MIGRATABLE_KINDS.map((kind) => (
                <label key={kind} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`local-data-migration-select-${kind}`}
                    checked={selected[kind] === true}
                    onChange={() => toggleSelected(kind)}
                  />
                  <span>{fill(ta("selectKindCheckboxTemplate"), { kind: kindLabel(kind) })}</span>
                  <span className="text-2xs text-text-muted">({legacy ? legacy[kind].itemCount : 0})</span>
                </label>
              ))}
            </div>
            <div>
              <Button size="sm" variant="secondary" onClick={handlePreview} disabled={!MIGRATABLE_KINDS.some((k) => selected[k])}>
                {ta("previewButton")}
              </Button>
            </div>
          </Surface>

          <Surface padding="md" className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-text">{ta("referenceIntegrityHeading")}</p>
            {refIssues ? (
              refIssues.totalReferencedCount === 0 ? (
                <p className="text-2xs text-text-muted">{ta("referenceIntegrityNoDataMessage")}</p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-2xs text-text-muted">{ta("referenceIntegrityTotalLabel")}</dt>
                      <dd className="font-bold tabular-nums">{refIssues.totalReferencedCount}</dd>
                    </div>
                    <div>
                      <dt className="text-2xs text-text-muted">{ta("referenceIntegrityBrokenLabel")}</dt>
                      <dd className="font-bold tabular-nums">{refIssues.brokenCount}</dd>
                    </div>
                  </dl>
                  {refIssues.brokenCount > 0 ? <p className="text-2xs text-warning">{ta("referenceIntegrityNotice")}</p> : null}
                </>
              )
            ) : null}
          </Surface>

          {MIGRATABLE_KINDS.filter((kind) => previews[kind]).map((kind) => {
            const preview = previews[kind]!;
            const result = results[kind];
            return (
              <Surface key={kind} padding="md" className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-text">{fill(ta("previewKindHeadingTemplate"), { kind: kindLabel(kind) })}</p>
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
                {kind === "myTeam" ? <p className="text-xs text-text-muted">{ta("cloudUnchangedNotice")}</p> : null}
                {preview.conflictCount > 0 ? <p className="text-xs text-warning">{ta("conflictNotMigratedNotice")}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {preview.addCount > 0 ? (
                    <Button size="sm" onClick={() => openMigrateConfirm(kind)}>
                      {ta("migrateButton")}
                    </Button>
                  ) : (
                    <p className="text-sm text-text-muted">{ta("nothingToMigrateMessage")}</p>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleDownloadBackup(kind)}>
                    {ta("downloadBackupButton")}
                  </Button>
                </div>
                {downloadNotice[kind] ? (
                  <p aria-live="polite" className="text-2xs text-text-muted">
                    {downloadNotice[kind]}
                  </p>
                ) : null}

                {result ? (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                    <p className="text-2xs font-semibold text-text-dim">{fill(ta("resultKindHeadingTemplate"), { kind: kindLabel(kind) })}</p>
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
                  </div>
                ) : null}
              </Surface>
            );
          })}
        </>
      )}

      <ConfirmDialog
        open={confirmKind != null}
        title={ta("migrateConfirmTitle")}
        confirmLabel={ta("migrateConfirmExecuteButton")}
        cancelLabel={ta("cancelButton")}
        confirmDisabled={!migrateAck}
        onCancel={() => setConfirmKind(null)}
        onConfirm={handleMigrateConfirmed}
        body={
          confirmKind ? (
            <div className="flex flex-col gap-1.5">
              <p>{ta("migrateConfirmIntro")}</p>
              <p className="font-semibold">{kindLabel(confirmKind)}</p>
              <p className="font-semibold">
                {fill(ta("migrateConfirmCountTemplate"), { kind: kindLabel(confirmKind), count: String(previews[confirmKind]?.addCount ?? 0) })}
              </p>
              <p className="text-2xs text-text-muted">
                {fill(ta("migrateConfirmDuplicateTemplate"), { kind: kindLabel(confirmKind), count: String(previews[confirmKind]?.duplicateCount ?? 0) })}
              </p>
              <p className="text-2xs text-text-muted">
                {fill(ta("migrateConfirmConflictTemplate"), { kind: kindLabel(confirmKind), count: String(previews[confirmKind]?.conflictCount ?? 0) })}
              </p>
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
          ) : null
        }
      />
    </div>
  );
}
