"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import {
  fetchMyTeamCloudSnapshot,
  saveMyTeamCloudSnapshot,
  deleteMyTeamCloudSnapshot,
  type MyTeamCloudSnapshot,
  type MyTeamCloudErrorReason,
} from "@/lib/supabase/my-team-cloud";
import { previewMyTeamCloudApply, applyAddMissingCloudItems } from "@/lib/user-cards/my-team-cloud-apply";
import {
  checkAccountProvenance,
  recordAccountHint,
  isProvenanceConfirmationRequired,
  type ProvenanceStatus,
} from "@/lib/supabase/my-team-cloud-provenance";
import { ConfirmDialog } from "@/components/user-cards/ConfirmDialog";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type MtcKey = keyof Dictionary["myTeamCloud"];
type AuthKey = keyof Dictionary["auth"];

/**
 * My Teamクラウド保存(手動・任意)の開発向けPoC画面。
 *
 * - ログイン・ページ表示だけではクラウドへ一切送信しない。送信は「クラウドへ保存」
 *   ボタン→確認画面→実行、の明示操作からのみ発生する。
 * - クラウドデータの取得(状態表示・確認)は読み取り専用であり、ローカルへは
 *   一切書き込まない。ローカルへの反映は、別途「ローカルへ反映」の確認後にのみ行う
 *   (採用方式: 不足分だけの追加。既存のローカルレコードは上書き・削除しない)。
 * - user_id・内部UUID(レコードid)・アクセストークン・Cookie・Project URL・
 *   Publishable keyは画面に一切表示しない(idはハンドラー引数にのみ使う)。
 * - Supabaseの生エラーは表示せず、閉じた理由コードだけをi18nメッセージへ変換する。
 */
export function MyTeamCloudView() {
  const t = useT();
  const ta = useCallback((key: MtcKey) => t("myTeamCloud", key), [t]);
  const taAuth = useCallback((key: AuthKey) => t("auth", key), [t]);
  const fill = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s),
    [],
  );

  const session = useSupabaseSession();
  const { myTeam } = useMyTeam();

  function errorMessage(reason: MyTeamCloudErrorReason): string {
    switch (reason) {
      case "UNAUTHENTICATED":
        return ta("errorUnauthenticated");
      case "NOT_FOUND_OR_FORBIDDEN":
        return ta("errorNotFoundOrForbidden");
      case "MULTIPLE_ROWS":
        return ta("errorMultipleRows");
      case "INVALID_LOCAL_DATA":
        return ta("errorInvalidLocalData");
      case "INVALID_CLOUD_DATA":
        return ta("errorInvalidCloudData");
      case "VERIFICATION_FAILED":
        return ta("errorVerificationFailed");
      case "NETWORK":
        return ta("errorNetwork");
      case "TIMEOUT":
        return ta("errorTimeout");
      default:
        return ta("errorUnknown");
    }
  }

  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSnapshot, setCloudSnapshot] = useState<MyTeamCloudSnapshot | null>(null);
  const [cloudChecked, setCloudChecked] = useState(false);
  const [cloudErrorReason, setCloudErrorReason] = useState<MyTeamCloudErrorReason | null>(null);
  // 直近のcheck要求のIDを保持し、古い(遅延した)応答が新しい状態を上書きしないようにする。
  const cloudRequestIdRef = useRef(0);

  const [saving, setSaving] = useState(false);
  const [saveErrorReason, setSaveErrorReason] = useState<MyTeamCloudErrorReason | null>(null);
  const [saveSuccessAt, setSaveSuccessAt] = useState<number | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteErrorReason, setDeleteErrorReason] = useState<MyTeamCloudErrorReason | null>(null);
  const [deleteSuccessAt, setDeleteSuccessAt] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [applying, setApplying] = useState(false);
  const [applyResultMessage, setApplyResultMessage] = useState<string | null>(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  const [provenanceStatus, setProvenanceStatus] = useState<ProvenanceStatus | null>(null);
  const [provenanceAck, setProvenanceAck] = useState(false);

  const checkCloud = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const requestId = ++cloudRequestIdRef.current;
    setCloudLoading(true);
    setCloudErrorReason(null);
    const result = await fetchMyTeamCloudSnapshot(supabase);
    if (cloudRequestIdRef.current !== requestId) return; // 古い応答は破棄する
    setCloudLoading(false);
    setCloudChecked(true);
    if (!result.ok) {
      setCloudErrorReason(result.error);
      return;
    }
    setCloudSnapshot(result.data);
  }, []);

  // ログイン中アカウントの認証済みユーザーID(未ログイン/未確認ならnull)。
  // 由来チェック(my-team-cloud-provenance.ts)の内部入力としてのみ使う値であり、
  // UI・ログ・報告には一切表示しない(認証・認可の判定にも使わない。RLSの代替ではない)。
  // 同一ブラウザーでA→Bのようにアカウントが切り替わった場合、session.statusは
  // "authenticated"のまま変化しないため、ユーザーIDも依存配列に含めて
  // アカウントの切り替わり自体を検知する(でないと前アカウントの画面状態が
  // 次のアカウントへ引き継がれてしまう)。
  const currentUserId = session.status === "authenticated" ? session.userId : null;

  // 読み取り専用の状態確認(クラウドの有無・件数)と由来チェックだけは、
  // 画面表示時に自動実行してよい(ローカルデータの送信・クラウドデータの
  // ローカル反映は一切行わない)。アカウントが切り替わった場合は、
  // 前のアカウントの画面表示(クラウド有無・エラー・成功メッセージ等)を
  // 必ず一度リセットしてから確認し直す。
  useEffect(() => {
    setCloudSnapshot(null);
    setCloudChecked(false);
    setCloudErrorReason(null);
    setSaveErrorReason(null);
    setSaveSuccessAt(null);
    setDeleteErrorReason(null);
    setDeleteSuccessAt(null);
    setApplyResultMessage(null);
    setProvenanceStatus(null);
    setProvenanceAck(false); // アカウント切り替え時は必ず明示確認チェックを破棄する
    if (session.status === "authenticated") {
      checkCloud();
      checkAccountProvenance(currentUserId).then(setProvenanceStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, currentUserId, checkCloud]);

  const cloudOnlyWorldIds = useMemo(() => (cloudSnapshot ? cloudSnapshot.payload.items.map((i) => i.worldCardId) : []), [cloudSnapshot]);
  const { cards: resolvedCloudCards } = useResolvedCards(cloudOnlyWorldIds);
  const knownWorldCardIds = useMemo(() => new Set(resolvedCloudCards.keys()), [resolvedCloudCards]);

  const preview = useMemo(() => {
    if (!cloudSnapshot) return null;
    return previewMyTeamCloudApply(myTeam, cloudSnapshot.payload.items, knownWorldCardIds);
  }, [cloudSnapshot, myTeam, knownWorldCardIds]);

  // 保存確認画面を開くたびに、追加確認チェックボックスの状態をリセットする
  // (前回の確認状態が別の操作へ引き継がれないようにする)。
  function openSaveConfirm() {
    setProvenanceAck(false);
    setShowSaveConfirm(true);
  }

  async function handleSaveConfirmed() {
    if (saving) return; // 連打防止
    // UIのdisabled属性とまったく同じ判定関数を使う(画面と処理の食い違いを構造的に防ぐ)。
    if (isProvenanceConfirmationRequired(provenanceStatus, provenanceAck)) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSaving(true);
    setSaveErrorReason(null);
    try {
      const result = await saveMyTeamCloudSnapshot(supabase, myTeam, new Date().toISOString());
      if (!result.ok) {
        setSaveErrorReason(result.error);
        return;
      }
      setCloudSnapshot(result.data);
      setSaveSuccessAt(Date.now());
      setShowSaveConfirm(false);
      setProvenanceAck(false);
      await recordAccountHint(currentUserId);
      setProvenanceStatus("MATCH");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (deleting || !cloudSnapshot) return; // 連打防止
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setDeleting(true);
    setDeleteErrorReason(null);
    try {
      const result = await deleteMyTeamCloudSnapshot(supabase, cloudSnapshot.id);
      if (!result.ok) {
        setDeleteErrorReason(result.error);
        return;
      }
      setCloudSnapshot(null);
      setDeleteSuccessAt(Date.now());
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleApplyConfirmed() {
    if (applying || !preview) return; // 連打防止
    setApplying(true);
    setApplyResultMessage(null);
    try {
      const result = applyAddMissingCloudItems(preview.cloudOnlyItems);
      if (result.ok) {
        setApplyResultMessage(fill(ta("applySuccessMessageTemplate"), { count: String(result.addedCount) }));
      } else {
        setApplyResultMessage(fill(ta("applyPartialNoticeTemplate"), { added: String(result.addedCount), failed: String(result.failedCount) }));
      }
      setShowApplyConfirm(false);
      if (result.addedCount > 0) {
        await recordAccountHint(currentUserId);
        setProvenanceStatus("MATCH");
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("pageTitle")} icon="database" />

      <Surface tone="outline" padding="md" className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-warning">{ta("devNoticeTitle")}</p>
        <p className="text-sm text-text-dim">{ta("devNoticeBody")}</p>
        <p className="text-xs text-text-muted">{ta("optionalNotice")}</p>
        <p className="text-xs text-text-muted">{ta("noAutoSendNotice")}</p>
        <p className="text-xs text-text-muted">{ta("notFullSyncNotice")}</p>
        <p className="text-xs font-semibold text-warning">{ta("browserSharedDataNotice")}</p>
        <p className="text-xs text-text-muted">{ta("notYetCloudSyncedNotice")}</p>
      </Surface>

      <Surface padding="md">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-2xs text-text-muted">{ta("localCountLabel")}</dt>
            <dd className="font-bold tabular-nums">{myTeam.length}</dd>
          </div>
          <div>
            <dt className="text-2xs text-text-muted">{ta("cloudSummaryHeading")}</dt>
            <dd className="font-bold">
              {!cloudChecked && cloudLoading
                ? ta("checkingMessage")
                : cloudSnapshot
                  ? `${ta("cloudExistsMessage")}（${ta("cloudCountLabel")}: ${cloudSnapshot.itemCount}）`
                  : ta("cloudNoneMessage")}
            </dd>
            {cloudSnapshot ? (
              <p className="mt-0.5 text-2xs text-text-muted">
                {ta("cloudUpdatedAtLabel")}: {new Date(cloudSnapshot.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </dl>
      </Surface>

      {session.status === "loading" ? (
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
          {provenanceStatus === "MISMATCH" ? (
            <Surface tone="outline" padding="sm" className="border-warning/60">
              <p role="alert" className="text-xs font-semibold text-warning">
                {ta("provenanceMismatchWarning")}
              </p>
            </Surface>
          ) : provenanceStatus === "UNKNOWN" ? (
            <Surface tone="outline" padding="sm">
              <p className="text-xs text-text-muted">{ta("provenanceUnknownNotice")}</p>
            </Surface>
          ) : null}

          <Surface padding="md" className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={checkCloud} disabled={cloudLoading}>
                {cloudLoading ? ta("checkingMessage") : ta("checkCloudButton")}
              </Button>
              <Button size="sm" onClick={openSaveConfirm} disabled={saving || cloudLoading}>
                {saving ? ta("savingMessage") : ta("saveButton")}
              </Button>
              {cloudSnapshot ? (
                <Button size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
                  {ta("deleteCloudButton")}
                </Button>
              ) : null}
            </div>
            {cloudErrorReason ? (
              <p role="alert" className="text-sm text-danger">
                {errorMessage(cloudErrorReason)}
              </p>
            ) : null}
            {saveErrorReason ? (
              <p role="alert" className="text-sm text-danger">
                {ta("saveFailureMessage")} {errorMessage(saveErrorReason)}
              </p>
            ) : null}
            {saveSuccessAt ? (
              <p aria-live="polite" className="text-sm text-success">
                {ta("saveSuccessMessage")}
              </p>
            ) : null}
            {deleteErrorReason ? (
              <p role="alert" className="text-sm text-danger">
                {ta("deleteFailureMessage")} {errorMessage(deleteErrorReason)}
              </p>
            ) : null}
            {deleteSuccessAt ? (
              <p aria-live="polite" className="text-sm text-success">
                {ta("deleteSuccessMessage")}
              </p>
            ) : null}
          </Surface>

          {cloudSnapshot && preview ? (
            <Surface padding="md" className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-text">{ta("previewHeading")}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewMatchingLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.matchingCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewLocalOnlyLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.localOnlyCount}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewCloudOnlyLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.cloudOnlyItems.length}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-text-muted">{ta("previewUnknownCardsLabel")}</dt>
                  <dd className="font-bold tabular-nums">{preview.unknownCardWorldIds.length}</dd>
                </div>
              </dl>
              <p className="text-xs text-text-muted">{ta("previewLocalUnchangedNotice")}</p>
              {preview.localOnlyCount > 0 && preview.cloudOnlyItems.length > 0 ? (
                <p className="text-xs text-warning">{ta("conflictNotice")}</p>
              ) : null}
              <p className="text-xs text-text-muted">{ta("backupRecommendationNotice")}</p>
              {preview.cloudOnlyItems.length === 0 ? (
                <p className="text-sm text-text-muted">{ta("previewNoChangesMessage")}</p>
              ) : (
                <div>
                  <Button size="sm" onClick={() => setShowApplyConfirm(true)} disabled={applying}>
                    {ta("applyButton")}
                  </Button>
                </div>
              )}
              {applyResultMessage ? (
                <p aria-live="polite" className="text-sm text-success">
                  {applyResultMessage}
                </p>
              ) : null}
            </Surface>
          ) : null}

          <Surface tone="outline" padding="sm">
            <p className="text-xs font-semibold text-text-dim">{ta("limitationsHeading")}</p>
            <p className="mt-1 text-2xs text-text-muted">{ta("limitationsBody")}</p>
          </Surface>
        </>
      )}

      <ConfirmDialog
        open={showSaveConfirm}
        title={ta("saveConfirmTitle")}
        confirmLabel={ta("saveConfirmExecuteButton")}
        cancelLabel={ta("cancelButton")}
        confirmDisabled={isProvenanceConfirmationRequired(provenanceStatus, provenanceAck)}
        onCancel={() => setShowSaveConfirm(false)}
        onConfirm={handleSaveConfirmed}
        body={
          <div className="flex flex-col gap-1.5">
            <p>{ta("saveConfirmIntro")}</p>
            <p className="font-semibold">{fill(ta("saveConfirmCountTemplate"), { count: String(myTeam.length) })}</p>
            {myTeam.length === 0 ? <p className="text-warning">{ta("saveConfirmEmptyWarning")}</p> : null}
            {cloudSnapshot ? <p className="text-warning">{ta("saveConfirmOverwriteWarning")}</p> : null}
            <p>{ta("saveConfirmNoLocalDeleteNotice")}</p>
            <p>{ta("saveConfirmFailureSafeNotice")}</p>
            <p>{ta("saveConfirmOwnDataOnlyNotice")}</p>
            <p>{ta("saveConfirmNotIncludedNotice")}</p>
            {provenanceStatus !== "MATCH" ? (
              <div className="mt-1 flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/10 p-2.5">
                <p role="alert" className="font-semibold text-warning">
                  {ta("saveConfirmProvenanceUnclearWarning")}
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-2xs">
                  <input
                    type="checkbox"
                    name="my-team-cloud-provenance-ack"
                    checked={provenanceAck}
                    onChange={(e) => setProvenanceAck(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{ta("saveConfirmProvenanceCheckboxLabel")}</span>
                </label>
              </div>
            ) : null}
          </div>
        }
      />

      <ConfirmDialog
        open={showApplyConfirm}
        title={ta("applyConfirmTitle")}
        confirmLabel={ta("applyConfirmExecuteButton")}
        cancelLabel={ta("cancelButton")}
        onCancel={() => setShowApplyConfirm(false)}
        onConfirm={handleApplyConfirmed}
        body={<p>{fill(ta("applyConfirmBodyTemplate"), { count: String(preview?.cloudOnlyItems.length ?? 0) })}</p>}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title={ta("deleteConfirmTitle")}
        danger
        confirmLabel={ta("deleteConfirmExecuteButton")}
        cancelLabel={ta("cancelButton")}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirmed}
        body={<p>{ta("deleteConfirmBody")}</p>}
      />
    </div>
  );
}
