import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkNoExpressionInCommentOn, auditReferenceDataExtensionSql, ANALYSIS_NAME_EXTENDABLE_TABLES } from "./reference-data-sql-audit";

/**
 * "COMMENT ON ... IS"句には単一の文字列定数(またはドル引用符文字列)しか書けず、
 * `||`のような式は使えない(実際に"syntax error at or near ||"で発生した障害の再発防止)。
 * この検査自体の正確性を、合成SQLと実ファイルの両方で検証する。
 */
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const NAME_SORT_KEY_EXTEND_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/extend-name-sort-key-schema.sql");
const ANALYSIS_NAME_EXTEND_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/extend-player-card-analysis-name-schema.sql");

describe("checkNoExpressionInCommentOn", () => {
  it("||で連結したCOMMENT ON ... ISを拒否する", () => {
    const sql = `comment on column t.c is 'foo' || 'bar';`;
    const issues = checkNoExpressionInCommentOn(sql);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("単一の文字列リテラルによるCOMMENTは許可する", () => {
    const sql = `comment on column t.c is 'foo bar baz';`;
    expect(checkNoExpressionInCommentOn(sql)).toEqual([]);
  });

  it("ドル引用符による複数行の単一文字列を適切に扱う(許可する)", () => {
    const sql = `comment on column t.c is $$foo\nbar\nbaz$$;`;
    expect(checkNoExpressionInCommentOn(sql)).toEqual([]);
  });

  it("タグ付きドル引用符($comment$...$comment$)も適切に扱う", () => {
    const sql = `comment on column t.c is $comment$foo || not a real operator, just text$comment$;`;
    // ドル引用符の中身はリテラルの一部なので、中に||という文字列が含まれていても違反ではない
    expect(checkNoExpressionInCommentOn(sql)).toEqual([]);
  });

  it("文字列内にアポストロフィ(''でエスケープ)があっても正しく1つの文として扱う", () => {
    const sql = `comment on column t.c is 'it''s a test';`;
    expect(checkNoExpressionInCommentOn(sql)).toEqual([]);
  });

  it("COMMENT文のセミコロンは文の終端として正しく扱う(次の文へ影響しない)", () => {
    const sql = `comment on column t.c is 'ok'; comment on column t.d is 'also ok' || 'bad';`;
    const issues = checkNoExpressionInCommentOn(sql);
    expect(issues.length).toBe(1); // 2文目だけが違反
  });

  it("COMMENT ON以外の文にある||は無視する(GINインデックス等の正当な用途)", () => {
    const sql = `create index idx on t using gin (to_tsvector('simple', coalesce(a,'') || ' ' || coalesce(b,'')));`;
    expect(checkNoExpressionInCommentOn(sql)).toEqual([]);
  });

  it("COMMENT ON TABLE / COMMENT ON CONSTRAINTでも同様に検出する", () => {
    expect(checkNoExpressionInCommentOn(`comment on table t is 'a' || 'b';`).length).toBeGreaterThan(0);
    expect(checkNoExpressionInCommentOn(`comment on constraint c on t is 'a' || 'b';`).length).toBeGreaterThan(0);
  });

  it("実ファイル: 修正後のextend-name-sort-key-schema.sqlは違反0件", () => {
    const sql = readFileSync(NAME_SORT_KEY_EXTEND_PATH, "utf8");
    expect(checkNoExpressionInCommentOn(sql)).toEqual([]);
  });

  it("実ファイル: 修正後のextend-player-card-analysis-name-schema.sqlは違反0件", () => {
    const sql = readFileSync(ANALYSIS_NAME_EXTEND_PATH, "utf8");
    expect(checkNoExpressionInCommentOn(sql)).toEqual([]);
  });

  it("実ファイル: auditReferenceDataExtensionSql全体としても両ファイルとも0 issues(統合確認)", () => {
    const nameSortKeySql = readFileSync(NAME_SORT_KEY_EXTEND_PATH, "utf8");
    expect(auditReferenceDataExtensionSql(nameSortKeySql).issues).toEqual([]);

    const analysisNameSql = readFileSync(ANALYSIS_NAME_EXTEND_PATH, "utf8");
    expect(auditReferenceDataExtensionSql(analysisNameSql, "reference_data", ANALYSIS_NAME_EXTENDABLE_TABLES).issues).toEqual([]);
  });
});
