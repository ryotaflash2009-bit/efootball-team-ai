/**
 * My Team「スカッドで使用」→ スカッド選択 → スカッド編集 の画面遷移(HTTP/SSRレベル)の
 * ブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-squad-use.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - My Team・保存ビルド・保存スカッドは localStorage 保存のため、SSRでは「空状態シェル」までを検証する。
 *   実際の「カード+ビルドの引き継ぎ→配置確定→保存→再読み込み後の維持」等の状態遷移は
 *   src/lib/squad/pending-addition.test.ts（vitest）と、隔離ヘッドレスChromeによる
 *   実ブラウザ検証スクリプトで担保する。
 * - 実ユーザーのMy Team・保存ビルド・保存スカッドは変更しない(このscriptsは読み取りのみ)。
 * - 結果は docs/black-box-tests/squad-use.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "squad-use.md");
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

const MESSI = "89138556575063";

async function main() {
  // 1. My Team画面(SSR空状態シェル)。「スカッドで使用」の文言はカード単位の表示のため
  //    localStorageが空のSSR初回応答には現れない(空状態シェルの既存慣習と同じ)。ここでは200のみ確認する。
  const mt = await get("/my-team");
  record("My Team: /my-team が 200", mt.status === 200, `HTTP ${mt.status}`);

  // 2. スカッド一覧: card パラメータのみ
  const sqCard = await get(`/squads?card=${MESSI}`);
  record("スカッド一覧: card付きで200", sqCard.status === 200, `HTTP ${sqCard.status}`);
  record("スカッド一覧: 内部情報を含まない(card単独)", !/SELECT \*|efootball\.db|process\.env/i.test(sqCard.text), "");

  // 3. スカッド一覧: card + build パラメータ(今回追加)。クラッシュしないことを確認する。
  //    注: build値自体はNext.jsのハイドレーション用ペイロード(scriptタグ内)に含まれ得るが、
  //    これは通常のUIへの表示ではない(既存のcard/squadId等の他propsも同様に含まれる)。
  //    「内部IDを通常UIへ表示しない」の検証は、実際に画面へ描画される文言を確認する
  //    隔離ヘッドレスChromeの実ブラウザ検証で行う。
  const sqCardBuild = await get(`/squads?card=${MESSI}&build=b_test123`);
  record("スカッド一覧: card+buildで200(クラッシュしない)", sqCardBuild.status === 200, `HTTP ${sqCardBuild.status}`);

  // 4. スカッド一覧: 不正なbuildパラメータでもクラッシュしない(安全に無視される想定)
  const sqInvalidBuild = await get(`/squads?card=${MESSI}&build=${encodeURIComponent("../../etc/passwd")}`);
  record("スカッド一覧: 不正なbuildパラメータでも200(安全に無視)", sqInvalidBuild.status === 200, `HTTP ${sqInvalidBuild.status}`);

  // 5. 存在しないスカッドIDへ card+build 付きでアクセスしてもクラッシュしない
  const notFoundSquad = await get(`/squads/sq_doesnotexist12?card=${MESSI}&build=b_test123`);
  record(
    "スカッド編集(存在しないID): card+build付きでも200(安全な不明表示)",
    notFoundSquad.status === 200,
    `HTTP ${notFoundSquad.status}`,
  );

  // 6. 回帰: 既存のスカッド関連ルートが引き続き200
  for (const p of ["/squads", "/squads/compare", "/squads/templates", "/my-team", "/my-builds", "/build-inventory"]) {
    const r = await get(p);
    record(`回帰: ${p} が200`, r.status === 200, `HTTP ${r.status}`);
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-squad-use] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 「スカッドで使用」遷移 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "注: My Team・保存ビルド・保存スカッドは localStorage 保存のため、SSRでは「空状態シェル」までを検証。",
    "カード+ビルドの引き継ぎ・配置確定・保存・再読み込み後の維持等の状態遷移は",
    "src/lib/squad/pending-addition.test.ts（vitest）と、隔離ヘッドレスChromeの実ブラウザ検証で担保。",
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
  console.log(`[black-box-squad-use] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
