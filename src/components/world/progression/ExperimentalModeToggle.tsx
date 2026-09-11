"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const WARNING =
  "検証中のブースター効果を試算へ含めます。表示される能力値はゲーム内の正式値ではありません。通常モードの確定値とは別に扱われます。";

/**
 * 実験的なブースター試算（検証モード）の切替。
 *  - 初期 OFF。有効化前に警告モーダルで同意を取る（フォーカストラップ・Esc・キーボード操作可）。
 *  - ON のときは常時バナー表示。解除はワンクリック。
 *  - ページ再読込で OFF（親コンポーネントの state のみ・永続化しない）。
 */
export function ExperimentalModeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const warnId = useId();

  if (enabled) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 rounded-md border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200"
      >
        <Icon name="sparkles" size={14} />
        <span className="font-semibold">検証モード（実験的なブースター試算）が有効です。</span>
        <span className="w-full text-2xs text-yellow-200/80">{WARNING}</span>
        <button
          type="button"
          onClick={() => onChange(false)}
          className="rounded border border-yellow-400/50 px-2 py-1 text-2xs font-semibold hover:bg-yellow-400/15"
        >
          検証モードを解除
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-describedby={warnId}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-dim hover:border-yellow-400/50 hover:text-yellow-200"
      >
        <Icon name="sparkles" size={13} />
        実験的なブースター試算を開く（検証モード）
      </button>
      <span id={warnId} className="sr-only">
        {WARNING}
      </span>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="検証モードを有効化しますか？" size="sm">
        <div className="space-y-3 text-sm">
          <p className="flex gap-2 rounded-md border border-yellow-400/40 bg-yellow-400/10 p-2.5 text-xs text-yellow-200">
            <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
            <span>{WARNING}</span>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-text-dim">
            <li>通常モードの最終値（確定値）は変わりません。試算値は別列（試算最終）に表示します。</li>
            <li>検証中の付属ブースターと、手動で選んだ試算ブースターが試算へ加わります。</li>
            <li>ページを再読み込みすると検証モードは OFF に戻ります。</li>
            <li>共有URLやスカッド全体へは自動的に反映されません。</li>
          </ul>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onChange(true);
                setConfirmOpen(false);
              }}
            >
              同意して有効化
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
