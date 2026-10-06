"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { DisplayLocale } from "@/lib/i18n/locale-registry";

/**
 * 内部の確認用の言語の一覧（listbox）。LanguageSwitcher が内部の確認の build だけで後から読み込む。
 * 矢印キー・Home/End・Enter/Space で選び、Escape・外側のクリック・Tab で閉じ、閉じたらボタンへフォーカスを戻す。
 */
export function PreviewLanguageMenu({ options, compact }: { options: { code: DisplayLocale; nativeName: string; dir: "ltr" | "rtl" }[]; compact: boolean }) {
  const { displayLocale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.code === displayLocale);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    listRef.current?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openList() {
    const i = options.findIndex((o) => o.code === displayLocale);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  }
  function choose(i: number) {
    setLocale(options[i].code);
    setOpen(false);
    buttonRef.current?.focus();
  }
  function onListKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={current ? `${t("language", "previewListLabel")}: ${current.nativeName}` : t("language", "moreLanguages")}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`min-h-[32px] rounded-md border border-dashed border-border px-2 font-semibold text-text-dim hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${compact ? "text-2xs" : "text-xs"} ${current ? "bg-accent text-accent-ink" : "bg-surface-2"}`}
      >
        {/* 狭いヘッダー（compact）では短い表示にし、読み上げは完全な名前（aria-label） */}
        {compact ? (current ? current.code : `+${options.length}`) : current ? current.nativeName : t("language", "moreLanguages")}
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={t("language", "previewListLabel")}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className="absolute end-0 top-full z-50 mt-1 max-h-[60vh] w-max min-w-[12rem] max-w-[min(20rem,90vw)] overflow-y-auto rounded-md border border-border bg-surface p-1 text-sm shadow-lg focus:outline-none"
        >
          {options.map((o, i) => (
            <li
              key={o.code}
              id={`${listId}-${i}`}
              role="option"
              lang={o.code}
              dir={o.dir}
              aria-selected={o.code === displayLocale}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 ${i === active ? "bg-surface-2" : ""} ${o.code === displayLocale ? "font-semibold" : ""}`}
            >
              <span>{o.nativeName}</span>
              <span className="shrink-0 text-2xs text-text-muted" lang={undefined}>
                {o.code} · {t("language", "previewBadge")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
