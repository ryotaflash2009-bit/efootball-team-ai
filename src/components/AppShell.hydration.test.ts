import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// React #418（2026-10-04 に原因を特定）: 殻の <main> の直下で、ページの segment を明示の Suspense で囲む。
// 外すと、cold の streaming で segment が遅れたときに hydration の不一致が再発する（再現: scripts/probe-react-418-local.mjs）。
const src = readFileSync(path.join(__dirname, "AppShell.tsx"), "utf8");

describe("AppShell の hydration 境界", () => {
  it("<main> の中で children を Suspense で囲む", () => {
    const main = /<main className="min-w-0 flex-1">([\s\S]*?)<\/main>/.exec(src)?.[1] ?? "";
    expect(main).toMatch(/<Suspense fallback=\{null\}>\{children\}<\/Suspense>/);
    expect(main.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/<Suspense fallback=\{null\}>\{children\}<\/Suspense>/, "").trim()).toBe("");
  });
});
