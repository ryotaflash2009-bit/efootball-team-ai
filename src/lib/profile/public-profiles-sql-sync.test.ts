import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PUBLIC_ID_MAX, PUBLIC_ID_MIN, RESERVED_PUBLIC_IDS } from "./public-id";

/** migration の提案（SQL）とアプリの規則（public-id.ts）が食い違わないこと。 */
const SQL = readFileSync(path.resolve(__dirname, "..", "..", "..", "docs", "production-readiness", "sql", "create-public-profiles-schema.sql"), "utf8");

describe("公開 ID の規則: SQL と TS の同期", () => {
  it("予約語の一覧が同じ", () => {
    const m = /array\[([\s\S]*?)\]::text\[\]/.exec(SQL);
    expect(m).not.toBeNull();
    const sqlWords = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(sqlWords).toEqual([...RESERVED_PUBLIC_IDS].sort());
  });

  it("長さと形式の規則が同じ（3〜20 文字・英小文字で始まる）", () => {
    expect(SQL).toContain(`'^[a-z][a-z0-9_]{${PUBLIC_ID_MIN - 1},${PUBLIC_ID_MAX - 1}}$'`);
  });
});
