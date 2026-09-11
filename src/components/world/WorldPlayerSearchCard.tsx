"use client";

import Link from "next/link";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { buildPlayerSearchCardView } from "@/lib/world/search-card";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * 選手検索結果の 1 カード（スカッド検索 / 選手比較検索で共通の表示部分）。
 *
 *  - 表示データは純関数 `buildPlayerSearchCardView`（画像解決は既存 `resolveCardImageSources` を再利用・
 *    外部取得なし・複製保存なし・優先順位はそのまま）。
 *  - 同名選手の別カードを判別できるよう カード画像・カードタイプ・登録ポジション・最大OVR・World ID・
 *    付属ブースターを併記。**名前で重複除去しない。**
 *  - カード全体が 1 個の追加ボタン（`onPick`）。重複時は `disabled` ＋ 理由を文字表示。
 *  - 詳細リンクだけ前面（`z-10`）に出し、追加ボタンへネストしない。
 *  - 色だけで状態・ブースター発動方式を断定しない（必ず文字ラベル）。
 *  - 画像が取得できなくても `WorldCardImage` がプレースホルダー（`PlayerSilhouette`）を出す。追加は可能。
 */
export function WorldPlayerSearchCard({
  player,
  actionLabel,
  onPick,
  disabled = false,
  disabledReason = null,
  imageWidthClass = "w-16 sm:w-20",
  detailInNewTab = true,
}: {
  player: WorldPlayerListItem;
  /** 追加ボタンに出す短いラベル（「LWF へ追加」「1人目へ追加」など） */
  actionLabel: string;
  onPick: () => void;
  disabled?: boolean;
  /** disabled の理由（文字表示・「配置済み: ベンチ」「比較に追加済み」など） */
  disabledReason?: string | null;
  /** カード画像の幅（Tailwind クラス）。PC は 64–88px 相当・モバイルは 56–72px 相当を目安に。 */
  imageWidthClass?: string;
  detailInNewTab?: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const twc = (k: keyof Dictionary["worldPlayerSearchCard"]) => t("worldPlayerSearchCard", k);
  const fillWc = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const v = buildPlayerSearchCardView(player, locale);

  return (
    <li>
      <div
        className={`relative flex gap-2.5 rounded-md border p-2 ${
          disabled ? "border-border/60 bg-surface-2/30 opacity-70" : "border-border bg-surface hover:border-accent"
        }`}
      >
        {/* カード全体を覆う追加ボタン（詳細リンクは z-10 で前面に出す） */}
        <button
          type="button"
          disabled={disabled}
          onClick={onPick}
          aria-label={
            disabled
              ? fillWc(twc("disabledAriaTemplate"), { name: v.name, identity: v.identityLabel, reason: disabledReason ?? twc("cannotAddFallback") })
              : fillWc(twc("enabledAriaTemplate"), { name: v.name, identity: v.identityLabel, action: actionLabel })
          }
          className="absolute inset-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed"
        />

        <div className={`pointer-events-none shrink-0 ${imageWidthClass}`}>
          <WorldCardImage sources={v.imageSources} alt={v.imageAlt} size="card" />
        </div>

        <div className="pointer-events-none min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold" title={v.name}>
              {v.name}
            </p>
            <span className="shrink-0 text-sm font-black text-accent tabular-nums" title={twc("ovrTooltip")}>
              {v.ovr ?? "–"}
            </span>
          </div>
          <p className="truncate text-2xs text-text-dim">{v.nameEn || twc("noEnglishName")}</p>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            {v.registeredPosition ? <Badge tone="neutral" size="xs">{v.registeredPosition}</Badge> : null}
            {v.cardType ? <Badge tone="outline" size="xs">{v.cardType}</Badge> : null}
            <span className="text-2xs text-text-muted">{fillWc(twc("maxOvrLabel"), { value: String(v.ovr ?? "—") })}</span>
            {v.maximumLevel != null ? (
              <span className="text-2xs text-text-muted">{fillWc(twc("levelCapLabel"), { value: String(v.maximumLevel) })}</span>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-2xs text-text-muted">{v.teamLine || twc("noTeamInfo")}</p>
          <p className="mt-0.5 text-2xs text-text-muted">
            World ID <span className="tabular-nums">{v.worldCardId}</span>
            {v.playingStyle ? ` · ${v.playingStyle}` : ""}
          </p>

          {v.boosterChips.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1">
              {v.boosterChips.map((b, i) => (
                <li key={i}>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold ${
                      b.kind === "pom"
                        ? "bg-warning/15 text-warning"
                        : b.kind === "fixed"
                          ? "bg-info/15 text-info"
                          : "bg-surface-3 text-text-dim"
                    }`}
                    title={
                      b.kind === "pom"
                        ? twc("pomTooltip")
                        : b.kind === "fixed"
                          ? b.provisional
                            ? twc("fixedProvisionalTooltip")
                            : twc("fixedTooltip")
                          : twc("unresolvedTooltip")
                    }
                  >
                    {b.kind === "pom"
                      ? fillWc(twc("pomChipTemplate"), { nameEn: b.nameEn, level: String(b.level) })
                      : b.kind === "fixed"
                        ? fillWc(b.provisional ? twc("fixedProvisionalChipTemplate") : twc("fixedChipTemplate"), {
                            nameEn: b.nameEn,
                            level: String(b.level),
                          })
                        : twc("unresolvedChip")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[9px] text-text-muted">{twc("noAttachedBoosters")}</p>
          )}

          <div className="pointer-events-auto relative z-10 mt-1.5 flex items-center gap-2">
            {disabled ? (
              <span className="text-2xs text-text-dim">{disabledReason ?? twc("cannotAddFallback")}</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-accent px-2 py-0.5 text-2xs font-semibold text-accent">
                <Icon name="plus" size={12} />
                {actionLabel}
              </span>
            )}
            <Link
              href={`/players/world/${encodeURIComponent(v.worldCardId)}`}
              {...(detailInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="ml-auto text-2xs text-text-dim underline hover:text-accent"
            >
              {twc("detailLink")}
              {detailInNewTab ? twc("detailNewTabSuffix") : ""}
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
