import type { ReactNode } from "react";

/** セクション見出し(h2/h3)。右側に補助操作や注記を置ける。 */
export function SectionHeader({
  title,
  as = "h2",
  hint,
  action,
  className = "",
}: {
  title: ReactNode;
  as?: "h2" | "h3";
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Tag = as;
  return (
    <div className={`mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Tag className={as === "h2" ? "text-lg font-semibold" : "text-sm font-semibold"}>{title}</Tag>
        {hint ? <span className="text-2xs text-text-dim">{hint}</span> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
