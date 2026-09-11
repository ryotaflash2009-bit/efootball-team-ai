"use client";

import type {
  PlayerBoosterInfo,
  SelectedConditionalBooster,
  ConditionalBoosterSelection,
} from "@/lib/progression/types";
import { Badge } from "@/components/ui/Badge";
import { BoosterIcon, boosterIconVariant } from "./BoosterIcon";
import { FixedBoosterChip } from "./FixedBoosterDetails";
import { ConditionalBoosterControl } from "./ConditionalBoosterControl";

/**
 * 選手カード周辺のカード付属ブースター表示（コンパクト）。
 *  - 固定型（青）: ロゴ + 名称 + 効果説明ダイアログ（数値変更なし）
 *  - Power of Many 型（金）: ロゴ + 名称 + 段階指定コントロール（+0/+1/+2/+3）
 *  - 未解決: ロゴ + 「未解決」＋理由
 * 付属が 1 つならその 1 つだけ、付属なしなら空スロットを出さない。
 */
export function BoosterStrip({
  attached,
  conditionalSelections = [],
  onConditionalChange,
  idPrefix = "strip",
}: {
  attached: PlayerBoosterInfo[];
  conditionalSelections?: SelectedConditionalBooster[];
  onConditionalChange?: (next: SelectedConditionalBooster[]) => void;
  idPrefix?: string;
}) {
  const condBySel = new Map(conditionalSelections.map((c) => [c.boosterKey, c.selection]));
  function setConditional(boosterKey: string, sel: ConditionalBoosterSelection) {
    const rest = conditionalSelections.filter((c) => c.boosterKey !== boosterKey);
    onConditionalChange?.(sel === "none" ? rest : [...rest, { boosterKey, selection: sel }]);
  }

  if (attached.length === 0) {
    return (
      <p className="text-2xs text-text-muted">このカードに付属するブースターはありません。</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attached.map((b) => {
        const resolved = b.boosterNameEn != null;
        const variant = boosterIconVariant({
          activationType: b.activationType,
          resolved,
          autoApplied: b.autoApplied,
          evidenceLevel: b.evidenceLevel,
        });
        const name = b.boosterNameJa
          ? `${b.boosterNameJa}（${b.boosterNameEn}）`
          : b.boosterNameEn;

        // ── Power of Many（金色）
        if (b.activationType === "power_of_many" && b.boosterKey && onConditionalChange) {
          return (
            <div key={b.slot} className="flex min-w-[15rem] flex-1 items-start gap-2">
              <BoosterIcon variant="power_of_many" className="mt-1" />
              <div className="min-w-0 flex-1">
                <ConditionalBoosterControl
                  boosterId={b.boosterId}
                  nameEn={b.boosterNameEn}
                  nameJa={b.boosterNameJa}
                  level={b.level}
                  affectedStats={b.affectedStats}
                  selection={condBySel.get(b.boosterKey) ?? "none"}
                  onChange={(sel) => setConditional(b.boosterKey!, sel)}
                  compact
                  idPrefix={`${idPrefix}-${b.slot}`}
                />
              </div>
            </div>
          );
        }

        // ── 固定型（青） / 検証中
        if (resolved) {
          const provisional = b.activationConfirmed === false;
          return (
            <FixedBoosterChip key={b.slot} booster={b}>
              <BoosterIcon variant={variant} size={18} />
              <span className="font-semibold">
                {name}
                {b.level != null ? ` +${b.level}` : ""}
              </span>
              <Badge tone={provisional ? "warning" : b.autoApplied ? "info" : "warning"} size="xs">
                {b.autoApplied
                  ? provisional
                    ? "固定型・推定・適用中"
                    : "固定型・適用中"
                  : "固定型・検証中"}
              </Badge>
              <span className="text-2xs text-text-muted">効果を見る ▸</span>
            </FixedBoosterChip>
          );
        }

        // ── 未解決
        return (
          <div
            key={b.slot}
            className="flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-2 py-1.5 text-xs"
          >
            <BoosterIcon variant="unresolved" size={18} />
            <span className="text-text-dim">ID {b.boosterId}</span>
            <Badge tone="warning" size="xs">
              未解決・未適用
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
