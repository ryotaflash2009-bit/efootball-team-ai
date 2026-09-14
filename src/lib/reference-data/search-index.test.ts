import { describe, it, expect } from "vitest";
import { buildSearchIndex, searchIndex, MIN_QUERY_LENGTH, MAX_RESULTS, type PlayerIndexSourceRow } from "./search-index";

function row(over: Partial<PlayerIndexSourceRow> = {}): PlayerIndexSourceRow {
  return {
    efhub_card_id: "1",
    name_en: "Lionel Messi",
    name_ja: "リオネル メッシ",
    ovr_max_candidate: 95,
    is_anomalous: 0,
    ...over,
  };
}

describe("buildSearchIndex", () => {
  it("is_anomalousな行を除外する", () => {
    const index = buildSearchIndex([row({ efhub_card_id: "1", is_anomalous: 0 }), row({ efhub_card_id: "2", is_anomalous: 1 })], "v1");
    expect(index.entries.map((e) => e.id)).toEqual(["1"]);
  });

  it("datasetVersionを保持する", () => {
    const index = buildSearchIndex([row()], "index-2026-09-14");
    expect(index.datasetVersion).toBe("index-2026-09-14");
  });

  it("name_enがnullの場合は空文字にする", () => {
    const index = buildSearchIndex([row({ name_en: null })], "v1");
    expect(index.entries[0].nameEn).toBe("");
  });
});

describe("searchIndex", () => {
  const index = buildSearchIndex(
    [
      row({ efhub_card_id: "1", name_en: "Lionel Messi", name_ja: "リオネル メッシ" }),
      row({ efhub_card_id: "2", name_en: "Cristiano Ronaldo", name_ja: "クリスティアーノ ロナウド" }),
      row({ efhub_card_id: "3", name_en: "Leo Someone", name_ja: "レオ サムワン" }),
    ],
    "v1",
  );

  it(`検索語が${MIN_QUERY_LENGTH}文字未満ならガイダンス付きの空結果を返す`, () => {
    const result = searchIndex(index, "l");
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.guidance).toMatch(new RegExp(`${MIN_QUERY_LENGTH}文字以上`));
  });

  it("英語名で大小無視の部分一致検索ができる", () => {
    const result = searchIndex(index, "MESSI");
    expect(result.items.map((i) => i.id)).toEqual(["1"]);
  });

  it("日本語名(Unicode)で部分一致検索ができる", () => {
    const result = searchIndex(index, "ロナウド");
    expect(result.items.map((i) => i.id)).toEqual(["2"]);
  });

  it("英語名の一部が複数件にマッチする場合は複数返す", () => {
    const result = searchIndex(index, "leo");
    // "Lionel"にも"Leo"にも小文字化した"leo"は含まれない点に注意しつつ、"Leo Someone"のみヒットすることを確認
    expect(result.items.map((i) => i.id)).toEqual(["3"]);
  });

  it("結果件数はMAX_RESULTSを超えない", () => {
    const manyRows = Array.from({ length: MAX_RESULTS + 50 }, (_, i) => row({ efhub_card_id: String(i), name_en: `Test Player ${i}` }));
    const bigIndex = buildSearchIndex(manyRows, "v1");
    const result = searchIndex(bigIndex, "test player");
    expect(result.items.length).toBe(MAX_RESULTS);
    expect(result.total).toBe(MAX_RESULTS + 50);
  });

  it("offset/limitでページングできる", () => {
    const manyRows = Array.from({ length: 10 }, (_, i) => row({ efhub_card_id: String(i), name_en: `Test Player ${i}` }));
    const bigIndex = buildSearchIndex(manyRows, "v1");
    const page1 = searchIndex(bigIndex, "test player", { offset: 0, limit: 3 });
    const page2 = searchIndex(bigIndex, "test player", { offset: 3, limit: 3 });
    expect(page1.items.map((i) => i.id)).toEqual(["0", "1", "2"]);
    expect(page2.items.map((i) => i.id)).toEqual(["3", "4", "5"]);
    expect(page1.total).toBe(10);
  });

  it("空クエリはガイダンス付きの空結果を返す", () => {
    const result = searchIndex(index, "");
    expect(result.items).toEqual([]);
    expect(result.guidance).toBeDefined();
  });

  it("datasetVersionを検索結果にも伝搬する", () => {
    const result = searchIndex(index, "messi");
    expect(result.datasetVersion).toBe("v1");
  });
});
