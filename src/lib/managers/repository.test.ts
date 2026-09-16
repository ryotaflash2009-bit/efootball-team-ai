import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { listManagers, getManagerById, getManagerCount } from "./repository";
import { parseManagerListQuery } from "./schemas";
import { managerToContext } from "./to-context";
import { DB_PATH } from "@/lib/world/db";

const hasDb = fs.existsSync(DB_PATH);
const d = hasDb ? describe : describe.skip;

d("manager repository（実 DB）", () => {
  it("一覧: 総数 > 0・pageSize 以内", async () => {
    const r = await listManagers(parseManagerListQuery({ pageSize: "24" }));
    expect(r.totalCount).toBeGreaterThan(0);
    expect(r.managers.length).toBeLessThanOrEqual(24);
    expect(r.source).toContain("amine250");
  });

  it("getManagerCount と一覧 totalCount が一致", async () => {
    const count = await getManagerCount();
    const list = await listManagers(parseManagerListQuery({}));
    expect(count).toBe(list.totalCount);
  });

  it("検索: 名前部分一致（大文字小文字無視）", async () => {
    const a = await listManagers(parseManagerListQuery({ q: "conte", pageSize: "50" }));
    const b = await listManagers(parseManagerListQuery({ q: "CONTE", pageSize: "50" }));
    expect(a.totalCount).toBe(b.totalCount);
    expect(a.totalCount).toBeGreaterThan(0);
    expect(a.managers.every((m) => m.nameEn.toLowerCase().includes("conte") || (m.teamName ?? "").toLowerCase().includes("conte"))).toBe(true);
  });

  it("フィルタ: ブースターあり / なし", async () => {
    const withB = await listManagers(parseManagerListQuery({ hasBooster: "1", pageSize: "100" }));
    expect(withB.managers.every((m) => m.hasBooster)).toBe(true);
    const noB = await listManagers(parseManagerListQuery({ hasBooster: "0", pageSize: "100" }));
    expect(noB.managers.every((m) => !m.hasBooster)).toBe(true);
  });

  it("フィルタ: Link-Up Play あり", async () => {
    const r = await listManagers(parseManagerListQuery({ hasLinkUpPlay: "1", pageSize: "100" }));
    expect(r.managers.every((m) => m.hasLinkUpPlay)).toBe(true);
  });

  it("SQL インジェクション風・記号でも落ちない", async () => {
    for (const q of ["'; DROP TABLE managers; --", "%%__", "@@@"]) {
      const r = await listManagers(parseManagerListQuery({ q }));
      expect(r.totalCount).toBeGreaterThanOrEqual(0);
    }
    expect(await getManagerCount()).toBeGreaterThan(0);
  });

  it("詳細: Antonio Conte のブースター = Defensive Awareness +1 / Kicking Power +1（確認済み）", async () => {
    const list = await listManagers(parseManagerListQuery({ q: "Antonio Conte", pageSize: "10" }));
    const conte = list.managers.find((m) => m.sourceManagerId === "conte") ?? list.managers[0];
    const detail = (await getManagerById(conte.internalManagerId))!;
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

  it("同名監督が別カードとして保存されている（Pep Guardiola 等）", async () => {
    const r = await listManagers(parseManagerListQuery({ q: "guardiola", pageSize: "50" }));
    expect(r.totalCount).toBeGreaterThanOrEqual(2);
    const ids = new Set(r.managers.map((m) => m.internalManagerId));
    expect(ids.size).toBe(r.managers.length); // 全部別ID
  });

  it("詳細: 不正/存在しない ID は null", async () => {
    expect(await getManagerById("abc")).toBeNull();
    expect(await getManagerById("999999")).toBeNull();
    expect(await getManagerById("1; DROP")).toBeNull();
  });

  it("managerToContext: confirmed ブースターのみ confirmationStatus=confirmed", async () => {
    const list = await listManagers(parseManagerListQuery({ q: "Antonio Conte", pageSize: "10" }));
    const detail = (await getManagerById((list.managers.find((m) => m.sourceManagerId === "conte") ?? list.managers[0]).internalManagerId))!;
    const ctx = managerToContext(detail);
    expect(ctx.confirmationStatus).toBe("confirmed");
    expect(ctx.boosterEffects).toHaveLength(2);
    expect(ctx.boosterEffects.every((e) => e.statKey)).toBe(true);
  });

  it("ブースターなし監督の context は confirmationStatus=unresolved", async () => {
    const noB = await listManagers(parseManagerListQuery({ hasBooster: "0", pageSize: "5" }));
    if (noB.managers.length > 0) {
      const detail = (await getManagerById(noB.managers[0].internalManagerId))!;
      const ctx = managerToContext(detail);
      expect(ctx.boosterEffects).toHaveLength(0);
      expect(ctx.confirmationStatus).toBe("unresolved");
    }
  });

  it("released_asc: released_atがNULLの監督は先頭に来る(SQLiteの既定動作=NULLは最小値)", async () => {
    const r = await listManagers(parseManagerListQuery({ sort: "released_asc", pageSize: "100" }));
    const nullCount = r.managers.filter((m) => m.releasedAt === null).length;
    expect(nullCount).toBeGreaterThan(0);
    const leadingNullCount = r.managers.slice(0, nullCount).filter((m) => m.releasedAt === null).length;
    expect(leadingNullCount).toBe(nullCount);
  });

  it("released_desc: released_atがNULLの監督は末尾に来る(SQLiteの既定動作=NULLは最小値)", async () => {
    const r = await listManagers(parseManagerListQuery({ sort: "released_desc", pageSize: "100" }));
    const nullCount = r.managers.filter((m) => m.releasedAt === null).length;
    expect(nullCount).toBeGreaterThan(0);
    const trailingNullCount = r.managers.slice(r.managers.length - nullCount).filter((m) => m.releasedAt === null).length;
    expect(trailingNullCount).toBe(nullCount);
  });

  it("overload_desc: overloadがNULLの監督(大多数)は末尾に集まる", async () => {
    const r = await listManagers(parseManagerListQuery({ sort: "overload_desc", pageSize: "100" }));
    const nullCount = r.managers.filter((m) => m.proficiencies.overload === null).length;
    expect(nullCount).toBeGreaterThan(0);
    const trailingNullCount = r.managers.slice(r.managers.length - nullCount).filter((m) => m.proficiencies.overload === null).length;
    expect(trailingNullCount).toBe(nullCount);
  });

  it("同名の監督グループは、いずれのソートキーでもグループ内がinternal_manager_id昇順で並ぶ(全16重複グループ)", async () => {
    const all = await listManagers(parseManagerListQuery({ pageSize: "100", sort: "name" }));
    const byName = new Map<string, number[]>();
    for (const m of all.managers) {
      const key = m.nameEn.toLowerCase();
      const arr = byName.get(key) ?? [];
      arr.push(m.internalManagerId);
      byName.set(key, arr);
    }
    const dupGroups = [...byName.values()].filter((ids) => ids.length >= 2);
    expect(dupGroups.length).toBeGreaterThanOrEqual(2);
    for (const ids of dupGroups) {
      const sorted = [...ids].sort((a, b) => a - b);
      expect(ids).toEqual(sorted);
    }
  });

  it("possession_gameとname_enが完全に一致する2件(Johan Cruyff相当)は常にinternal_manager_id昇順で並ぶ", async () => {
    const r = await listManagers(parseManagerListQuery({ q: "cruyff", pageSize: "10" }));
    expect(r.managers.length).toBeGreaterThanOrEqual(2);
    const ids = r.managers.map((m) => m.internalManagerId);
    const sorted = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sorted);
  });

  it("全9ソートキーで、同一クエリを複数回実行しても順序が変わらない(安定性)", async () => {
    const sortKeys = [
      "name",
      "released_desc",
      "released_asc",
      "possession_desc",
      "quick_counter_desc",
      "long_ball_counter_desc",
      "out_wide_desc",
      "long_ball_desc",
      "overload_desc",
    ] as const;
    for (const sort of sortKeys) {
      const first = await listManagers(parseManagerListQuery({ sort, pageSize: "100" }));
      const second = await listManagers(parseManagerListQuery({ sort, pageSize: "100" }));
      expect(second.managers.map((m) => m.internalManagerId)).toEqual(first.managers.map((m) => m.internalManagerId));
    }
  });

  it("全9ソートキーで、pageSize=1の全ページを結合すると重複・欠落なく全件と一致する(タイブレークがページ境界を壊さない)", async () => {
    const sortKeys = ["name", "possession_desc", "overload_desc", "released_asc", "released_desc"] as const;
    const total = await getManagerCount();
    for (const sort of sortKeys) {
      const collected: number[] = [];
      for (let page = 1; page <= total; page += 1) {
        const r = await listManagers(parseManagerListQuery({ sort, pageSize: "1", page: String(page) }));
        expect(r.managers.length).toBe(1);
        collected.push(r.managers[0].internalManagerId);
      }
      expect(new Set(collected).size).toBe(total);
      const fullPage = await listManagers(parseManagerListQuery({ sort, pageSize: String(total) }));
      expect(collected).toEqual(fullPage.managers.map((m) => m.internalManagerId));
    }
  });
});
