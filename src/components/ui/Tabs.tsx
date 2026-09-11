"use client";

import { useId, useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

/**
 * アクセシブルなタブ。role=tablist/tab/tabpanel、矢印キー移動。
 * 非アクティブパネルも DOM に残す（hidden）ので no-JS でも内容が存在する。
 */
export function Tabs({
  items,
  initial,
  ariaLabel = "タブ",
  sticky = false,
}: {
  items: TabItem[];
  initial?: string;
  ariaLabel?: string;
  sticky?: boolean;
}) {
  const base = useId();
  const [active, setActive] = useState(
    initial && items.some((t) => t.id === initial) ? initial : items[0]?.id,
  );
  const activeId = items.some((t) => t.id === active) ? active : items[0]?.id;

  function onKey(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = items[(idx + dir + items.length) % items.length];
    setActive(next.id);
    document.getElementById(`${base}-tab-${next.id}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${
          sticky ? "sticky top-header z-20 border-b border-border bg-bg/95 backdrop-blur" : "border-b border-border"
        }`}
      >
        <div role="tablist" aria-label={ariaLabel} className="flex gap-1">
          {items.map((t, i) => {
            const on = t.id === activeId;
            return (
              <button
                key={t.id}
                id={`${base}-tab-${t.id}`}
                role="tab"
                aria-selected={on}
                aria-controls={`${base}-panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(t.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                  on
                    ? "border-accent font-semibold text-text"
                    : "border-transparent text-text-dim hover:text-text"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {items.map((t) => (
        <div
          key={t.id}
          id={`${base}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== activeId}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
