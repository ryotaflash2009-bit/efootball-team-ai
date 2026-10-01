import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * workflow_run の `workflows:` は GitHub ではフィルターのパターンとして扱われる（* ? + [ ] ! が特別な意味を持つ）。
 * 2026-10-02: 検出 workflow の名前に "+" が入っていたため一致せず、通知と自動進行の workflow が一度も起動していなかった。
 * 参照される名前が実在する workflow の name と完全に一致し、パターンの文字を含まないことを全 workflow で確かめる。
 */
const DIR = path.resolve(__dirname, "..", "..", "..", "..", ".github", "workflows");
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));
const read = (f: string) => readFileSync(path.join(DIR, f), "utf8");
const names = new Set(files.map((f) => /^name:\s*(.+?)\s*$/m.exec(read(f))?.[1]?.replace(/^["']|["']$/g, "")).filter(Boolean) as string[]);

describe("workflow_run の参照", () => {
  const refs = files.flatMap((f) => {
    const m = /workflow_run:\s*\n\s+workflows:\s*\[([^\]]*)\]/.exec(read(f));
    if (!m) return [];
    return m[1].split(",").map((s) => ({ file: f, name: s.trim().replace(/^["']|["']$/g, "") }));
  });

  it("通知と自動進行の workflow は検出 workflow を参照している", () => {
    const byFile = new Map(refs.map((r) => [r.file, r.name]));
    expect(byFile.get("reference-data-update-notify.yml")).toBe("Reference data update detection");
    expect(byFile.get("reference-data-update-orchestrator.yml")).toBe("Reference data update detection");
  });

  it("参照される名前は実在する workflow の name と完全一致し、フィルターのパターン文字を含まない", () => {
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(names.has(r.name), `${r.file} -> ${r.name}`).toBe(true);
      expect(r.name, `${r.file} -> ${r.name}`).not.toMatch(/[*?+[\]!]/);
    }
  });
});
