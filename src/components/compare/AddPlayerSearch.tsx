"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { COMPARISON_MAX } from "@/lib/comparison/types";
import { sortSearchResults } from "@/lib/squad/search-results";
import { WorldPlayerSearchCard } from "@/components/world/WorldPlayerSearchCard";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { isSearchInputRejectedResponse } from "@/lib/search/search-input";

/**
 * 比較へ追加する選手を検索して選ぶ（World 13,009件・既存 SQLite API）。
 *  - 検索結果はカード画像付き（`WorldPlayerSearchCard`・スカッド検索と共通）。同名選手の別カード
 *    （別 worldCardId）を画像・タイプ・OVR・World ID で判別できる。
 *  - 一度に全件は送らない（`pageSize=20`・最小 2 文字）。クリック / タップ / Enter / Space で追加。
 *  - 連続入力時、古いレスポンスが新しい結果を上書きしないよう `reqIdRef` で破棄。
 *  - 追加は `onAdd` が成功（`true`）を返したときだけパネルを閉じる（`onClose`）。
 *  - 既存の比較計算・URL 生成・監督・育成には一切触れない（追加先 worldCardId を渡すだけ）。
 */

const MIN_QUERY_LEN = 2;

type SearchState =
  | { kind: "idle" }
  | { kind: "tooShort" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "rejected" }
  | { kind: "results"; players: WorldPlayerListItem[] };

export function AddPlayerSearch({
  existingIds,
  targetIndex,
  onAdd,
  onClose,
}: {
  /** すでに比較に入っている worldCardId（重複追加を拒否） */
  existingIds: string[];
  /** 追加先の比較枠（0 始まり・表示は targetIndex + 1 人目） */
  targetIndex: number;
  /** 追加処理。成功で true。失敗時はパネルを閉じない。 */
  onAdd: (worldCardId: string) => Promise<boolean>;
  /** パネルを閉じる（成功時 / 閉じる操作 / Escape）。呼び出し側でフォーカスを戻す。 */
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [picking, setPicking] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);
  const lastQueryRef = useRef("");
  const t = useT();
  const tas = useCallback((k: keyof Dictionary["addPlayerSearch"]) => t("addPlayerSearch", k), [t]);
  const fillAs = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s),
    [],
  );

  const slotLabel = fillAs(t("compareRadarChart", "personOrdinalTemplate"), { n: String(targetIndex + 1) });
  const existing = useMemo(() => new Set(existingIds), [existingIds]);
  const full = targetIndex >= COMPARISON_MAX;

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const runSearch = useCallback(async (raw: string) => {
    const v = raw.trim();
    lastQueryRef.current = v;
    if (!v) return setState({ kind: "idle" });
    if (v.length < MIN_QUERY_LEN) return setState({ kind: "tooShort" });

    const reqId = ++reqIdRef.current;
    setState({ kind: "loading" });
    try {
      const r = await fetch(`/api/world/players?q=${encodeURIComponent(v)}&pageSize=20&sort=ovr_max_desc`);
      if (!r.ok) {
        // 検索語が拒否された(制御文字等・上流の防御)場合は、通信失敗とは別の安全な案内を出す。
        const body = await r.json().catch(() => null);
        if (reqId !== reqIdRef.current) return;
        if (isSearchInputRejectedResponse(r.status, body)) return setState({ kind: "rejected" });
        throw new Error(`HTTP ${r.status}`);
      }
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

  const pick = useCallback(
    async (worldCardId: string) => {
      if (picking) return;
      setAddError(null);
      setPicking(worldCardId);
      try {
        const ok = await onAdd(worldCardId);
        if (ok) {
          onClose();
        } else {
          setAddError(tas("addFailedError"));
        }
      } finally {
        setPicking(null);
      }
    },
    [onAdd, onClose, picking, tas],
  );

  const sorted = useMemo(
    () => (state.kind === "results" ? sortSearchResults(state.players, lastQueryRef.current, null) : []),
    [state],
  );

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{fillAs(tas("selectCardHeadingTemplate"), { slot: slotLabel })}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-border px-2 py-0.5 text-xs text-text-dim hover:text-text"
        >
          {tas("closeButton")}
        </button>
      </div>

      {full ? (
        <p className="text-xs text-text-dim">
          {fillAs(tas("maxPlayersNoteTemplate"), { max: String(COMPARISON_MAX) })}
        </p>
      ) : (
        <>
          <input
            type="search"
            value={q}
            maxLength={100}
            autoFocus
            onChange={(e) => onChange(e.target.value)}
            placeholder={tas("searchPlaceholder")}
            aria-label={fillAs(tas("searchAriaLabelTemplate"), { slot: slotLabel })}
            className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
          />
          <p className="mt-1 text-2xs text-text-dim/80">{tas("duplicateNote")}</p>

          {addError ? (
            <p role="alert" className="mt-1 text-xs text-danger">
              {addError}
            </p>
          ) : null}

          <div aria-live="polite" className="mt-2">
            {state.kind === "idle" ? (
              <p className="text-xs text-text-dim">
                {fillAs(tas("minLengthPromptTemplate"), { min: String(MIN_QUERY_LEN) })}
              </p>
            ) : state.kind === "tooShort" ? (
              <p className="text-xs text-text-dim">
                {fillAs(tas("tooShortTemplate"), { remaining: String(MIN_QUERY_LEN - q.trim().length) })}
              </p>
            ) : state.kind === "loading" ? (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <li key={i} className="h-28 animate-pulse rounded-md border border-border bg-surface-2/40" />
                ))}
              </ul>
            ) : state.kind === "rejected" ? (
              <p role="alert" className="text-xs text-warning">
                {t("searchInput", "rejectedTitle")}: {t("searchInput", "rejectedDescription")}
              </p>
            ) : state.kind === "error" ? (
              <div className="text-xs">
                <p role="alert" className="text-danger">
                  {tas("searchFailedError")}
                </p>
                <button
                  type="button"
                  onClick={() => runSearch(lastQueryRef.current || q)}
                  className="mt-1 rounded border border-border px-2 py-0.5 hover:border-accent"
                >
                  {tas("retryButton")}
                </button>
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-xs text-text-dim">{tas("noResults")}</p>
            ) : (
              <>
                <p className="mb-1.5 text-2xs text-text-muted">{fillAs(tas("resultCountTemplate"), { count: String(sorted.length) })}</p>
                <ul className="grid max-h-[55vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                  {sorted.map((p) => {
                    const dup = existing.has(p.worldCardId);
                    return (
                      <WorldPlayerSearchCard
                        key={p.worldCardId}
                        player={p}
                        actionLabel={picking === p.worldCardId ? tas("addingLabel") : fillAs(tas("addToSlotTemplate"), { slot: slotLabel })}
                        onPick={() => pick(p.worldCardId)}
                        disabled={dup || picking != null}
                        disabledReason={dup ? tas("alreadyAddedReason") : picking != null ? tas("processingReason") : null}
                      />
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
