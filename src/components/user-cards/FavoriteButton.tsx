"use client";

import { useState } from "react";
import { useFavorites } from "@/lib/user-cards/hooks";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * お気に入りボタン（共通）。画面ごとにロジックを複製しない。
 *  - `aria-pressed` で状態を伝える（色だけに依存しない）。テキストでも判別可能。
 *  - お気に入り = ライム/白。Power of Many（金）と混同しない配色。
 *  - Link の中に置いてもカードのクリックへ伝播しない（stopPropagation / preventDefault）。
 */
export function FavoriteButton({
  worldCardId,
  variant = "detail",
  className = "",
}: {
  worldCardId: string;
  variant?: "detail" | "card" | "compact";
  className?: string;
}) {
  const t = useT();
  const { isFavorite, toggle, available } = useFavorites();
  const on = isFavorite(worldCardId);
  const [err, setErr] = useState<string | null>(null);

  function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const r = toggle(worldCardId);
    setErr(r.ok ? null : (r.error ?? t("favoriteButton", "saveFailedFallback")));
  }

  const label = on ? t("favoriteButton", "removeLabel") : t("favoriteButton", "addLabel");
  const star = (
    <Icon
      name="star"
      size={variant === "detail" ? 16 : 14}
      className={on ? "fill-accent text-accent" : ""}
    />
  );

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={handle}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={`absolute right-1 top-1 z-10 inline-grid h-8 w-8 place-items-center rounded-md bg-black/70 text-text-dim transition-colors hover:text-accent ${
          on ? "text-accent" : ""
        } ${className}`}
      >
        {star}
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handle}
        aria-pressed={on}
        aria-label={label}
        className={`inline-flex min-h-[36px] items-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold transition-colors ${
          on
            ? "border-accent bg-accent-soft text-accent"
            : "border-border text-text-dim hover:border-accent hover:text-text"
        } ${className}`}
      >
        {star}
        {on ? t("favoriteButton", "favoritedCompactLabel") : t("favoriteButton", "notFavoritedCompactLabel")}
      </button>
    );
  }

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        onClick={handle}
        aria-pressed={on}
        className={`inline-flex h-9 min-h-[36px] items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors ${
          on
            ? "border-accent bg-accent-soft text-accent"
            : "border-border-strong bg-surface-2 text-text hover:border-accent"
        }`}
      >
        {star}
        {on ? t("favoriteButton", "favoritedLabel") : t("favoriteButton", "addFavoriteLabel")}
      </button>
      {!available ? (
        <span className="mt-0.5 text-2xs text-warning">{t("favoriteButton", "unavailableNote")}</span>
      ) : err ? (
        <span className="mt-0.5 text-2xs text-danger">{err}</span>
      ) : null}
    </span>
  );
}
