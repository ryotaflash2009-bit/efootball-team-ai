"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addCompareId, getCompareIds, removeCompareId } from "@/lib/comparison/compare-cart";
import { COMPARISON_MAX } from "@/lib/comparison/types";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * 「比較へ追加」ボタン。プレイヤー一覧カード・選手詳細に置く。
 * sessionStorage の比較リストへ追加し、/compare へのリンクを提供する。
 */
export function CompareAddButton({
  worldCardId,
  variant = "detail",
}: {
  worldCardId: string;
  variant?: "detail" | "card";
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useT();
  const tab = (k: keyof Dictionary["compareAddButton"]) => t("compareAddButton", k);

  useEffect(() => {
    setIds(getCompareIds());
  }, []);

  const inList = ids.includes(worldCardId);
  const full = ids.length >= COMPARISON_MAX && !inList;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inList) {
      setIds(removeCompareId(worldCardId));
      setMsg(null);
      return;
    }
    const r = addCompareId(worldCardId);
    setIds(r.ids);
    setMsg(r.result === "full" ? tab("fullMessageTemplate").replace("{max}", String(COMPARISON_MAX)) : null);
  }

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={inList}
        aria-label={inList ? tab("removeFromCompareAria") : tab("addToCompareAria")}
        disabled={full}
        className={`inline-flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          inList ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent hover:text-text"
        }`}
      >
        <Icon name={inList ? "check" : "compare"} size={12} />
        {inList ? tab("inCompareLabel") : full ? tab("compareFullLabel") : tab("addToCompareLabel")}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={inList}
        disabled={full}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          inList ? "border-accent bg-accent-soft text-accent" : "border-border-strong bg-surface-2 text-text hover:border-accent"
        }`}
      >
        <Icon name={inList ? "check" : "compare"} size={15} />
        {inList ? tab("inCompareCheckedLabel") : full ? tab("compareFullLabel") : tab("addToCompareLabel")}
      </button>
      {ids.length >= 1 ? (
        <Link
          href={`/compare?ids=${ids.join(",")}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-accent hover:underline"
        >
          {tab("viewCompareTemplate").replace("{count}", String(ids.length))}
          <Icon name="arrow-right" size={14} />
        </Link>
      ) : null}
      {msg ? <span className="text-2xs text-danger">{msg}</span> : null}
    </span>
  );
}
