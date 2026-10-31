"use client";

import "@/lib/i18n/dictionaries/ja-ns/playerDetailPage";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { formatDateTime } from "@/lib/i18n/format";
import { realFormMatchesCard, viewSeason, type RealForm } from "@/lib/dev/real-form";

type State = { kind: "loading" } | { kind: "unavailable" } | { kind: "mismatch"; form: RealForm } | { kind: "ok"; form: RealForm };

/**
 * 開発用: 現実の今季成績（参考・2026-10-31）。内部ページを有効にしたビルドでだけ置く（呼び出し側が判定）。
 * /api/dev/real-form（このPCのサッカー AI）を読み、名前と国籍がカードと一致したときだけ成績を出す。計算には使わない。
 */
export function RealFormPanel({ nameEn, nationality }: { nameEn: string | null; nationality: string | null }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"playerDetailPage">>[1]) => t("playerDetailPage", k);
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    if (!nameEn) {
      setState({ kind: "unavailable" });
      return;
    }
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetch(`/api/dev/real-form?name=${encodeURIComponent(nameEn)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; form?: RealForm } | null) => {
        if (!j?.ok || !j.form) return setState({ kind: "unavailable" });
        setState(realFormMatchesCard(j.form, { nameEn, nationality }) ? { kind: "ok", form: j.form } : { kind: "mismatch", form: j.form });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "unavailable" });
      });
    return () => controller.abort();
  }, [nameEn, nationality]);

  if (state.kind === "loading") return null;
  return (
    <details className="rounded-card border border-dashed border-border bg-surface p-3 text-sm" data-testid="real-form" data-state={state.kind}>
      <summary className="flex min-h-[36px] cursor-pointer items-center font-semibold">{tp("realFormHeading")}</summary>
      {state.kind === "unavailable" ? (
        <p className="mt-1 text-xs text-text-dim">{tp("realFormUnavailable")}</p>
      ) : state.kind === "mismatch" ? (
        <p className="mt-1 text-xs text-warning">{fillMessage(tp("realFormMismatchTemplate"), { name: state.form.name, nationality: state.form.nationality ?? "—" })}</p>
      ) : (
        <RealFormBody form={state.form} />
      )}
    </details>
  );

}

function RealFormBody({ form }: { form: RealForm }) {
  const t = useT();
  const { displayLocale } = useLocale();
  const tp = (k: Parameters<typeof t<"playerDetailPage">>[1]) => t("playerDetailPage", k);
  const season = viewSeason(form.season, new Date());
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <p className="text-xs text-text-dim">
        {[form.team, form.position, season.label].filter(Boolean).join(" · ")}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
        {form.stats.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-text-muted">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {season.futureYearRemoved ? <p className="text-2xs text-text-muted">{tp("realFormFutureYear")}</p> : null}
      {season.stale ? <p className="text-2xs text-warning">{tp("realFormStale")}</p> : null}
      <p className="text-2xs text-text-muted">
        {fillMessage(tp("realFormNoteTemplate"), { source: form.source, time: formatDateTime(new Date(form.fetchedAt), displayLocale) })}
      </p>
    </div>
  );
}
