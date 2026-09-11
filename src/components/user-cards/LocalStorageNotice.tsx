"use client";

import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 初期版がローカル保存であることの明示。
 * 「アカウントへ保存済み」「クラウド同期済み」「本人確認済み」等の誤表示はしない。
 */
export function LocalStorageNotice({ kind }: { kind: "favorites" | "my-team" | "both" | "builds" }) {
  const t = useT();
  const what =
    kind === "favorites"
      ? t("localStorageNotice", "whatFavorites")
      : kind === "my-team"
        ? t("localStorageNotice", "whatMyTeam")
        : kind === "builds"
          ? t("localStorageNotice", "whatBuilds")
          : t("localStorageNotice", "whatFavoritesAndMyTeam");
  return (
    <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-2xs text-info">
      <Icon name="info" size={14} className="mt-0.5 shrink-0" />
      <span>
        {t("localStorageNotice", "bodyPrefixTemplate").replace("{what}", what)}
        <b>{t("localStorageNotice", "bodyBold")}</b>
        {t("localStorageNotice", "bodySuffix")}
      </span>
    </p>
  );
}
