"use client";

import type { BuildMigration } from "@/lib/progression/types";

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
  return (
    <div className="rounded-md border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs">
      <p className="font-semibold text-yellow-300">
        このビルドは旧規則（{migration.fromVersion}）で作成されています
      </p>
      <p className="mt-1 text-text-dim">
        現行規則（{migration.toVersion}）は配分の単位（グループ）と段階コストが異なります。
        下のボタンで再計算すると、元の配分を保ったまま現行規則へ変換します（自動保存はしません）。
      </p>
      {migration.notes.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-text-dim">
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
          現行規則で再計算
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-border px-3 py-1 text-text-dim hover:text-text"
        >
          そのまま表示
        </button>
      </div>
    </div>
  );
}
