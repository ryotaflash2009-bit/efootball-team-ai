"use client";

import { useState, type ReactNode } from "react";
import type { PlayerBoosterInfo } from "@/lib/progression/types";
import { getStatDef } from "@/lib/world/stats";
import { statLabelJa } from "@/lib/world/stat-labels";
import { Modal } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { BoosterIcon } from "./BoosterIcon";

/**
 * 固定（青色）ブースターの効果説明ダイアログ。**数値変更 UI は出さない**。
 * カード本来の付属ブースターであることと、対象能力ごとの上昇量・証拠レベル・適用状況を示すだけ。
 */

function evidenceText(level: string): { text: string; tone: "success" | "info" | "warning" } {
  switch (level) {
    case "game_client_verified":
    case "screenshot_verified":
      return { text: "参考画面で実測確認", tone: "success" };
    case "external_cross_verified":
      return { text: "外部照合済み（KONAMI 公式未確認）", tone: "info" };
    default:
      return { text: "効果検証中", tone: "warning" };
  }
}

export function FixedBoosterDetails({
  booster,
  open,
  onClose,
}: {
  booster: PlayerBoosterInfo;
  open: boolean;
  onClose: () => void;
}) {
  const name = booster.boosterNameJa
    ? `${booster.boosterNameJa}（${booster.boosterNameEn}）`
    : booster.boosterNameEn ?? "ブースター";
  const ev = evidenceText(booster.evidenceLevel);
  const level = booster.level ?? 0;
  const activationProvisional = booster.activationConfirmed === false;

  return (
    <Modal open={open} onClose={onClose} title={`${booster.boosterNameEn ?? "ブースター"}（固定）の効果`} size="sm">
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <BoosterIcon variant="fixed" />
          <span className="font-semibold">
            {name}
            {booster.level != null ? ` +${booster.level}` : ""}
          </span>
          <Badge tone={activationProvisional ? "warning" : "info"} size="xs">
            {activationProvisional ? "固定型・推定" : "固定型"} +{booster.level ?? "?"}
          </Badge>
          <Badge tone={ev.tone} size="xs">
            {ev.text}
          </Badge>
        </div>

        <p className="text-xs text-text-dim">
          これはカード本来の付属ブースターです。
          {activationProvisional
            ? "固定型と推定しているため人数条件による段階変更は無い前提で扱っています（未確認）。"
            : "人数条件による段階変更はありません。"}
          {booster.autoApplied ? "標準最終値へ適用中です。" : "現在の適用モードでは通常値へ適用していません。"}
        </p>

        {activationProvisional ? (
          <p className="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
            発動方式は「固定型」と<b>推定</b>（発動方式未確認）。効果内容（対象能力・上昇量）は外部照合済みですが、
            このブースターが青色（固定型）か金色（Power of Many）かの判別材料
            （eFHUB のヘキサゴン色の元データ・eFootball World の生ペイロード・ゲーム内実測）を確認できていません。
            ScoreBar 差分だけでは「固定 +N」と「Power of Many の最大 +N」を区別できないためです。
            Power of Many（条件型）である具体的証拠がないため、標準モードでは固定型として暫定適用しています。
          </p>
        ) : null}

        <div>
          <p className="text-xs font-semibold text-text-dim">対象能力ごとの上昇量</p>
          <ul className="mt-1 flex flex-col gap-1">
            {booster.affectedStats.map((k) => (
              <li key={k} className="flex items-center justify-between rounded border border-border/60 bg-surface-2/40 px-2 py-1 text-xs">
                <span title={getStatDef(k)?.nameEn ?? k}>{statLabelJa(k)}</span>
                <span className="font-bold tabular-nums text-lime-300">+{level}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-2xs text-text-muted">
          名称・レベル・効果は eFootball World（外部コミュニティDB・KONAMI 公式サイトではない）の個別選手ページ表示と
          EFScout（外部DB）の定義から解決しています。
        </p>
      </div>
    </Modal>
  );
}

/** チップ全体をボタンにして詳細ダイアログを開くラッパー。 */
export function FixedBoosterChip({
  booster,
  children,
}: {
  booster: PlayerBoosterInfo;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-md border border-info/40 bg-info/5 px-2 py-1.5 text-left text-xs transition-colors hover:border-info"
      >
        {children}
      </button>
      <FixedBoosterDetails booster={booster} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
