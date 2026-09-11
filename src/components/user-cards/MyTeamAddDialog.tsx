"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { TagEditor } from "./TagEditor";
import { addToMyTeam, updateMyTeamRecord } from "@/lib/user-cards/my-team-storage";
import {
  OWNERSHIP_STATUSES,
  USAGE_STATUSES,
  type OwnershipStatus,
  type UsageStatus,
  type MyTeamRecord,
} from "@/lib/user-cards/types";
import { NOTE_MAX_LEN, sanitizeNote } from "@/lib/user-cards/validation";
import { useOwnershipLabels, useUsageLabels } from "./UserCardTile";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * My Team への追加 / 編集ダイアログ。所有状態・使用状態・メモ・タグ。
 * 既定: ownershipStatus = owned / usageStatus = unknown。
 * 「My Team へ追加」＝お気に入りへ自動追加はしない（独立管理）。
 */
export function MyTeamAddDialog({
  worldCardId,
  playerName,
  open,
  onClose,
  editRecord,
  onDone,
}: {
  worldCardId: string;
  playerName: string;
  open: boolean;
  onClose: () => void;
  /** 指定すると編集モード。 */
  editRecord?: MyTeamRecord | null;
  onDone?: () => void;
}) {
  const editing = editRecord != null;
  const [ownership, setOwnership] = useState<OwnershipStatus>(editRecord?.ownershipStatus ?? "owned");
  const [usage, setUsage] = useState<UsageStatus>(editRecord?.usageStatus ?? "unknown");
  const [note, setNote] = useState(editRecord?.note ?? "");
  const [tags, setTags] = useState<string[]>(editRecord?.tags ?? []);
  const [err, setErr] = useState<string | null>(null);
  const noteLen = sanitizeNote(note).length;
  const t = useT();
  const tad = (k: keyof Dictionary["myTeamAddDialog"]) => t("myTeamAddDialog", k);
  const fillAd = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const OWNERSHIP_LABELS = useOwnershipLabels();
  const USAGE_LABELS = useUsageLabels();

  function save() {
    if (editing && editRecord) {
      const r = updateMyTeamRecord(editRecord.teamCardId, {
        ownershipStatus: ownership,
        usageStatus: usage,
        note,
        tags,
      });
      if (!r.ok) return setErr(r.error ?? tad("saveFailedFallback"));
    } else {
      const r = addToMyTeam({ worldCardId, ownershipStatus: ownership, usageStatus: usage, note, tags });
      if (!r.ok) return setErr(r.error ?? tad("saveFailedFallback"));
    }
    setErr(null);
    onDone?.();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? tad("editTitle") : tad("addTitle")} size="sm">
      <div className="space-y-3 text-sm">
        <p className="text-xs text-text-dim">
          {fillAd(editing ? tad("introEditTemplate") : tad("introAddTemplate"), { playerName, worldCardId })}
        </p>

        <Select
          label={tad("ownershipLabel")}
          value={ownership}
          onChange={(e) => setOwnership(e.target.value as OwnershipStatus)}
        >
          {OWNERSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OWNERSHIP_LABELS[s]}
            </option>
          ))}
        </Select>

        <Select label={tad("usageLabel")} value={usage} onChange={(e) => setUsage(e.target.value as UsageStatus)}>
          {USAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {USAGE_LABELS[s]}
            </option>
          ))}
        </Select>
        <p className="-mt-1 text-2xs text-text-muted">{tad("usageNote")}</p>

        <div className="flex flex-col gap-1">
          <label htmlFor="myteam-note" className="text-xs font-medium text-text-dim">
            {fillAd(tad("noteLabelTemplate"), { max: String(NOTE_MAX_LEN) })}
          </label>
          <textarea
            id="myteam-note"
            value={note}
            maxLength={NOTE_MAX_LEN + 20}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tad("notePlaceholder")}
            className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
          />
          <p className="text-right text-2xs text-text-muted">
            {fillAd(tad("noteCountTemplate"), { count: String(noteLen), max: String(NOTE_MAX_LEN) })}
          </p>
        </div>

        <TagEditor tags={tags} onChange={setTags} idPrefix="myteam" />

        {err ? <p className="text-2xs text-danger" role="alert">{err}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tad("cancelButton")}
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            {editing ? tad("saveButton") : tad("addButton")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
