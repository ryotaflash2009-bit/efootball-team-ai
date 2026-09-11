"use client";

import type { BoosterApplicationMode } from "@/lib/progression/types";
import { BOOSTER_APPLICATION_MODES } from "@/lib/progression/booster-resolution";
import { ExperimentalModeToggle } from "./ExperimentalModeToggle";

/**
 * 選手ブースターの適用モード設定・検証情報。
 * B1（カード付属ブースター）と B2（追加ブースター・手動選択）の通常表示・選択操作は
 * `AttachedBoosterSection` / `B2BoosterSelector`（育成ポイント直下・常時表示）へ集約済み。
 * ここには「モード設定」と「効果の出所・検証情報」だけを残す（重複表示を避けるため）。
 */
export function PlayerBoosterPanel({
  mode,
  onModeChange,
}: {
  mode: BoosterApplicationMode;
  onModeChange: (m: BoosterApplicationMode) => void;
}) {
  const experimental = mode === "experimental";

  return (
    <section className="rounded-md border border-border bg-surface p-3 text-sm">
      <h3 className="font-semibold">選手ブースター</h3>

      {/* ── ブースター適用モード ── */}
      <div className="mt-2 rounded-md border border-border/60 bg-surface-2/30 p-2">
        <p className="text-xs font-semibold text-text-dim">ブースター適用モード</p>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {BOOSTER_APPLICATION_MODES.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-2 text-2xs">
              <input
                type="radio"
                name="booster-mode"
                value={m.id}
                checked={mode === m.id}
                onChange={() => {
                  if (m.id === "experimental" && mode !== "experimental") return; // 実験モードは下のトグルから
                  onModeChange(m.id);
                }}
                disabled={m.id === "experimental"}
                className="mt-0.5 accent-[color:var(--color-accent)]"
              />
              <span>
                <span className="font-semibold text-text">{m.label}</span>
                <span className="block text-text-muted">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
        {mode !== "strict" ? (
          <p className="mt-1.5 rounded border border-info/30 bg-info/10 px-2 py-1 text-2xs text-info">
            標準モード: 効果内容を外部データベース間で照合した高信頼値を含みます（「外部照合済み・固定型推定を含む」）。KONAMI 公式の計算結果として確認された値ではありません。
            適用の基準は効果内容の照合であり、発動方式は問いません。発動方式の証拠が不足するブースターは、Power of Many（条件型）である具体的証拠がないため固定型と推定して暫定適用しています。
          </p>
        ) : null}
      </div>

      {/* ── 検証情報 ── */}
      <div className="mt-3 border-t border-border/60 pt-2.5">
        <p className="text-xs font-semibold text-text-dim">効果の詳細・検証情報</p>
        <p className="mt-0.5 text-2xs text-text-muted">
          B1（カード付属ブースター）・B2（追加ブースター）の通常の選択・解除は、育成ポイント表示の直下（このカードの概要欄）で行えます。
          未確認・過去の試算値やPower of Many（条件付きブースター）の互換表示・詳細もそちらに表示します。
        </p>
        <div className="mt-2.5">
          <ExperimentalModeToggle
            enabled={experimental}
            onChange={(on) => onModeChange(on ? "experimental" : "standard")}
          />
        </div>
        <p className="mt-2 text-2xs text-text-muted">
          付属ブースターの名称・レベル・効果は eFootball World（外部コミュニティDB・KONAMI 公式サイトではない）の個別選手ページ表示と
          EFScout（外部DB）の定義から得ています。ball-carrying / 攻撃の起点 のみユーザー保存済みスクリーンショットで対象能力・上昇量を直接確認。
          未確認の値から架空の上昇量は生成しません。
        </p>
      </div>
    </section>
  );
}
