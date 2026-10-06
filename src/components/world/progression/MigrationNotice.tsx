"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import type { BuildMigration } from "@/lib/progression/types";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * 旧規則で保存されたビルドを読み込んだときの通知。
 * ユーザーの元配分は保持したまま「現行規則で再計算」を選べる。勝手に上書きしない。
 */
export function MigrationNotice({
  migration,
  onRecalculate,
  onDismiss,
}: {
  migration: BuildMigration;
  onRecalculate: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  return (
    <div className="rounded-md border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs">
      <p className="font-semibold text-yellow-300">
        {tp("migrationTitle").replace("{version}", migration.fromVersion)}
      </p>
      <p className="mt-1 text-text-dim">
        {tp("migrationBody1").replace("{version}", migration.toVersion)}
        {tp("migrationBody2")}
      </p>
      {migration.notes.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 ps-4 text-text-dim">
          {migration.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onRecalculate}
          className="rounded-md bg-accent px-3 py-1 font-semibold text-accent-ink"
        >
          {tp("migrationRecalculate")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-border px-3 py-1 text-text-dim hover:text-text"
        >
          {tp("migrationKeep")}
        </button>
      </div>
    </div>
  );
}
