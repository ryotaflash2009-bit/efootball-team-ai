/**
 * 日本語表記回帰監査ランナー（読み取り専用）。
 *   npm run audit:ja-labels
 *
 * - 走査は AUDIT_DIRS 配下のみ。EXCLUDE_DIRS / 除外ファイルは開かない。
 * - ワークスペース外へアクセスしない。ファイルを一切書き換えない（読み取り専用）。
 * - 出力は相対パスのみ（絶対パス・ファイル内容全体・機密は出さない）。
 * - 次のいずれかで exit 1: 辞書の問題 / 未許可の静的違反 / 未許可の動的候補 /
 *   allowlist の構造不正 / stale allowlist。それ以外は exit 0。
 * - NUL バイトを含むファイルは開かず、修復もせず、一覧だけ報告する。
 *
 * ロジック本体は scripts/lib/ja-label-audit.mjs（純関数・テスト対象）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUDIT_DIRS,
  EXCLUDE_DIRS,
  ALLOWLIST,
  isExcludedFile,
  scanSource,
  scanDynamicNameEn,
  checkDictionary,
  parseLabelMap,
  countAllowedTitleMentions,
  validateAllowlistEntry,
  isAllowlistEntryStale,
} from "./lib/ja-label-audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");

async function* walkTsx(dirAbs) {
  let entries;
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.includes(e.name)) continue;
      yield* walkTsx(path.join(dirAbs, e.name));
    } else if (e.isFile()) {
      if (isExcludedFile(e.name)) continue;
      if (!/\.(t|j)sx$/.test(e.name)) continue;
      if (/\.(test|spec)\.(t|j)sx$/.test(e.name)) continue;
      yield path.join(dirAbs, e.name);
    }
  }
}

async function readSourceFile(relText) {
  return fs.readFile(path.join(ROOT, relText), "utf8");
}

async function tryReadFile(relText) {
  try {
    return await fs.readFile(path.join(ROOT, relText), "utf8");
  } catch {
    return null;
  }
}

async function main() {
  // ---------- 1. 表示辞書の完全性 ----------
  const statLabelsSrc = await readSourceFile("src/lib/world/stat-labels.ts");
  const statsSrc = await readSourceFile("src/lib/world/stats.ts");
  const groupsSrc = await readSourceFile("src/lib/progression/stat-groups.ts");
  const catsSrc = await readSourceFile("src/lib/comparison/categories.ts");

  const statLabels = parseLabelMap(statLabelsSrc, "STAT_LABEL_JA") ?? {};
  const groupLabels = parseLabelMap(statLabelsSrc, "GROUP_LABEL_JA") ?? {};
  const radarAxisLabels = parseLabelMap(statLabelsSrc, "RADAR_AXIS_LABEL_JA") ?? {};
  const buildModeLabels = parseLabelMap(statLabelsSrc, "BUILD_MODE_LABEL_JA") ?? {};

  const statKeys = [...statsSrc.matchAll(/\{\s*key:\s*"([^"]+)"/g)].map((m) => m[1]);
  const groupIds = [...groupsSrc.matchAll(/groupId:\s*"([^"]+)"/g)].map((m) => m[1]);
  const radarAxisIds = [...catsSrc.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
  // CompareBuildMode / SquadBuildMode の union（両者とも同じ 5 値）
  const buildModeValues = ["none", "attack", "defense", "balance", "gk"];

  const dictProblems = checkDictionary({
    statLabels,
    groupLabels,
    radarAxisLabels,
    buildModeLabels,
    statKeys,
    groupIds,
    radarAxisIds,
    buildModeValues,
  });

  // ---------- 2. JSX スキャン（静的リテラル + 動的 nameEn） ----------
  const staticViolations = [];
  const dynamicAll = [];
  const nulFiles = [];
  let scanned = 0;
  let allowedTitles = 0;
  for (const dir of AUDIT_DIRS) {
    for await (const abs of walkTsx(path.join(ROOT, dir))) {
      const buf = await fs.readFile(abs);
      if (buf.includes(0)) {
        nulFiles.push(rel(abs));
        continue;
      }
      scanned++;
      const text = buf.toString("utf8");
      const r = rel(abs);
      staticViolations.push(...scanSource(r, text));
      dynamicAll.push(...scanDynamicNameEn(r, text));
      allowedTitles += countAllowedTitleMentions(r, text);
    }
  }
  const dynamicAllowed = dynamicAll.filter((v) => v.allowlisted);
  const dynamicUnallowed = dynamicAll.filter((v) => !v.allowlisted);

  // ---------- 3. allowlist の構造検証 + stale 検出 ----------
  const allowlistProblems = [];
  const staleEntries = [];
  for (const entry of ALLOWLIST) {
    const structural = validateAllowlistEntry(entry);
    for (const p of structural) allowlistProblems.push(`${entry.file || "(file 未設定)"}: ${p}`);
    if (structural.length > 0) continue; // 構造不正なら stale 判定はしない
    const content = await tryReadFile(entry.file);
    if (isAllowlistEntryStale(entry, content)) {
      staleEntries.push(entry);
    }
  }

  // ---------- 4. レポート ----------
  console.log("日本語能力値ラベル監査:");
  console.log(`- 能力値辞書: ${Object.keys(statLabels).length} / ${statKeys.length}`);
  console.log(`- 育成カテゴリ辞書: ${Object.keys(groupLabels).length} / ${groupIds.length}`);
  console.log(`- レーダー軸辞書: ${Object.keys(radarAxisLabels).length} / ${radarAxisIds.length}`);
  console.log(`- 育成方針辞書: ${Object.keys(buildModeLabels).length} / ${buildModeValues.length}`);
  console.log(`- 走査した JSX ファイル: ${scanned}`);
  console.log(`- title 属性への英語リテラル併記（許可・参考）: ${allowedTitles}`);
  console.log(`- 静的な英語主表示違反: ${staticViolations.length}`);
  console.log(`- 動的 nameEn 表示候補: ${dynamicUnallowed.length}`);
  console.log(`- allowlist 適用: ${dynamicAllowed.length}`);
  console.log(`- stale allowlist: ${staleEntries.length}`);
  console.log(
    `- 未許可違反: ${staticViolations.length + dynamicUnallowed.length}`,
  );
  if (nulFiles.length) console.log(`- NUL バイト検出（開かず）: ${nulFiles.length}`);

  let ok = true;

  if (dictProblems.length) {
    ok = false;
    console.log("\n辞書の問題:");
    for (const p of dictProblems) console.log(`  - ${p}`);
  }
  if (staticViolations.length) {
    ok = false;
    console.log("\n違反候補（静的リテラル）:");
    for (const v of staticViolations) {
      console.log(`  - ${v.file}:${v.line}`);
      console.log(`    ルール: ${v.rule}`);
      console.log(`    式: ${v.name}`);
      console.log(`    ${v.excerpt}`);
    }
  }
  if (dynamicUnallowed.length) {
    ok = false;
    console.log("\n違反候補（動的 nameEn 表示）:");
    for (const v of dynamicUnallowed) {
      console.log(`  - ${v.file}:${v.line}`);
      console.log(`    ルール: ${v.rule}`);
      console.log(`    式: ${v.name}`);
      console.log(`    理由: JSX 子要素で英語名を直接表示する可能性があります`);
      console.log(`    ${v.excerpt}`);
    }
  }
  if (allowlistProblems.length) {
    ok = false;
    console.log("\nallowlist の構造不正:");
    for (const p of allowlistProblems) console.log(`  - ${p}`);
  }
  if (staleEntries.length) {
    ok = false;
    console.log("\nstale allowlist:");
    for (const e of staleEntries) {
      console.log(`  - ${e.file}`);
      console.log(`    ルール: ${e.rule}`);
      console.log(`    式: ${e.expression}`);
      console.log(`    登録した式／ファイルが見つかりません（不要なら手動で削除してください）`);
    }
  }
  if (nulFiles.length) {
    console.log("\nNUL バイトを含むファイル（監査対象外・修復しない）:");
    for (const f of nulFiles) console.log(`  - ${f}`);
  }
  if (dynamicAllowed.length && ok) {
    console.log("\nallowlist 適用（理由付きで許可された既知の箇所）:");
    for (const v of dynamicAllowed) {
      console.log(`  - ${v.file}:${v.line}  ${v.name}  [${v.rule}]`);
    }
  }

  console.log(`\n結果: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("監査エラー:", err && err.message ? err.message : err);
  process.exit(1);
});
