import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidPlayerId,
  buildImageUrl,
  isAllowedUpstreamUrl,
  getCachedImage,
  setCachedImage,
  _clearImageCache,
  _imageCacheSize,
} from "./player-image";

describe("isValidPlayerId", () => {
  it("数字1〜20桁を許可する", () => {
    expect(isValidPlayerId("1")).toBe(true);
    expect(isValidPlayerId("89138556575063")).toBe(true);
    expect(isValidPlayerId("12345678901234567890")).toBe(true); // 20桁
  });

  it("不正な値を拒否する", () => {
    for (const bad of [
      "",
      " ",
      " 12",
      "12 ",
      "abc",
      "12a",
      "-1",
      "+1",
      "1.0",
      "12.png",
      "../x",
      "12/34",
      "12\\34",
      "http://efimg.com/x.png",
      "1?a=1",
      "1#x",
      "%2F",
      "123456789012345678901", // 21桁
    ]) {
      expect(isValidPlayerId(bad), bad).toBe(false);
    }
    expect(isValidPlayerId(null)).toBe(false);
    expect(isValidPlayerId(undefined)).toBe(false);
  });
});

describe("buildImageUrl", () => {
  it("固定テンプレートからURLを生成する", () => {
    expect(buildImageUrl("89138556575063")).toBe(
      "https://efimg.com/efootballhub22/images/player_cards/89138556575063_l.png",
    );
    expect(buildImageUrl("88041460996837")).toBe(
      "https://efimg.com/efootballhub22/images/player_cards/88041460996837_l.png",
    );
  });

  it("不正な id では例外を投げる", () => {
    expect(() => buildImageUrl("abc")).toThrow();
    expect(() => buildImageUrl("../x")).toThrow();
    expect(() => buildImageUrl("")).toThrow();
  });
});

describe("isAllowedUpstreamUrl", () => {
  it("正規の efimg.com 画像URLだけを許可する", () => {
    expect(
      isAllowedUpstreamUrl("https://efimg.com/efootballhub22/images/player_cards/1_l.png"),
    ).toBe(true);
  });

  it("ホスト違い・パス違い・http・クエリ付きを拒否する", () => {
    for (const bad of [
      "http://efimg.com/efootballhub22/images/player_cards/1_l.png",
      "https://evil.com/efootballhub22/images/player_cards/1_l.png",
      "https://efimg.com.evil.com/efootballhub22/images/player_cards/1_l.png",
      "https://efimg.com/other/1_l.png",
      "https://efimg.com/efootballhub22/images/player_cards/1_l.png?x=1",
      "https://efimg.com/efootballhub22/images/player_cards/1_l.jpg",
      "https://efimg.com/efootballhub22/images/player_cards/abc_l.png",
      "https://efhub.com/players/1",
      "not a url",
    ]) {
      expect(isAllowedUpstreamUrl(bad), bad).toBe(false);
    }
  });
});

describe("メモリキャッシュ", () => {
  beforeEach(() => _clearImageCache());

  function make() {
    return { body: new Uint8Array([1, 2, 3]), contentType: "image/png", etag: null, storedAt: Date.now() };
  }

  it("保存した画像を取り出せる", () => {
    setCachedImage("100", make());
    expect(getCachedImage("100")?.contentType).toBe("image/png");
  });

  it("TTL を過ぎたら null（古い storedAt）", () => {
    setCachedImage("200", { ...make(), storedAt: Date.now() - 2 * 60 * 60 * 1000 });
    expect(getCachedImage("200")).toBeNull();
  });

  it("32件を超えると最も古い項目から削除される", () => {
    for (let i = 0; i < 40; i++) setCachedImage(String(i), make());
    expect(_imageCacheSize()).toBe(32);
    expect(getCachedImage("0")).toBeNull(); // 最初に入れたもの
    expect(getCachedImage("7")).toBeNull();
    expect(getCachedImage("8")).not.toBeNull(); // 40-32=8 以降が残る
    expect(getCachedImage("39")).not.toBeNull();
  });

  it("同じ id を再保存すると最新扱いになり、他が先に消える", () => {
    for (let i = 0; i < 32; i++) setCachedImage(String(i), make());
    setCachedImage("0", make()); // 0 を最新化
    setCachedImage("999", make()); // 33件目 → 最古の "1" が消える
    expect(getCachedImage("1")).toBeNull();
    expect(getCachedImage("0")).not.toBeNull();
    expect(getCachedImage("999")).not.toBeNull();
  });
});
