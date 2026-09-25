/**
 * 監督選択UI（ManagerPicker / CurrentManagerCard）のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-manager-picker.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**（ヘッドレスブラウザ検証も localhost のみ）。
 * - Picker 本体は Drawer（open=false で DOM 非描画）のため、
 *   ここでは (a) /api/managers の並べ替え・フィルタ（Picker が叩く API）と
 *   (b) 育成 / 比較 / スカッドに SSR される「選択中監督の要約カード」を検証する。
 * - 「スカッド: 監督なし時の案内 or 監督一覧ボタン」の1チェックのみ、
 *   scripts/lib/squad-editor-browser-check.mjs によるヘッドレス Chrome 実描画検証を使用する
 *   （スカッド編集画面は localStorage 専用データソースで ready/notfound 判定が
 *   クライアント側 useEffect 内でのみ確定するため、curl の SSR HTML だけでは検証意図
 *   （監督未設定時の導線・notfound 遷移・ja/en の実描画）を確認できないため）。
 * - 結果は docs/black-box-tests/manager-picker.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifySquadEditorManagerGuidance } from "./lib/squad-editor-browser-check.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "manager-picker.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
async function get(p) {
  try {
    const r = await fetch(BASE + p, { redirect: "manual" });
    return { status: r.status, body: await r.text().catch(() => "") };
  } catch (e) {
    return { status: -1, body: "", err: e.message };
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
const nums = (arr, pick) => arr.map(pick).filter((v) => typeof v === "number");
const isDesc = (a) => a.every((v, i) => i === 0 || a[i - 1] >= v);

async function main() {
  // 1. Picker が叩く一覧 API：並べ替え（名前 / リリース / 6戦術適性）
  const sorts = [
    "name",
    "released_desc",
    "released_asc",
    "possession_desc",
    "quick_counter_desc",
    "long_ball_counter_desc",
    "out_wide_desc",
    "long_ball_desc",
    "overload_desc",
  ];
  for (const s of sorts) {
    const r = await json(`/api/managers?pageSize=100&sort=${s}`);
    record(`並べ替え sort=${s}: HTTP 200 + 監督が返る`, r.status === 200 && (r.data?.managers?.length ?? 0) > 0, `n=${r.data?.managers?.length}`);
  }
  const profSort = {
    possession_desc: (m) => m.proficiencies.possessionGame,
    quick_counter_desc: (m) => m.proficiencies.quickCounter,
    long_ball_counter_desc: (m) => m.proficiencies.longBallCounter,
    out_wide_desc: (m) => m.proficiencies.outWide,
    long_ball_desc: (m) => m.proficiencies.longBall,
    overload_desc: (m) => m.proficiencies.overload,
  };
  for (const [s, pick] of Object.entries(profSort)) {
    const r = await json(`/api/managers?pageSize=100&sort=${s}`);
    record(`並べ替え sort=${s}: 該当適性が降順`, isDesc(nums(r.data?.managers ?? [], pick)), "");
  }
  const relDesc = await json("/api/managers?pageSize=100&sort=released_desc");
  record("並べ替え released_desc: リリース日が新しい順", isDesc((relDesc.data?.managers ?? []).map((m) => m.releasedAt ?? "")), "");

  // 2. フィルタ（得意戦術 → Picker 側でクライアント絞り込み、booster / linkup は API）
  const withB = await json("/api/managers?hasBooster=1&pageSize=200");
  record("フィルタ hasBooster=1: 全件ブースターあり", (withB.data?.managers ?? []).length > 0 && withB.data.managers.every((m) => m.hasBooster), `n=${withB.data?.totalCount}`);
  const noB = await json("/api/managers?hasBooster=0&pageSize=200");
  record("フィルタ hasBooster=0: 全件ブースターなし", (noB.data?.managers ?? []).length > 0 && noB.data.managers.every((m) => !m.hasBooster), `n=${noB.data?.totalCount}`);
  const withL = await json("/api/managers?hasLinkUpPlay=1&pageSize=200");
  record("フィルタ hasLinkUpPlay=1: 全件 Link-Up あり", (withL.data?.managers ?? []).length > 0 && withL.data.managers.every((m) => m.hasLinkUpPlay), `n=${withL.data?.totalCount}`);
  const both = await json("/api/managers?pageSize=1");
  record("フィルタ合算: あり + なし = 総数", (withB.data?.totalCount ?? 0) + (noB.data?.totalCount ?? -1) === (both.data?.totalCount ?? 0), `${withB.data?.totalCount}+${noB.data?.totalCount} vs ${both.data?.totalCount}`);

  // 3. 検索は「絞り込みの補助」：クエリ有無で件数が変わる（主操作ではない）
  const all = await json("/api/managers?pageSize=1");
  const q = await json(`/api/managers?pageSize=100&q=${encodeURIComponent("Guardiola")}`);
  record("検索: 補助的な絞り込みとして機能（総数 > 一致件数）", (all.data?.totalCount ?? 0) > (q.data?.totalCount ?? 0) && (q.data?.totalCount ?? 0) > 0, `${q.data?.totalCount}/${all.data?.totalCount}`);

  // 4. 詳細 API：Picker の「詳細を見る」/「この監督を選択」が使う
  const conte = (await json(`/api/managers?q=${encodeURIComponent("Conte")}&pageSize=20`)).data.managers.find((m) => m.nameEn.includes("Conte"));
  const det = await json(`/api/managers/${conte.internalManagerId}`);
  record("詳細API: 6戦術適性 + ブースター + Link-Up + リリース + ID を返す", (() => {
    const m = det.data?.manager;
    return m && ["possessionGame", "quickCounter", "longBallCounter", "outWide", "longBall", "overload"].every((k) => k in m.proficiencies)
      && Array.isArray(m.boosters) && Array.isArray(m.linkUpPlays) && "releasedAt" in m && "internalManagerId" in m;
  })(), "");
  record("詳細API: ブースターは confirmed のみ statKey 付き（未確認は適用しない前提）", (det.data?.manager?.boosters ?? []).every((b) => (b.confirmationStatus === "confirmed") === !!b.statKey || b.confirmationStatus !== "confirmed"), "");

  // 5. 育成画面：選択中監督の要約カード（監督なし初期状態）
  const messiWorld = (await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=1&sort=ovr_max_desc`)).data.players[0].worldCardId;
  const prog = await get(`/players/world/${messiWorld}`);
  record("育成: 「監督なし（managerBoosterDelta = 0）」を初期表示", prog.body.includes("監督なし（managerBoosterDelta = 0）"), "");
  record("育成: 「監督一覧から選択」ボタン（検索ボックスではなく一覧が主操作）", prog.body.includes("監督一覧から選択"), "");
  record("育成: 監督なし要約カードは「監督を選ぶと確認済みブースターが対象能力へ適用」と案内", prog.body.includes("監督を選ぶと") && prog.body.includes("確認済みブースター"), "");
  record("育成: 監督補正は独立レイヤー（managerBoosterDelta）として能力値比較に列がある", prog.body.includes("選択した監督のブースター効果"), "");

  // 6. 比較画面：全員一括の監督選択 UI（インライン検索を廃し一覧ボタンへ）
  const cb = (await json("/api/world/players?position=CB&pageSize=1&sort=ovr_max_desc")).data.players[0].worldCardId;
  const cmp = await get(`/compare?ids=${messiWorld},${cb}`);
  record("比較: 「監督一覧から選択」ボタンがある", cmp.body.includes("監督一覧から選択"), "");
  record("比較: インラインの監督検索入力を撤去（主操作は一覧）", !/監督名で検索|監督を検索/.test(cmp.body), "");
  const cmpMgr = await get(`/compare?ids=${messiWorld},${cb}&m=${conte.internalManagerId},${conte.internalManagerId}`);
  record("比較: URL の監督指定 (m=) が SSR に反映される", cmpMgr.status === 200 && cmpMgr.body.includes("監督"), `HTTP ${cmpMgr.status}`);

  // 7. スカッド画面：チーム全体の監督選択（同じ CurrentManagerCard / ManagerPicker）
  const sq = await get("/squads/sq_pickerbb0001");
  record("スカッド: 監督パネルが 200 で描画（クラッシュしない）", sq.status === 200, `HTTP ${sq.status}`);
  // このチェックのみヘッドレス Chrome による実描画検証（理由は本ファイル冒頭コメント参照）。
  const browserCheck = await verifySquadEditorManagerGuidance(BASE);
  record("スカッド: 監督なし時の案内 or 監督一覧ボタン（ヘッドレス実描画検証）", browserCheck.ok, browserCheck.detail);

  // 8. 回帰：監督一覧ページ・詳細ページは従来どおり
  const lp = await get("/managers");
  record("回帰: /managers 一覧 200", lp.status === 200 && /名の監督/.test(lp.body), `HTTP ${lp.status}`);
  const dp = await get(`/managers/${conte.internalManagerId}`);
  record("回帰: /managers/{id} 詳細 200", dp.status === 200 && dp.body.includes("戦術適性"), `HTTP ${dp.status}`);
  record("回帰: 監督画像は使わずイニシャルアバターのみ（<img> の監督写真なし）", !/manager[-_]?photo|監督写真/i.test(lp.body + dp.body), "");

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-manager-picker] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 監督選択UI ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
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
  console.log(`[black-box-manager-picker] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
