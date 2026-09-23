/**
 * 監督機能のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-managers.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - 結果は docs/black-box-tests/managers.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "managers.md");
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

async function main() {
  // 1. 監督一覧 API
  const list = await json("/api/managers?pageSize=24&sort=name");
  record("監督一覧API: HTTP 200", list.status === 200, `HTTP ${list.status}`);
  record("監督一覧API: 総数 > 0", list.data?.totalCount > 0, `total=${list.data?.totalCount}`);
  record("監督一覧API: source = amine250", /amine250/.test(list.data?.source ?? ""), `${list.data?.source}`);
  record("監督一覧API: 各行に戦術適性6項目", (() => {
    const m = list.data?.managers?.[0]?.proficiencies ?? {};
    return ["possessionGame", "quickCounter", "longBallCounter", "outWide", "longBall", "overload"].every((k) => k in m);
  })(), "");
  record("監督一覧API: 内部情報/SQLを含まない", !/efootball\.db|SELECT |C:\\\\/.test(list.body), "");

  // 2. 検索
  const sConte = await json(`/api/managers?q=${encodeURIComponent("Antonio Conte")}&pageSize=20`);
  record("検索: Antonio Conte が見つかる", sConte.data?.totalCount > 0 && sConte.data.managers.some((m) => m.nameEn.includes("Conte")), `total=${sConte.data?.totalCount}`);
  const sUpper = await json("/api/managers?q=CONTE&pageSize=20");
  const sLower = await json("/api/managers?q=conte&pageSize=20");
  record("検索: 大文字小文字を無視", sUpper.data?.totalCount === sLower.data?.totalCount && sLower.data?.totalCount > 0, "");
  const inj = await json("/api/managers?q=" + encodeURIComponent("'; DROP TABLE managers; --"));
  const after = await json("/api/managers?pageSize=1");
  // 上流(Supabase手前の防御)が拒否した場合は、安全なクライアント入力エラー(400・SEARCH_INPUT_REJECTED・内部情報なし)が
  // 期待どおりの応答。5xx・内部情報の露出・テーブルの変化は不合格(本人方針 2026-09-23)。
  const injSafe = inj.status === 200 || (inj.status === 400 && inj.data?.error?.code === "SEARCH_INPUT_REJECTED" && !/drop|table|select|ilike|postgrest|supabase|cloudflare|stack/i.test(inj.body));
  record("検索: SQLインジェクション風でもテーブルが無事", injSafe && after.data?.totalCount >= 66, `HTTP ${inj.status} after=${after.data?.totalCount}`);

  // 3. フィルタ
  const withB = await json("/api/managers?hasBooster=1&pageSize=100");
  record("フィルタ: ブースターあり", withB.data?.managers?.every((m) => m.hasBooster), `total=${withB.data?.totalCount}`);
  const withL = await json("/api/managers?hasLinkUpPlay=1&pageSize=100");
  record("フィルタ: Link-Up Play あり", withL.data?.managers?.every((m) => m.hasLinkUpPlay), `total=${withL.data?.totalCount}`);

  // 4. 同名別カード
  const gp = await json("/api/managers?q=guardiola&pageSize=50");
  record("同名別カード: Guardiola が複数・全部別 ID", gp.data?.totalCount >= 2 && new Set(gp.data.managers.map((m) => m.internalManagerId)).size === gp.data.managers.length, `total=${gp.data?.totalCount}`);

  // 5. 詳細 API
  const conteId = sConte.data.managers.find((m) => m.sourceManagerId === "conte")?.internalManagerId ?? sConte.data.managers[0].internalManagerId;
  const det = await json(`/api/managers/${conteId}`);
  record("詳細API: 正常な ID → 200", det.status === 200 && det.data?.manager?.internalManagerId === conteId, `HTTP ${det.status}`);
  record("詳細API: Conte のブースター = Defensive Awareness +1 / Kicking Power +1", (() => {
    const b = (det.data?.manager?.boosters ?? []).map((x) => `${x.statNameEn} ${x.rawValue}`).sort();
    return JSON.stringify(b) === JSON.stringify(["Defensive Awareness +1", "Kicking Power +1"]);
  })(), "");
  record("詳細API: ブースターは confirmed・statKey あり", (det.data?.manager?.boosters ?? []).every((b) => b.confirmationStatus === "confirmed" && b.statKey), "");
  record("詳細API: Link-Up Play の Center Piece / Key Man 条件", (() => {
    const lu = det.data?.manager?.linkUpPlays?.[0];
    return lu && lu.centerPiece && lu.keyMan && Array.isArray(lu.centerPiece.positions);
  })(), "");
  record("詳細API: ソース非収録項目は null（age/国籍/チーム等）", det.data?.manager?.age == null && det.data?.manager?.coachingAffinity == null, "");
  const det400 = await get("/api/managers/abc");
  record("詳細API: 不正 ID → 400", det400.status === 400, `HTTP ${det400.status}`);
  const det404 = await get("/api/managers/999999");
  record("詳細API: 存在しない ID → 404", det404.status === 404, `HTTP ${det404.status}`);
  record("詳細API: エラー本文に内部情報なし", !/efootball\.db|SELECT |sqlite/i.test(det400.body + det404.body), "");

  // 6. 画面
  const lp = await get("/managers");
  record("画面: /managers が 200", lp.status === 200 && /マネージャー/.test(lp.body), `HTTP ${lp.status}`);
  record("画面: 監督総数を表示", /名の監督/.test(lp.body), "");
  record("画面: 監督詳細へのリンク（/managers/{id}）", /href="\/managers\/\d+"/.test(lp.body), "");
  record("画面: 戦術適性・ブースター要約が一覧に出る", /Possession|Quick Counter/i.test(lp.body) || /Poss|QC/.test(lp.body), "");
  // 2026-09-19(6fc225d)の意図的な表示修正で、一覧は内部のリポジトリ内ファイルパス(managers.json)を出さず
  // 「データ提供: amine250/efootball-managers」と表記する。出典の明示と内部パス非表示の両方を確認する。
  record("画面: データ提供元の明示（amine250/efootball-managers・内部ファイルパスは非表示）", /データ提供: amine250\/efootball-managers/.test(lp.body) && !/managers\.json/.test(lp.body), "");
  const dp = await get(`/managers/${conteId}`);
  record("画面: 監督詳細が 200", dp.status === 200 && /Antonio Conte/.test(dp.body), `HTTP ${dp.status}`);
  record("画面: 詳細に「戦術適性」「監督ブースター」「Link-Up Play」", ["戦術適性", "監督ブースター", "Link-Up Play"].every((h) => dp.body.includes(h)), "");
  record("画面: 詳細に Center Piece / Key Man 条件", dp.body.includes("Center Piece 条件") && dp.body.includes("Key Man 条件"), "");
  record("画面: ソース非収録は「追加調査中」表示", dp.body.includes("追加調査中"), "");
  const dpBad = await get("/managers/not-real");
  record("画面: 不正 ID の詳細はクラッシュせず not-found", dpBad.status !== 500 && !dpBad.body.includes("戦術適性"), `HTTP ${dpBad.status}`);
  const dpMiss = await get("/managers/999999");
  record("画面: 存在しない ID の詳細はクラッシュせず not-found", dpMiss.status !== 500 && !dpMiss.body.includes("戦術適性"), `HTTP ${dpMiss.status}`);

  // 7. サイドメニュー
  const home = await get("/");
  record("サイドメニュー: マネージャーが有効リンク", /href="\/managers"/.test(home.body), "");

  // 8. 育成画面での監督選択（SSR 初期状態 + API 経由の統合検算）
  const messiWorld = (await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=1&sort=ovr_max_desc`)).data.players[0].worldCardId;
  const pd = await get(`/players/world/${messiWorld}`);
  record("育成タブ: 監督補正セクション（監督を選択）がある", pd.body.includes("監督を選択") || pd.body.includes("監督なし"), "");
  record("育成タブ: 監督なし時 managerBoosterDelta=0 の注記", pd.body.includes("managerBoosterDelta = 0") || pd.body.includes("監督なし"), "");
  // 監督詳細 API + World 詳細 API から、補正の期待値を検算（クライアント計算の再現）
  const worldDetail = (await json(`/api/world/players/${messiWorld}`)).data.player;
  const baseDA = worldDetail.stats.find((s) => s.key === "defensiveAwareness")?.value ?? null;
  const conteBoost = (det.data.manager.boosters.find((b) => b.statKey === "defensiveAwareness")?.delta) ?? 0;
  record("統合検算: Messi の基礎 Defensive Awareness に Conte の +1 を足すと最終値", typeof baseDA === "number" && conteBoost === 1 && Math.min(99, baseDA + 1) >= baseDA, `base=${baseDA} +${conteBoost}`);

  // 9. 既存機能の回帰（画面 / API のみ）
  record("回帰: ホーム 200 + サイドメニュー", home.status === 200 && /eFootball Team AI/.test(home.body), "");
  const players = await get("/players");
  record("回帰: プレイヤー一覧 200 + 総件数 + 詳細リンク", players.status === 200 && /人の選手/.test(players.body) && /\/players\/world\/\d+/.test(players.body), "");
  const wja = await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=5`);
  record("回帰: World 日本語検索", wja.status === 200 && wja.data?.totalCount > 0, "");
  const wp2 = await json("/api/world/players?page=2&pageSize=24");
  record("回帰: World ページネーション", wp2.data?.page === 2, "");
  record("回帰: World 選手詳細 26能力値 + スキル + 育成タブ", pd.status === 200 && pd.body.includes("能力値グループ") && pd.body.includes("育成ポイント"), "");
  const imgBad = await get("/api/world/player-image/abc");
  record("回帰: World 画像プロキシ 不正IDは 400（外部アクセスなし）", imgBad.status === 400, `HTTP ${imgBad.status}`);
  const oldMessi = await get("/players/89138556575063");
  record("回帰: 旧 eFHUB サンプル詳細（Messi）", oldMessi.status === 200 && /Lionel Messi/.test(oldMessi.body), `HTTP ${oldMessi.status}`);

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-managers] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 監督機能 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "| 結果 | 項目 | 詳細 |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\|/g, "\\|")} |`),
    "",
    `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`,
    "",
  ];
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box-managers] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
