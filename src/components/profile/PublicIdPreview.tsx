"use client";

import "@/lib/i18n/dictionaries/ja-ns/publicIdPreview";
import { useId, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { PUBLIC_ID_RULES_VERSION, validateDisplayName, validatePublicId } from "@/lib/profile/public-id";

type Key = keyof Dictionary["publicIdPreview"];

/**
 * F-053 公開 ID の試作（内部ページ）。入力の検証を見せるだけで、保存・送信はしない。
 * 公開範囲は「非公開」だけ（URL 限定・友達・全体は安全機能の確認と本人の承認の後）。
 */
export function PublicIdPreview() {
  const t = useT();
  const p = (k: Key) => t("publicIdPreview", k);
  const [publicId, setPublicId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const idField = useId();
  const nameField = useId();
  const id = validatePublicId(publicId);
  const name = validateDisplayName(displayName);
  const message = (ok: boolean, problem?: string) => (ok ? p("ok") : p(`problem_${problem}` as Key));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={p("pageTitle")} icon="community" description={p("pageDescription")} />
      <p role="note" className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning" data-testid="public-id-banner">
        {p("localOnlyBanner")}
      </p>
      <Surface className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={idField} className="text-sm font-semibold">{p("publicIdLabel")}</label>
          <input
            id={idField}
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            maxLength={64}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={`${idField}-hint ${idField}-status`}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          />
          <p id={`${idField}-hint`} className="text-2xs text-text-muted">{p("publicIdHint")}</p>
          {publicId ? (
            <p id={`${idField}-status`} role="status" className={`text-xs ${id.ok ? "text-success" : "text-warning"}`} data-testid="public-id-status">
              {message(id.ok, id.ok ? undefined : id.problem)}
              {id.ok ? <span className="ms-2 font-mono text-text-muted">{p("previewUrl")}: /u/{id.normalized}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={nameField} className="text-sm font-semibold">{p("displayNameLabel")}</label>
          <input
            id={nameField}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            autoComplete="off"
            aria-describedby={`${nameField}-hint ${nameField}-status`}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          />
          <p id={`${nameField}-hint`} className="text-2xs text-text-muted">{p("displayNameHint")}</p>
          {displayName ? (
            <p id={`${nameField}-status`} role="status" className={`text-xs ${name.ok ? "text-success" : "text-warning"}`} data-testid="display-name-status">
              {message(name.ok, name.ok ? undefined : name.problem)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{p("visibilityLabel")}</span>
          <p className="text-xs text-text-dim">{p("visibilityPrivateOnly")}</p>
        </div>
        <p className="text-2xs text-text-muted">{p("changeRule")}</p>
        <p className="text-2xs text-text-muted">
          {p("rulesVersion")}: <span className="font-mono">{PUBLIC_ID_RULES_VERSION}</span>
        </p>
      </Surface>
    </div>
  );
}
