import { describe, it, expect } from "vitest";
import {
  normalizeText,
  filterPlayers,
  sortPlayers,
  parseSortKey,
  queryPlayers,
} from "./players";
import { normalizeRawEntry } from "./schema";
import type { PlayerSummary } from "./types";

const sample: PlayerSummary[] = [
  { id: "1001", nameJa: "リオネル メッシ", nameEn: "Lionel Messi", ovr: 97 },
  { id: "1002", nameJa: "アーリング ハーランド", nameEn: "Erling Haaland", ovr: 95 },
  { id: "1003", nameJa: "キリアン エムバペ", nameEn: "Kylian Mbappe", ovr: 96 },
  { id: "1004", nameJa: "メルヴァン バール", nameEn: "Melvin Bard", ovr: 78 },
];

describe("normalizeText", () => {
  it("前後の空白を除去して小文字化する", () => {
    expect(normalizeText("  Messi  ")).toBe("messi");
  });
  it("全角スペースを半角に変換する", () => {
    expect(normalizeText("Lionel　Messi")).toBe("lionel messi");
  });
});

describe("filterPlayers", () => {
  it("空文字なら全件返す", () => {
    expect(filterPlayers(sample, "")).toHaveLength(4);
  });
  it("日本語名の部分一致で絞り込める", () => {
    const r = filterPlayers(sample, "メッシ");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("1001");
  });
  it("英語名の部分一致（大文字小文字を無視）で絞り込める", () => {
    const r = filterPlayers(sample, "haaland");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("1002");
  });
  it("選手IDの完全一致で絞り込める", () => {
    const r = filterPlayers(sample, "1003");
    expect(r).toHaveLength(1);
    expect(r[0].nameEn).toBe("Kylian Mbappe");
  });
  it("一致しなければ空配列", () => {
    expect(filterPlayers(sample, " zzzzz")).toHaveLength(0);
  });
});

describe("sortPlayers", () => {
  it("OVR 降順", () => {
    const r = sortPlayers(sample, "ovr_desc");
    expect(r.map((p) => p.ovr)).toEqual([97, 96, 95, 78]);
  });
  it("OVR 昇順", () => {
    const r = sortPlayers(sample, "ovr_asc");
    expect(r.map((p) => p.ovr)).toEqual([78, 95, 96, 97]);
  });
  it("元の配列を変更しない", () => {
    const copy = [...sample];
    sortPlayers(sample, "ovr_asc");
    expect(sample).toEqual(copy);
  });
});

describe("parseSortKey", () => {
  it("既知の値はそのまま返す", () => {
    expect(parseSortKey("ovr_asc")).toBe("ovr_asc");
    expect(parseSortKey("name")).toBe("name");
  });
  it("不明な値・空・null は ovr_desc にフォールバック", () => {
    expect(parseSortKey("xxx")).toBe("ovr_desc");
    expect(parseSortKey(null)).toBe("ovr_desc");
    expect(parseSortKey(undefined)).toBe("ovr_desc");
  });
});

describe("queryPlayers", () => {
  it("検索 + 並べ替え + 件数制限をまとめて適用する", () => {
    const { players, total } = queryPlayers(sample, { q: "a", sort: "ovr_desc", limit: 2 });
    // 英語名に 'a' を含む: Haaland(95), Mbappe(96), Bard(78)
    expect(total).toBe(3);
    expect(players).toHaveLength(2);
    expect(players[0].ovr).toBe(96);
  });
});

describe("normalizeRawEntry", () => {
  it("i/e/j/o をアプリ内部型へ正規化し、id を文字列化する", () => {
    const r = normalizeRawEntry({ i: 105845711048063, e: "Melvin Bard", j: "メルヴァン バール", o: 97 });
    expect(r).toEqual({
      id: "105845711048063",
      nameEn: "Melvin Bard",
      nameJa: "メルヴァン バール",
      ovr: 97,
    });
  });
  it("o が文字列でも数値化する", () => {
    const r = normalizeRawEntry({ i: "1", e: "A", j: "エー", o: "88" });
    expect(r.ovr).toBe(88);
  });
});
