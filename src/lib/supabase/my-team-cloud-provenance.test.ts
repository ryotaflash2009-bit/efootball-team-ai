import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LOCAL_ACCOUNT_HINT_KEY,
  LOCAL_ACCOUNT_HINT_VERSION,
  computeAccountHint,
  checkAccountProvenance,
  recordAccountHint,
  isProvenanceConfirmationRequired,
  __clearAccountHintForTests,
} from "./my-team-cloud-provenance";

function installMemoryStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    },
  });
  return map;
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("computeAccountHint", () => {
  it("ユーザーIDが無い場合はnullを返す(計算できない)", async () => {
    expect(await computeAccountHint(null)).toBeNull();
  });

  it("同じユーザーIDは常に同じハッシュになる(決定的)", async () => {
    const a = await computeAccountHint(USER_A);
    const b = await computeAccountHint(USER_A);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("異なるユーザーIDは異なるハッシュになる", async () => {
    const a = await computeAccountHint(USER_A);
    const b = await computeAccountHint(USER_B);
    expect(a).not.toBe(b);
  });

  it("用途別の固定プレフィックスと組み合わせている(単なるSHA-256(userId)ではない)", async () => {
    const withPrefix = await computeAccountHint(USER_A);
    const bareUuidHashData = new TextEncoder().encode(USER_A);
    const bareDigest = await crypto.subtle.digest("SHA-256", bareUuidHashData);
    const bareHex = Array.from(new Uint8Array(bareDigest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(withPrefix).not.toBe(bareHex);
  });

  it("ハッシュから元のユーザーIDへ復元できない", async () => {
    const hint = await computeAccountHint(USER_A);
    expect(hint).not.toContain(USER_A);
  });
});

describe("checkAccountProvenance / recordAccountHint(ユーザーID方式)", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("目印が未記録の場合はUNKNOWNを返す(初回利用)", async () => {
    expect(await checkAccountProvenance(USER_A)).toBe("UNKNOWN");
  });

  it("ユーザーIDが取得できない場合はUNKNOWNを返す", async () => {
    await recordAccountHint(USER_A);
    expect(await checkAccountProvenance(null)).toBe("UNKNOWN");
  });

  it("記録済みの目印と同じアカウントならMATCHを返す", async () => {
    await recordAccountHint(USER_A);
    expect(await checkAccountProvenance(USER_A)).toBe("MATCH");
  });

  it("記録済みの目印と異なるアカウントならMISMATCHを返す(アカウントAからBへの切り替え)", async () => {
    await recordAccountHint(USER_A);
    expect(await checkAccountProvenance(USER_B)).toBe("MISMATCH");
  });

  it("同一アカウントでメールアドレスが変わってもMATCHのまま(ユーザーIDだけで判定する)", async () => {
    // メールは判定に一切関与しないため、そもそも引数にも取らない。
    // ここでは「同じuserIdである限り、呼び出し元がどんなメールを保持していても結果は同じ」ことを
    // 別の観点(同じuserIdを2回渡す)で確認する。
    await recordAccountHint(USER_A);
    expect(await checkAccountProvenance(USER_A)).toBe("MATCH");
    expect(await checkAccountProvenance(USER_A)).toBe("MATCH");
  });

  it("recordAccountHintは生ユーザーIDをlocalStorageへ保存しない", async () => {
    await recordAccountHint(USER_A);
    const stored = window.localStorage.getItem(LOCAL_ACCOUNT_HINT_KEY);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain(USER_A);
  });

  it("recordAccountHintはメールアドレスやそのハッシュを一切保存しない(構造が閉じている)", async () => {
    await recordAccountHint(USER_A);
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_ACCOUNT_HINT_KEY)!);
    expect(Object.keys(stored).sort()).toEqual(["accountHash", "updatedAt", "version"]);
    expect(stored.accountHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.version).toBe(LOCAL_ACCOUNT_HINT_VERSION);
  });

  it("ユーザーIDが無い場合はrecordAccountHintが何も書き込まない", async () => {
    await recordAccountHint(null);
    expect(window.localStorage.getItem(LOCAL_ACCOUNT_HINT_KEY)).toBeNull();
  });

  it("__clearAccountHintForTestsで目印を消去できる(再びUNKNOWNへ戻る)", async () => {
    await recordAccountHint(USER_A);
    __clearAccountHintForTests();
    expect(await checkAccountProvenance(USER_A)).toBe("UNKNOWN");
  });

  it("アカウントを跨いだ切り替えシナリオ: A記録→Bで確認→MISMATCH→B記録→Bで確認→MATCH", async () => {
    await recordAccountHint(USER_A);
    expect(await checkAccountProvenance(USER_B)).toBe("MISMATCH");
    await recordAccountHint(USER_B);
    expect(await checkAccountProvenance(USER_B)).toBe("MATCH");
    expect(await checkAccountProvenance(USER_A)).toBe("MISMATCH");
  });

  it("壊れたJSONが保存されている場合はUNKNOWN扱いになる(自動保存の根拠にしない)", async () => {
    window.localStorage.setItem(LOCAL_ACCOUNT_HINT_KEY, "{not valid json");
    expect(await checkAccountProvenance(USER_A)).toBe("UNKNOWN");
  });

  it("旧バージョン(メール由来ヒント等)の値が残っていてもUNKNOWN扱いになり、一致とはみなさない", async () => {
    // 旧実装(メールアドレスのハッシュを直接文字列で保存していた形式)を模擬する。
    window.localStorage.setItem(LOCAL_ACCOUNT_HINT_KEY, "a".repeat(64));
    expect(await checkAccountProvenance(USER_A)).toBe("UNKNOWN");
  });

  it("versionフィールドが現行と異なるJSONはUNKNOWN扱いになる(旧形式を安全に識別)", async () => {
    window.localStorage.setItem(
      LOCAL_ACCOUNT_HINT_KEY,
      JSON.stringify({ version: "my-team-cloud-account-hint/2026-09-12.v1", accountHash: "b".repeat(64), updatedAt: "2026-09-12T00:00:00.000Z" }),
    );
    expect(await checkAccountProvenance(USER_A)).toBe("UNKNOWN");
  });

  it("旧形式が残っている状態でcheckAccountProvenanceを呼んでも書き込みは発生しない(自動保存しない)", async () => {
    window.localStorage.setItem(LOCAL_ACCOUNT_HINT_KEY, "a".repeat(64));
    await checkAccountProvenance(USER_A);
    // 読み取り専用の呼び出しでは値が変化しない(recordAccountHintを呼ばない限り書き換わらない)。
    expect(window.localStorage.getItem(LOCAL_ACCOUNT_HINT_KEY)).toBe("a".repeat(64));
  });
});

describe("isProvenanceConfirmationRequired", () => {
  it("MATCH + 未チェックでも確認不要(通常の保存確認をそのまま許可する)", () => {
    expect(isProvenanceConfirmationRequired("MATCH", false)).toBe(false);
  });

  it("MATCH + チェック済みでも確認不要", () => {
    expect(isProvenanceConfirmationRequired("MATCH", true)).toBe(false);
  });

  it("UNKNOWN + 未チェックは確認必須(=保存を阻止する)", () => {
    expect(isProvenanceConfirmationRequired("UNKNOWN", false)).toBe(true);
  });

  it("UNKNOWN + チェック済みは確認不要(=保存を許可する)", () => {
    expect(isProvenanceConfirmationRequired("UNKNOWN", true)).toBe(false);
  });

  it("MISMATCH + 未チェックは確認必須(=保存を阻止する)", () => {
    expect(isProvenanceConfirmationRequired("MISMATCH", false)).toBe(true);
  });

  it("MISMATCH + チェック済みは確認不要(=保存を許可する)", () => {
    expect(isProvenanceConfirmationRequired("MISMATCH", true)).toBe(false);
  });

  it("判定未完了(null) + 未チェックは安全側(確認必須)として扱う(由来チェック完了前は保存させない)", () => {
    expect(isProvenanceConfirmationRequired(null, false)).toBe(true);
  });

  it("チェックを外すと直ちに再び確認必須へ戻る(MISMATCH確定後のトグル)", () => {
    expect(isProvenanceConfirmationRequired("MISMATCH", true)).toBe(false);
    expect(isProvenanceConfirmationRequired("MISMATCH", false)).toBe(true);
  });
});
