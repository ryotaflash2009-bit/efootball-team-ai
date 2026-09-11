import { describe, it, expect } from "vitest";
import { resolvePendingSquadAddition, pendingSquadAdditionQuery } from "./pending-addition";

describe("resolvePendingSquadAddition", () => {
  it("有効なcard+buildをそのまま返す", () => {
    expect(resolvePendingSquadAddition("89138556575063", "b_abc123")).toEqual({
      worldCardId: "89138556575063",
      buildId: "b_abc123",
    });
  });

  it("cardのみでもbuildなしとして返す(My Team側で保存ビルド未選択のケース)", () => {
    expect(resolvePendingSquadAddition("89138556575063", null)).toEqual({
      worldCardId: "89138556575063",
      buildId: null,
    });
  });

  it("cardが無効ならbuildが有効でも両方nullにする(孤立したビルドIDだけを引き継がない)", () => {
    expect(resolvePendingSquadAddition(null, "b_abc123")).toEqual({ worldCardId: null, buildId: null });
    expect(resolvePendingSquadAddition("not-a-number", "b_abc123")).toEqual({ worldCardId: null, buildId: null });
  });

  it("buildの形式が不正なら安全に無視する(カードだけは引き継ぐ)", () => {
    expect(resolvePendingSquadAddition("89138556575063", "invalid build id with spaces")).toEqual({
      worldCardId: "89138556575063",
      buildId: null,
    });
  });

  it("card/buildともに未指定なら両方null", () => {
    expect(resolvePendingSquadAddition(undefined, undefined)).toEqual({ worldCardId: null, buildId: null });
  });

  it("JSON文字列や配列風の値など、想定外の形式を安全に拒否する", () => {
    expect(resolvePendingSquadAddition('{"worldCardId":"1"}', null)).toEqual({ worldCardId: null, buildId: null });
    expect(resolvePendingSquadAddition("1,2,3", null)).toEqual({ worldCardId: null, buildId: null });
  });
});

describe("pendingSquadAdditionQuery", () => {
  it("card+buildの両方がある場合、両方を含むクエリ文字列を作る", () => {
    expect(pendingSquadAdditionQuery({ worldCardId: "123", buildId: "b1" })).toBe("?card=123&build=b1");
  });

  it("cardのみの場合、buildを含まないクエリ文字列を作る", () => {
    expect(pendingSquadAdditionQuery({ worldCardId: "123", buildId: null })).toBe("?card=123");
  });

  it("cardが無い場合は空文字列", () => {
    expect(pendingSquadAdditionQuery({ worldCardId: null, buildId: "b1" })).toBe("");
    expect(pendingSquadAdditionQuery({ worldCardId: null, buildId: null })).toBe("");
  });

  it("resolveしたものをqueryへ戻すと往復して一致する(ラウンドトリップ)", () => {
    const resolved = resolvePendingSquadAddition("89138556575063", "b_abc123");
    expect(pendingSquadAdditionQuery(resolved)).toBe("?card=89138556575063&build=b_abc123");
  });

  it("URLへ内部データを不必要に含めない(worldCardId/buildId以外のキーが混入しない)", () => {
    const q = pendingSquadAdditionQuery({ worldCardId: "123", buildId: "b1" });
    expect(q).not.toMatch(/[{}[\]]/);
    expect(q.split("&")).toHaveLength(2);
  });
});
