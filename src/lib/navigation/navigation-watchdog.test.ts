import { describe, expect, it } from "vitest";
import { createNavigationWatchdog, NAVIGATION_WATCHDOG_MS } from "./navigation-watchdog";

function setup(start = "https://example.test/players") {
  let href = start;
  const assigned: string[] = [];
  const timers = new Map<number, () => void>();
  let next = 1;
  const watchdog = createNavigationWatchdog({
    href: () => href,
    assign: (url) => assigned.push(url),
    setTimeout: (fn, ms) => {
      expect(ms).toBe(NAVIGATION_WATCHDOG_MS);
      const id = next++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id as number),
  });
  const fire = () => {
    const fns = [...timers.values()];
    timers.clear();
    fns.forEach((fn) => fn());
  };
  return { watchdog, assigned, timers, fire, go: (u: string) => (href = u) };
}

describe("navigation watchdog", () => {
  it("falls back to a browser navigation when the navigation never commits", () => {
    const s = setup();
    s.watchdog("/players?q=Messi", "push");
    s.fire();
    expect(s.assigned).toEqual(["https://example.test/players?q=Messi"]);
  });

  it("does nothing when the navigation committed", () => {
    const s = setup();
    s.watchdog("/players/world/1", "push");
    s.go("https://example.test/players/world/1");
    s.fire();
    expect(s.assigned).toEqual([]);
  });

  it("does nothing when the URL changed for another reason (redirect, another action)", () => {
    const s = setup();
    s.watchdog("/players/1", "push");
    s.go("https://example.test/players/world/1");
    s.fire();
    expect(s.assigned).toEqual([]);
  });

  it("a newer navigation cancels the previous watch", () => {
    const s = setup();
    s.watchdog("/players?q=a", "push");
    s.watchdog("/players?q=ab", "replace");
    expect(s.timers.size).toBe(1);
    s.fire();
    expect(s.assigned).toEqual(["https://example.test/players?q=ab"]);
  });

  it("ignores back/forward, other origins and same-URL navigations", () => {
    const s = setup("https://example.test/players?q=a#top");
    s.watchdog("/managers", "traverse");
    s.watchdog("https://other.test/players", "push");
    s.watchdog("/players?q=a", "push");
    s.watchdog("/players?q=a#list", "push");
    expect(s.timers.size).toBe(0);
  });

  it("a back/forward navigation cancels a pending watch", () => {
    const s = setup();
    s.watchdog("/managers", "push");
    s.watchdog("/", "traverse");
    expect(s.timers.size).toBe(0);
  });
});
