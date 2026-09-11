import { describe, it, expect } from "vitest";
import { evaluateCompatibility, roleOfPosition, isUnresolvedCompatibility } from "./position";

describe("ポジション適性の分類", () => {
  it("登録 = 配置 → exact", () => {
    expect(evaluateCompatibility("CB", "CB").status).toBe("exact");
  });

  it("同 role（DF内） → related（能力値は下げない）", () => {
    const r = evaluateCompatibility("CB", "RB");
    expect(r.status).toBe("related");
    expect(r.label).toContain("未確認");
  });

  it("role 違い（FW を DF へ）→ unresolved", () => {
    expect(evaluateCompatibility("CF", "CB").status).toBe("unresolved");
  });

  it("GK をフィールドへ → gkMismatch（不適性の可能性）", () => {
    expect(evaluateCompatibility("GK", "CB").status).toBe("gkMismatch");
  });
  it("フィールドを GK へ → gkMismatch", () => {
    expect(evaluateCompatibility("CB", "GK").status).toBe("gkMismatch");
  });
  it("GK を GK へ → exact", () => {
    expect(evaluateCompatibility("GK", "GK").status).toBe("exact");
  });

  it("登録ポジション不明 → unresolved", () => {
    expect(evaluateCompatibility(null, "CF").status).toBe("unresolved");
  });

  it("roleOfPosition", () => {
    expect(roleOfPosition("GK")).toBe("GK");
    expect(roleOfPosition("AMF")).toBe("MF");
    expect(roleOfPosition("SS")).toBe("FW");
    expect(roleOfPosition("???")).toBeNull();
  });

  it("isUnresolvedCompatibility", () => {
    expect(isUnresolvedCompatibility("related")).toBe(true);
    expect(isUnresolvedCompatibility("unresolved")).toBe(true);
    expect(isUnresolvedCompatibility("exact")).toBe(false);
    expect(isUnresolvedCompatibility("gkMismatch")).toBe(false);
  });
});
