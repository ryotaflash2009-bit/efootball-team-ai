"use client";

import type { ManagerContext, ManagerBoosterReason } from "@/lib/progression/types";
import type { ManagerDetail } from "@/lib/managers/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { topTactic, tacticTier, TACTIC_TEXT, managerInitials } from "./tactics";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 選択中の監督の要約カード（育成 / 比較 / スカッドの共通表示）。
 * 監督なしのときは案内 + 「監督一覧から選択」。
 */
export function CurrentManagerCard({
  manager,
  detail,
  reasons,
  onOpenPicker,
  onClear,
  onOpenDetailHref,
  compact = false,
}: {
  manager: ManagerContext | null;
  detail?: ManagerDetail | null;
  reasons: ManagerBoosterReason[];
  onOpenPicker: () => void;
  onClear: () => void;
  /** 監督詳細ページへのリンク（あれば「詳細を見る」を表示） */
  onOpenDetailHref?: string;
  compact?: boolean;
}) {
  const t = useT();
  if (!manager || !manager.internalManagerId) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface/60 p-3 text-sm">
        <p className="font-semibold text-text-dim">{t("manager", "none")}</p>
        <p className="mt-0.5 text-xs text-text-muted">{t("manager", "noneDescription")}</p>
        <Button variant="secondary" size="sm" iconLeft="managers" onClick={onOpenPicker} className="mt-2">
          {t("manager", "selectFromList")}
        </Button>
      </div>
    );
  }

  const prof = manager.tacticalProficiencies
    ? topTactic({
        possessionGame: manager.tacticalProficiencies.possessionGame ?? null,
        quickCounter: manager.tacticalProficiencies.quickCounter ?? null,
        longBallCounter: manager.tacticalProficiencies.longBallCounter ?? null,
        outWide: manager.tacticalProficiencies.outWide ?? null,
        longBall: manager.tacticalProficiencies.longBall ?? null,
        overload: manager.tacticalProficiencies.overload ?? null,
      })
    : null;
  const confirmed = manager.confirmationStatus === "confirmed";

  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm">
      <div className="flex items-start gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-black text-text-dim">
          {managerInitials(manager.managerName ?? "?")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{manager.managerName}</p>
          {prof ? (
            <p className="text-2xs text-text-dim">
              {t("manager", "bestAt")} {prof.en}{" "}
              <span className={`font-bold tabular-nums ${TACTIC_TEXT[tacticTier(prof.value)]}`}>{prof.value}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onOpenPicker} className="rounded border border-border px-2 py-1 text-2xs hover:border-accent">
            {t("manager", "change")}
          </button>
          <button type="button" onClick={onClear} className="rounded border border-border px-2 py-1 text-2xs text-danger hover:opacity-80">
            {t("manager", "clear")}
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs">
        {confirmed ? (
          <p className="text-success">{t("manager", "confirmedBoosterActive")}</p>
        ) : (
          <p className="text-warning">{t("manager", "unconfirmedBoosterNotice")}</p>
        )}
        {reasons.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1">
            {reasons.map((r, i) => (
              <li key={i}>
                <Badge tone="success" size="xs">
                  {r.statNameEn} {r.delta >= 0 ? "+" : ""}
                  {r.delta}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
        {detail?.hasLinkUpPlay || (detail?.linkUpPlays.length ?? 0) > 0 ? (
          <p className="mt-1 flex items-center gap-1 text-info">
            <Icon name="sparkles" size={11} />
            {t("manager", "linkUpPlayAvailable")}
          </p>
        ) : null}
        {!compact ? (
          <p className="mt-1 text-2xs text-text-muted">{t("manager", "applicationOrderUnconfirmed")}</p>
        ) : null}
        {onOpenDetailHref ? (
          <a href={onOpenDetailHref} className="mt-1 inline-flex items-center gap-1 text-2xs text-accent hover:underline">
            {t("manager", "viewManagerDetail")} <Icon name="arrow-right" size={11} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
