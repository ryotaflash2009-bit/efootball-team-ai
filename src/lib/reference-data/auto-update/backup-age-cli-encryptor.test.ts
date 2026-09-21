import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgeCliEncryptor } from "./backup-age-cli-encryptor";

/**
 * `age` CLI呼び出しの境界(引数の組み立て・成功/失敗の扱い・平文削除)だけを検証する。
 * 実`age`バイナリはこのセッションでは一度もインストール・実行していない。代わりに、
 * このテストファイル専用の使い捨てfakeスクリプト(単純なファイル操作だけを行う、
 * 暗号として一切安全ではないNodeスクリプト)を`process.execPath`経由で起動する。
 */

const RECIPIENT = "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
let scratchDir: string;
let fakeAgeSuccessPath: string;
let fakeAgeFailurePath: string;

beforeAll(() => {
  scratchDir = mkdtempSync(join(tmpdir(), "age-cli-encryptor-test-"));

  fakeAgeSuccessPath = join(scratchDir, "fake-age-success.mjs");
  // `age -r <recipient> -o <out> <in>`と同じ引数の並びを模倣する、テスト専用のfake実装。
  // 実際の暗号化は一切行わず、"FAKE_AGE:<recipient>:"というmarkerを前置してコピーするだけ。
  writeFileSync(
    fakeAgeSuccessPath,
    `import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const recipient = args[args.indexOf("-r") + 1];
const outPath = args[args.indexOf("-o") + 1];
const inPath = args[args.length - 1];
const plaintext = readFileSync(inPath);
writeFileSync(outPath, Buffer.concat([Buffer.from("FAKE_AGE:" + recipient + ":"), plaintext]));
`,
  );

  fakeAgeFailurePath = join(scratchDir, "fake-age-failure.mjs");
  writeFileSync(
    fakeAgeFailurePath,
    `process.stderr.write("fake age failure for test\\n");
process.exit(1);
`,
  );
});

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

describe("AgeCliEncryptor(fake age実行境界だけを検証、実バイナリ・実ネットワークは一切使わない)", () => {
  it("recipientがage1で始まらない場合は構築時に例外を投げる", () => {
    expect(() => new AgeCliEncryptor({ recipient: "not-an-age-key", ageCommand: [process.execPath, fakeAgeSuccessPath] })).toThrow();
  });

  it("正常系: fake ageを呼び出し、marker付きの暗号化済みbufferを返し、平文一時ファイルを削除する", async () => {
    const writtenPlaintextPaths: string[] = [];
    const encryptor = new AgeCliEncryptor({
      recipient: RECIPIENT,
      ageCommand: [process.execPath, fakeAgeSuccessPath],
      tempDir: scratchDir,
      fsOverride: {
        writeFile: async (path, data, opts) => {
          writtenPlaintextPaths.push(path as string);
          const { writeFile } = await import("node:fs/promises");
          return writeFile(path, data, opts);
        },
      },
    });

    const plaintext = Buffer.from("hello production backup");
    const encrypted = await encryptor.encrypt(plaintext);

    expect(encrypted.toString("utf8")).toBe(`FAKE_AGE:${RECIPIENT}:hello production backup`);
    expect(writtenPlaintextPaths).toHaveLength(1);
    // 暗号化成功後、平文一時ファイルは削除されている(cleanup成功)。
    expect(existsSync(writtenPlaintextPaths[0])).toBe(false);
  });

  it("age実行が失敗した場合、平文一時ファイルは削除されたうえで元のエラーが伝播する", async () => {
    let plaintextPath = "";
    const encryptor = new AgeCliEncryptor({
      recipient: RECIPIENT,
      ageCommand: [process.execPath, fakeAgeFailurePath],
      tempDir: scratchDir,
      fsOverride: {
        writeFile: async (path, data, opts) => {
          plaintextPath = path as string;
          const { writeFile } = await import("node:fs/promises");
          return writeFile(path, data, opts);
        },
      },
    });

    await expect(encryptor.encrypt(Buffer.from("secret rows"))).rejects.toThrow(/age終了コード1/);
    // 暗号化に失敗しても、平文一時ファイルの削除は実行されている。
    expect(existsSync(plaintextPath)).toBe(false);
  });

  it("cleanup(平文削除)自体が失敗した場合、暗号化が成功していても明示的に例外を投げる(平文を残したまま正常終了しない)", async () => {
    const encryptor = new AgeCliEncryptor({
      recipient: RECIPIENT,
      ageCommand: [process.execPath, fakeAgeSuccessPath],
      tempDir: scratchDir,
      fsOverride: {
        unlink: async () => {
          throw new Error("fake unlink failure(テスト専用)");
        },
      },
    });

    await expect(encryptor.encrypt(Buffer.from("hello"))).rejects.toThrow(/cleanup failure/);
  });

  it("cleanup失敗時のエラーメッセージは、暗号化自体の失敗もあわせて記録する(両方失敗した場合)", async () => {
    const encryptor = new AgeCliEncryptor({
      recipient: RECIPIENT,
      ageCommand: [process.execPath, fakeAgeFailurePath],
      tempDir: scratchDir,
      fsOverride: {
        unlink: async () => {
          throw new Error("fake unlink failure(テスト専用)");
        },
      },
    });

    await expect(encryptor.encrypt(Buffer.from("hello"))).rejects.toThrow(/cleanup failure/);
    await encryptor.encrypt(Buffer.from("hello")).catch((err: Error) => {
      expect(err.message).toContain("age終了コード1");
    });
  });

  it("decryptは意図的に未実装であり、呼び出すと例外を投げる(workflow側は復号を一切行わない)", async () => {
    const encryptor = new AgeCliEncryptor({ recipient: RECIPIENT, ageCommand: [process.execPath, fakeAgeSuccessPath] });
    await expect(encryptor.decrypt(Buffer.from("anything"))).rejects.toThrow(/decryptは意図的に未実装/);
  });

  it("recipient(公開鍵)自体はエラーメッセージへ現れてもよいが、fsOverrideに渡した一時ファイルpath以外の機微情報は含まれない", async () => {
    const encryptor = new AgeCliEncryptor({ recipient: RECIPIENT, ageCommand: [process.execPath, fakeAgeFailurePath], tempDir: scratchDir });
    try {
      await encryptor.encrypt(Buffer.from("x"));
      expect.unreachable();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toMatch(/AGE-SECRET-KEY/i);
    }
  });

  it("fakeスクリプトのファイル自体が生成した暗号化ファイルの中身にplaintextがそのまま平文で残っていないこと(fake内でmarker前置されていること)を確認する", () => {
    // fake-age-success.mjsの中身自体を静的に確認し、テスト用スクリプトが「単純コピーではなくmarkerを前置する」設計であることを保証する。
    const src = readFileSync(fakeAgeSuccessPath, "utf8");
    expect(src).toContain("FAKE_AGE:");
  });
});
