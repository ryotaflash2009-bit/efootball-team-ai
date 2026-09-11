import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getEditorPreferences,
  setEditorPreferences,
  parseEditorPreferences,
  DEFAULT_EDITOR_PREFERENCES,
} from "./editor-preferences";

function installMemoryStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
    },
  });
  return map;
}

describe("editor-preferences", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("既定値（snap ON / guides ON / grid OFF）", () => {
    expect(getEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(DEFAULT_EDITOR_PREFERENCES.snapEnabled).toBe(true);
    expect(DEFAULT_EDITOR_PREFERENCES.showGrid).toBe(false);
  });

  it("保存 → 再取得", () => {
    setEditorPreferences({ snapEnabled: false, showGuides: false, showGrid: true });
    expect(getEditorPreferences()).toEqual({ snapEnabled: false, showGuides: false, showGrid: true });
  });

  it("壊れた JSON / 不正な型は既定へフォールバック", () => {
    expect(parseEditorPreferences("{ broken")).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(parseEditorPreferences(JSON.stringify({ snapEnabled: "yes", showGrid: 1 }))).toEqual(
      DEFAULT_EDITOR_PREFERENCES,
    );
  });

  it("旧・新どちらの形（フラット / preferences ネスト）も読める", () => {
    expect(parseEditorPreferences(JSON.stringify({ snapEnabled: false, showGuides: true, showGrid: false })).snapEnabled).toBe(false);
    expect(
      parseEditorPreferences(JSON.stringify({ preferences: { snapEnabled: false, showGuides: true, showGrid: true } })).showGrid,
    ).toBe(true);
  });

  it("localStorage 不可でもクラッシュしない", () => {
    vi.unstubAllGlobals();
    expect(getEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(setEditorPreferences(DEFAULT_EDITOR_PREFERENCES)).toBe(false);
  });
});
