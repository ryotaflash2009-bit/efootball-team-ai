import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "outline";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-text-dim",
  accent: "bg-accent-soft text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  outline: "border border-border text-text-dim",
};

/** 状態・分類のラベル。色だけに依存せず必ず文字を持つ。 */
export function Badge({
  tone = "neutral",
  size = "sm",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  size?: "xs" | "sm";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill font-medium ${
        size === "xs" ? "px-1.5 py-0.5 text-2xs" : "px-2 py-0.5 text-xs"
      } ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
