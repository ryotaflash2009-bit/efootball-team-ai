import { describe, it, expect } from "vitest";
import { isOAuthOnly, providersOf } from "./use-auth-session";

describe("ログインの方法（2026-10-11）", () => {
  it("app_metadata.providers を優先し、無ければ provider・どちらも無ければ空", () => {
    expect(providersOf({ app_metadata: { providers: ["google"] } })).toEqual(["google"]);
    expect(providersOf({ app_metadata: { provider: "email" } })).toEqual(["email"]);
    expect(providersOf({ app_metadata: { providers: ["email", 1, "google"] } })).toEqual(["email", "google"]);
    expect(providersOf({})).toEqual([]);
    expect(providersOf(null)).toEqual([]);
  });
  it("Google だけ → OAuth だけ・メールを含む / 不明 → 従来どおり", () => {
    expect(isOAuthOnly(["google"])).toBe(true);
    expect(isOAuthOnly(["email", "google"])).toBe(false);
    expect(isOAuthOnly(["email"])).toBe(false);
    expect(isOAuthOnly([])).toBe(false);
  });
});
