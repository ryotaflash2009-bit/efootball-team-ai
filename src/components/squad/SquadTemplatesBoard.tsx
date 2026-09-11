"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listTemplateSummaries,
  createEmptyTemplate,
  createSquadFromTemplate,
  renameTemplate,
  deleteTemplate,
  getTemplate,
  isTemplateStorageAvailable,
  type SquadTemplateSummary,
} from "@/lib/squad/templates";
import { FORMATIONS } from "@/lib/squad/formations";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { MiniPitch } from "./MiniPitch";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

export function SquadTemplatesBoard() {
  const router = useRouter();
  const t = useT();
  const tst = (k: keyof Dictionary["squadTemplatesBoard"]) => t("squadTemplatesBoard", k);
  const fillSt = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const [items, setItems] = useState<SquadTemplateSummary[] | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const [newName, setNewName] = useState("");
  const [newFormation, setNewFormation] = useState(FORMATIONS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = () => setItems(listTemplateSummaries());
  useEffect(() => {
    setStorageOk(isTemplateStorageAvailable());
    reload();
  }, []);

  if (!storageOk) {
    return (
      <Surface tone="outline" className="text-center">
        <p className="text-base font-semibold">{tst("storageUnavailableHeading")}</p>
        <p className="mt-2 text-sm text-text-dim">{tst("storageUnavailableNote")}</p>
      </Surface>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/squads" className="w-fit text-sm text-text-dim hover:text-accent">
        {tst("backToSquadListLink")}
      </Link>

      <Surface tone="raised">
        <p className="text-sm font-semibold">{tst("createEmptyHeading")}</p>
        <p className="mt-1 text-xs text-text-dim">{tst("createEmptyNote")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            {tst("templateNameLabel")}
            <input
              value={newName}
              maxLength={80}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9 rounded border border-border bg-surface-2 px-2"
              aria-label={tst("newTemplateNameAria")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            {tst("formationLabel")}
            <select
              value={newFormation}
              onChange={(e) => setNewFormation(e.target.value)}
              className="h-9 rounded border border-border bg-surface-2 px-2"
            >
              {FORMATIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const r = createEmptyTemplate(newName.trim() || tst("defaultEmptyTemplateName"), newFormation);
              if (r.ok) {
                setNewName("");
                setError(null);
                reload();
              } else setError(r.error);
            }}
          >
            {tst("createButton")}
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </Surface>

      <section>
        <p className="mb-2 text-sm font-semibold">
          {fillSt(tst("templatesHeadingTemplate"), {
            countSuffix: items ? fillSt(tst("templatesCountSuffixTemplate"), { count: String(items.length) }) : "",
          })}
        </p>
        {items == null ? (
          <p className="text-sm text-text-dim">{tst("loadingText")}</p>
        ) : items.length === 0 ? (
          <Surface tone="outline" className="py-8 text-center text-sm text-text-dim">
            {tst("noTemplatesNote")}
          </Surface>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((t) => {
              const tpl = getTemplate(t.templateId);
              return (
                <li key={t.templateId}>
                  <Surface className="flex h-full gap-3">
                    <div className="w-16 shrink-0">
                      <MiniPitch
                        formationId={t.formationId}
                        filledSlotIds={
                          tpl ? tpl.squad.slots.filter((s) => s.worldCardId).map((s) => s.slotId) : []
                        }
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-sm font-semibold">{t.templateName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-text-muted">
                        <span className="font-medium text-text-dim">{t.formationName}</span>
                        <Badge tone="outline" size="xs">
                          {t.templateType === "empty" ? tst("emptyTypeBadge") : tst("fullTypeBadge")}
                        </Badge>
                        {t.hasCustomPositioning ? <Badge tone="accent" size="xs">{tst("customPlacementBadge")}</Badge> : null}
                        <span>{fillSt(tst("startersTemplate"), { count: String(t.startingCount) })}</span>
                        <span>{fillSt(tst("benchTemplate"), { count: String(t.benchCount) })}</span>
                        <span>{t.hasManager ? tst("hasManagerLabel") : tst("noManagerLabel")}</span>
                      </p>
                      {t.description ? (
                        <p className="mt-0.5 line-clamp-2 text-2xs text-text-dim">{t.description}</p>
                      ) : null}

                      <div className="mt-auto flex flex-wrap gap-1 pt-2 text-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            const name = window.prompt(tst("newSquadNamePrompt"), t.templateName);
                            if (name == null) return;
                            const r = createSquadFromTemplate(t.templateId, name);
                            if (r.ok) router.push(`/squads/${r.squad.squadId}`);
                            else setError(r.error);
                          }}
                          className="rounded border border-accent px-2 py-1 text-accent hover:bg-accent/10"
                        >
                          {tst("createFromTemplateButton")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const name = window.prompt(tst("templateNamePrompt"), t.templateName);
                            if (name == null) return;
                            const r = renameTemplate(t.templateId, name);
                            if (r.ok) reload();
                            else setError(r.error);
                          }}
                          className="rounded border border-border px-2 py-1 hover:border-accent"
                        >
                          {tst("renameButton")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(t.templateId)}
                          className="rounded border border-border px-2 py-1 text-danger hover:opacity-80"
                        >
                          {tst("deleteButton")}
                        </button>
                      </div>

                      {confirmId === t.templateId ? (
                        <div className="mt-2 rounded border border-danger/50 bg-surface-2/40 p-2 text-2xs">
                          <p>{fillSt(tst("deleteConfirmTemplate"), { name: t.templateName })}</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                deleteTemplate(t.templateId);
                                setConfirmId(null);
                                reload();
                              }}
                              className="rounded border border-danger px-2 py-1 text-danger"
                            >
                              {tst("deleteConfirmButton")}
                            </button>
                            <button type="button" onClick={() => setConfirmId(null)} className="rounded border border-border px-2 py-1">
                              {tst("cancelDeleteButton")}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Surface>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          <Link href="/squads" className={buttonClasses("secondary", "sm")}>
            {tst("backToSquadListButton")}
          </Link>
        </div>
      </section>
    </div>
  );
}
