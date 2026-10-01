import { describe, it, expect } from "vitest";
import { classifyHomeFailure } from "./home-failure";
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";

describe("ホームの照会の失敗の扱い", () => {
  it("データ未準備・一時的な失敗は部分表示、それ以外は error boundary", () => {
    expect(classifyHomeFailure(undefined)).toBe("none");
    expect(classifyHomeFailure(new WorldDataUnavailableError())).toBe("unavailable");
    expect(classifyHomeFailure(new WorldQueryError())).toBe("temporary");
    expect(classifyHomeFailure(new TypeError("bug"))).toBe("throw");
  });
});
