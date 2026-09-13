import { describe, it, expect } from "vitest";
import { computeAccountScopeId } from "./scope-id";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("computeAccountScopeId", () => {
  it("認証ユーザーID由来で、固定プレフィックスを組み合わせたSHA-256(小文字16進)を返す", async () => {
    const id = await computeAccountScopeId(USER_A);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同じユーザーIDからは同じスコープIDになる(決定的)", async () => {
    const a = await computeAccountScopeId(USER_A);
    const b = await computeAccountScopeId(USER_A);
    expect(a).toBe(b);
  });

  it("異なるユーザーIDからは異なるスコープIDになる", async () => {
    const a = await computeAccountScopeId(USER_A);
    const b = await computeAccountScopeId(USER_B);
    expect(a).not.toBe(b);
  });

  it("固定プレフィックスを使っている(単なるSHA-256(userId)ではない)", async () => {
    const withPrefix = await computeAccountScopeId(USER_A);
    const bareDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(USER_A));
    const bareHex = Array.from(new Uint8Array(bareDigest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(withPrefix).not.toBe(bareHex);
  });

  it("空文字列は取得できないものとして拒否する(null)", async () => {
    expect(await computeAccountScopeId("")).toBeNull();
  });

  it("空白のみの文字列は取得できないものとして拒否する(null)", async () => {
    expect(await computeAccountScopeId("   ")).toBeNull();
  });

  it("nullは取得できないものとして拒否する", async () => {
    expect(await computeAccountScopeId(null)).toBeNull();
  });

  it("undefinedは取得できないものとして拒否する", async () => {
    expect(await computeAccountScopeId(undefined)).toBeNull();
  });

  it("生のユーザーIDはハッシュへ復元不可能な形で含まれる(平文が残らない)", async () => {
    const id = await computeAccountScopeId(USER_A);
    expect(id).not.toContain(USER_A);
  });

  it("前後の空白を除去してから計算する(同一ユーザーとして扱う)", async () => {
    const a = await computeAccountScopeId(USER_A);
    const b = await computeAccountScopeId(`  ${USER_A}  `);
    expect(a).toBe(b);
  });
});
