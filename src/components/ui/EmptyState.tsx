import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * 空状態。アイコン＋見出し＋説明＋主要操作＋補助。
 * variant: "empty"（データ未作成） / "no-results"（検索/フィルタ0件）を区別。
 */
export function EmptyState({
  icon = "sparkles",
  variant = "empty",
  title,
  description,
  action,
  secondaryAction,
  children,
}: {
  icon?: IconName;
  variant?: "empty" | "no-results" | "error";
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** プリセットやサンプルなど */
  children?: ReactNode;
}) {
  const ring =
    variant === "error"
      ? "border-danger/40"
      : variant === "no-results"
        ? "border-border"
        : "border-accent/25";
  const iconTone =
    variant === "error" ? "text-danger bg-danger/10" : "text-accent bg-accent-soft";

  return (
    <div
      className={`flex flex-col items-center gap-4 rounded-card border border-dashed ${ring} bg-surface/60 px-6 py-12 text-center`}
    >
      <span className={`grid h-14 w-14 place-items-center rounded-full ${iconTone}`}>
        <Icon name={variant === "no-results" ? "search" : icon} size={26} />
      </span>
      <div className="max-w-md">
        <p className="text-lg font-semibold text-text">{title}</p>
        {description ? <p className="mt-2 text-sm leading-relaxed text-text-dim">{description}</p> : null}
      </div>
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
      {children ? <div className="w-full max-w-lg pt-2">{children}</div> : null}
    </div>
  );
}
