import type { HTMLAttributes, ReactNode } from "react";

export type SurfaceTone = "base" | "raised" | "inset" | "outline";

const TONE: Record<SurfaceTone, string> = {
  base: "border border-border bg-surface shadow-card",
  raised: "border border-border-strong bg-surface-2 shadow-card",
  inset: "border border-border/70 bg-surface-2/40",
  outline: "border border-dashed border-border bg-surface/60",
};

const PAD: Record<"none" | "sm" | "md" | "lg", string> = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

/** カード／パネルの共通コンテナ。色や境界をページで直書きしないための土台。 */
export function Surface({
  tone = "base",
  padding = "md",
  interactive = false,
  className = "",
  children,
  ...rest
}: {
  tone?: SurfaceTone;
  padding?: keyof typeof PAD;
  interactive?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card ${TONE[tone]} ${PAD[padding]} ${
        interactive ? "transition-colors duration-150 hover:border-accent hover:bg-surface-2" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
