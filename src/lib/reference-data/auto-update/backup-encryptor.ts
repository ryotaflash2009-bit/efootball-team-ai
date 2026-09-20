import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Backup暗号化の差し替え可能interface。
 *
 * **Production向けの第一候補は`age`(非対称鍵暗号)であり、この理由を明記する:**
 * GitHub Actions側は「暗号化用の公開鍵」だけを持てばよく、復号能力(秘密鍵・パスフレーズ)を
 * 一切持たない設計にできる。これにより、CI側のSecret漏洩がBackup内容の漏洩に直結しない
 * (公開鍵はそもそも秘密情報ではない)。復号は常に本人がローカルで、秘密鍵を使って行う。
 * `age`はGitHub Actions runnerへのインストールが容易(単一の小さいバイナリ)で、
 * Windows/Linuxいずれでも復号操作が単純という利点もある。
 *
 * このセッションでは、外部バイナリ(`age`・GPG・OpenSSL CLI)を新たにpackage/依存として
 * 追加しない方針のため、隔離PostgreSQL検証で実際に動かすのはNode.js標準の`node:crypto`
 * (AES-256-GCM、対称鍵)による`NodeAesGcmEncryptor`とする。これはあくまで
 * **検証専用の代替実装**であり、Production運用でこれをそのまま採用する場合は、
 * 対称鍵(パスフレーズ)をGitHub Secretsとして持たせる必要があり、`age`より秘密情報の
 * 取り扱い範囲が広くなる(このトレードオフは`reference-data-production-backup-design.md`に
 * 明記する)。
 *
 * いずれの実装も、Production用の実際の鍵・パスフレーズはこのセッションで生成・使用しない。
 * 隔離検証では`generateEphemeralTestKey()`が返す使い捨てテスト鍵、または`FakeEncryptor`
 * だけを使用する。
 */
export interface BackupEncryptor {
  algorithmId: string;
  encrypt(plaintext: Buffer): Promise<Buffer>;
  decrypt(ciphertext: Buffer): Promise<Buffer>;
}

/**
 * Unit Test専用のfake実装。暗号として一切安全ではない(単純な反転+マーカー付与のみ)。
 * Production・隔離PostgreSQL検証のいずれでも使用してはならない(呼び出し元のテストコード内だけで使う)。
 */
export class FakeEncryptor implements BackupEncryptor {
  algorithmId = "fake-test-only-reversible-marker";

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    const marker = Buffer.from("FAKE_ENCRYPTED:");
    return Buffer.concat([marker, Buffer.from(plaintext).reverse()]);
  }

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    const marker = Buffer.from("FAKE_ENCRYPTED:");
    if (!ciphertext.subarray(0, marker.length).equals(marker)) {
      throw new Error("FakeEncryptor: マーカー不一致(改ざんされたデータ、または対応する鍵で暗号化されていない)");
    }
    return Buffer.from(ciphertext.subarray(marker.length)).reverse();
  }
}

/**
 * 隔離PostgreSQL検証専用: Node.js標準`crypto`のAES-256-GCMによる対称鍵暗号化。
 * 認証タグ(GCM)により、改ざん・誤った鍵での復号を検出して例外を投げる
 * (「暗号化ファイル改ざん時拒否」「wrong key拒否」の実装根拠)。
 */
export class NodeAesGcmEncryptor implements BackupEncryptor {
  algorithmId = "aes-256-gcm";
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error("NodeAesGcmEncryptor: 鍵は32byte(256bit)である必要がある");
    this.key = key;
  }

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    if (ciphertext.length < 12 + 16) {
      throw new Error("NodeAesGcmEncryptor: 暗号文が短すぎる(不完全なBackupファイルの可能性)");
    }
    const iv = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(12, 28);
    const encrypted = ciphertext.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    // GCMの認証タグ検証に失敗すると、ここで必ず例外を投げる(改ざん・誤った鍵を安全に拒否する)。
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}

/**
 * 隔離PostgreSQL検証専用の使い捨てテスト鍵を生成する。Production用の鍵・パスフレーズの
 * 生成・保存は行わない(このセッションのスコープ外、独立した承認事項)。
 */
export function generateEphemeralTestKey(): Buffer {
  return randomBytes(32);
}
