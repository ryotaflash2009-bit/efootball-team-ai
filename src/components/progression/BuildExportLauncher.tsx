"use client";

import "@/lib/i18n/dictionaries/ja-ns/buildExportModal";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { SavedBuild } from "@/lib/progression/types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { useT } from "@/lib/i18n/LocaleContext";

// Modal の中身（大きい）は押したときに読み込む（最初の JS を軽く・2026-11-01）
const BuildExportModal = dynamic(() => import("./BuildExportModal").then((m) => m.BuildExportModal), { ssr: false });

/**
 * My Builds のエクスポート入口。ボタンと固定説明は常時表示（保存ビルド 0 件でも説明は出す）。
 * 実際の対象選択・確認・ダウンロードは Modal 内で行う。
 */
export function BuildExportLauncher({
  builds,
  cards,
  usedBuildIds,
  available,
  stale,
  onReload,
}: {
  builds: SavedBuild[];
  cards: Map<string, WorldPlayerListItem>;
  usedBuildIds: Set<string>;
  available: boolean;
  stale: boolean;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <Surface tone="inset" padding="sm" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("buildExportModal", "launcherHeading")}</p>
          <p className="mt-0.5 text-2xs text-text-muted">{t("buildExportModal", "launcherDescription")}</p>
        </div>
        <Button
          variant="secondary"
          size="md"
          iconLeft="database"
          onClick={() => setOpen(true)}
          disabled={!available || builds.length === 0}
          aria-haspopup="dialog"
        >
          {t("buildExportModal", "launcherButton")}
        </Button>
      </div>
      {builds.length === 0 ? (
        <p className="text-2xs text-text-muted">{t("buildExportModal", "noBuildsNote")}</p>
      ) : null}
      {!available ? (
        <p className="text-2xs text-warning">{t("buildExportModal", "unavailableNote")}</p>
      ) : null}

      {open ? (
        <BuildExportModal
          builds={builds}
          cards={cards}
          usedBuildIds={usedBuildIds}
          stale={stale}
          onReload={onReload}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Surface>
  );
}
