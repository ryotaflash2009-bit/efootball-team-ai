"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { sortSearchResults } from "@/lib/squad/search-results";
import { SquadPlayerSearchCard } from "./SquadPlayerSearchCard";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 選手検索（World 13,009件・既存 SQLite API）。
 *  - 一度に全件は送らない（pageSize=20）。ドラッグ非依存＝クリック/タップで追加。
 *  - 結果はカード画像付きで表示し、同名選手の別カード（別 worldCardId）を判別できるようにする。
 *  - 画像は既存の解決処理を再利用（外部取得なし・複製保存なし）。
 */

const MIN_QUERY_LEN = 2;

type SearchState =
  | { kind: "idle" }
  | { kind: "tooShort" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "results"; players: WorldPlayerListItem[] };

export function PlayerSearchPanel({
  title,
  targetLabel,
  targetPosition,
  placedIds,
  onPick,
  onClose,
  placedLabel,
}: {
  title: string;
  /** 追加ボタンに出す短いラベル（「LWF へ追加」「ベンチへ追加」など） */
  targetLabel: string;
  /** 対象スロットの表示ポジション（並び替えのヒント・ベンチは null） */
  targetPosition?: string | null;
  /** すでに配置済みの worldCardId（重複配置を拒否） */
  placedIds: Set<string>;
  onPick: (worldCardId: string) => void;
  onClose?: () => void;
  /** worldCardId → 配置場所ラベル（重複時に表示） */
  placedLabel?: (worldCardId: string) => string | null;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  const lastQueryRef = useRef("");
  const t = useT();
  const fillPs = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const runSearch = useCallback(async (raw: string) => {
    const v = raw.trim();
    lastQueryRef.current = v;
    if (!v) return setState({ kind: "idle" });
    if (v.length < MIN_QUERY_LEN) return setState({ kind: "tooShort" });

    const reqId = ++reqIdRef.current;
    setState({ kind: "loading" });
    try {
      const r = await fetch(
        `/api/world/players?q=${encodeURIComponent(v)}&pageSize=20&sort=ovr_max_desc`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (reqId !== reqIdRef.current) return; // 古いレスポンスは破棄
      setState({ kind: "results", players: Array.isArray(data.players) ? data.players : [] });
    } catch {
      if (reqId !== reqIdRef.current) return;
      setState({ kind: "error" });
    }
  }, []);

  function onChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  // 並び替え: 名前一致 → 対象ポジション一致 → API 順（OVR 高い順）→ World ID 安定
  const sorted = useMemo(
    () =>
      state.kind === "results"
        ? sortSearchResults(state.players, lastQueryRef.current, targetPosition)
        : [],
    [state, targetPosition],
  );

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border px-2 py-0.5 text-xs text-text-dim hover:text-text"
          >
            {t("addPlayerSearch", "closeButton")}
          </button>
        ) : null}
      </div>

      <input
        type="search"
        value={q}
        maxLength={100}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("addPlayerSearch", "searchPlaceholder")}
        aria-label={t("playerSearchPanel", "searchAriaLabel")}
        className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
      />

      <p className="mt-1 text-2xs text-text-dim/80">
        {t("playerSearchPanel", "duplicateNotePrefix")}
        {targetPosition
          ? fillPs(t("playerSearchPanel", "sortNoteWithPositionTemplate"), { position: targetPosition })
          : t("playerSearchPanel", "sortNoteDefault")}
      </p>

      <div aria-live="polite" className="mt-2">
        {state.kind === "idle" ? (
          <p className="text-xs text-text-dim">
            {fillPs(t("addPlayerSearch", "minLengthPromptTemplate"), { min: String(MIN_QUERY_LEN) })}
          </p>
        ) : state.kind === "tooShort" ? (
          <p className="text-xs text-text-dim">
            {fillPs(t("addPlayerSearch", "tooShortTemplate"), { remaining: String(MIN_QUERY_LEN - q.trim().length) })}
          </p>
        ) : state.kind === "loading" ? (
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-24 animate-pulse rounded-md border border-border bg-surface-2/40" />
            ))}
          </ul>
        ) : state.kind === "error" ? (
          <div className="text-xs">
            <p className="text-danger">{t("addPlayerSearch", "searchFailedError")}</p>
            <button
              type="button"
              onClick={() => runSearch(lastQueryRef.current || q)}
              className="mt-1 rounded border border-border px-2 py-0.5 hover:border-accent"
            >
              {t("addPlayerSearch", "retryButton")}
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-text-dim">{t("addPlayerSearch", "noResults")}</p>
        ) : (
          <>
            <p className="mb-1.5 text-2xs text-text-muted">
              {fillPs(t("addPlayerSearch", "resultCountTemplate"), { count: String(sorted.length) })}
            </p>
            <ul className="grid max-h-[55vh] grid-cols-1 gap-2 overflow-y-auto lg:grid-cols-2 2xl:grid-cols-3">
              {sorted.map((p) => (
                <SquadPlayerSearchCard
                  key={p.worldCardId}
                  player={p}
                  targetLabel={targetLabel}
                  duplicate={placedIds.has(p.worldCardId)}
                  duplicateWhere={placedIds.has(p.worldCardId) && placedLabel ? placedLabel(p.worldCardId) : null}
                  onPick={() => onPick(p.worldCardId)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
