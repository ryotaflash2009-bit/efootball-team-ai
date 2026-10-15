"use client";

import "@/lib/i18n/dictionaries/ja-ns/community";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fillMessage } from "@/lib/i18n/message-format";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { listRivals, removeRival, setRivalOptIn, MAX_RIVALS, type RivalRow } from "@/lib/community/community-client";
import { communityClient, communityErrorKey, MessageLine, useCommunityT, useRivalsAvailable, type Message } from "./community-shared";

const signed = (n: number | null) => (n == null ? "—" : n > 0 ? `+${n}` : String(n));

/**
 * F-062 ライバル（オプトイン・2026-10-14）。自分とライバルの、比較に使う診断の総合点と週・月の成長（同じ規則の版の点だけ）を並べる。
 * 使うのをやめると一覧は空になり、相手の一覧からも外れる。
 */
export function RivalsSection({ hasProfile }: { hasProfile: boolean }) {
  const tc = useCommunityT();
  const available = useRivalsAvailable();
  const [rows, setRows] = useState<RivalRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    const supabase = await communityClient();
    if (!supabase) return;
    const r = await listRivals(supabase);
    if (r.ok) setRows(r.data);
    else setMessage({ tone: "error", text: tc(communityErrorKey(r.error)) });
  }, [tc]);

  useEffect(() => {
    if (hasProfile && available) void load();
  }, [hasProfile, available, load]);

  async function run(fn: (s: NonNullable<Awaited<ReturnType<typeof communityClient>>>) => Promise<{ ok: true; data: unknown } | { ok: false; error: Parameters<typeof communityErrorKey>[0] }>, okText: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const supabase = await communityClient();
      if (!supabase) return setMessage({ tone: "error", text: tc("errorGeneric") });
      const r = await fn(supabase);
      setMessage(r.ok ? { tone: "ok", text: okText } : { tone: "error", text: tc(communityErrorKey(r.error)) });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const self = rows?.find((r) => r.isSelf) ?? null;
  const rivals = rows?.filter((r) => !r.isSelf) ?? [];
  const optedIn = self?.optedIn ?? false;

  if (!available) return null;
  return (
    <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="community-rivals">
      <h2 className="font-semibold">{tc("rivalsHeading")}</h2>
      <p className="text-xs text-text-dim">{fillMessage(tc("rivalsBody"), { max: String(MAX_RIVALS) })}</p>
      {!hasProfile ? (
        <p className="text-2xs text-text-muted">{tc("profileRequiredHint")}</p>
      ) : (
        <>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={optedIn}
              disabled={busy || rows == null}
              onChange={(e) => {
                const next = e.target.checked;
                void run((s) => setRivalOptIn(s, next), tc(next ? "rivalsOptedIn" : "rivalsOptedOut"));
              }}
              data-testid="community-rivals-optin"
            />
            {tc("rivalsOptInLabel")}
          </label>
          {optedIn ? (
            <>
              <table className="w-full text-xs" data-testid="community-rivals-table">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-start font-normal">{tc("rivalsColName")}</th>
                    <th className="text-end font-normal">{tc("compareOverall")}</th>
                    <th className="text-end font-normal">{tc("rivalsColWeek")}</th>
                    <th className="text-end font-normal">{tc("rivalsColMonth")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...(self ? [self] : []), ...rivals].map((r) => (
                    <tr key={r.publicId} className="border-t border-border">
                      <td className="py-1">
                        {r.isSelf ? (
                          tc("compareMine")
                        ) : (
                          <Link href={`/u/${r.publicId}`} className="text-accent hover:underline">
                            {r.displayName}
                          </Link>
                        )}
                      </td>
                      <td className="text-end tabular-nums">{r.overall ?? "—"}</td>
                      <td className="text-end tabular-nums">{signed(r.growthWeek)}</td>
                      <td className="text-end tabular-nums">{signed(r.growthMonth)}</td>
                      <td className="text-end">
                        {r.isSelf ? null : (
                          <Button size="sm" variant="secondary" onClick={() => run((s) => removeRival(s, r.publicId), tc("rivalRemoved"))} disabled={busy} data-testid={`community-rival-remove-${r.publicId}`}>
                            {tc("rivalRemoveButton")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rivals.length === 0 ? <p className="text-2xs text-text-muted">{tc("rivalsEmpty")}</p> : null}
              <p className="text-2xs text-text-muted">{tc("rivalsGrowthNotice")}</p>
            </>
          ) : null}
        </>
      )}
      <MessageLine message={message} testId="community-rivals-message" />
    </Surface>
  );
}
