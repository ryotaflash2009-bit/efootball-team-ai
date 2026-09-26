"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { tierBadgeTone, tierBarClass } from "./diagnosis-tier-style";
import { ABILITY_CATEGORIES, type SquadDiagnosisCategoryId } from "@/lib/squad/squad-diagnosis";
import { CATEGORY_LABEL_EN } from "@/lib/squad/squad-diagnosis-image";
import {
  SHARE_CATEGORY_IDS,
  decodeShareToken,
  isCurrentRulesVersion,
  type ShareDecodeFailure,
  type ShareFinding,
  type SquadDiagnosisSharePayloadV1,
} from "@/lib/squad/squad-diagnosis-share-url";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Locale } from "@/lib/i18n/locale";

type ViewState = { status: "loading" } | { status: "ok"; payload: SquadDiagnosisSharePayloadV1 } | { status: "error"; reason: ShareDecodeFailure };

const JA_LABEL = new Map<string, string>(ABILITY_CATEGORIES.map((c) => [c.id, c.label]));

export function diagnosisCategoryLabel(id: SquadDiagnosisCategoryId, locale: Locale): string {
  if (locale === "en") return CATEGORY_LABEL_EN[id] ?? id;
  return id === "squadCompleteness" ? "選手配置の充足状況" : (JA_LABEL.get(id) ?? id);
}

/**
 * 共有されたスカッド診断の表示（読み取り専用）。
 * - 共有データは URL の fragment だけから読む（サーバーへ送られない・保存しない・書き込みなし）。
 * - 失敗時は理由の種類だけを表示し、URL の内容は画面へ反映しない。
 * - hashchange（戻る/進む・同じページでのURL変更）でも読み直す。
 */
export function SharedDiagnosisView() {
  const t = useT();
  const { locale } = useLocale();
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    const read = () => {
      const r = decodeShareToken(window.location.hash);
      setState(r.ok ? { status: "ok", payload: r.payload } : { status: "error", reason: r.reason });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const s = (k: Parameters<typeof t<"diagnosisShare">>[1]) => t("diagnosisShare", k);

  if (state.status === "loading") {
    return (
      <p role="status" className="mt-6 text-sm text-text-dim">
        {s("loading")}
      </p>
    );
  }

  if (state.status === "error") {
    const body = state.reason === "unsupported_version" ? s("unsupportedBody") : state.reason === "empty" ? s("emptyBody") : s("invalidBody");
    return (
      <div className="mt-6" data-share-state="error" data-share-reason={state.reason}>
        <PageHeader title={s("invalidTitle")} icon="squad" />
        <p className="mt-4 text-sm text-text-dim">{body}</p>
        <Link href="/" className={`${buttonClasses("secondary", "sm")} mt-4`}>
          {s("openSite")}
        </Link>
      </div>
    );
  }

  const p = state.payload;
  const findingText = (f: ShareFinding | null, strong: boolean): string => {
    if (!f) return s("none");
    const [kind, cat] = f;
    if (kind === "ability" && cat) return (strong ? s("findingAbilityHigh") : s("findingAbilityLow")).replace("{category}", diagnosisCategoryLabel(cat, locale));
    if (kind === "compatibility") return s("findingCompatibility");
    if (kind === "referenceError") return s("findingReferenceError");
    return s("findingConfig");
  };

  return (
    <div className="mt-6 flex flex-col gap-4" data-share-state="ok">
      <PageHeader title={s("pageTitle")} icon="squad" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-dim">
        <Badge tone="outline" size="xs">
          {s("readOnlyBadge")}
        </Badge>
        <span>
          {s("diagnosedOn")}: {p.d}
        </span>
        {p.f ? (
          <span>
            {s("formation")}: {p.f}
          </span>
        ) : null}
      </div>
      {!isCurrentRulesVersion(p) ? (
        <p role="note" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-text">
          {s("olderRules").replace("{version}", p.r)}
        </p>
      ) : null}

      <section className="rounded-card border border-border bg-surface p-4" aria-label={s("overall")}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{s("overall")}</h2>
          {p.o[0] == null ? (
            <span className="text-sm text-text-muted">{s("notRated")}</span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-2xl font-black tabular-nums">{p.o[0]}</span>
              <Badge tone={tierBadgeTone(p.o[1])} size="sm">
                {p.o[1]}
              </Badge>
            </span>
          )}
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold">{s("categoriesHeading")}</h2>
        <ul className="flex flex-col gap-2">
          {SHARE_CATEGORY_IDS.map((id) => {
            const [score, tier] = p.c[id];
            return (
              <li key={id} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-dim">{diagnosisCategoryLabel(id, locale)}</span>
                  {score == null ? (
                    <span className="text-text-muted">{s("notRated")}</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold tabular-nums">{score}</span>
                      <Badge tone={tierBadgeTone(tier)} size="xs">
                        {tier}
                      </Badge>
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className={`h-full rounded-full ${tierBarClass(tier)}`} style={{ width: `${Math.max(2, score ?? 0)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold text-success">{s("strength")}</h2>
          <p className="mt-1 text-sm">{findingText(p.s, true)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold text-danger">{s("weakness")}</h2>
          <p className="mt-1 text-sm">{findingText(p.w, false)}</p>
        </div>
      </section>

      <p className="text-2xs text-text-muted">{s("sharedNote")}</p>
      <p className="text-2xs text-text-muted">{s("disclaimer")}</p>
      <Link href="/" className={`${buttonClasses("secondary", "sm")} self-start`}>
        {s("openSite")}
      </Link>
    </div>
  );
}
