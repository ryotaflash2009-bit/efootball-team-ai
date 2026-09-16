import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * 参照データ移行ツール一式(`src/lib/reference-data/*.ts`・`scripts/migration/*.mjs`・
 * `scripts/migration/*.ps1`)が、本人のクリップボード・保存パスワード・Cookie・認証Token・
 * ブラウザープロファイルへ一切アクセスしていないことを静的に確認する。
 *
 * Session pooler接続文字列の取得はSupabase Dashboardからの手動コピー(または、ユーザーが
 * 明示的に許可した場合の別経路)に限定し、この既定の移行ツール群では絶対に自動化しない
 * という設計を、コード追加によって壊していないかを継続的に検出する。
 */
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const REFERENCE_DATA_DIR = path.resolve(__dirname);
const MIGRATION_SCRIPTS_DIR = path.join(REPO_ROOT, "scripts", "migration");

const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "Windowsクリップボード読取り(Get-Clipboard)", re: /Get-Clipboard/i },
  { label: "clip.exe呼び出し", re: /\bclip\.exe\b/i },
  { label: "ブラウザーのCookie/Local Storage/プロファイルパス", re: /(Cookies|Local State|User Data\\Default|chrome:\/\/|Login Data)/i },
  { label: "navigator.clipboard等のブラウザーAPI", re: /navigator\.clipboard/i },
  { label: "Node clipboardy等のクリップボード操作パッケージ", re: /require\(["']clipboardy["']\)|from ["']clipboardy["']/i },
  { label: "Supabase Management APIトークン", re: /SUPABASE_ACCESS_TOKEN|management\.supabase\.com/i },
];

function listFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir)
    .filter((f) => extensions.some((ext) => f.endsWith(ext)))
    .map((f) => path.join(dir, f));
}

describe("参照データ移行ツール: クリップボード・ブラウザー資格情報の不使用を静的監査", () => {
  const targetFiles = [
    ...listFiles(REFERENCE_DATA_DIR, [".ts"]).filter((f) => !f.endsWith(".test.ts")),
    ...listFiles(MIGRATION_SCRIPTS_DIR, [".mjs", ".ps1"]),
  ];

  it("対象ファイルが1件以上見つかる(監査対象が空にならないことの保証)", () => {
    expect(targetFiles.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN_PATTERNS)("$label を含まない", ({ re }) => {
    for (const file of targetFiles) {
      const content = readFileSync(file, "utf8");
      const match = content.match(re);
      expect(match, `${path.relative(REPO_ROOT, file)} に該当パターンが見つかった: ${match?.[0]}`).toBeNull();
    }
  });
});
