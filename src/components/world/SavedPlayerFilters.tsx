"use client";

import "@/lib/i18n/dictionaries/ja-ns/worldFilters";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import {
  activeSavedFiltersKey,
  deleteFilter,
  loadSavedFilters,
  newSavedFilterId,
  normalizeFilterQuery,
  saveFilter,
  SAVED_FILTER_NAME_MAX,
  type SavedPlayerFilter,
} from "@/lib/world/saved-filters";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

type Msg = { tone: "ok" | "error"; key: keyof Dictionary["worldFilters"] } | null;

/**
 * 選手一覧の保存した絞り込み（NEW-31・2026-10-09）。今の URL の絞り込みを名前つきで端末に保存し、選ぶと同じ条件の一覧へ移る。
 * ダイアログ（window.prompt 等）は使わず、その場の入力欄で名前を入れる。
 */
export function SavedPlayerFilters({ currentQuery }: { currentQuery: string }) {
  const router = useRouter();
  const t = useT();
  const tw = (k: keyof Dictionary["worldFilters"]) => t("worldFilters", k);
  const [items, setItems] = useState<SavedPlayerFilter[]>([]);
  const [selected, setSelected] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const reload = () => setItems(loadSavedFilters(storage(), activeSavedFiltersKey()));
    reload();
    return subscribeCurrentScope(reload);
  }, []);

  const normalizedCurrent = normalizeFilterQuery(currentQuery);
  useEffect(() => {
    // 今の条件と同じ保存があれば、それを選んだ状態にする（別の条件へ移ったら外す）
    setSelected(items.find((x) => x.query === normalizedCurrent)?.id ?? "");
  }, [items, normalizedCurrent]);

  const onSave = () => {
    const r = saveFilter(storage(), activeSavedFiltersKey(), name, currentQuery, new Date().toISOString(), newSavedFilterId);
    if (!r.ok) {
      setMsg({ tone: "error", key: r.reason === "full" ? "savedMsgFull" : r.reason === "empty_query" ? "savedMsgEmpty" : r.reason === "invalid_name" ? "savedMsgName" : "savedMsgStorage" });
      return;
    }
    setItems(r.items);
    setNaming(false);
    setName("");
    setMsg({ tone: "ok", key: r.replaced ? "savedMsgReplaced" : "savedMsgSaved" });
  };

  const onPick = (id: string) => {
    setSelected(id);
    const f = items.find((x) => x.id === id);
    if (f) router.push(f.query ? `/players?${f.query}` : "/players");
  };

  const onDelete = () => {
    if (!selected) return;
    const next = deleteFilter(storage(), activeSavedFiltersKey(), selected);
    if (next) {
      setItems(next);
      setSelected("");
    } else setMsg({ tone: "error", key: "savedMsgStorage" });
  };

  const control = "min-h-[36px] rounded-md border border-border bg-surface px-2 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="saved-player-filters">
      {items.length > 0 ? (
        <>
          <label className="flex items-center gap-1.5">
            <span className="text-text-dim">{tw("savedLabel")}</span>
            <select className={control} value={selected} onChange={(e) => onPick(e.target.value)} data-testid="saved-filter-select">
              <option value="">{tw("savedPlaceholder")}</option>
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <button type="button" className={`${control} text-text-dim hover:border-danger hover:text-danger`} onClick={onDelete} data-testid="saved-filter-delete">
              {tw("savedDeleteButton")}
            </button>
          ) : null}
        </>
      ) : null}
      {naming ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1.5">
            <span className="text-text-dim">{tw("saveNameLabel")}</span>
            <input
              className={`${control} w-40`}
              value={name}
              maxLength={SAVED_FILTER_NAME_MAX}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") setNaming(false);
              }}
              data-testid="saved-filter-name"
            />
          </label>
          <button type="button" className={`${control} border-accent text-accent`} onClick={onSave} data-testid="saved-filter-confirm">
            {tw("saveConfirmButton")}
          </button>
          <button type="button" className={`${control} text-text-dim`} onClick={() => setNaming(false)}>
            {tw("saveCancelButton")}
          </button>
        </span>
      ) : (
        <button
          type="button"
          className={`${control} text-text-dim hover:border-accent`}
          onClick={() => {
            setMsg(null);
            setNaming(true);
          }}
          data-testid="saved-filter-save"
        >
          {tw("saveCurrentButton")}
        </button>
      )}
      <span className="text-2xs text-text-muted">{tw("savedLocalNote")}</span>
      {msg ? (
        <span role="status" aria-live="polite" className={msg.tone === "error" ? "text-danger" : "text-success"}>
          {tw(msg.key)}
        </span>
      ) : null}
    </div>
  );
}
