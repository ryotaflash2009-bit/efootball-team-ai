import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// hydration の前に選んだ絞り込みが失われないこと（2026-10-05）。URL を変える select はすべて、描画した値と
// URL の項目名を持ち、コンポーネントが useAdoptPreHydrationSelects でマウント時に確認すること。
const FILES = ["src/components/world/WorldFilters.tsx", "src/components/managers/ManagerControls.tsx"];

describe("filter selects adopt values chosen before hydration", () => {
  for (const file of FILES) {
    it(file, () => {
      const src = readFileSync(file, "utf8");
      const selects = src.match(/<select[\s\S]*?>/g) ?? [];
      expect(selects.length).toBeGreaterThan(0);
      for (const tag of selects) {
        const value = tag.match(/\n\s*value=\{(.+)\}\n/)?.[1];
        expect(value, tag).toBeTruthy();
        expect(tag, tag).toMatch(/data-adopt-param="\w+"/);
        expect(tag, tag).toContain(`data-rendered-value={${value}}`);
      }
      expect(src).toMatch(/useAdoptPreHydrationSelects\(\w+Ref, push\)/);
      expect(src).toMatch(/<div ref=\{\w+Ref\}/);
    });
  }
});
