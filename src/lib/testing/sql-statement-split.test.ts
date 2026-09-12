import { describe, it, expect } from "vitest";
import { splitSqlStatements } from "./sql-statement-split";

describe("splitSqlStatements", () => {
  it("単純な複数文をセミコロンで分割する", () => {
    const sql = "select 1; select 2; select 3;";
    expect(splitSqlStatements(sql)).toEqual(["select 1", "select 2", "select 3"]);
  });

  it("末尾にセミコロンが無くても最後の文を取りこぼさない", () => {
    expect(splitSqlStatements("select 1; select 2")).toEqual(["select 1", "select 2"]);
  });

  it("空文・空白だけの文は無視する", () => {
    expect(splitSqlStatements("select 1;;   ;select 2;")).toEqual(["select 1", "select 2"]);
  });

  it("$$...$$ドルクオート内のセミコロンは分割しない(PL/pgSQL関数本体)", () => {
    const sql = `
      create function f() returns trigger language plpgsql as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$;
      select 1;
    `;
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBe(2);
    expect(statements[0]).toContain("begin");
    expect(statements[0]).toContain("end;");
    expect(statements[1].trim()).toBe("select 1");
  });

  it("タグ付きドルクオート($tag$...$tag$)内のセミコロンも分割しない", () => {
    const sql = `create function f() returns void language sql as $body$ select 1; select 2; $body$; select 3;`;
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBe(2);
    expect(statements[0]).toContain("select 1; select 2;");
    expect(statements[1].trim()).toBe("select 3");
  });

  it("文字列リテラル内のセミコロンは分割しない", () => {
    const sql = `insert into t (label) values ('a;b'); select 1;`;
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBe(2);
    expect(statements[0]).toContain("'a;b'");
  });

  it("エスケープされた単一引用符('')を含む文字列を正しく扱う", () => {
    const sql = `insert into t (label) values ('it''s; a test'); select 1;`;
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBe(2);
    expect(statements[0]).toContain("it''s; a test");
  });

  it("行コメント内のセミコロンは分割しない", () => {
    const sql = `select 1; -- comment; with semicolon\nselect 2;`;
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBe(2);
  });

  it("ブロックコメント内のセミコロンは分割しない", () => {
    const sql = `select 1; /* comment; with semicolon */ select 2;`;
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBe(2);
  });

  it("空文字列は空配列を返す", () => {
    expect(splitSqlStatements("")).toEqual([]);
  });
});
