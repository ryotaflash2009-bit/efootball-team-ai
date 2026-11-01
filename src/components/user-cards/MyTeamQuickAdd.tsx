"use client";

import "@/lib/i18n/dictionaries/ja-ns/myTeam";
import "@/lib/i18n/dictionaries/ja-ns/myTeamButton";
import "@/lib/i18n/dictionaries/ja-ns/addPlayerSearch";
import "@/lib/i18n/dictionaries/ja-ns/searchInput";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { WorldPlayerSearchCard } from "@/components/world/WorldPlayerSearchCard";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { addToMyTeam } from "@/lib/user-cards/my-team-storage";
import { isSearchInputRejectedResponse } from "@/lib/search/search-input";
import { playersWithProvisional } from "@/lib/world/search-with-provisional";

const MIN_QUERY_LEN = 2;
type State = { kind: "idle" } | { kind: "loading" } | { kind: "error" } | { kind: "rejected" } | { kind: "results"; players: WorldPlayerListItem[] };

/**
 * My Team: カードを探して「所持」で追加（2026-11-01）。選手の一覧やカードの画面へ移らずに、まとめて登録できるようにする。
 * 登録済みのカードは押せない（状態の変更は一覧の「編集」で）。検索は選手の比較・スカッドと同じ API。
 */
export function MyTeamQuickAdd({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const t = useT();
  const { getByWorldId } = useMyTeam();
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const reqId = useRef(0);
  useEffect(() => {
    const v = q.trim();
    if (v.length < MIN_QUERY_LEN) {
      setState({ kind: "idle" });
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      setState({ kind: "loading" });
      const r = await fetch(`/api/world/players?q=${encodeURIComponent(v)}&pageSize=12&sort=ovr_max_desc`).catch(() => null);
      if (id !== reqId.current) return;
      if (!r) return setState({ kind: "error" });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        if (id !== reqId.current) return;
        return setState({ kind: isSearchInputRejectedResponse(r.status, body) ? "rejected" : "error" });
      }
      const json = (await r.json().catch(() => null)) as { players?: WorldPlayerListItem[] } | null;
      if (id !== reqId.current) return;
      // 暫定のカード（正式なデータの反映前）も登録できるように、検索に合うものを後ろに足す（2026-11-01）
      setState(json ? { kind: "results", players: playersWithProvisional(json) } : { kind: "error" });
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <details className="rounded-card border border-border bg-surface p-3" data-testid="my-team-quick-add" open={defaultOpen}>
      <summary className="flex min-h-[36px] cursor-pointer items-center text-sm font-semibold">{t("myTeam", "quickAddHeading")}</summary>
      <input
        type="search"
        value={q}
        maxLength={100}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("addPlayerSearch", "searchPlaceholder")}
        aria-label={t("myTeam", "quickAddHeading")}
        className="mt-2 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
        data-testid="my-team-quick-add-input"
      />
      <div aria-live="polite" className="mt-2">
        {state.kind === "idle" ? (
          <p className="text-xs text-text-dim">{fillMessage(t("addPlayerSearch", "minLengthPromptTemplate"), { min: String(MIN_QUERY_LEN) })}</p>
        ) : state.kind === "loading" ? (
          <p className="text-xs text-text-dim">…</p>
        ) : state.kind === "rejected" ? (
          <p role="alert" className="text-xs text-warning">
            {t("searchInput", "rejectedTitle")}: {t("searchInput", "rejectedDescription")}
          </p>
        ) : state.kind === "error" ? (
          <p className="text-xs text-danger">{t("addPlayerSearch", "searchFailedError")}</p>
        ) : state.players.length === 0 ? (
          <p className="text-xs text-text-dim">{t("addPlayerSearch", "noResults")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {state.players.map((p) => {
              const registered = !!getByWorldId(p.worldCardId);
              return (
                <WorldPlayerSearchCard
                  key={p.worldCardId}
                  player={p}
                  actionLabel={t("myTeam", "quickAddAction")}
                  onPick={() => addToMyTeam({ worldCardId: p.worldCardId, ownershipStatus: "owned" })}
                  disabled={registered}
                  disabledReason={registered ? t("myTeamButton", "registeredLabel") : null}
                />
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
