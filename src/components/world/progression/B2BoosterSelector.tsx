"use client";

import type { AppliedPlayerBooster, PlayerBoosterInfo, SelectedPlayerBooster } from "@/lib/progression/types";
import {
  BOOSTER_CATALOG,
  getBoosterDef,
  isB2SelectableCandidate,
  isConfirmedB2Candidate,
} from "@/lib/progression/booster-catalog";
import { statListJa } from "@/lib/world/stat-labels";
import { Badge } from "@/components/ui/Badge";

/** 通常の B2 候補（確認済み・Power of Many を除く）。カタログは静的データのため一度だけ計算する。 */
const CONFIRMED_B2_CATALOG = BOOSTER_CATALOG.filter(isB2SelectableCandidate).filter(isConfirmedB2Candidate);

/**
 * B2（追加ブースター・手動選択）の選択UI。
 * 既存の `selectedPlayerBooster` 状態と更新処理（`onChange`）をそのまま使う唯一の入り口。
 * このコンポーネントを複数箇所へ配置しない（重複表示・二重計算を避けるため）。
 */
export function B2BoosterSelector({
  selected,
  attached,
  applied,
  onChange,
}: {
  selected: SelectedPlayerBooster[];
  attached: PlayerBoosterInfo[];
  applied: AppliedPlayerBooster[];
  onChange: (next: SelectedPlayerBooster[]) => void;
}) {
  const bySlot = new Map(selected.map((s) => [s.slot, s]));

  function setSlot(slot: 1 | 2, boosterKey: string | null, level?: number) {
    const rest = selected.filter((s) => s.slot !== slot);
    if (!boosterKey) return onChange(rest);
    const def = getBoosterDef(boosterKey);
    const lv = Math.max(1, Math.min(def?.maxLevel ?? 5, level ?? bySlot.get(slot)?.level ?? 1));
    onChange([...rest, { slot, boosterKey, level: lv }]);
  }

  return (
    <div>
      {([1, 2] as const).map((slot) => {
        const cur = bySlot.get(slot);
        const def = cur ? getBoosterDef(cur.boosterKey) : undefined;
        const curConfirmed = def ? isConfirmedB2Candidate(def) : false;
        // 既存の選択（未確認の試算値・過去バージョンで Total Package 等を B2 として選んでいた場合）を
        // 一覧から消さず・自動変換せずに復元できるよう、通常候補一覧とは別に現在値の表示ラベルを作る。
        const legacySelectionLabel =
          def && !curConfirmed
            ? def.conditional
              ? `${def.nameEn}（Power of Many・B2 選択肢からは提供終了）`
              : `${def.nameEn}（未確認・試算のみ・過去の選択）`
            : null;
        const att = attached.find((a) => a.slot === slot);
        const keepLabel = att
          ? att.boosterNameEn
            ? `— なし（付属: ${att.boosterNameEn}${att.level != null ? ` +${att.level}` : ""}）—`
            : "— なし（付属は未解決）—"
          : "— なし（付属なし）—";
        return (
          <div key={slot} className="mt-2 flex w-full flex-wrap items-center gap-1.5 first:mt-0">
            <span className="text-2xs text-text-muted">スロット{slot}</span>
            <select
              value={cur?.boosterKey ?? ""}
              onChange={(e) => setSlot(slot, e.target.value || null)}
              aria-label={`スロット${slot} の追加ブースター（B2）を指定`}
              className="min-h-[44px] min-w-0 flex-1 rounded border border-border bg-surface-2 px-2 py-2 text-xs"
            >
              <option value="">{keepLabel}</option>
              {legacySelectionLabel && def ? <option value={def.key}>{legacySelectionLabel}</option> : null}
              <optgroup label="確認済み（通常反映）">
                {CONFIRMED_B2_CATALOG.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.nameEn}
                  </option>
                ))}
              </optgroup>
            </select>
            {def ? (
              <select
                value={cur?.level ?? 1}
                onChange={(e) => setSlot(slot, cur!.boosterKey, Number(e.target.value))}
                aria-label={`スロット${slot} の追加ブースター（B2）のレベル`}
                className="min-h-[44px] rounded border border-border bg-surface-2 px-2 py-2 text-xs"
              >
                {Array.from({ length: def.maxLevel }, (_, i) => i + 1).map((lv) => (
                  <option key={lv} value={lv}>
                    +{lv}
                  </option>
                ))}
              </select>
            ) : null}
            {cur ? (
              <button
                type="button"
                onClick={() => setSlot(slot, null)}
                className="min-h-[44px] rounded border border-border px-3 py-1 text-2xs text-text-dim hover:border-danger hover:text-danger"
              >
                B2を解除
              </button>
            ) : null}
            {cur && curConfirmed ? (
              <Badge tone="success" size="xs">現在適用中</Badge>
            ) : null}
            {legacySelectionLabel ? (
              <span className="w-full text-2xs text-warning">
                未確認のため通常の最終値には反映されません（試算最終値のみ）。「なし」を選ぶか、確認済みの候補へ変更できます。
              </span>
            ) : null}
          </div>
        );
      })}

      {applied.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 text-2xs">
          {applied.map((a, i) => {
            const adef = getBoosterDef(a.boosterKey);
            const aConfirmed = adef ? isConfirmedB2Candidate(adef) : false;
            return (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <Badge tone={aConfirmed ? "success" : "warning"} size="xs">
                  {aConfirmed ? "確認済み・反映中" : "試算のみ（未確認）"}
                </Badge>
                <span className="font-medium">
                  {a.nameEn} +{a.level}
                </span>
                <span className="text-text-muted">
                  {statListJa(a.affectedStats)} に各 +{a.level}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selected.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 min-h-[44px] rounded border border-border px-3 py-1 text-2xs text-text-dim hover:border-danger hover:text-danger"
        >
          追加ブースター（B2）をすべて解除
        </button>
      ) : null}

      <p className="mt-2 text-2xs text-text-muted">
        確認済みのB2を選ぶと、対象能力・通常の最終値・比較の順位・チーム集計へ即座に反映します。
      </p>
    </div>
  );
}
