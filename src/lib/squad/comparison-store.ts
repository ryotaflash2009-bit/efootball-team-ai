import { z } from "zod";
import { SQUAD_ID_RE } from "./types";

/**
 * スカッド比較の「直前に比較した相手」だけを覚える軽量 UI 設定（localStorage）。
 *
 *  - 主な状態源は URL（/squads/compare?a=&b=）。これはパラメーター無しで画面へ来たときの復元用。
 *  - **保存するのは squadId 2 つと更新時刻だけ。** スカッド本体・選手データ・ビルド・ブースター定義・
 *    My Team・お気に入りは一切保存しない。
 *  - SSR / localStorage 不可 / 壊れた JSON でもクラッシュしない。
 */

export const SQUAD_COMPARISON_STORE_KEY = "efootball-team-ai:squad-comparison:v1";
export const SQUAD_COMPARISON_STORAGE_VERSION = "squad-comparison-storage/2026-08-30.v1";

export interface SquadComparisonPref {
  storageVersion: string;
  squadIdA: string | null;
  squadIdB: string | null;
  updatedAt: string;
}

const schema = z.object({
  storageVersion: z.string().max(80).catch(SQUAD_COMPARISON_STORAGE_VERSION),
  squadIdA: z.string().regex(SQUAD_ID_RE).nullable().catch(null),
  squadIdB: z.string().regex(SQUAD_ID_RE).nullable().catch(null),
  updatedAt: z.string().max(40).catch(""),
});

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const k = "__efb_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

const EMPTY: SquadComparisonPref = {
  storageVersion: SQUAD_COMPARISON_STORAGE_VERSION,
  squadIdA: null,
  squadIdB: null,
  updatedAt: "",
};

export function getComparisonPref(): SquadComparisonPref {
  const ls = getStorage();
  if (!ls) return { ...EMPTY };
  try {
    const raw = ls.getItem(SQUAD_COMPARISON_STORE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ...EMPTY };
    return {
      storageVersion: SQUAD_COMPARISON_STORAGE_VERSION,
      squadIdA: parsed.data.squadIdA,
      squadIdB: parsed.data.squadIdB,
      updatedAt: parsed.data.updatedAt,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** A/B の squadId だけを保存する（不正 ID は null 化）。localStorage 不可なら黙って何もしない。 */
export function setComparisonPref(a: string | null, b: string | null): void {
  const ls = getStorage();
  if (!ls) return;
  const next: SquadComparisonPref = {
    storageVersion: SQUAD_COMPARISON_STORAGE_VERSION,
    squadIdA: a && SQUAD_ID_RE.test(a) ? a : null,
    squadIdB: b && SQUAD_ID_RE.test(b) ? b : null,
    updatedAt: new Date().toISOString(),
  };
  try {
    ls.setItem(SQUAD_COMPARISON_STORE_KEY, JSON.stringify(next));
  } catch {
    /* 保存できなくても致命ではない */
  }
}
