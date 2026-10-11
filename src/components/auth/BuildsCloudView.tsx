"use client";

import "@/lib/i18n/dictionaries/ja-ns/buildsCloud";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { fillMessage } from "@/lib/i18n/message-format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import { isBuildsCloudAvailable } from "@/lib/supabase/builds-cloud-mode";
import { planBuildsRestore } from "@/lib/supabase/builds-cloud-schema";
import type { BuildsCloudErrorReason, BuildsCloudSnapshot } from "@/lib/supabase/builds-cloud";
import { importBuilds, listAllBuilds } from "@/lib/progression/build-storage";
import { getCurrentScope, subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { useSignInHref } from "@/components/auth/useSignInHref";

type Key = keyof Dictionary["buildsCloud"];

/**
 * 保存ビルドのクラウド保存（手動・任意・F-052 第 2 段階・2026-10-11）。
 *
 * - 公開の状態は BUILDS_CLOUD_MODE（本番の表を作るまで "disabled"）。無効の間は準備中の案内だけで、Supabase を呼ばない。
 * - 送信・取得・削除はボタンからだけ。ログイン・画面の表示では何もしない。
 * - 反映は「端末に無いビルドだけを追加」（既存の importBuilds・上書き・削除なし・途中で端末のビルドが変われば止める）。
 * - user_id・行の id・トークンは画面に出さない。Supabase の生のエラーは出さない。
 */
export function BuildsCloudView() {
  const t = useT();
  const tb = useCallback((k: Key) => t("buildsCloud", k), [t]);
  const signInHref = useSignInHref();
  const session = useSupabaseSession();
  // この画面だけで開かれても端末の保存ビルドを読めるよう、ストレージのスコープを自分で解決して共有ストアへ伝える（スカッドの画面と同じ）
  useSyncedStorageScope();
  const scope = useSyncExternalStore(subscribeCurrentScope, getCurrentScope, () => null);

  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(isBuildsCloudAvailable(window.location.hostname, window.location.search, isLocalDevHostname));
  }, []);

  const [localVersion, setLocalVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const localBuilds = useMemo(() => (scope ? listAllBuilds() : []), [scope, localVersion]);

  const [snapshot, setSnapshot] = useState<BuildsCloudSnapshot | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<null | "check" | "save" | "restore" | "delete">(null);
  const [confirm, setConfirm] = useState<null | "save" | "delete">(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const errorText = (r: BuildsCloudErrorReason): string =>
    r === "UNAUTHENTICATED" ? tb("errorUnauthenticated") : r === "INVALID_LOCAL_DATA" ? tb("errorInvalidLocal") : r === "INVALID_CLOUD_DATA" ? tb("errorInvalidCloud") : tb("errorGeneric");

  async function client() {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    return getSupabaseBrowserClient();
  }

  async function check() {
    if (busy) return;
    setBusy("check");
    setMessage(null);
    const { fetchBuildsCloudSnapshot } = await import("@/lib/supabase/builds-cloud");
    const supabase = await client();
    const r = supabase ? await fetchBuildsCloudSnapshot(supabase) : ({ ok: false, error: "UNKNOWN" } as const);
    setBusy(null);
    if (r.ok) {
      setSnapshot(r.data);
      setChecked(true);
    } else setMessage({ tone: "error", text: errorText(r.error) });
  }

  async function save() {
    if (busy) return;
    setConfirm(null);
    setBusy("save");
    setMessage(null);
    const { saveBuildsCloudSnapshot } = await import("@/lib/supabase/builds-cloud");
    const supabase = await client();
    const r = supabase ? await saveBuildsCloudSnapshot(supabase, listAllBuilds(), new Date().toISOString()) : ({ ok: false, error: "UNKNOWN" } as const);
    setBusy(null);
    if (r.ok) {
      setSnapshot(r.data);
      setChecked(true);
      setMessage({ tone: "ok", text: tb("saved") });
    } else setMessage({ tone: "error", text: errorText(r.error) });
  }

  async function remove() {
    if (busy || !snapshot) return;
    setConfirm(null);
    setBusy("delete");
    setMessage(null);
    const { deleteBuildsCloudSnapshot } = await import("@/lib/supabase/builds-cloud");
    const supabase = await client();
    const r = supabase ? await deleteBuildsCloudSnapshot(supabase, snapshot.id) : ({ ok: false, error: "UNKNOWN" } as const);
    setBusy(null);
    if (r.ok) {
      setSnapshot(null);
      setMessage({ tone: "ok", text: tb("deleted") });
    } else setMessage({ tone: "error", text: errorText(r.error) });
  }

  const plan = useMemo(() => (snapshot ? planBuildsRestore(localBuilds, snapshot.payload.items) : null), [snapshot, localBuilds]);

  function restore() {
    if (busy || !plan) return;
    if (plan.toAdd.length === 0) {
      setMessage({ tone: "ok", text: tb("restoreNothing") });
      return;
    }
    setBusy("restore");
    const r = importBuilds(plan.toAdd, { expectedExistingBuildIds: localBuilds.map((b) => b.buildId) });
    setBusy(null);
    setLocalVersion((v) => v + 1);
    if (r.ok) setMessage({ tone: "ok", text: fillMessage(tb("restoredTemplate"), { count: String(r.saved) }) });
    else setMessage({ tone: "error", text: r.code === "conflict" ? tb("errorConflict") : tb("errorGeneric") });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="builds-cloud">
      <PageHeader title={tb("pageTitle")} icon="database" description={tb("introBody")} />
      <Surface tone="outline" padding="md" className="flex flex-col gap-1 text-xs text-text-dim">
        <p>{tb("manualNotice")}</p>
        <p>{tb("scopeNotice")}</p>
      </Surface>

      {session.status !== "authenticated" ? (
        <Surface padding="md" className="text-sm" data-testid="builds-cloud-signin">
          <p>{tb("signInRequired")}</p>
          <Link href={signInHref} className="mt-2 inline-block text-accent hover:underline">
            {tb("signInLink")}
          </Link>
        </Surface>
      ) : !available ? (
        <Surface padding="md" className="text-sm text-text-dim" data-testid="builds-cloud-unavailable">
          {tb("unavailableNotice")}
        </Surface>
      ) : (
        <Surface padding="md" className="flex flex-col gap-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-2xs text-text-muted">{tb("localCountLabel")}</dt>
              <dd className="font-semibold" data-testid="builds-cloud-local-count">{localBuilds.length}</dd>
            </div>
            <div>
              <dt className="text-2xs text-text-muted">{tb("cloudLabel")}</dt>
              <dd data-testid="builds-cloud-status">
                {!checked ? tb("cloudNotChecked") : snapshot ? fillMessage(tb("cloudExistsTemplate"), { count: String(snapshot.itemCount), date: new Date(snapshot.updatedAt).toLocaleString() }) : tb("cloudNone")}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={check} disabled={busy != null} data-testid="builds-cloud-check">
              {busy === "check" ? tb("checking") : tb("checkButton")}
            </Button>
            <Button size="sm" onClick={() => setConfirm("save")} disabled={busy != null || localBuilds.length === 0} data-testid="builds-cloud-save">
              {busy === "save" ? tb("saving") : tb("saveButton")}
            </Button>
            {snapshot ? (
              <Button size="sm" variant="danger" onClick={() => setConfirm("delete")} disabled={busy != null} data-testid="builds-cloud-delete">
                {tb("deleteButton")}
              </Button>
            ) : null}
          </div>
          {localBuilds.length === 0 ? <p className="text-2xs text-text-muted">{tb("saveEmptyBlocked")}</p> : null}

          {confirm ? (
            <div role="alertdialog" className="flex flex-col gap-2 rounded-md border border-accent/50 bg-accent/5 p-3 text-xs" data-testid="builds-cloud-confirm">
              <p>{confirm === "save" ? fillMessage(tb("saveConfirmTemplate"), { count: String(localBuilds.length) }) : tb("deleteConfirm")}</p>
              <div className="flex gap-2">
                <Button size="sm" variant={confirm === "delete" ? "danger" : "primary"} onClick={confirm === "save" ? save : remove} data-testid="builds-cloud-confirm-yes">
                  {confirm === "save" ? tb("saveConfirmButton") : tb("deleteConfirmButton")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                  {tb("cancelButton")}
                </Button>
              </div>
            </div>
          ) : null}

          {plan ? (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs">
              <p data-testid="builds-cloud-restore-plan">{fillMessage(tb("restorePreviewTemplate"), { add: String(plan.toAdd.length), same: String(plan.alreadyLocal), diff: String(plan.sameIdDifferent) })}</p>
              <Button size="sm" variant="secondary" onClick={restore} disabled={busy != null} data-testid="builds-cloud-restore">
                {tb("restoreButton")}
              </Button>
            </div>
          ) : null}

          {message ? (
            <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-danger" : "text-success"} data-testid="builds-cloud-message">
              {message.text}
            </p>
          ) : null}
        </Surface>
      )}
    </div>
  );
}
