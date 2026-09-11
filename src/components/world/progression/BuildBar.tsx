"use client";

import { useEffect, useState } from "react";
import {
  isBuildStorageAvailable,
  listBuilds,
  saveBuild,
  renameBuild,
  deleteBuild,
} from "@/lib/progression/build-storage";
import type { ProgressionResult, SavedBuild, SelectedConditionalBooster } from "@/lib/progression/types";
import { isV2RulesVersion } from "@/lib/progression/progression-rules";

/**
 * 育成ビルドの保存・読み込み・複数管理（localStorage）。
 * 保存対象はブラウザ内のユーザー作成ビルドのみ（Windows 上のファイルは触らない）。
 */
export function BuildBar({
  worldCardId,
  result,
  allocation,
  selectedBooster,
  conditionalBoosterSelections,
  onLoad,
}: {
  worldCardId: string;
  result: ProgressionResult;
  allocation: Record<string, number>;
  selectedBooster: number | null;
  conditionalBoosterSelections?: SelectedConditionalBooster[];
  onLoad: (build: SavedBuild) => void;
}) {
  const [available, setAvailable] = useState(true);
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setAvailable(isBuildStorageAvailable());
    setBuilds(listBuilds(worldCardId));
  }, [worldCardId]);

  function refresh() {
    setBuilds(listBuilds(worldCardId));
  }

  function handleSave() {
    const finalStats: Record<string, number> = {};
    for (const s of result.stats) finalStats[s.key] = s.finalValue;
    const r = saveBuild({
      worldCardId,
      buildName: name || `ビルド ${builds.length + 1}`,
      progressionAllocation: allocation,
      selectedPlayerBooster: selectedBooster,
      conditionalBoosterSelections,
      calculatedStats: finalStats,
      calculatedOvr: result.rating.estimatedOvr,
      calculationMode: result.calculationMode,
      rulesVersion: result.rulesVersion,
    });
    setMsg(r.ok ? `保存しました: ${r.build.buildName}` : `保存できません: ${r.error}`);
    if (r.ok) {
      setName("");
      refresh();
    }
  }

  function handleRename(b: SavedBuild) {
    const next = window.prompt("新しいビルド名", b.buildName);
    if (next == null) return;
    const r = renameBuild(worldCardId, b.buildId, next);
    setMsg(r.ok ? "名前を変更しました" : `変更できません: ${r.error}`);
    refresh();
  }

  function handleDelete(b: SavedBuild) {
    if (!window.confirm(`ビルド「${b.buildName}」を削除しますか？（ブラウザ内の保存のみ）`)) return;
    const r = deleteBuild(worldCardId, b.buildId);
    setMsg(r.ok ? "削除しました" : `削除できません: ${r.error}`);
    refresh();
  }

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-sm font-semibold">ビルド保存</p>
      {!available ? (
        <p className="mt-2 text-xs text-text-dim">
          この環境では localStorage が使えないため、ビルドを保存できません（画面の操作は可能です）。
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="ビルド名"
              aria-label="ビルド名"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={handleSave}
              className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
            >
              保存
            </button>
          </div>

          {builds.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {builds.map((b) => (
                <li
                  key={b.buildId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-surface-2/40 px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{b.buildName}</span>
                    {!isV2RulesVersion(b.rulesVersion) ? (
                      <span className="ml-1 rounded bg-yellow-400/15 px-1 text-[10px] text-yellow-300">旧規則</span>
                    ) : null}
                    <span className="ml-2 text-text-dim">
                      推定OVR {b.calculatedOvr ?? "—"} / {new Date(b.updatedAt).toLocaleString("ja-JP", { hour12: false })}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => onLoad(b)} className="rounded bg-surface px-2 py-0.5 hover:text-accent">
                      読込
                    </button>
                    <button type="button" onClick={() => handleRename(b)} className="rounded bg-surface px-2 py-0.5 hover:text-accent">
                      名前
                    </button>
                    <button type="button" onClick={() => handleDelete(b)} className="rounded bg-surface px-2 py-0.5 text-danger hover:opacity-80">
                      削除
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-text-dim">保存済みのビルドはありません。</p>
          )}
        </>
      )}
      {msg ? <p className="mt-2 text-xs text-text-dim">{msg}</p> : null}
    </div>
  );
}
