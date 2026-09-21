import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile as writeFileReal, readFile as readFileReal, unlink as unlinkReal } from "node:fs/promises";
import type { BackupEncryptor } from "./backup-encryptor";

/**
 * Production向けの実`age` CLI呼び出しによる暗号化専用実装。
 *
 * 設計方針([[reference-data-production-backup-security-model.md]]と対応):
 * - workflowは`recipient`(age**公開鍵**)だけを持ち、秘密鍵は一切扱わない
 *   (`decrypt`は意図的に未実装、呼び出し自体を拒否する)。
 * - `age`はGitHub Actions runner上に別途インストールされたCLIバイナリを想定し、
 *   新規npm packageとしては追加しない(このモジュール自体はnode:child_processで
 *   外部コマンドを起動するだけ)。
 * - 平文はrunnerのtemp領域(既定は`os.tmpdir()`)へ一時ファイルとして書き出す
 *   (`age` CLIがファイル入出力を要求するため、in-memoryだけでは完結できない)。
 *   暗号化の成否にかかわらず、平文一時ファイルの削除を必ず試みる。
 *   **削除自体が失敗した場合は、暗号化が成功していても例外を投げ、
 *   呼び出し元(workflow)がjob failureとして扱えるようにする**(平文を
 *   runner上に残したまま正常終了しない)。
 *
 * このセッションでは実`age`バイナリを一度も実行していない。テストでは、
 * `ageCommand`にfakeスクリプト(このリポジトリのテストコード内だけで生成する、
 * 単純なファイルコピーを行うだけのNodeスクリプト)を注入し、ネットワーク・
 * 実バイナリの両方に依存せず、CLI呼び出しの境界(引数の組み立て・
 * 成功/失敗の扱い・平文削除)だけを検証する。
 */

export interface AgeCliEncryptorFsOverride {
  writeFile?: typeof writeFileReal;
  readFile?: typeof readFileReal;
  unlink?: typeof unlinkReal;
}

export interface AgeCliEncryptorOptions {
  /** age公開鍵(recipient)。"age1"で始まる文字列であることだけを確認する(値自体は秘密情報ではない)。 */
  recipient: string;
  /** 実行コマンドのargv prefix。既定は["age"](PATH上の`age`バイナリ)。テストでは[process.execPath, fakeScriptPath]等を注入する。 */
  ageCommand?: string[];
  tempDir?: string;
  /** テスト専用: 実fs呼び出しを差し替えるための注入ポイント(cleanup失敗を決定的に再現するため)。 */
  fsOverride?: AgeCliEncryptorFsOverride;
}

export class AgeCliEncryptor implements BackupEncryptor {
  algorithmId = "age-x25519";
  private readonly recipient: string;
  private readonly ageCommand: string[];
  private readonly tempDir: string;
  private readonly fsWriteFile: typeof writeFileReal;
  private readonly fsReadFile: typeof readFileReal;
  private readonly fsUnlink: typeof unlinkReal;

  constructor(options: AgeCliEncryptorOptions) {
    if (!options.recipient || !options.recipient.startsWith("age1")) {
      throw new Error("AgeCliEncryptor: recipientはage公開鍵(age1...)である必要がある");
    }
    this.recipient = options.recipient;
    this.ageCommand = options.ageCommand ?? ["age"];
    if (this.ageCommand.length === 0) throw new Error("AgeCliEncryptor: ageCommandが空");
    this.tempDir = options.tempDir ?? tmpdir();
    this.fsWriteFile = options.fsOverride?.writeFile ?? writeFileReal;
    this.fsReadFile = options.fsOverride?.readFile ?? readFileReal;
    this.fsUnlink = options.fsOverride?.unlink ?? unlinkReal;
  }

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    const id = randomBytes(16).toString("hex");
    const plaintextPath = join(this.tempDir, `backup-plaintext-${id}.tmp`);
    const encryptedPath = join(this.tempDir, `backup-encrypted-${id}.age`);

    await this.fsWriteFile(plaintextPath, plaintext, { mode: 0o600 });

    let encryptError: unknown = null;
    let encrypted: Buffer | null = null;
    try {
      await this.runAge(["-r", this.recipient, "-o", encryptedPath, plaintextPath]);
      encrypted = await this.fsReadFile(encryptedPath);
    } catch (err) {
      encryptError = err;
    }

    // 暗号化の成否にかかわらず、平文一時ファイルの削除を必ず試みる。
    try {
      await this.fsUnlink(plaintextPath);
    } catch (cleanupErr) {
      const cleanupMessage = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
      const encryptMessage = encryptError instanceof Error ? encryptError.message : encryptError ? String(encryptError) : null;
      throw new Error(
        `AgeCliEncryptor: 平文一時ファイルの削除に失敗した(cleanup failure、明示的にjobを失敗させる): ${cleanupMessage}` +
          (encryptMessage ? ` (加えて暗号化自体も失敗していた: ${encryptMessage})` : ""),
      );
    }

    // 暗号化済みファイルは読み出し済みのため、その後の削除失敗は致命的としない
    // (runner終了時のworkspace破棄でも最終的に消える。平文とは扱いを区別する)。
    await this.fsUnlink(encryptedPath).catch(() => undefined);

    if (encryptError) {
      throw encryptError instanceof Error ? encryptError : new Error(String(encryptError));
    }
    return encrypted as Buffer;
  }

  async decrypt(_ciphertext: Buffer): Promise<Buffer> {
    throw new Error("AgeCliEncryptor: workflow側は復号を一切行わない設計のため、decryptは意図的に未実装");
  }

  private runAge(args: string[]): Promise<void> {
    const [command, ...prefixArgs] = this.ageCommand;
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...prefixArgs, ...args], { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString("utf8");
      });
      child.on("error", (err) => reject(new Error(`age実行に失敗した: ${err.message}`)));
      child.on("close", (code) => {
        if (code === 0) resolve();
        // stderrはage自身の(secretを含まない)診断メッセージのみを想定するが、
        // 念のため長さを制限してから例外メッセージへ含める。
        else reject(new Error(`age終了コード${code}: ${stderr.slice(0, 500)}`));
      });
    });
  }
}
