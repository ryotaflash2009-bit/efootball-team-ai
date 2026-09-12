"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { listOwnProbes, createProbe, updateProbeLabel, deleteProbe, type RlsProbeRecord, type RlsProbeErrorReason } from "@/lib/supabase/rls-probe";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type RlsTestKey = keyof Dictionary["rlsTest"];
type AuthKey = keyof Dictionary["auth"];

/** 作成/更新の失敗理由(クライアント側の入力検証結果も含む、閉じた集合)。 */
type FormFailureReason = "EMPTY" | "TOO_LONG" | RlsProbeErrorReason;

/**
 * Row Level Security分離検証専用の開発向けPoC画面。
 *
 * - My Team等のクラウド同期ではない。短い検証文字列(label)だけを扱う。
 * - user_id・内部UUID・JWT・Token・Cookie・Project URL・Publishable keyは
 *   一切画面へ表示しない(レコードの`id`もReactのkeyとハンドラー引数にのみ使い、
 *   可視テキストとしては描画しない)。
 * - 0件の更新/削除を成功として誤表示しない(`rls-probe.ts`が
 *   NOT_FOUND_OR_FORBIDDENとして区別する)。
 * - RLSを第一防衛線として維持するため、クライアント側で`user_id`によるフィルターは
 *   一切行わない(`listOwnProbes`はRLSだけに絞り込みを委ねる)。
 * - 状態には「翻訳済み文字列」ではなく理由コードだけを保持し、表示直前(JSX側)で
 *   翻訳する。翻訳関数(`t`)はレンダーごとに再生成されるため、理由コードのまま
 *   保持すればフック依存配列に翻訳関数を含める必要がなくなる。
 */
export function RlsTestView() {
  const t = useT();
  const ta = (key: RlsTestKey) => t("rlsTest", key);
  const taAuth = (key: AuthKey) => t("auth", key);
  const session = useSupabaseSession();

  function formFailureMessage(reason: FormFailureReason): string {
    if (reason === "EMPTY") return ta("createEmptyError");
    if (reason === "TOO_LONG") return ta("createTooLongError");
    if (reason === "NOT_FOUND_OR_FORBIDDEN") return ta("notFoundOrForbiddenMessage");
    return ta("genericErrorMessage");
  }

  const [records, setRecords] = useState<RlsProbeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErrorReason, setListErrorReason] = useState<RlsProbeErrorReason | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErrorReason, setCreateErrorReason] = useState<FormFailureReason | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; reason: FormFailureReason } | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListErrorReason(null);
    const result = await listOwnProbes(supabase);
    setLoading(false);
    if (!result.ok) {
      setListErrorReason(result.error);
      return;
    }
    setRecords(result.data);
  }, []);

  useEffect(() => {
    if (session.status === "authenticated") {
      refresh();
    } else {
      setRecords([]);
    }
  }, [session.status, refresh]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (creating) return; // 連打防止
    setCreateErrorReason(null);
    setSuccessMessage(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCreateErrorReason("UNKNOWN");
      return;
    }
    setCreating(true);
    try {
      const result = await createProbe(supabase, newLabel);
      if (!result.ok) {
        if (result.error === "INVALID_INPUT") {
          setCreateErrorReason(newLabel.trim().length === 0 ? "EMPTY" : "TOO_LONG");
        } else {
          setCreateErrorReason(result.error);
        }
        return;
      }
      setRecords((prev) => [result.data, ...prev]);
      setNewLabel("");
      setSuccessMessage(ta("createSuccessMessage"));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(record: RlsProbeRecord) {
    setEditingId(record.id);
    setEditValue(record.label);
    setRowError(null);
    setSuccessMessage(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function handleSaveEdit(id: string) {
    if (savingId) return; // 連打防止
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSavingId(id);
    setRowError(null);
    try {
      const result = await updateProbeLabel(supabase, id, editValue);
      if (!result.ok) {
        const reason: FormFailureReason = result.error === "INVALID_INPUT" ? (editValue.trim().length === 0 ? "EMPTY" : "TOO_LONG") : result.error;
        setRowError({ id, reason });
        return;
      }
      setRecords((prev) => prev.map((r) => (r.id === id ? result.data : r)));
      setEditingId(null);
      setSuccessMessage(ta("updateSuccessMessage"));
    } finally {
      setSavingId(null);
    }
  }

  async function handleConfirmDelete(id: string) {
    if (deletingId) return; // 連打防止
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setDeletingId(id);
    try {
      const result = await deleteProbe(supabase, id);
      if (!result.ok) {
        setRowError({ id, reason: result.error });
        return;
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
      setSuccessMessage(ta("deleteSuccessMessage"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ta("pageTitle")} icon="shield" />

      <Surface tone="outline" padding="md" className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-warning">{ta("devNoticeTitle")}</p>
        <p className="text-sm text-text-dim">{ta("devNoticeBody")}</p>
        <p className="text-xs text-text-muted">{ta("notCloudSyncNotice")}</p>
        <p className="text-xs text-text-muted">{ta("shortStringOnlyNotice")}</p>
        <p className="text-xs text-text-muted">{ta("deletableAfterTestNotice")}</p>
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
          <Surface padding="md">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleCreate} noValidate>
              <div className="min-w-0 flex-1">
                <Input name="rls-probe-create-label" label={ta("createLabel")} placeholder={ta("createPlaceholder")} value={newLabel} maxLength={200} onChange={(e) => setNewLabel(e.target.value)} disabled={creating} />
              </div>
              <Button type="submit" disabled={creating} className="sm:w-fit">
                {creating ? ta("createSubmitting") : ta("createButton")}
              </Button>
            </form>
            {createErrorReason ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {formFailureMessage(createErrorReason)}
              </p>
            ) : null}
            {successMessage ? (
              <p aria-live="polite" className="mt-2 text-sm text-success">
                {successMessage}
              </p>
            ) : null}
          </Surface>

          <Surface padding="md" className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">{ta("listHeading")}</p>
            {listErrorReason ? (
              <p role="alert" className="text-sm text-danger">
                {formFailureMessage(listErrorReason)}
              </p>
            ) : null}
            {loading ? (
              <p className="text-sm text-text-dim">{ta("loadingMessage")}</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-text-muted">{ta("emptyListMessage")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {records.map((record) => (
                  <li key={record.id} className="rounded-md border border-border p-3">
                    {editingId === record.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <Input name="rls-probe-edit-label" value={editValue} maxLength={200} onChange={(e) => setEditValue(e.target.value)} disabled={savingId === record.id} />
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(record.id)} disabled={savingId === record.id}>
                            {ta("saveButton")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={savingId === record.id}>
                            {ta("cancelButton")}
                          </Button>
                        </div>
                      </div>
                    ) : confirmDeleteId === record.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-danger">{ta("deleteConfirmTitle")}</p>
                        <p className="text-xs text-text-dim">{ta("deleteConfirmBody")}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" onClick={() => handleConfirmDelete(record.id)} disabled={deletingId === record.id}>
                            {ta("deleteConfirmButton")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setConfirmDeleteId(null)} disabled={deletingId === record.id}>
                            {ta("cancelButton")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 break-words text-sm text-text">{record.label}</span>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEdit(record)}>
                            {ta("editButton")}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirmDeleteId(record.id)}>
                            {ta("deleteButton")}
                          </Button>
                        </div>
                      </div>
                    )}
                    {rowError?.id === record.id ? (
                      <p role="alert" className="mt-2 text-sm text-danger">
                        {formFailureMessage(rowError.reason)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </>
      )}
    </div>
  );
}
