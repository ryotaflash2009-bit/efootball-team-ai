import { describe, it, expect, vi } from "vitest";
import { runGuardedCleanup } from "./postgres-test-lifecycle";

describe("runGuardedCleanup", () => {
  it("ready=trueのステップだけを宣言順に実行する", async () => {
    const calls: string[] = [];
    await runGuardedCleanup([
      { ready: true, run: async () => void calls.push("a") },
      { ready: false, run: async () => void calls.push("b") },
      { ready: true, run: async () => void calls.push("c") },
    ]);
    expect(calls).toEqual(["a", "c"]);
  });

  it("beforeAllが途中失敗した状態(final schema未作成)を模擬し、未作成schema向けのrunを一切呼び出さない", async () => {
    const finalSchemaCleanup = vi.fn(async () => {});
    const stagingSchemaCleanup = vi.fn(async () => {});
    // 実際に発生した障害を再現: staging schemaは作成成功、final schemaはbeforeAll途中失敗で未作成。
    const finalSchemaReady = false;
    const stagingSchemaReady = true;

    await runGuardedCleanup([
      { ready: finalSchemaReady, run: finalSchemaCleanup },
      { ready: stagingSchemaReady, run: stagingSchemaCleanup },
    ]);

    expect(finalSchemaCleanup).not.toHaveBeenCalled();
    expect(stagingSchemaCleanup).toHaveBeenCalledTimes(1);
  });

  it("すべてready=falseなら何も実行しない(adminClient未接続時の模擬)", async () => {
    const run = vi.fn(async () => {});
    await runGuardedCleanup([
      { ready: false, run },
      { ready: false, run },
    ]);
    expect(run).not.toHaveBeenCalled();
  });

  it("空配列は何もせず正常終了する", async () => {
    await expect(runGuardedCleanup([])).resolves.toBeUndefined();
  });

  it("あるステップのrunが失敗すると、それ以降のステップは実行されず例外が伝播する(本来のエラーを隠さない)", async () => {
    const afterFailure = vi.fn(async () => {});
    await expect(
      runGuardedCleanup([
        { ready: true, run: async () => { throw new Error("schema does not exist"); } },
        { ready: true, run: afterFailure },
      ]),
    ).rejects.toThrow("schema does not exist");
    expect(afterFailure).not.toHaveBeenCalled();
  });
});
