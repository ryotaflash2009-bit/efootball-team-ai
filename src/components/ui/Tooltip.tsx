"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * 軽量ツールチップ。hover とキーボードフォーカスの両方で表示。
 * トリガーには aria-describedby を付ける。過度なアニメーションはしない。
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-40 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-border-strong bg-surface-3 px-2 py-1 text-2xs text-text shadow-pop ${
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
