import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BUILD_STORAGE_ERROR_EN, localizeBuildStorageError } from "./build-storage-errors";

const SOURCE = readFileSync(path.join(__dirname, "build-storage.ts"), "utf8");
const JP = /[぀-ヿ一-龯]/;

describe("build-storage のエラー文の英語表示", () => {
  it("build-storage.ts のすべての `error: \"…\"` に英語がある（日本語を含まない）", () => {
    const literals = [...SOURCE.matchAll(/error: "([^"]+)"/g)].map((m) => m[1]);
    expect(literals.length).toBeGreaterThan(5);
    for (const l of new Set(literals)) {
      expect(BUILD_STORAGE_ERROR_EN[l], l).toBeTruthy();
      expect(JP.test(BUILD_STORAGE_ERROR_EN[l]), l).toBe(false);
    }
  });

  it("日本語画面では元の文のまま、英語画面で未知の文は汎用の英語", () => {
    expect(localizeBuildStorageError("ビルド名を入力してください", "ja")).toBe("ビルド名を入力してください");
    expect(localizeBuildStorageError("ビルド名を入力してください", "en")).toBe("Please enter a build name");
    expect(localizeBuildStorageError("未知のエラー", "en")).toBe("The action could not be completed");
  });
});
