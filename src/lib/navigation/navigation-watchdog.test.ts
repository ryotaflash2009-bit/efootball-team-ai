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

describe("navigation watchdog: early fallback after the RSC response", () => {
  function earlySetup() {
    let href = "https://example.test/players";
    let now = 0;
    let rscAt: number | null = null;
    let lastNet = 0;
    const assigned: string[] = [];
    const timers: { id: number; at: number; fn: () => void }[] = [];
    let next = 1;
    const watchdog = createNavigationWatchdog({
      href: () => href,
      assign: (url) => assigned.push(url),
      setTimeout: (fn, ms) => {
        const id = next++;
        timers.push({ id, at: now + ms, fn });
        return id;
      },
      clearTimeout: (id) => {
        const i = timers.findIndex((t) => t.id === id);
        if (i >= 0) timers.splice(i, 1);
      },
      early: { now: () => now, rscCompletedAt: () => rscAt, lastNetworkActivityAt: () => lastNet },
    });
    const advance = (to: number) => {
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const t = timers[0];
        if (!t || t.at > to) break;
        timers.shift();
        now = t.at;
        t.fn();
      }
      now = to;
    };
    return {
      watchdog, assigned, timers, advance,
      rsc: (at: number) => { rscAt = at; lastNet = Math.max(lastNet, at); },
      net: (at: number) => { lastNet = at; },
      go: (u: string) => (href = u),
    };
  }

  it("a hung navigation falls back about 1.5 s after the RSC response (not 5 s)", () => {
    const s = earlySetup();
    s.watchdog("/players/world/1", "push");
    s.rsc(300);
    s.advance(1700);
    expect(s.assigned).toEqual([]);
    s.advance(2100);
    expect(s.assigned).toEqual(["https://example.test/players/world/1"]);
    expect(s.timers.length).toBe(0);
  });

  it("does not fall back early while the network is still busy", () => {
    const s = earlySetup();
    s.watchdog("/players/world/1", "push");
    s.rsc(300);
    s.net(1900); // a chunk finished late
    s.advance(2200);
    expect(s.assigned).toEqual([]);
    s.advance(2500);
    expect(s.assigned).toEqual(["https://example.test/players/world/1"]);
  });

  it("without an RSC response (slow network or prefetched), only the 5 s rule applies", () => {
    const s = earlySetup();
    s.watchdog("/players/world/1", "push");
    s.advance(4900);
    expect(s.assigned).toEqual([]);
    s.advance(5000);
    expect(s.assigned).toEqual(["https://example.test/players/world/1"]);
  });

  it("a normal navigation that commits right after the RSC response never falls back", () => {
    const s = earlySetup();
    s.watchdog("/players/world/1", "push");
    s.rsc(900);
    s.advance(1000);
    s.go("https://example.test/players/world/1");
    s.advance(10000);
    expect(s.assigned).toEqual([]);
    expect(s.timers.length).toBe(0);
  });

  it("a newer navigation or back/forward cancels the early check too", () => {
    const s = earlySetup();
    s.watchdog("/players/world/1", "push");
    s.rsc(300);
    s.watchdog("/", "traverse");
    s.advance(10000);
    expect(s.assigned).toEqual([]);
    expect(s.timers.length).toBe(0);
  });
});
