import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

/** UI の角・端の位置は start-/end-（RTL で鏡像になる）。ピッチの座標・中央寄せ・装飾だけが left-/right- のまま（docs/i18n/rtl-position-utilities.md）。 */
describe("RTL: 物理的な位置の指定の回帰", () => {
  it("論理プロパティへ直すべき指定（TO_LOGICAL）が 0", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const out = execFileSync(process.execPath, [path.join(root, "scripts/i18n-rtl-position-audit.mjs"), "--check"], { cwd: root, encoding: "utf8" });
    expect(out).toMatch(/no TO_LOGICAL left/);
  });
});
