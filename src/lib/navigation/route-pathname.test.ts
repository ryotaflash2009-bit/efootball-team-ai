import { describe, it, expect } from "vitest";
import { routePathname } from "./route-pathname";

describe("routePathname", () => {
  it("ISR の作り直しの /index はホーム（/）", () => {
    expect(routePathname("/index")).toBe("/");
  });
  it("空・null はホーム、それ以外はそのまま", () => {
    expect(routePathname(null)).toBe("/");
    expect(routePathname("")).toBe("/");
    expect(routePathname("/")).toBe("/");
    expect(routePathname("/players")).toBe("/players");
    expect(routePathname("/players/index")).toBe("/players/index");
  });
});
