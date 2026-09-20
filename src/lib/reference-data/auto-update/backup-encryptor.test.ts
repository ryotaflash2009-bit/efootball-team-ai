import { describe, it, expect } from "vitest";
import { FakeEncryptor, NodeAesGcmEncryptor, generateEphemeralTestKey } from "./backup-encryptor";

describe("FakeEncryptor(テスト専用、暗号として安全ではない)", () => {
  it("暗号化後に復号すると元のplaintextへ戻る", async () => {
    const enc = new FakeEncryptor();
    const plaintext = Buffer.from("hello world", "utf8");
    const ciphertext = await enc.encrypt(plaintext);
    const decrypted = await enc.decrypt(ciphertext);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it("マーカーが無いciphertextの復号は拒否する(改ざん検出の最小限モデル)", async () => {
    const enc = new FakeEncryptor();
    await expect(enc.decrypt(Buffer.from("not encrypted"))).rejects.toThrow();
  });
});

describe("NodeAesGcmEncryptor(隔離PostgreSQL検証専用、使い捨てテスト鍵と併用する)", () => {
  it("正しい鍵で暗号化・復号すると元のplaintextへ戻る", async () => {
    const key = generateEphemeralTestKey();
    const enc = new NodeAesGcmEncryptor(key);
    const plaintext = Buffer.from(JSON.stringify({ a: 1, skills: ["x", "y"] }), "utf8");
    const ciphertext = await enc.encrypt(plaintext);
    const decrypted = await enc.decrypt(ciphertext);
    expect(decrypted.toString("utf8")).toBe(plaintext.toString("utf8"));
  });

  it("暗号化のたびに異なるciphertextを生成する(IVがランダム)", async () => {
    const key = generateEphemeralTestKey();
    const enc = new NodeAesGcmEncryptor(key);
    const plaintext = Buffer.from("same content", "utf8");
    const c1 = await enc.encrypt(plaintext);
    const c2 = await enc.encrypt(plaintext);
    expect(c1.equals(c2)).toBe(false);
  });

  it("誤った鍵での復号は拒否する(wrong key拒否)", async () => {
    const key1 = generateEphemeralTestKey();
    const key2 = generateEphemeralTestKey();
    const enc1 = new NodeAesGcmEncryptor(key1);
    const enc2 = new NodeAesGcmEncryptor(key2);
    const ciphertext = await enc1.encrypt(Buffer.from("secret", "utf8"));
    await expect(enc2.decrypt(ciphertext)).rejects.toThrow();
  });

  it("改ざんされたciphertextの復号は拒否する(認証タグ検証による改ざん検出)", async () => {
    const key = generateEphemeralTestKey();
    const enc = new NodeAesGcmEncryptor(key);
    const ciphertext = await enc.encrypt(Buffer.from("secret payload", "utf8"));
    const tampered = Buffer.from(ciphertext);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(enc.decrypt(tampered)).rejects.toThrow();
  });

  it("不完全(短すぎる)なciphertextの復号は拒否する(incomplete dump拒否)", async () => {
    const key = generateEphemeralTestKey();
    const enc = new NodeAesGcmEncryptor(key);
    await expect(enc.decrypt(Buffer.from("short"))).rejects.toThrow();
  });

  it("32byte以外の鍵は構築時に拒否する", () => {
    expect(() => new NodeAesGcmEncryptor(Buffer.from("too-short"))).toThrow();
  });

  it("generateEphemeralTestKeyは毎回異なる32byteの鍵を返す", () => {
    const k1 = generateEphemeralTestKey();
    const k2 = generateEphemeralTestKey();
    expect(k1.length).toBe(32);
    expect(k1.equals(k2)).toBe(false);
  });
});
