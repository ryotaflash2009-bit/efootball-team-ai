import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { decideDisplay, PENDING_EXTERNAL_SOURCE, SYNTHETIC_PACK, SYNTHETIC_TIER_LIST, type DataSource } from "./model";

const base: DataSource = { kind: "synthetic", label: "x", url: null, updatedAt: "2026-10-02T00:00:00Z", rightsStatus: "synthetic" };

describe("Tier・Pack の表示の可否", () => {
  it("合成は内部の試作画面だけで表示し、公開画面では出さない", () => {
    expect(decideDisplay(base, "internal_preview")).toEqual({ display: true, label: "合成データ（例）" });
    expect(decideDisplay(base, "public")).toEqual({ display: false, reason: "synthetic_not_public" });
  });

  it("外部は権利の確認済みだけ。確認待ち・状態の食い違いは出さない", () => {
    expect(decideDisplay(PENDING_EXTERNAL_SOURCE, "public")).toEqual({ display: false, reason: "rights_pending" });
    expect(decideDisplay(PENDING_EXTERNAL_SOURCE, "internal_preview")).toEqual({ display: false, reason: "rights_pending" });
    expect(decideDisplay({ ...base, kind: "external", rightsStatus: "own_data" }, "public")).toMatchObject({ display: false });
    expect(decideDisplay({ ...base, kind: "external", label: "X", rightsStatus: "cleared" }, "public")).toEqual({ display: true, label: "出典: X" });
  });

  it("自前の規則は own_data のときだけ。情報源の名前・更新時刻が無ければ出さない", () => {
    expect(decideDisplay({ ...base, kind: "own_rules", rightsStatus: "own_data" }, "public")).toMatchObject({ display: true });
    expect(decideDisplay({ ...base, kind: "own_rules", rightsStatus: "pending" }, "public")).toMatchObject({ display: false });
    expect(decideDisplay({ ...base, updatedAt: "?" }, "internal_preview")).toEqual({ display: false, reason: "invalid_source" });
  });
});

describe("合成モックに外部・実在のデータが無い", () => {
  const src = readFileSync(path.join(__dirname, "model.ts"), "utf8");
  it("URL・数字の長い ID を持たず、名前は Sample で始まる架空のものだけ", () => {
    expect(src).not.toMatch(/https?:\/\//);
    expect(src).not.toMatch(/\b\d{8,}\b/);
    for (const e of SYNTHETIC_TIER_LIST.entries) expect(e.name).toMatch(/^Sample /);
    for (const f of SYNTHETIC_PACK.featured) expect(f.name).toMatch(/^Sample /);
    expect(SYNTHETIC_TIER_LIST.source.url).toBeNull();
    expect(PENDING_EXTERNAL_SOURCE.url).toBeNull();
  });
  it("取得・保存の処理を持たない（fetch・storage を使わない）", () => {
    expect(src).not.toMatch(/\bfetch\(|localStorage|indexedDB|writeFile/);
  });
});
