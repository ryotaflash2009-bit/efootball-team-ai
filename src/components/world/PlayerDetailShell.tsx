"use client";

import { useState, type ReactNode } from "react";

/**
 * World 選手詳細のタブ枠。
 * ヘッダー（選手画像・名前・OVR）は常時表示、本文をタブで切り替える。
 * 既存セクションはそのまま content として渡すだけ（画面の作り直しはしない）。
 */
export interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function PlayerDetailShell({
  header,
  tabs,
  initialTab,
}: {
  header: ReactNode;
  tabs: DetailTab[];
  initialTab?: string;
}) {
  const [active, setActive] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0]?.id,
  );
  const activeId = tabs.some((t) => t.id === active) ? active : tabs[0]?.id;

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="sticky top-14 z-20 -mx-4 overflow-x-auto border-b border-border bg-bg/95 px-4 backdrop-blur">
        <div role="tablist" aria-label="選手詳細" className="flex gap-1">
          {tabs.map((t) => {
            const on = t.id === activeId;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
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

      {/* 全パネルを DOM に描画し、非アクティブは hidden で隠す（no-JS でも内容が存在する） */}
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" aria-labelledby={t.id} hidden={t.id !== activeId}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
