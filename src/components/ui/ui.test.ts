import { describe, it, expect } from "vitest";
import { buttonClasses } from "./Button";
import { CONTAINER_MAXW } from "./layout";
import { ICON_NAMES, iconHasPath } from "./Icon";

describe("buttonClasses", () => {
  it("variant ごとに異なるクラスを返す", () => {
    const primary = buttonClasses("primary", "md");
    const danger = buttonClasses("danger", "md");
    expect(primary).toContain("bg-accent");
    expect(primary).toContain("text-accent-ink");
    expect(danger).toContain("text-danger");
    expect(primary).not.toBe(danger);
  });
  it("size ごとに高さクラスが変わる", () => {
    expect(buttonClasses("primary", "sm")).toContain("h-8");
    expect(buttonClasses("primary", "md")).toContain("h-10");
    expect(buttonClasses("primary", "lg")).toContain("h-11");
  });
  it("フォーカスリングと無効時スタイルを常に含む", () => {
    const c = buttonClasses("ghost", "md");
    expect(c).toContain("focus-visible:outline");
    expect(c).toContain("disabled:opacity-45");
  });
  it("追加クラスを末尾へ連結", () => {
    expect(buttonClasses("primary", "md", "w-full")).toMatch(/w-full$/);
  });
});

describe("CONTAINER_MAXW", () => {
  it("4種の幅トークンを持つ", () => {
    expect(Object.keys(CONTAINER_MAXW).sort()).toEqual(["full", "regular", "wide", "xwide"]);
    expect(CONTAINER_MAXW.wide).toBe("max-w-content-wide");
    expect(CONTAINER_MAXW.full).toBe("max-w-content-full");
  });
});

describe("Icon", () => {
  it("サイドバー・ヘッダーで使うアイコンが定義済み", () => {
    for (const n of ["home", "players", "managers", "compare", "squad", "search", "menu", "close", "plus", "check"]) {
      expect(iconHasPath(n)).toBe(true);
    }
    expect(ICON_NAMES.length).toBeGreaterThan(20);
  });
  it("未定義アイコン名は false", () => {
    expect(iconHasPath("not-an-icon")).toBe(false);
  });
});
