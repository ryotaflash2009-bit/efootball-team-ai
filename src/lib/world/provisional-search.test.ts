import { describe, expect, it } from "vitest";
import { searchProvisionalPlayers } from "./repository";
import type { WorldPlayerListItem } from "./types";

const row = (id: string, en: string, ja: string | null) => ({ worldCardId: id, nameEn: en, nameJa: ja }) as WorldPlayerListItem;
const ROWS = [row("105891076673336", "Joane Gadou", null), row("100000000000001", "Serhou Guirassy", "セル ギラシ"), row("100000000000002", "Mbappé", "エムバペ")];

describe("暫定のカードの検索（2026-10-24）", () => {
  it("英語名・日本語名の部分一致、かなの違い（ひらがな）、アクセントの違い、World ID の完全一致", () => {
    expect(searchProvisionalPlayers("guirassy", 20, ROWS).map((p) => p.nameEn)).toEqual(["Serhou Guirassy"]);
    expect(searchProvisionalPlayers("ぎらし", 20, ROWS).map((p) => p.nameEn)).toEqual(["Serhou Guirassy"]);
    expect(searchProvisionalPlayers("mbappe", 20, ROWS).map((p) => p.nameEn)).toEqual(["Mbappé"]);
    expect(searchProvisionalPlayers("105891076673336", 20, ROWS).map((p) => p.nameEn)).toEqual(["Joane Gadou"]);
  });
  it("1 文字・合わない語は空、件数の上限", () => {
    expect(searchProvisionalPlayers("g", 20, ROWS)).toEqual([]);
    expect(searchProvisionalPlayers("zzzz", 20, ROWS)).toEqual([]);
    expect(searchProvisionalPlayers("ou", 1, ROWS)).toHaveLength(1);
  });
});
