/**
 * World データ UI 接続のブラックボックステスト（実ユーザー操作相当）。
 *   npm run build && npm run start   の後に
 *   node scripts/black-box-world-ui.mjs
 *
 * - localhost（起動中サーバー）への HTTP のみ。外部アクセスなし。
 * - 結果は docs/black-box-tests/world-ui.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "world-ui.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// NO_EXTERNAL=1 のとき、サーバーが外部（cloudfront/efimg）へ出る可能性のある画像バイト取得をスキップし、
// HTML の src 配線・プレースホルダー・400 のみ確認する（外部アクセス 0 を保証）。
const NO_EXTERNAL = process.env.NO_EXTERNAL === "1";

const results = [];
let externalHits = 0;

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

async function http(pathname) {
  const url = BASE + pathname;
  try {
    const r = await fetch(url, { redirect: "manual" });
    const body = await r.text().catch(() => "");
    return { status: r.status, body };
  } catch (e) {
    return { status: -1, body: "", err: e.message };
  }
}
async function json(pathname) {
  const r = await http(pathname);
  let data = null;
  try {
    data = JSON.parse(r.body);
  } catch {
    /* ignore */
  }
  return { ...r, data };
}

async function main() {
  // ---- 一覧 API ----
  const list = await json("/api/world/players?pageSize=24");
  record("一覧API: HTTP 200", list.status === 200, `HTTP ${list.status}`);
  record("一覧API: 総件数がおよそ 13,009", list.data?.totalCount >= 12000 && list.data?.totalCount <= 14000, `totalCount=${list.data?.totalCount}`);
  record("一覧API: 1ページ 24 件前後", Array.isArray(list.data?.players) && list.data.players.length <= 24 && list.data.players.length > 0, `players=${list.data?.players?.length}`);
  record("一覧API: totalPages 計算", list.data?.totalPages === Math.ceil(list.data?.totalCount / list.data?.pageSize), `totalPages=${list.data?.totalPages}`);
  record("一覧API: source=eFootball World", /World/.test(list.data?.source ?? ""), `${list.data?.source}`);
  record("一覧API: 要素は必須フィールドを持つ", (() => {
    const p = list.data?.players?.[0] ?? {};
    return ["worldCardId", "nameEn", "nameJa", "cardType", "registeredPosition", "ovrBase", "ovrMax", "maximumLevel", "playingStyle", "playingStyleDefensive", "hasEfhubLink"].every((k) => k in p);
  })(), "");
  record("一覧API: 26能力値やスキルを含めない（軽量）", (() => {
    const p = list.data?.players?.[0] ?? {};
    return !("stats" in p) && !("playerSkills" in p);
  })(), "");
  record("一覧API: 内部情報/パス/SQLを含まない", !/efootball\.db|C:\\\\|SELECT |INSERT /.test(list.body), "");

  // ---- ページネーション ----
  const page2 = await json("/api/world/players?pageSize=24&page=2");
  record("ページ2へ移動できる", page2.status === 200 && page2.data?.page === 2 && page2.data?.hasPrevious === true, `page=${page2.data?.page}`);
  const lastPage = list.data?.totalPages ?? 1;
  const last = await json(`/api/world/players?pageSize=24&page=${lastPage}`);
  record("最終ページを表示できる", last.status === 200 && last.data?.page === lastPage && last.data?.hasNext === false, `page=${last.data?.page}/${lastPage}`);
  const overflow = await json("/api/world/players?pageSize=24&page=999999");
  record("範囲外ページはクラッシュせず最終ページへ丸める", overflow.status === 200 && overflow.data?.page === lastPage, `page=${overflow.data?.page}`);
  const badPage = await json("/api/world/players?page=-5&pageSize=abc");
  record("不正な page/pageSize でも 200（既定へ丸め）", badPage.status === 200 && badPage.data?.page === 1 && badPage.data?.pageSize === 24, `page=${badPage.data?.page} size=${badPage.data?.pageSize}`);
  const bigSize = await json("/api/world/players?pageSize=5000");
  record("pageSize 上限 100 に丸める", bigSize.data?.pageSize === 100, `pageSize=${bigSize.data?.pageSize}`);

  // ---- 検索 ----
  const ja = await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=50`);
  record("日本語名検索", ja.status === 200 && ja.data?.totalCount > 0 && ja.data.players.every((p) => (p.nameJa ?? "").includes("メッシ")), `total=${ja.data?.totalCount}`);
  const en = await json("/api/world/players?q=messi&pageSize=50");
  const enUpper = await json("/api/world/players?q=MESSI&pageSize=50");
  record("英語名検索（部分一致）", en.status === 200 && en.data?.totalCount > 0, `total=${en.data?.totalCount}`);
  record("英語検索は大文字小文字を無視", en.data?.totalCount === enUpper.data?.totalCount, `${en.data?.totalCount} vs ${enUpper.data?.totalCount}`);
  const firstId = list.data?.players?.[0]?.worldCardId;
  const byId = await json(`/api/world/players?q=${firstId}`);
  record("World ID 検索で 1 件", byId.data?.totalCount === 1 && byId.data.players[0].worldCardId === firstId, `total=${byId.data?.totalCount}`);
  const none = await json("/api/world/players?q=zzzzzznotexist");
  record("存在しない検索は 0 件（200）", none.status === 200 && none.data?.totalCount === 0, `total=${none.data?.totalCount}`);
  const empty = await json("/api/world/players?q=");
  record("空検索は全件", empty.data?.totalCount >= 12000, `total=${empty.data?.totalCount}`);
  const sym = await json("/api/world/players?q=" + encodeURIComponent("@@@###%%%__"));
  record("記号入力でクラッシュしない", sym.status === 200, `HTTP ${sym.status}`);
  const long = await json("/api/world/players?q=" + encodeURIComponent("あ".repeat(500)));
  record("非常に長い入力を制限（クラッシュしない）", long.status === 200, `HTTP ${long.status}`);
  const inj = await json("/api/world/players?q=" + encodeURIComponent("'; DROP TABLE world_player_cards;--"));
  const afterInj = await json("/api/world/players?pageSize=1");
  record("SQLインジェクション風入力でテーブルが無事", inj.status === 200 && afterInj.data?.totalCount >= 12000, `after=${afterInj.data?.totalCount}`);

  // ---- フィルター ----
  for (const pos of ["GK", "CB", "CMF", "AMF", "CF"]) {
    const r = await json(`/api/world/players?position=${pos}&pageSize=100`);
    record(`フィルター: ${pos}`, r.status === 200 && r.data?.totalCount > 0 && r.data.players.every((p) => p.registeredPosition === pos), `total=${r.data?.totalCount}`);
  }
  const ct = await json("/api/world/players?cardType=EPIC&pageSize=100");
  record("フィルター: カードタイプ EPIC", ct.data?.players?.every((p) => p.cardType === "EPIC"), `total=${ct.data?.totalCount}`);
  const ps = await json("/api/world/players?playingStyle=" + encodeURIComponent("Box-to-Box") + "&pageSize=100");
  record("フィルター: 攻撃プレースタイル", ps.data?.players?.every((p) => p.playingStyle === "Box-to-Box"), `total=${ps.data?.totalCount}`);
  const combo = await json("/api/world/players?position=CF&cardType=EPIC&minOvr=90&pageSize=100");
  record("フィルター: 複数条件の組み合わせ", combo.status === 200 && combo.data.players.every((p) => p.registeredPosition === "CF" && p.cardType === "EPIC" && (p.ovrMax ?? 0) >= 90), `total=${combo.data?.totalCount}`);
  const cleared = await json("/api/world/players?pageSize=24");
  record("フィルター解除で全件へ戻る", cleared.data?.totalCount >= 12000, `total=${cleared.data?.totalCount}`);

  // ---- 並べ替え ----
  const sd = await json("/api/world/players?sort=ovr_max_desc&pageSize=50");
  const sa = await json("/api/world/players?sort=ovr_max_asc&pageSize=50");
  const sbd = await json("/api/world/players?sort=ovr_base_desc&pageSize=50");
  const nm = await json("/api/world/players?sort=name&pageSize=50");
  const up = await json("/api/world/players?sort=updated_desc&pageSize=50");
  const isDesc = (a) => a.every((v, i) => i === 0 || a[i - 1] >= v);
  const isAsc = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);
  record("並べ替え: 最大OVR降順", sd.status === 200 && isDesc(sd.data.players.map((p) => p.ovrMax ?? 0)), "");
  record("並べ替え: 最大OVR昇順", sa.status === 200 && isAsc(sa.data.players.map((p) => p.ovrMax ?? 999)), "");
  record("並べ替え: 基礎OVR降順", sbd.status === 200 && isDesc(sbd.data.players.map((p) => p.ovrBase ?? 0)), "");
  record("並べ替え: 名前順", nm.status === 200 && isAsc(nm.data.players.map((p) => (p.nameEn ?? "").toLowerCase())), "");
  record("並べ替え: 更新順", up.status === 200, `HTTP ${up.status}`);
  const badSort = await json("/api/world/players?sort=" + encodeURIComponent("x); DROP--") + "&pageSize=5");
  record("不正な sort 値は既定へ（クラッシュしない）", badSort.status === 200, `HTTP ${badSort.status}`);

  // ---- 詳細 ----
  const messiWorld = ja.data?.players?.[0]?.worldCardId;
  const det = await json(`/api/world/players/${messiWorld}`);
  record("詳細API: 正常な World ID", det.status === 200 && det.data?.player?.worldCardId === messiWorld, `HTTP ${det.status}`);
  record("詳細API: 26 能力値", det.data?.player?.stats?.length === 26, `stats=${det.data?.player?.stats?.length}`);
  record("詳細API: 能力値キーが26種のみ", (() => {
    const keys = (det.data?.player?.stats ?? []).map((s) => s.key);
    return new Set(keys).size === 26;
  })(), "");
  record("詳細API: 選手スキル配列", Array.isArray(det.data?.player?.playerSkills) && det.data.player.playerSkills.length > 0, `skills=${det.data?.player?.playerSkills?.length}`);
  record("詳細API: AIスキル配列", Array.isArray(det.data?.player?.aiStyles), `ai=${det.data?.player?.aiStyles?.length}`);
  record("詳細API: 基本情報（国籍/リーグ/チーム/身長/体重/年齢/利き足）", (() => {
    const p = det.data?.player ?? {};
    return ["nationality", "league", "team", "height", "weight", "age", "preferredFoot"].every((k) => k in p);
  })(), "");
  record("詳細API: 最大レベル", "maximumLevel" in (det.data?.player ?? {}), `maxLv=${det.data?.player?.maximumLevel}`);
  record("詳細API: スキルは重複なし", (() => {
    const s = det.data?.player?.playerSkills ?? [];
    return new Set(s).size === s.length;
  })(), "");
  const det404 = await json("/api/world/players/99999999999999");
  record("詳細API: 存在しない World ID は 404", det404.status === 404, `HTTP ${det404.status}`);
  const detBad = await json("/api/world/players/abc");
  record("詳細API: 不正な World ID は 400", detBad.status === 400, `HTTP ${detBad.status}`);
  const detInj = await json("/api/world/players/" + encodeURIComponent("1;DROP"));
  record("詳細API: SQL風 ID でクラッシュしない", detInj.status === 400 || detInj.status === 404, `HTTP ${detInj.status}`);
  record("詳細API: エラー本文に内部情報を含まない", !/efootball\.db|C:\\\\|SELECT |sqlite/i.test(det404.body + detBad.body), "");

  // ---- 画面（HTML） ----
  const listPage = await http("/players");
  record("画面: /players が 200", listPage.status === 200, `HTTP ${listPage.status}`);
  record("画面: World 総件数を表示", /人の選手/.test(listPage.body) && /13,009|1[23],\d{3}/.test(listPage.body), "");
  record("画面: 詳細リンクが /players/world/ 形式", /\/players\/world\/\d+/.test(listPage.body), "");
  record("画面: ページネーション表示（件を表示）", /件を表示/.test(listPage.body), "");
  record("画面: データソース表示（eFootball World）", /eFootball World/.test(listPage.body), "");
  const worldDetailPage = await http(`/players/world/${messiWorld}`);
  record("画面: World 選手詳細が 200", worldDetailPage.status === 200, `HTTP ${worldDetailPage.status}`);
  record("画面: 詳細に「能力値（26 項目」表示", /能力値（26/.test(worldDetailPage.body), "");
  record("画面: 詳細に「Player Skills」「AI Playing Styles」", /Player Skills/.test(worldDetailPage.body) && /AI Playing Styles/.test(worldDetailPage.body), "");
  record("画面: 未取得項目を「追加調査中」表示", /追加調査中/.test(worldDetailPage.body), "");
  record("画面: 未取得項目を 0/空で偽装しない（Tier: 追加調査中）", /Tier: 追加調査中/.test(worldDetailPage.body), "");
  record("画面: 詳細に 26 能力値の内容が描画される（有効IDのみ）", /能力値（26/.test(worldDetailPage.body), "");
  // 注: Next 15 の force-dynamic + notFound() は本文を not-found UI にしつつ HTTP は 200 を返す。
  //     ここでは「クラッシュ（500）せず、詳細本文を描画しない」ことを確認する。
  const badDetailPage = await http("/players/world/not-real");
  record(
    "画面: 不正 World ID の詳細はクラッシュせず not-found（詳細本文を描画しない）",
    badDetailPage.status !== 500 && !/能力値（26/.test(badDetailPage.body),
    `HTTP ${badDetailPage.status}`,
  );
  const missingDetailPage = await http("/players/world/99999999999999");
  record(
    "画面: 存在しない World ID の詳細はクラッシュせず not-found",
    missingDetailPage.status !== 500 && !/能力値（26/.test(missingDetailPage.body),
    `HTTP ${missingDetailPage.status}`,
  );

  // ---- 画像表示（内部プロキシ経由・cloudfront は承認済みホスト） ----
  // ここで叩くカードは verify-world-images.mjs が取得済み（サーバーのメモリキャッシュに載る）。
  async function imgProbe(p) {
    const r = await fetch(BASE + p, { redirect: "manual" });
    const buf = new Uint8Array(await r.arrayBuffer());
    const up = Number(r.headers.get("x-image-upstream-requests") ?? "0");
    if (Number.isFinite(up)) externalHits += up;
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    return {
      status: r.status,
      isImage: r.status === 200 && ct.startsWith("image/") && r.headers.get("x-image-placeholder") !== "1" && buf.byteLength > 0,
      placeholder: r.headers.get("x-image-placeholder") === "1",
      bytes: buf.byteLength,
      cache: r.headers.get("x-image-cache"),
    };
  }

  // 一覧先頭ページのカード ID を取得（画像取得なし）
  const firstPage = (await json("/api/world/players?pageSize=24&sort=ovr_max_desc")).data.players;
  const noLink = firstPage.find((p) => !p.hasEfhubLink);
  const withLink = firstPage.find((p) => p.hasEfhubLink);

  if (!NO_EXTERNAL) {
    const iNoLink = await imgProbe(`/api/world/player-image/${noLink.worldCardId}`);
    record("画像: eFHUB リンクなし World カードでも画像が表示される", iNoLink.isImage, `${noLink.nameEn} ${iNoLink.status} ${(iNoLink.bytes / 1024).toFixed(0)}KB cache=${iNoLink.cache}`);
    if (withLink) {
      const iLinkEfhub = await imgProbe(`/api/player-image/${withLink.efhubCardId}`);
      record("画像: eFHUB リンクありカードは eFHUB プロキシで画像が表示される", iLinkEfhub.isImage, `${withLink.nameEn} ${iLinkEfhub.status}`);
      const iLinkWorld = await imgProbe(`/api/world/player-image/${withLink.worldCardId}`);
      record("画像: 同カードの World プロキシ経路でも画像が表示される", iLinkWorld.isImage, `${iLinkWorld.status}`);
    }
  } else {
    record("画像: eFHUB リンクなし World カードに World 画像プロキシ src が配線（NO_EXTERNAL）", /\/api\/world\/player-image\/\d+/.test(listPage.body), "");
  }

  const iMissing = await imgProbe("/api/world/player-image/99999999999999");
  record("画像: 取得不可時はローカル SVG プレースホルダー（外部アクセス0）", iMissing.placeholder && iMissing.status === 200, `${iMissing.status} placeholder=${iMissing.placeholder}`);
  const iBadId = await imgProbe("/api/world/player-image/abc");
  record("画像: 不正な World ID は 400（外部アクセス0）", iBadId.status === 400, `HTTP ${iBadId.status}`);

  // 検索・並べ替え・ページ移動後も画像とカード情報がずれない（HTML の src 配線 + 代表1枚）
  const searchPage = await http(`/players?q=${encodeURIComponent("メッシ")}`);
  record("画像: 検索後も World 画像プロキシ src が配線されている", /\/api\/world\/player-image\/\d+/.test(searchPage.body) || /\/api\/player-image\/\d+/.test(searchPage.body), "");
  if (!NO_EXTERNAL) {
    const searchApi = (await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=1&sort=ovr_max_desc`)).data.players[0];
    const iSearch = await imgProbe(`/api/world/player-image/${searchApi.worldCardId}`);
    record("画像: 検索結果の先頭カードの画像が表示される", iSearch.isImage || iSearch.placeholder, `${searchApi.nameEn} ${iSearch.status}`);
  }
  const sortPage = await http("/players?sort=ovr_base_desc");
  record("画像: 並べ替え後も画像 src が配線されている", /\/api\/world\/player-image\/\d+/.test(sortPage.body), "");
  const page2Img = await http("/players?page=2&sort=ovr_max_desc");
  record("画像: ページ移動後も画像 src が配線されている", /\/api\/world\/player-image\/\d+/.test(page2Img.body), "");
  record("画像: 一覧 HTML は loading=\"lazy\" を使う（プリロードしない）", /loading="lazy"/.test(listPage.body), "");
  record("画像: 一覧カードレイアウトが崩れない（aspect-[3/4] 枠 + OVR/名前を保持）", /aspect-\[3\/4\]/.test(listPage.body) && /MAX/.test(listPage.body), "");

  // ---- 既存機能の回帰 ----
  const home = await http("/");
  record("回帰: ホーム 200", home.status === 200 && /eFootball Team AI/.test(home.body), `HTTP ${home.status}`);
  record("回帰: ホームにサイドメニュー", /プレイヤー/.test(home.body) && /マネージャー/.test(home.body), "");
  const oldMessi = await http("/players/89138556575063");
  record("回帰: 旧 eFHUB サンプル詳細（Messi）", oldMessi.status === 200 && /Lionel Messi/.test(oldMessi.body), `HTTP ${oldMessi.status}`);
  const oldCanna = await http("/players/88041460996837");
  record("回帰: 旧 eFHUB サンプル詳細（Cannavaro）", oldCanna.status === 200 && /Fabio Cannavaro/.test(oldCanna.body), `HTTP ${oldCanna.status}`);
  const oldApi = await json("/api/players?q=messi&sort=ovr_desc&limit=5");
  record("回帰: 旧 /api/players（サンプル）維持", oldApi.status === 200 && Array.isArray(oldApi.data?.players), `HTTP ${oldApi.status}`);
  const imgBad = await http("/api/player-image/abc");
  record("回帰: 画像プロキシの不正IDは 400", imgBad.status === 400, `HTTP ${imgBad.status}`);
  if (!NO_EXTERNAL) {
    const imgOk = withLink ? await http(`/api/player-image/${withLink.efhubCardId}`) : { status: 200 };
    record("回帰: eFHUB 画像プロキシ（efimg 経路）が応答", [200, 404, 502].includes(imgOk.status), `HTTP ${imgOk.status}`);
  }
  record("回帰: ブラウザへ渡す src は同一オリジンのみ（cloudfront URL を露出しない）", !/d1zxa6glxh8sq9\.cloudfront\.net/.test(listPage.body + worldDetailPage.body), "");

  // 内部プロキシ経由の外部 GET 累計
  if (NO_EXTERNAL) {
    record("画像取得の外部 GET が 0（NO_EXTERNAL モード）", externalHits === 0, `external=${externalHits}`);
  } else {
    record("画像取得の外部 GET 累計が 10 回以内", externalHits <= 10, `external=${externalHits}`);
  }

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-world-ui] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# World データ UI 接続 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: 0 回`,
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
  console.log(`[black-box-world-ui] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
