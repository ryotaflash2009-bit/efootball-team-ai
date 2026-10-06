import { describe, expect, it } from "vitest";
import { accentInsensitivePattern, foldAccents, kanaInsensitivePattern, normalizeSearchQuery } from "./search-normalize";
import { buildSearchOrFilter, parsePostgrestOrExpression } from "./postgrest-filter";

/** PostgreSQL の ~*（imatch）と同じく大文字・小文字を区別しない一致（文字クラスだけを使うため JS の正規表現で同じ結果）。 */
const matches = (query: string, name: string) => {
  const p = accentInsensitivePattern(query);
  return p !== null && new RegExp(p, "i").test(name);
};

describe("検索語の正規化（多言語）", () => {
  it("NFKC: 全角英数・半角カナ・余分な空白", () => {
    expect(normalizeSearchQuery("ＭＥＳＳＩ")).toBe("MESSI");
    expect(normalizeSearchQuery("  Lionel   Messi ")).toBe("Lionel Messi");
    expect(normalizeSearchQuery("ﾒｯｼ")).toBe("メッシ");
  });

  it("アクセントを区別しない（スペイン語・ポルトガル語・フランス語・ドイツ語・東欧の名前）", () => {
    expect(matches("muller", "Thomas Müller")).toBe(true);
    expect(matches("ibrahimovic", "Zlatan Ibrahimović")).toBe(true);
    expect(matches("joao felix", "João Félix")).toBe(true);
    expect(matches("mbappe", "Kylian Mbappé")).toBe(true);
    expect(matches("nunez", "Darwin Núñez")).toBe(true);
    expect(matches("odegaard", "Martin Ødegaard")).toBe(true);
    expect(matches("lewandowski", "Robert Lewandowski")).toBe(true);
    expect(matches("szczesny", "Wojciech Szczęsny")).toBe(true);
  });

  it("アクセントつきの検索語でも、アクセントの無い名前に一致する。大文字・小文字・全角も区別しない", () => {
    expect(matches("Müller", "Thomas Muller")).toBe(true);
    expect(matches("MBAPPÉ", "kylian mbappe")).toBe(true);
    expect(matches("ＭＢＡＰＰＥ", "Kylian Mbappé")).toBe(true);
  });

  it("ドイツ語の ß は ss と同じ。トルコ語の ı / İ は i と同じ", () => {
    expect(matches("strasse", "Straße")).toBe(true);
    expect(matches("Straße", "Strasse")).toBe(true);
    expect(matches("calhanoglu", "Hakan Çalhanoğlu")).toBe(true);
    expect(matches("yildiz", "Kenan Yıldız")).toBe(true);
    expect(foldAccents("İstanbul")).toBe("istanbul");
  });

  it("誤った一致をしない（別の綴り・部分の違い）", () => {
    expect(matches("muller", "Mueller Smith")).toBe(false); // ü を ue に展開しない（根拠のない別名を作らない）
    expect(matches("messi", "Mesut Özil")).toBe(false);
    expect(matches("nunez", "Nunes")).toBe(false);
    expect(matches("joao", "Jonas")).toBe(false);
    expect(matches("ss", "Silva")).toBe(false);
  });

  it("正規表現の記号は文字どおり（検索語で条件を作れない）", () => {
    expect(matches("a.b", "aXb")).toBe(false);
    expect(matches("a.b", "a.b")).toBe(true);
    expect(matches("(x)|y", "y")).toBe(false);
    expect(matches("o'neil", "O'Neil")).toBe(true);
  });

  it("日本語だけの検索語・長すぎる検索語では作らない（従来の部分一致だけ）", () => {
    expect(accentInsensitivePattern("メッシ")).toBeNull();
    expect(accentInsensitivePattern("a".repeat(81))).toBeNull();
  });

  it("フィルター: 指定した列だけに imatch を追加し、既存の ilike・ID の完全一致はそのまま", () => {
    const spec = { likeColumns: ["name_en", "name_ja"], exact: { column: "world_card_id", pattern: /^[0-9]{1,20}$/ }, accentInsensitiveColumns: ["name_en"] } as const;
    const parsed = parsePostgrestOrExpression(buildSearchOrFilter(spec, "Müller"));
    expect(parsed.map((p) => `${p.field}.${p.op}`)).toEqual(["name_en.ilike", "name_ja.ilike", "name_en.imatch"]);
    expect(parsePostgrestOrExpression(buildSearchOrFilter(spec, "メッシ")).map((p) => p.op)).toEqual(["ilike", "ilike"]);
    expect(() => buildSearchOrFilter({ likeColumns: ["name_en"], accentInsensitiveColumns: ["name_en;drop"] }, "x")).toThrow();
  });
});

describe("検索語の正規化 v2（2026-10-07）", () => {
  const kana = (query: string, name: string) => {
    const p = kanaInsensitivePattern(query);
    return p !== null && new RegExp(p).test(name);
  };

  it("言語ごとのアクセント（es・pt・fr・de・tr）", () => {
    expect(matches("nunez", "Darwin Núñez")).toBe(true);
    expect(matches("joao felix", "João Félix")).toBe(true);
    expect(matches("mbappe", "Kylian Mbappé")).toBe(true);
    expect(matches("gundogan", "İlkay Gündoğan")).toBe(true);
    expect(matches("ilkay", "İlkay Gündoğan")).toBe(true);
    expect(matches("calhanoglu", "Hakan Çalhanoğlu")).toBe(true);
    expect(matches("strasse", "Straße")).toBe(true);
    expect(matches("muller", "Thomas Müller")).toBe(true);
  });

  it("全角・半角は NFKC で同じに扱う", () => {
    expect(matches("ＭＥＳＳＩ", "Lionel Messi")).toBe(true);
    expect(normalizeSearchQuery("ﾒｯｼ")).toBe("メッシ");
  });

  it("短すぎる・記号だけの検索語では正規表現を作らない（部分一致だけ）", () => {
    expect(accentInsensitivePattern("a")).toBeNull();
    expect(accentInsensitivePattern("é")).toBeNull();
    expect(accentInsensitivePattern("!!!")).toBeNull();
    expect(accentInsensitivePattern("--")).toBeNull();
    expect(kanaInsensitivePattern("め")).toBeNull();
    expect(kanaInsensitivePattern("!?")).toBeNull();
  });

  it("韓国語・中国語は正規表現を作らない（部分一致だけ・簡体字と繁体字を同一視しない）", () => {
    expect(accentInsensitivePattern("손흥민")).toBeNull();
    expect(kanaInsensitivePattern("손흥민")).toBeNull();
    expect(accentInsensitivePattern("梅西")).toBeNull();
    expect(kanaInsensitivePattern("梅西")).toBeNull();
    expect(kanaInsensitivePattern("C罗")).toBeNull();
  });

  it("ひらがな・カタカナを区別しない（日本語の名前の列）", () => {
    expect(kana("めっし", "リオネル・メッシ")).toBe(true);
    expect(kana("メッシ", "めっし")).toBe(true);
    expect(kana("ろなうど", "クリスティアーノ・ロナウド")).toBe(true);
    expect(kana("めっし", "ネイマール")).toBe(false);
    expect(kana("でぃ・まりあ", "ディ・マリア")).toBe(true);
    expect(kanaInsensitivePattern("メッシ.")).toBe(String.raw`[めメ][っッ][しシ]\.`);
  });

  it("誤一致しない（別の文字・衝突）", () => {
    expect(matches("neymar", "Neyman")).toBe(false);
    expect(matches("son", "Sön")).toBe(true);
    expect(matches("sane", "Sané")).toBe(true);
    expect(matches("sane", "Sanz")).toBe(false);
  });

  it("filter: 世界のカードは name_ja にかなの一致を追加・英語の検索語では追加しない", () => {
    const spec = { likeColumns: ["name_en", "name_ja"], accentInsensitiveColumns: ["name_en"], kanaInsensitiveColumns: ["name_ja"] };
    const ja = parsePostgrestOrExpression(buildSearchOrFilter(spec, "めっし"));
    expect(ja.some((c) => c.field === "name_ja" && c.op === "imatch")).toBe(true);
    const en = parsePostgrestOrExpression(buildSearchOrFilter(spec, "messi"));
    expect(en.some((c) => c.field === "name_ja" && c.op === "imatch")).toBe(false);
    expect(en.some((c) => c.field === "name_en" && c.op === "imatch")).toBe(true);
    expect(en.filter((c) => c.op === "ilike").length).toBe(2);
  });
});
