import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveApprovedBy } from "./approved-by";

describe("resolveApprovedBy", () => {
  it("Environment の承認者を起動した actor より優先する", () => {
    expect(resolveApprovedBy({ STAGE4_APPROVED_BY: "owner-login", GITHUB_ACTOR: "github-actions[bot]" })).toBe("owner-login");
  });

  it("承認者が無い・形式外なら actor、どちらも形式外なら固定値", () => {
    expect(resolveApprovedBy({ GITHUB_ACTOR: "owner-login" })).toBe("owner-login");
    expect(resolveApprovedBy({ STAGE4_APPROVED_BY: "a b; rm", GITHUB_ACTOR: "owner-login" })).toBe("owner-login");
    expect(resolveApprovedBy({ GITHUB_ACTOR: "github-actions[bot]" })).toBe("environment-approval");
    expect(resolveApprovedBy({})).toBe("environment-approval");
  });

  it("World・managers の apply CLI はどちらもこの関数で承認者を決める", () => {
    for (const f of ["stage4-world-cli.ts", "stage4-managers-cli.ts"]) {
      const src = readFileSync(path.join(__dirname, f), "utf8");
      expect(src, f).toContain("approvedBy: resolveApprovedBy(env)");
      expect(src, f).not.toContain('"environment-approval"');
    }
  });
});
