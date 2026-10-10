"use client";

import "@/lib/i18n/dictionaries/ja-ns/auth";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import {
  classifyAccountDeletionError,
  clearAccountLocalData,
  DELETE_CONFIRM_TOKEN,
  isAccountDeletionAvailable,
  isConfirmPhraseValid,
  isDeletionSucceeded,
  type AccountDeletionFailure,
} from "@/lib/account/account-deletion";
import { getCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { getSafeLocalStorage } from "@/lib/local-storage-scope/storage-access";
import { GoogleSignInButton, useGoogleOAuthAvailable } from "./GoogleSignInButton";

type AuthKey = keyof Dictionary["auth"];
type Phase = "idle" | "deleting" | "done";
type Message = AccountDeletionFailure | "unknown_result" | "reauth_done" | null;

/** 応答が来ないときの上限（結果が不明として案内する。関数は冪等なので再試行してよい）。 */
const RPC_TIMEOUT_MS = 20_000;

const MESSAGE_KEY: Record<NonNullable<Message>, AuthKey> = {
  reauth_required: "deletionReauthRequired",
  confirmation_required: "deletionErrorFailed",
  billing_active: "deletionErrorBilling",
  not_authenticated: "deletionLoginRequired",
  unavailable: "deletionErrorUnavailable",
  failed: "deletionErrorFailed",
  unknown_result: "deletionErrorUnknownResult",
  reauth_done: "deletionReauthDone",
};

/**
 * アカウントの削除（`/account/delete`・2026-10-11）。
 * - 削除の対象・削除されないもの・再登録の扱いを先に示す。確認のチェック＋確認の語の入力の両方がそろうまでボタンは押せない（1 クリックで消さない）。
 * - サーバーの関数 `delete_my_account('DELETE')` だけを呼ぶ（service role は使わない・対象は auth.uid() だけ）。最近の認証が無ければ
 *   再認証（Google は Google の画面へ・メールのアカウントはパスワード）を求める。
 * - 成功の後: この端末のこのアカウントのデータを消す（本人が選んだときだけ）→ この端末のセッションを破棄 → 完了の表示。
 * - 公開の状態は ACCOUNT_DELETION_MODE。無効の間は、運営への連絡による手動の削除の案内だけを出す（関数を呼ばない）。
 */
export function AccountDeletionView() {
  const t = useT();
  const ta = (key: AuthKey) => t("auth", key);
  const session = useSupabaseSession();
  const google = useGoogleOAuthAvailable();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (isAccountDeletionAvailable(window.location.hostname, window.location.search, isLocalDevHostname)) setAvailable(true);
  }, []);

  const [ack, setAck] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [clearLocal, setClearLocal] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<Message>(null);
  const [password, setPassword] = useState("");
  const [reauthPending, setReauthPending] = useState(false);
  const inFlight = useRef(false);

  const expectedPhrase = ta("deletionPhrase");
  const canSubmit = ack && isConfirmPhraseValid(phrase, expectedPhrase) && phase === "idle";

  async function handleDelete() {
    if (!canSubmit || inFlight.current) return; // 二重の実行の防止
    inFlight.current = true;
    setPhase("deleting");
    setMessage(null);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      if (!supabase?.rpc) {
        setMessage("unavailable");
        setPhase("idle");
        return;
      }
      const scope = getCurrentScope(); // 削除の前に取得（ログアウトの後は guest になる）
      const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), RPC_TIMEOUT_MS));
      const result = await Promise.race([supabase.rpc("delete_my_account", { confirm: DELETE_CONFIRM_TOKEN }), timeout]);
      if (result === "timeout") {
        setMessage("unknown_result");
        setPhase("idle");
        return;
      }
      if (result.error || !isDeletionSucceeded(result.data)) {
        setMessage(result.error ? classifyAccountDeletionError(result.error) : "failed");
        setPhase("idle");
        return;
      }
      if (clearLocal && scope) clearAccountLocalData(scope, getSafeLocalStorage());
      // サーバーの側で sessions・refresh tokens は消えている。この端末の Cookie も消す（ユーザーが無いので global は使わない）。
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      setPhase("done");
    } catch {
      setMessage("unknown_result");
      setPhase("idle");
    } finally {
      inFlight.current = false;
    }
  }

  async function handlePasswordReauth(e: FormEvent) {
    e.preventDefault();
    if (reauthPending || session.status !== "authenticated" || !session.email) return;
    setReauthPending(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const r = await supabase?.auth.signInWithPassword({ email: session.email, password });
      setPassword("");
      setMessage(r && !r.error ? "reauth_done" : "failed");
    } catch {
      setMessage("failed");
    } finally {
      setReauthPending(false);
    }
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-5" data-testid="account-deletion-done">
        <PageHeader title={ta("deletionDoneTitle")} icon="shield" />
        <Surface padding="md" className="flex max-w-xl flex-col gap-3">
          <p role="status" className="text-sm">
            {ta("deletionDoneBody")}
          </p>
          <div>
            <Link href="/">
              <Button size="sm">{ta("accountLimitedBrowse")}</Button>
            </Link>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="account-deletion">
      <PageHeader title={ta("deletionPageTitle")} icon="shield" />

      <Surface padding="md" className="flex max-w-xl flex-col gap-2">
        <p className="text-sm font-semibold text-text">{ta("deletionWillDeleteHeading")}</p>
        <ul className="list-disc ps-5 text-sm text-text-dim">
          <li>{ta("deletionItemLogin")}</li>
          <li>{ta("deletionItemCloud")}</li>
          <li>{ta("deletionItemSessions")}</li>
        </ul>
        <p className="mt-2 text-sm font-semibold text-text">{ta("deletionKeptHeading")}</p>
        <ul className="list-disc ps-5 text-sm text-text-dim">
          <li>{ta("deletionKeptGuest")}</li>
          <li>{ta("deletionKeptAudit")}</li>
          <li>{ta("deletionKeptLogs")}</li>
        </ul>
        <p className="mt-2 text-xs text-text-muted">{ta("deletionReRegisterNote")}</p>
      </Surface>

      {!available ? (
        <Surface tone="outline" padding="md" className="flex max-w-xl flex-col gap-2" data-testid="account-deletion-manual">
          <p className="text-sm font-semibold text-text">{ta("deletionManualTitle")}</p>
          <p className="text-sm text-text-dim">{ta("deletionManualBody")}</p>
          <Link href="/support" className="w-fit text-sm text-accent hover:underline">
            {ta("deletionManualLink")}
          </Link>
        </Surface>
      ) : session.status !== "authenticated" ? (
        <Surface padding="md" className="max-w-xl">
          <p className="text-sm text-text-dim">{session.status === "loading" ? "…" : ta("deletionLoginRequired")}</p>
        </Surface>
      ) : (
        <Surface padding="md" className="flex max-w-xl flex-col gap-3" data-testid="account-deletion-form">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={clearLocal} onChange={(e) => setClearLocal(e.target.checked)} disabled={phase !== "idle"} />
            <span>{ta("deletionClearLocalLabel")}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" name="account-deletion-ack" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={phase !== "idle"} />
            <span>{ta("deletionAckLabel")}</span>
          </label>
          <Input
            label={ta("deletionPhraseLabelTemplate").replace("{phrase}", expectedPhrase)}
            name="account-deletion-phrase"
            autoComplete="off"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            disabled={phase !== "idle"}
            maxLength={40}
          />
          {message ? (
            <p role={message === "reauth_done" ? "status" : "alert"} className={`text-sm ${message === "reauth_done" ? "text-success" : "text-danger"}`}>
              {ta(MESSAGE_KEY[message])}
            </p>
          ) : null}
          <Button type="button" variant="danger" onClick={handleDelete} disabled={!canSubmit} aria-busy={phase === "deleting"}>
            {phase === "deleting" ? ta("deletionDeleting") : ta("deletionSubmitButton")}
          </Button>

          {message === "reauth_required" ? (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3" data-testid="account-deletion-reauth">
              {google ? <GoogleSignInButton next="/account/delete" onError={() => setMessage("failed")} /> : null}
              <form className="flex flex-col gap-2" onSubmit={handlePasswordReauth}>
                <p className="text-xs text-text-muted">{ta("deletionReauthPasswordLead")}</p>
                <Input
                  type="password"
                  label={ta("passwordLabel")}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                  disabled={reauthPending}
                />
                <Button type="submit" variant="secondary" size="sm" disabled={reauthPending || password === ""}>
                  {ta("deletionReauthButton")}
                </Button>
              </form>
            </div>
          ) : null}
        </Surface>
      )}
    </div>
  );
}
