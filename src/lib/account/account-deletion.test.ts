import { describe, it, expect } from "vitest";
import {
  ACCOUNT_DELETION_MODE,
  classifyAccountDeletionError,
  clearAccountLocalData,
  isAccountDeletionAvailable,
  isConfirmPhraseValid,
  isDeletionSucceeded,
} from "./account-deletion";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

describe("アカウントの削除（画面の側）", () => {
  it("既定は無効（Production に関数を適用・検証した後に PR で有効にする）・ローカルの ?deletionPreview=1 だけ流れを試せる", () => {
    expect(ACCOUNT_DELETION_MODE).toBe("disabled");
    expect(isAccountDeletionAvailable("efootball-team-ai.vercel.app", "?deletionPreview=1", isLocalDevHostname)).toBe(false);
    expect(isAccountDeletionAvailable("localhost", "?deletionPreview=1", isLocalDevHostname)).toBe(true);
    expect(isAccountDeletionAvailable("localhost", "", isLocalDevHostname)).toBe(false);
    expect(isAccountDeletionAvailable("example.com", "", isLocalDevHostname, "enabled")).toBe(true);
  });

  it("確認の語: 前後の空白・大文字小文字・全角半角を無視・空の期待値は常に不一致", () => {
    expect(isConfirmPhraseValid(" delete ", "DELETE")).toBe(true);
    expect(isConfirmPhraseValid("ＤＥＬＥＴＥ", "DELETE")).toBe(true);
    expect(isConfirmPhraseValid("削除する", "削除する")).toBe(true);
    expect(isConfirmPhraseValid("削除", "削除する")).toBe(false);
    expect(isConfirmPhraseValid("", "")).toBe(false);
  });

  it("失敗の一般化（関数の理由コード・未適用・障害）と成功の判定", () => {
    expect(classifyAccountDeletionError({ message: "reauthentication_required" })).toBe("reauth_required");
    expect(classifyAccountDeletionError({ message: "billing_active" })).toBe("billing_active");
    expect(classifyAccountDeletionError({ message: "confirmation_required" })).toBe("confirmation_required");
    expect(classifyAccountDeletionError({ message: "x", code: "PGRST202" })).toBe("unavailable");
    expect(classifyAccountDeletionError({ message: "x", status: 503 })).toBe("unavailable");
    expect(classifyAccountDeletionError({ message: "secret detail" })).toBe("failed");
    expect(isDeletionSucceeded({ deleted: true })).toBe(true);
    expect(isDeletionSucceeded({ deleted: "true" })).toBe(false);
    expect(isDeletionSucceeded(null)).toBe(false);
  });

  it("端末のデータ: そのアカウントの領域だけを消す（ゲスト・他のアカウント・共通データは残す）", () => {
    const map = new Map<string, string>();
    const scope = { kind: "account" as const, scopeId: "aaaa" };
    const other = { kind: "account" as const, scopeId: "bbbb" };
    map.set(buildScopedStorageKey(scope, "myTeam"), "1");
    map.set(buildScopedStorageKey(scope, "squads"), "1");
    map.set(buildScopedStorageKey(other, "myTeam"), "1");
    map.set(buildScopedStorageKey({ kind: "guest" }, "myTeam"), "1");
    map.set("efootball-team-ai:my-team:v1", "1");
    const storage = { getItem: (k: string) => map.get(k) ?? null, removeItem: (k: string) => void map.delete(k) };
    expect(clearAccountLocalData(scope, storage)).toBe(2);
    expect([...map.keys()].sort()).toEqual(
      [buildScopedStorageKey(other, "myTeam"), buildScopedStorageKey({ kind: "guest" }, "myTeam"), "efootball-team-ai:my-team:v1"].sort(),
    );
    expect(clearAccountLocalData({ kind: "guest" }, storage)).toBe(0);
    expect(clearAccountLocalData(scope, null)).toBe(0);
  });
});
