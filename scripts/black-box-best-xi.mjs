/**
 * AIベスト11 画面のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-best-xi.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - My Team・保存ビルドは localStorage 保存のため、SSR では「候補ゼロ(空状態)シェル」までを検証する。
 *   候補構築・適格性判定・選考アルゴリズム・重複防止・選考理由・選外候補・決定性は
 *   src/lib/best-xi/*.test.ts（vitest）で担保。実際の選考結果を伴う操作(再選出・複数ビルド等)は
 *   隔離ヘッドレスChromeによる実ブラウザ検証スクリプトで担保する。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッドは変更しない(このscriptsは読み取りのみ)。
 * - 結果は docs/black-box-tests/best-xi.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "best-xi.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const stripRsc = (s) => s.replace(/<!-- -->/g, "");
async function get(p) {
  try {
    const r = await fetch(BASE + p, { redirect: "manual" });
    const raw = await r.text().catch(() => "");
    return { status: r.status, body: raw, text: stripRsc(raw) };
  } catch (e) {
    return { status: -1, body: "", text: "", err: e.message };
  }
}
async function json(p) {
  const r = await get(p);
  try {
    return { ...r, data: JSON.parse(r.body) };
  } catch {
    return { ...r, data: null };
  }
}

async function main() {
  // 1. AIベスト11画面(SSR 空状態シェル)
  const bx = await get("/best-xi");
  record("AIベスト11: /best-xi が 200", bx.status === 200, `HTTP ${bx.status}`);
  record("AIベスト11: 見出し(h1)は1つ", (bx.body.match(/<h1/g) || []).length === 1, "");
  record("AIベスト11: 見出し「AIベスト11」", bx.text.includes("AIベスト11"), "");
  record("AIベスト11: 「総合型」の説明がある", bx.text.includes("総合型"), "");
  record("AIベスト11: 「4-3-3」の初期フォーメーション表記がある", bx.text.includes("4-3-3"), "");
  record(
    "AIベスト11: 生成AI不使用の明示",
    bx.text.includes("生成AI") && bx.text.includes("外部AI"),
    "",
  );
  record(
    "AIベスト11: 勝率予測ではないことの明示",
    bx.text.includes("勝率") && bx.text.includes("予測する機能ではありません"),
    "",
  );
  record(
    "AIベスト11: 結果は保存されないことの明示",
    bx.text.includes("この選考結果は保存されません"),
    "",
  );
  record(
    "AIベスト11: 「あなたの保存済み候補内」の明示",
    bx.text.includes("あなたの保存済み候補内"),
    "",
  );
  record(
    "AIベスト11: My Team未登録時の空状態案内",
    bx.text.includes("My Teamに選手が登録されていません"),
    "",
  );
  record(
    "AIベスト11: My Teamへの導線がある",
    /href="\/my-team"/.test(bx.body),
    "",
  );
  record(
    "AIベスト11: 保存ビルド一覧への導線がある",
    /href="\/build-inventory"/.test(bx.body),
    "",
  );
  record(
    "AIベスト11: 内部情報(SQL/絶対パス/APIキー等)を含まない",
    !/SELECT \*|efootball\.db|C:\\\\|process\.env|api[_-]?key/i.test(bx.text),
    "",
  );
  record(
    "AIベスト11: worldCardId等の内部ID文字列がそのまま露出していない(候補ゼロ状態)",
    !/candidateKey|worldCardId|savedBuildId/.test(bx.text),
    "",
  );
  record(
    "AIベスト11: 「世界最強」等の誇大表現を含まない",
    !/世界最強|全国(1位|最強)|必ず勝てる/.test(bx.text),
    "",
  );

  // 2. サイドバー導線
  const home = await get("/");
  record(
    "サイドバー: 「AIベスト11」リンクがある",
    /href="\/best-xi"/.test(home.body) && home.text.includes("AIベスト11"),
    "",
  );
  record(
    "サイドバー: 「AIベスト11」が「準備中」表示ではない",
    !new RegExp("AIベスト11[\\s\\S]{0,40}準備中").test(home.text),
    "",
  );

  // 3. 既存ルートの回帰(AIベスト11追加が他画面へ影響していないこと)
  for (const p of ["/", "/players", "/compare", "/my-team", "/favorites", "/squads", "/squads/compare", "/my-builds", "/build-inventory"]) {
    const r = await get(p);
    record(`回帰: ${p} が200`, r.status === 200, `HTTP ${r.status}`);
  }
  const one = await json("/api/world/players/89138556575063");
  record("回帰: 選手詳細API 26能力値", one.status === 200 && one.data?.player?.stats?.length === 26, "");

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-best-xi] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# AIベスト11 画面 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "注: My Team・保存ビルドは localStorage 保存のため、SSR では「候補ゼロ(空状態)シェル」までを検証。",
    "候補構築・適格性判定・選考アルゴリズム・重複防止・選考理由・選外候補・決定性は",
    "src/lib/best-xi/*.test.ts（vitest）で担保。",
    "実際の選考結果を伴う操作(再選出・複数ビルド・候補不足等)は隔離ヘッドレスChromeの実ブラウザ検証で担保。",
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`),
    "",
    `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`,
    "",
  ];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box-best-xi] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
