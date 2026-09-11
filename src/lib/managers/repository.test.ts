import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { listManagers, getManagerById, getManagerCount } from "./repository";
import { parseManagerListQuery } from "./schemas";
import { managerToContext } from "./to-context";
import { DB_PATH } from "@/lib/world/db";

const hasDb = fs.existsSync(DB_PATH);
const d = hasDb ? describe : describe.skip;

d("manager repository（実 DB）", () => {
  it("一覧: 総数 > 0・pageSize 以内", () => {
    const r = listManagers(parseManagerListQuery({ pageSize: "24" }));
    expect(r.totalCount).toBeGreaterThan(0);
    expect(r.managers.length).toBeLessThanOrEqual(24);
    expect(r.source).toContain("amine250");
  });

  it("getManagerCount と一覧 totalCount が一致", () => {
    expect(getManagerCount()).toBe(listManagers(parseManagerListQuery({})).totalCount);
  });

  it("検索: 名前部分一致（大文字小文字無視）", () => {
    const a = listManagers(parseManagerListQuery({ q: "conte", pageSize: "50" }));
    const b = listManagers(parseManagerListQuery({ q: "CONTE", pageSize: "50" }));
    expect(a.totalCount).toBe(b.totalCount);
    expect(a.totalCount).toBeGreaterThan(0);
    expect(a.managers.every((m) => m.nameEn.toLowerCase().includes("conte") || (m.teamName ?? "").toLowerCase().includes("conte"))).toBe(true);
  });

  it("フィルタ: ブースターあり / なし", () => {
    const withB = listManagers(parseManagerListQuery({ hasBooster: "1", pageSize: "100" }));
    expect(withB.managers.every((m) => m.hasBooster)).toBe(true);
    const noB = listManagers(parseManagerListQuery({ hasBooster: "0", pageSize: "100" }));
    expect(noB.managers.every((m) => !m.hasBooster)).toBe(true);
  });

  it("フィルタ: Link-Up Play あり", () => {
    const r = listManagers(parseManagerListQuery({ hasLinkUpPlay: "1", pageSize: "100" }));
    expect(r.managers.every((m) => m.hasLinkUpPlay)).toBe(true);
  });

  it("SQL インジェクション風・記号でも落ちない", () => {
    for (const q of ["'; DROP TABLE managers; --", "%%__", "@@@"]) {
      expect(listManagers(parseManagerListQuery({ q })).totalCount).toBeGreaterThanOrEqual(0);
    }
    expect(getManagerCount()).toBeGreaterThan(0);
  });

  it("詳細: Antonio Conte のブースター = Defensive Awareness +1 / Kicking Power +1（確認済み）", () => {
    const list = listManagers(parseManagerListQuery({ q: "Antonio Conte", pageSize: "10" }));
    const conte = list.managers.find((m) => m.sourceManagerId === "conte") ?? list.managers[0];
    const detail = getManagerById(conte.internalManagerId)!;
    expect(detail).not.toBeNull();
    const stats = detail.boosters.map((b) => `${b.statNameEn} ${b.rawValue}`).sort();
    expect(stats).toEqual(["Defensive Awareness +1", "Kicking Power +1"]);
    expect(detail.boosters.every((b) => b.confirmationStatus === "confirmed" && b.statKey)).toBe(true);
    // 戦術適性
    expect(detail.proficiencies.possessionGame).toBe(68);
    expect(detail.proficiencies.quickCounter).toBe(90);
    // Link-Up Play
    expect(detail.linkUpPlays.length).toBeGreaterThan(0);
    expect(detail.linkUpPlays[0].centerPiece).not.toBeNull();
  });

  it("同名監督が別カードとして保存されている（Pep Guardiola 等）", () => {
    const r = listManagers(parseManagerListQuery({ q: "guardiola", pageSize: "50" }));
    expect(r.totalCount).toBeGreaterThanOrEqual(2);
    const ids = new Set(r.managers.map((m) => m.internalManagerId));
    expect(ids.size).toBe(r.managers.length); // 全部別ID
  });

  it("詳細: 不正/存在しない ID は null", () => {
    expect(getManagerById("abc")).toBeNull();
    expect(getManagerById("999999")).toBeNull();
    expect(getManagerById("1; DROP")).toBeNull();
  });

  it("managerToContext: confirmed ブースターのみ confirmationStatus=confirmed", () => {
    const list = listManagers(parseManagerListQuery({ q: "Antonio Conte", pageSize: "10" }));
    const detail = getManagerById((list.managers.find((m) => m.sourceManagerId === "conte") ?? list.managers[0]).internalManagerId)!;
    const ctx = managerToContext(detail);
    expect(ctx.confirmationStatus).toBe("confirmed");
    expect(ctx.boosterEffects).toHaveLength(2);
    expect(ctx.boosterEffects.every((e) => e.statKey)).toBe(true);
  });

  it("ブースターなし監督の context は confirmationStatus=unresolved", () => {
    const noB = listManagers(parseManagerListQuery({ hasBooster: "0", pageSize: "5" }));
    if (noB.managers.length > 0) {
      const ctx = managerToContext(getManagerById(noB.managers[0].internalManagerId)!);
      expect(ctx.boosterEffects).toHaveLength(0);
      expect(ctx.confirmationStatus).toBe("unresolved");
    }
  });
});
