import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * 日本語の辞書のソースの全文（核 ja.ts + 分割した名前空間 ja-ns/*.ts。2026-10-04 に分割）。
 * 「文言は辞書に存在する」の確認で使う（文言は変えずにファイルを分けただけなので、すべてを合わせて探す）。
 */
export async function readJaDictionarySource(root) {
  const dir = path.join(root, "src", "lib", "i18n", "dictionaries");
  const parts = [await fs.readFile(path.join(dir, "ja.ts"), "utf8")];
  for (const f of (await fs.readdir(path.join(dir, "ja-ns"))).sort()) parts.push(await fs.readFile(path.join(dir, "ja-ns", f), "utf8"));
  return parts.join("\n");
}
