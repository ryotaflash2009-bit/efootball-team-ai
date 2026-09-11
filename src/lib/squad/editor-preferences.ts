/**
 * スカッド編集画面の「表示だけ」の設定（ユーザー UI 設定・スカッド固有ではない）。
 *  - スカッドの保存形式（座標・roleOverride 等）には混ぜない。
 *  - localStorage `efootball-team-ai:squad-editor-preferences:v1`。SQLite へは保存しない。
 *  - SSR / localStorage 不可 / 壊れた JSON でも安全な既定値を返す。
 */

const KEY = "efootball-team-ai:squad-editor-preferences:v1";
const STORAGE_VERSION = "squad-editor-preferences-storage/2026-08-30.v1";

export interface EditorPreferences {
  /** 配置スナップ（弱い補助） */
  snapEnabled: boolean;
  /** 整列ガイド線の表示 */
  showGuides: boolean;
  /** 配置グリッドの表示 */
  showGrid: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  snapEnabled: true,
  showGuides: true,
  showGrid: false,
};

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const k = "__efb_pref_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

function coerceBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function parseEditorPreferences(raw: string | null): EditorPreferences {
  if (!raw) return { ...DEFAULT_EDITOR_PREFERENCES };
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const body =
      j && typeof j === "object" && "preferences" in j && typeof j.preferences === "object"
        ? (j.preferences as Record<string, unknown>)
        : (j as Record<string, unknown>);
    return {
      snapEnabled: coerceBool(body?.snapEnabled, DEFAULT_EDITOR_PREFERENCES.snapEnabled),
      showGuides: coerceBool(body?.showGuides, DEFAULT_EDITOR_PREFERENCES.showGuides),
      showGrid: coerceBool(body?.showGrid, DEFAULT_EDITOR_PREFERENCES.showGrid),
    };
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES };
  }
}

export function getEditorPreferences(): EditorPreferences {
  const ls = getStorage();
  if (!ls) return { ...DEFAULT_EDITOR_PREFERENCES };
  return parseEditorPreferences(ls.getItem(KEY));
}

export function setEditorPreferences(next: EditorPreferences): boolean {
  const ls = getStorage();
  if (!ls) return false;
  try {
    ls.setItem(
      KEY,
      JSON.stringify({ storageVersion: STORAGE_VERSION, updatedAt: new Date().toISOString(), preferences: next }),
    );
    return true;
  } catch {
    return false;
  }
}
