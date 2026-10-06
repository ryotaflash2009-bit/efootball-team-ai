"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import { useEffect, useState } from "react";
import {
  isBuildStorageAvailable,
  listBuilds,
  renameBuild,
  deleteBuild,
} from "@/lib/progression/build-storage";
import type { ProgressionResult, SavedBuild, SelectedConditionalBooster } from "@/lib/progression/types";
import { isV2RulesVersion } from "@/lib/progression/progression-rules";
import { subscribeCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { saveCurrentBuild } from "@/lib/progression/save-current-build";
import { localizeBuildStorageError } from "@/lib/progression/build-storage-errors";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";

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
  onSaved,
  refreshKey = 0,
}: {
  worldCardId: string;
  result: ProgressionResult;
  allocation: Record<string, number>;
  selectedBooster: number | null;
  conditionalBoosterSelections?: SelectedConditionalBooster[];
  onLoad: (build: SavedBuild) => void;
  /** 保存に成功したとき（未保存の変更の表示を消すため）。 */
  onSaved?: (build: SavedBuild) => void;
  /** 他の場所（育成パネルのクイック保存）で保存したときに一覧を読み直すためのキー。 */
  refreshKey?: number;
}) {
  const [available, setAvailable] = useState(true);
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);

  useEffect(() => {
    setAvailable(isBuildStorageAvailable());
    setBuilds(listBuilds(worldCardId));
    // 保存先（guest/アカウント）は認証確認後に決まる。決まった・切り替わったときに一覧を読み直す
    // （読み直さないと、再読込直後に保存済みビルドが表示されない）。
    return subscribeCurrentScope(() => setBuilds(listBuilds(worldCardId)));
  }, [worldCardId, refreshKey]);

  function refresh() {
    setBuilds(listBuilds(worldCardId));
  }

  function handleSave() {
    const r = saveCurrentBuild({
      worldCardId,
      buildName: name || tp("buildDefaultName").replace("{n}", String(builds.length + 1)),
      allocation,
      result,
      selectedBooster,
      conditionalBoosterSelections,
    });
    setMsg(r.ok ? tp("buildSaved").replace("{name}", r.build.buildName) : tp("buildSaveFailed").replace("{reason}", localizeBuildStorageError(r.error, locale)));
    if (r.ok) {
      setName("");
      refresh();
      onSaved?.(r.build);
    }
  }

  function handleRename(b: SavedBuild) {
    const next = window.prompt(tp("buildRenamePrompt"), b.buildName);
    if (next == null) return;
    const r = renameBuild(worldCardId, b.buildId, next);
    setMsg(r.ok ? tp("buildRenamed") : tp("buildRenameFailed").replace("{reason}", localizeBuildStorageError(r.error, locale)));
    refresh();
  }

  function handleDelete(b: SavedBuild) {
    if (!window.confirm(tp("buildDeleteConfirm").replace("{name}", b.buildName))) return;
    const r = deleteBuild(worldCardId, b.buildId);
    setMsg(r.ok ? tp("buildDeleted") : tp("buildDeleteFailed").replace("{reason}", localizeBuildStorageError(r.error ?? "", locale)));
    refresh();
  }

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-sm font-semibold">{tp("buildSaveHeading")}</p>
      {!available ? (
        <p className="mt-2 text-xs text-text-dim">
          {tp("buildStorageUnavailable")}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder={tp("buildNameLabel")}
              aria-label={tp("buildNameLabel")}
              className="min-h-[44px] min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[44px] shrink-0 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink"
            >
              {tp("buildSaveButton")}
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
                    <span className="font-semibold" data-user-content="build-name">{b.buildName}</span>
                    {!isV2RulesVersion(b.rulesVersion) ? (
                      <span className="ms-1 rounded bg-yellow-400/15 px-1 text-[10px] text-yellow-300">{tp("buildLegacyRules")}</span>
                    ) : null}
                    <span className="ms-2 text-text-dim">
                      {tp("buildListMeta").replace("{ovr}", String(b.calculatedOvr ?? "—")).replace("{date}", new Date(b.updatedAt).toLocaleString(locale === "ja" ? "ja-JP" : "en-US", { hour12: false }))}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => onLoad(b)} className="min-h-[44px] min-w-[44px] rounded bg-surface px-2 py-0.5 hover:text-accent">
                      {tp("buildLoad")}
                    </button>
                    <button type="button" onClick={() => handleRename(b)} className="min-h-[44px] min-w-[44px] rounded bg-surface px-2 py-0.5 hover:text-accent">
                      {tp("buildRename")}
                    </button>
                    <button type="button" onClick={() => handleDelete(b)} className="min-h-[44px] min-w-[44px] rounded bg-surface px-2 py-0.5 text-danger hover:opacity-80">
                      {tp("buildDelete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-text-dim">{tp("buildNone")}</p>
          )}
        </>
      )}
      {msg ? <p className="mt-2 text-xs text-text-dim">{msg}</p> : null}
    </div>
  );
}
