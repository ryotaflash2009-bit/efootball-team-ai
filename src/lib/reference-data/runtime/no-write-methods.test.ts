import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * `src/lib/reference-data/runtime/`配下のアプリ実行時コードが、Supabaseの書込みメソッド
 * (.insert/.update/.upsert/.delete/.rpc)を一切呼び出していないことを静的に確認する。
 * 通常アプリのデータアクセス層は参照データをSELECTするだけであるべきという設計を、
 * コードの追加によって壊していないかを継続的に検出する。
 */
const RUNTIME_DIR = path.resolve(__dirname);
const WRITE_METHOD_RE = /\.(insert|update|upsert|delete|rpc)\s*\(/;

function listSourceFiles(): string[] {
  return readdirSync(RUNTIME_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "test-doubles.ts")
    .map((f) => path.join(RUNTIME_DIR, f));
}

describe("reference-data/runtime: 書込みメソッド不使用の静的監査", () => {
  it("insert/update/upsert/delete/rpcを一切呼び出さない", () => {
    const files = listSourceFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const match = content.match(WRITE_METHOD_RE);
      expect(match, `${path.basename(file)} が書込みメソッドを含む: ${match?.[0]}`).toBeNull();
    }
  });

  it("service_role/接続文字列がコード(コメント以外)に実際に使われていない", () => {
    // コメント内で「service_roleは使わない」等と説明することは許容する(既存のDDL監査と同じ方針)。
    // ここではコメントを取り除いた実コード部分だけを対象にする。
    const files = listSourceFiles();
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(withoutComments, path.basename(file)).not.toMatch(/service_role/i);
      expect(withoutComments, path.basename(file)).not.toMatch(/postgres(ql)?:\/\//i);
    }
  });
});
