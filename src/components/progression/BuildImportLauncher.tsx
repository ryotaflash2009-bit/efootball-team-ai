"use client";

import "@/lib/i18n/dictionaries/ja-ns/buildImportModal";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { SavedBuild } from "@/lib/progression/types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { useT } from "@/lib/i18n/LocaleContext";

// Modal の中身（大きい）は押したときに読み込む（最初の JS を軽く・2026-11-01）
const BuildImportModal = dynamic(() => import("./BuildImportModal").then((m) => m.BuildImportModal), { ssr: false });

export function useSafetyLines(): string[] {
  const t = useT();
  return [
    t("buildImportModal", "safetyLine1"),
    t("buildImportModal", "safetyLine2"),
    t("buildImportModal", "safetyLine3"),
    t("buildImportModal", "safetyLine4"),
    t("buildImportModal", "safetyLine5"),
    t("buildImportModal", "safetyLine6"),
    t("buildImportModal", "safetyLine7"),
  ];
}

export function BuildImportLauncher({
  builds,
  cards,
  available,
  stale,
  onReload,
}: {
  builds: SavedBuild[];
  cards: Map<string, WorldPlayerListItem>;
  available: boolean;
  stale: boolean;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const safetyLines = useSafetyLines();

  return (
    <Surface tone="inset" padding="sm" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("buildImportModal", "launcherHeading")}</p>
          <p className="mt-0.5 text-2xs text-text-muted">
            {t("buildImportModal", "launcherDescriptionPrefix")}
            <b>{t("buildImportModal", "addBoldLabel")}</b>
            {t("buildImportModal", "launcherDescriptionSuffix")}
          </p>
          {/* 7 項目の注意はスマホで長いため畳む（2026-10-25 画面の整理）。文言は HTML に残る */}
          <details className="mt-1 text-2xs text-text-muted" data-testid="build-import-safety">
            <summary className="cursor-pointer font-semibold">{t("buildImportModal", "safetySummary")}</summary>
            <ul className="mt-1 list-disc ps-4">
              {safetyLines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        </div>
        <Button
          variant="secondary"
          size="md"
          iconLeft="sliders"
          onClick={() => setOpen(true)}
          disabled={!available}
          aria-haspopup="dialog"
        >
          {t("buildImportModal", "launcherButton")}
        </Button>
      </div>
      {!available ? (
        <p className="text-2xs text-warning">{t("buildImportModal", "unavailableNote")}</p>
      ) : null}

      {open ? (
        <BuildImportModal
          builds={builds}
          cards={cards}
          stale={stale}
          onReload={onReload}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Surface>
  );
}
