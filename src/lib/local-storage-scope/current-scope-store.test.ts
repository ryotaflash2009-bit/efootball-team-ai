import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCurrentScope, setCurrentScope, subscribeCurrentScope, __resetCurrentScopeForTests } from "./current-scope-store";

beforeEach(() => {
  __resetCurrentScopeForTests();
});

describe("getCurrentScope / setCurrentScope", () => {
  it("初期状態はnull(未解決)", () => {
    expect(getCurrentScope()).toBeNull();
  });

  it("guestスコープを設定できる", () => {
    setCurrentScope({ kind: "guest" });
    expect(getCurrentScope()).toEqual({ kind: "guest" });
  });

  it("accountスコープを設定できる", () => {
    setCurrentScope({ kind: "account", scopeId: "abc" });
    expect(getCurrentScope()).toEqual({ kind: "account", scopeId: "abc" });
  });

  it("nullへ戻せる(未解決状態への復帰)", () => {
    setCurrentScope({ kind: "guest" });
    setCurrentScope(null);
    expect(getCurrentScope()).toBeNull();
  });
});

describe("subscribeCurrentScope", () => {
  it("スコープが実際に変わったときだけ通知する", () => {
    const cb = vi.fn();
    subscribeCurrentScope(cb);
    setCurrentScope({ kind: "guest" });
    expect(cb).toHaveBeenCalledTimes(1);
    setCurrentScope({ kind: "guest" }); // 同じ内容の再設定
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("同じaccountスコープIDの再設定では通知しない", () => {
    const cb = vi.fn();
    setCurrentScope({ kind: "account", scopeId: "abc" });
    subscribeCurrentScope(cb);
    setCurrentScope({ kind: "account", scopeId: "abc" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("異なるaccountスコープIDへの変更では通知する(アカウント切り替え)", () => {
    const cb = vi.fn();
    setCurrentScope({ kind: "account", scopeId: "a" });
    subscribeCurrentScope(cb);
    setCurrentScope({ kind: "account", scopeId: "b" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("guest→accountの変更では通知する", () => {
    const cb = vi.fn();
    setCurrentScope({ kind: "guest" });
    subscribeCurrentScope(cb);
    setCurrentScope({ kind: "account", scopeId: "a" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("account→nullの変更(セッション切れ等)では通知する", () => {
    const cb = vi.fn();
    setCurrentScope({ kind: "account", scopeId: "a" });
    subscribeCurrentScope(cb);
    setCurrentScope(null);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("購読解除後は通知されない", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeCurrentScope(cb);
    unsubscribe();
    setCurrentScope({ kind: "guest" });
    expect(cb).not.toHaveBeenCalled();
  });
});
