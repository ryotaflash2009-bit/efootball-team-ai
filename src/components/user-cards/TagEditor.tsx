"use client";

import { useState } from "react";
import { MAX_TAGS, TAG_MAX_LEN, sanitizeTag } from "@/lib/user-cards/validation";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * 自由入力タグの編集（バッジ形式）。プレーンテキストのみ。
 *  - 1 タグ最大 24 文字 / 最大 10 タグ / 前後空白削除 / 空・重複・制御文字を拒否 / HTML 解釈なし。
 */
export function TagEditor({
  tags,
  onChange,
  idPrefix = "tags",
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  idPrefix?: string;
}) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const t = useT();
  const tte = (k: keyof Dictionary["tagEditor"]) => t("tagEditor", k);
  const fillTe = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);

  function commit() {
    const tag = sanitizeTag(draft);
    if (tag == null) {
      setDraft("");
      return;
    }
    if (tags.includes(tag)) {
      setErr(tte("duplicateTag"));
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setErr(fillTe(tte("maxTagsTemplate"), { max: String(MAX_TAGS) }));
      return;
    }
    onChange([...tags, tag]);
    setDraft("");
    setErr(null);
  }

  function remove(tag: string) {
    onChange(tags.filter((x) => x !== tag));
    setErr(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${idPrefix}-input`} className="text-xs font-medium text-text-dim">
        {fillTe(tte("labelTemplate"), { maxTags: String(MAX_TAGS), maxLen: String(TAG_MAX_LEN) })}
      </label>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-pill bg-surface-3 px-2 py-0.5 text-2xs text-text-dim">
                {tag}
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  aria-label={fillTe(tte("removeTagAriaTemplate"), { tag })}
                  className="grid h-4 w-4 place-items-center rounded-full hover:bg-danger/20 hover:text-danger"
                >
                  <Icon name="close" size={10} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-1.5">
        <input
          id={`${idPrefix}-input`}
          type="text"
          value={draft}
          maxLength={TAG_MAX_LEN + 4}
          onChange={(e) => {
            setDraft(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={tte("placeholder")}
          disabled={tags.length >= MAX_TAGS}
          className="min-h-[36px] flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={commit}
          disabled={draft.trim() === "" || tags.length >= MAX_TAGS}
          className="min-h-[36px] shrink-0 rounded-md border border-border px-3 text-xs hover:enabled:border-accent disabled:opacity-40"
        >
          {tte("addButton")}
        </button>
      </div>
      {err ? <p className="text-2xs text-danger" role="alert">{err}</p> : null}
    </div>
  );
}
