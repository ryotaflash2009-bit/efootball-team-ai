"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LocaleContext";

/** シンプルな確認ダイアログ（`Modal` ＝ フォーカストラップ・Esc 対応）。 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** 追加の明示確認(例: チェックボックス)が済むまで実行ボタンを無効化したい場合に使う。 */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const resolvedConfirmLabel = confirmLabel ?? t("common", "confirm");
  const resolvedCancelLabel = cancelLabel ?? t("common", "cancel");
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4 text-sm">
        <div className="text-text-dim">{body}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {resolvedCancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm} disabled={confirmDisabled}>
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
