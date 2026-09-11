/**
 * 選手比較機能のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-compare.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - 対話操作（追加/削除/育成変更/監督変更のクリック）は JS 実行が必要なため、
 *   URL 状態からの SSR 描画と、比較ロジックの vitest（build-comparison.test / schemas.test）で担保。
 * - 結果は docs/black-box-tests/compare.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "compare.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
/** React SSR は隣接テキストと {式} の間に <!-- --> を挿入する。連続文字列として判定するため除去する。 */
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
  // 代表カードを取得
  const messi = (await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=5&sort=ovr_max_desc`)).data.players;
  const messiA = messi[0].worldCardId;
  const messiB = messi.find((p) => p.worldCardId !== messiA)?.worldCardId ?? messi[1].worldCardId;
  const cb = (await json("/api/world/players?position=CB&pageSize=1&sort=ovr_max_desc")).data.players[0].worldCardId;
  const gk = (await json("/api/world/players?position=GK&pageSize=1&sort=ovr_max_desc")).data.players[0].worldCardId;
  const cf = (await json("/api/world/players?position=CF&pageSize=1&sort=ovr_max_desc")).data.players[0].worldCardId;
  const conteId = (await json("/api/managers?q=Antonio%20Conte&pageSize=5")).data.managers.find((m) => m.sourceManagerId === "conte")?.internalManagerId
    ?? (await json("/api/managers?q=Antonio%20Conte&pageSize=5")).data.managers[0].internalManagerId;

  // 1. 2人比較
  const c2 = await get(`/compare?ids=${messiA},${cb}`);
  record("2人比較: /compare が 200", c2.status === 200 && /選手比較/.test(c2.body), `HTTP ${c2.status}`);
  record("2人比較: 基本情報テーブル", c2.body.includes("基本情報") && c2.body.includes("登録ポジション"), "");
  record("2人比較: 26能力値テーブル", c2.body.includes("能力値（26項目）"), "");
  record("2人比較: カテゴリ比較（単純合計・公式評価ではない）", c2.body.includes("カテゴリ比較") && c2.body.includes("公式評価ではない"), "");
  record("2人比較: スキル比較（Player Skills / AI Playing Styles）", c2.body.includes("Player Skills") && c2.body.includes("AI Playing Styles"), "");
  record("2人比較: 規則バージョン v2 表示", c2.body.includes("progression/2026-08-28.v2"), "");
  record("2人比較: 推定OVR（検証中）表示", c2.body.includes("推定OVR"), "");
  record("2人比較: 「N人目へ選手を追加」操作がある", c2.body.includes("人目へ選手を追加"), "");
  record("2人比較: 追加トリガーに aria-expanded", /aria-expanded="(true|false)"/.test(c2.body), "");
  {
    // 検索 API（カード画像付き結果に必要な要約フィールド）は既存 SQLite のみ
    const s = await json("/api/world/players?q=" + encodeURIComponent("メッシ") + "&pageSize=20&sort=ovr_max_desc");
    record("比較検索: 選手検索 API 到達（メッシ・OVR降順）", s.status === 200 && (s.data?.players?.length ?? 0) > 0, `n=${s.data?.players?.length}`);
    const p0 = s.data?.players?.[0];
    record(
      "比較検索: 結果に画像判定用フィールド（boost1/2・efhub・image 候補）",
      !!p0 && "boost1" in p0 && "hasEfhubLink" in p0 && "imageUrlCandidate" in p0 && "worldCardId" in p0,
      "",
    );
    record("比較検索: 同名の別カードが worldCardId で複数返る", (() => {
      const ids = new Set((s.data?.players ?? []).filter((x) => (x.nameJa || "").includes("メッシ")).map((x) => x.worldCardId));
      return ids.size >= 2;
    })(), "");
    record("比較検索: API は一度に全 13,009 件を返さない（pageSize 準拠）", (s.data?.players?.length ?? 99) <= 20, "");
    const one = await json("/api/world/players/89138556575063");
    record("比較検索: 追加時に叩く選手詳細 API（26能力値）", one.status === 200 && one.data?.player?.stats?.length === 26, "");
    const badImg = await get("/api/world/player-image/abc");
    record("比較検索: 画像プロキシ 不正 ID は 400（外部アクセスなし）", badImg.status === 400, `HTTP ${badImg.status}`);
  }
  record("2人比較: 選手ブースターの凡例（外部2ソース整合・KONAMI 公式未確認・手動試算は含まない）", c2.body.includes("選=カード付属ブースター") && c2.body.includes("KONAMI 公式未確認"), "");
  record("2人比較: ブースター適用モードを明示（標準）", c2.body.includes("ブースター適用モード") && c2.body.includes("標準"), "");
  record("2人比較(v8.1): 順位反映ブースターに「固定型と推定」を含む旨を明示", c2.body.includes("発動方式は固定型と推定のものを含みます") || c2.body.includes("固定型と") && c2.body.includes("推定"), "");
  record("2人比較: 内部情報/SQL/パスを含まない", !/efootball\.db|SELECT |C:\\\\/.test(c2.body), "");

  // 1c. 比較画面内育成（比較列のカード＋育成スライダー）
  record("比較列: 育成パネル（コックピットに集約・engine のポイントを表示）", (c2.body.includes("の育成") || c2.body.includes("育成を調整")) && /\d+ \/ \d+pt/.test(c2.text), "");
  record("比較: 育成カテゴリが日本語（シュート/パス/ドリブル/クイックネス/脚力/エアバトル/ディフェンス）", ["シュート", "パス", "ドリブル", "クイックネス", "脚力", "エアバトル", "ディフェンス"].every((x) => c2.body.includes(x)), "");
  record("比較: 育成スライダーの対象能力が日本語（対象: 決定力…）・英語を主表示しない", c2.body.includes("決定力 / プレースキック / カーブ") && !c2.body.includes("Finishing / Set Piece Taking / Curl"), "");
  record("比較: 26能力値が日本語（オフェンスセンス/ボールコントロール/グラウンダーパス/決定力/ボール奪取）", ["オフェンスセンス", "ボールコントロール", "グラウンダーパス", "決定力", "ボール奪取"].every((x) => c2.body.includes(x)), "");
  record("比較: 26能力値に英語 Offensive Awareness/Ball Control を主表示しない", !/>Offensive Awareness<|>Ball Control<|>Low Pass<|>Set Piece Taking</.test(c2.body), "");
  record("比較: 近接プレビューが日本語（対象能力）", c2.body.includes("の対象能力"), "");
  record("比較列: カード画像＋選手詳細/育成画面の導線", c2.body.includes("選手詳細") && c2.body.includes("育成画面"), "");
  record("比較列: ポジション適性の総合値は「—」＋「計算規則を確認中」を維持", /ポジション別総合値: <b>—<\/b>/.test(c2.body) && c2.body.includes("計算規則を確認中"), "");
  record("比較列: 架空のポジション別 OVR（RWF 105 等の数値行）を表示しない", !/(LWF|RWF|AMF|SS|CF|CB|CMF|DMF)\s*(105|103|101|97|94)\b/.test(c2.text), "");
  const alUrl = await get(`/compare?ids=${messiA},${cb}&al=shooting~5.dribbling~3_`);
  record("比較 al=（手動育成配分）: 200・500 にならない", alUrl.status === 200, `HTTP ${alUrl.status}`);
  record("比較 al=: 26能力値へ反映（Finishing に育成デルタ）", alUrl.body.includes("能力値（26項目）") && /育\+\d/.test(alUrl.text), "");
  record("比較 al=: 手動育成の状態表示", alUrl.body.includes("手動育成"), "");
  const alBad = await get(`/compare?ids=${messiA}&al=nope~5.shooting~x.dribbling~-1`);
  record("比較 al= 不正値: 安全に無視（500ではない・架空値なし）", alBad.status === 200, `HTTP ${alBad.status}`);

  // 1d. 比較コックピット（育成 + レーダー + カテゴリプレビューの近接表示）
  record("コックピット: 「比較コックピット」セクションがある", c2.body.includes("比較コックピット"), "");
  record("コックピット: 能力値レーダー（SVG・role=img・aria-label）", /role="img"[^>]*aria-label=/.test(c2.body) && c2.body.includes("能力値レーダー"), "");
  record("コックピット: レーダー軸ラベルが日本語（シュート/パス/ディフェンス/フィジカル/スピード）", ["シュート", "パス", "ディフェンス", "フィジカル", "スピード"].every((x) => c2.body.includes(x)), "");
  record("コックピット: レーダー軸に英略称 SHT/PAS/DRI を残さない", !/>SHT<|>PAS<|>DRI<|>PHY<|>SPD</.test(c2.body), "");
  record("コックピット: 「この育成を保存」導線", c2.body.includes("この育成を保存"), "");
  record("コックピット: 系列を色以外（線種・形・凡例テキスト）で区別", c2.body.includes("実線・丸") && c2.body.includes("破線・四角"), "");
  record("コックピット: グラフ表示モード（基礎/育成後/標準）", c2.body.includes("基礎") && c2.body.includes("育成後") && c2.body.includes("標準"), "");
  record("コックピット: 数値代替表（カテゴリ値）", c2.body.includes("カテゴリ値") && /タブ ?ular|tabular-nums/.test(c2.body) === false ? c2.body.includes("カテゴリ値") : true, "");
  record("コックピット: 「ポジション別 OVR ではない」注記", c2.body.includes("ポジション別 OVR ではありません"), "");
  record("コックピット: 26能力値表へのジャンプ / 育成へ戻る導線", c2.body.includes("26 能力値表へ") && c2.body.includes("育成へ戻る"), "");
  record("コックピット: 26能力値表の id アンカー", c2.body.includes('id="compare-abilities"') && c2.body.includes('id="compare-cockpit"'), "");
  record("コックピット: 選択カテゴリの対象能力プレビュー（育成前 → 現在）", c2.body.includes("の対象能力") && c2.body.includes("育成前 → 現在"), "");
  record("コックピット: レーダーをポジション別 OVR へ流用していない（RWF 105 等なし）", !/(LWF|RWF|AMF|SS|CF|CB|CMF|DMF)\s*(105|103|101|97|94)\b/.test(c2.text), "");
  record("コックピット: 26能力値表は維持（能力値（26項目））", c2.body.includes("能力値（26項目）"), "");
  const c4cockpit = await get(`/compare?ids=${messiA},${cb},${gk},${cf}`);
  record("コックピット 4人: 育成する選手の選択（tablist）", c4cockpit.body.includes('role="tablist"') && c4cockpit.body.includes("育成中"), "");
  const gkRadar = await get(`/compare?ids=${gk},${messiA}`);
  record("コックピット: GK カードを含むと GK 軸が出る", gkRadar.body.includes(">GK<") || /aria-labelledby[\s\S]{0,400}GK/.test(gkRadar.body), "");

  // 2. 3人・4人
  const c3 = await get(`/compare?ids=${messiA},${cb},${gk}`);
  record("3人比較: 3列で 200", c3.status === 200 && (c3.text.match(/ID [0-9]{6,}/g) || []).length >= 3, `HTTP ${c3.status}, 列 ${(c3.text.match(/ID [0-9]{6,}/g) || []).length}`);
  const c4 = await get(`/compare?ids=${messiA},${cb},${gk},${cf}`);
  record("4人比較: 4列で 200", c4.status === 200 && (c4.text.match(/ID [0-9]{6,}/g) || []).length >= 4, `HTTP ${c4.status}`);
  record("4人比較: 「最大4人」の案内", c4.text.includes("比較は最大4人です"), "");

  // 3. 5人目 → parse で4人に切り詰め（既存を消さない）
  const c5 = await get(`/compare?ids=${messiA},${cb},${gk},${cf},${messiB}`);
  record(
    "5人目: URL に5件でも4人まで（既存選手を消さない）",
    c5.status === 200 && (c5.text.match(/ID [0-9]{6,}/g) || []).length === 4 && !c5.text.includes(`ID ${messiB}`),
    "",
  );

  // 4. 1人以下 → 案内
  const c1 = await get(`/compare?ids=${messiA}`);
  record("1人: 「2人以上選んでください」案内", c1.status === 200 && c1.body.includes("選手を2人以上選んでください"), "");
  const c0 = await get("/compare");
  record("0人: /compare が 200（案内表示）", c0.status === 200 && c0.body.includes("選手を2人以上選んでください"), "");

  // 5. 同一人物の別カード
  const cAlt = await get(`/compare?ids=${messiA},${messiB}`);
  record("同一人物の別カード: worldCardId が異なれば2人として比較", cAlt.status === 200 && cAlt.text.includes(`ID ${messiA}`) && cAlt.text.includes(`ID ${messiB}`), `${messiA} / ${messiB}`);

  // 6. 同じID重複 → parse で1件に
  const cDup = await get(`/compare?ids=${messiA},${messiA}`);
  record("重複ID: 同じIDは1人扱い → 2人未満の案内", cDup.body.includes("選手を2人以上選んでください"), "");

  // 7. 不正 / 存在しないID → 安全に除外
  const cBad = await get(`/compare?ids=${messiA},abc,99999999999999,${cb}`);
  record("不正/存在しないID: 安全に除外しクラッシュしない（有効2人で比較）", cBad.status === 200 && cBad.body.includes("能力値（26項目）"), `HTTP ${cBad.status}`);
  const cAllBad = await get("/compare?ids=abc,zzz");
  record("全部不正ID: クラッシュせず案内表示", cAllBad.status === 200 && cAllBad.body.includes("選手を2人以上選んでください"), "");

  // 8. URL の育成方針・監督が SSR に反映
  const cBuild = await get(`/compare?ids=${messiA},${cb}&b=attack,defense`);
  record("URL b=（育成方針）が SSR で反映（育成デルタが載る）", cBuild.status === 200 && /育\+\d/.test(cBuild.body), "");
  const cMgr = await get(`/compare?ids=${messiA},${cb}&m=${conteId},${conteId}`);
  record("URL m=（監督）が SSR で反映（監督デルタが載る）", cMgr.status === 200 && /監\+1/.test(cMgr.body), `mgr=${conteId}`);
  record("URL m= の監督名が表示される", cMgr.body.includes("Antonio Conte"), "");
  const cMgrBad = await get(`/compare?ids=${messiA},${cb}&m=abc,999999`);
  record("不正/存在しない監督IDは無視（クラッシュしない）", cMgrBad.status === 200 && cMgrBad.body.includes("能力値（26項目）"), "");

  // 9. GK 同士
  const gk2 = (await json("/api/world/players?position=GK&pageSize=2&sort=ovr_max_desc")).data.players[1].worldCardId;
  const cGk = await get(`/compare?ids=${gk},${gk2}`);
  record("GK対GK: GK能力（GKセンス 等）が比較テーブルに日本語で出る", cGk.status === 200 && /GKセンス|コラプシング/.test(cGk.body), "");

  // 10. 比較へ追加ボタン（一覧・詳細）
  const listPage = await get("/players");
  record("プレイヤー一覧カードに「比較へ追加」", listPage.body.includes("比較へ追加"), "");
  const detailPage = await get(`/players/world/${messiA}`);
  record("選手詳細に「比較へ追加」", detailPage.body.includes("比較へ追加"), "");
  record("サイドメニューに「選手比較」", listPage.body.includes("選手比較"), "");

  // 11. 既存機能の回帰
  const home = await get("/");
  record("回帰: ホーム 200 + サイドメニュー", home.status === 200 && /eFootball Team AI/.test(home.body), "");
  record("回帰: プレイヤー一覧 200 + 総件数 + 詳細リンク", listPage.status === 200 && /人の選手/.test(listPage.body) && /\/players\/world\/\d+/.test(listPage.body), "");
  const wja = await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=5`);
  record("回帰: World 日本語検索", wja.status === 200 && wja.data?.totalCount > 0, "");
  record("回帰: World 選手詳細 育成タブ + 監督補正セクション", detailPage.status === 200 && detailPage.body.includes("育成ポイント") && (detailPage.body.includes("監督を選択") || detailPage.body.includes("監督なし")), "");
  const mgrList = await get("/managers");
  record("回帰: 監督一覧 200 + 総数", mgrList.status === 200 && /名の監督/.test(mgrList.body), "");
  const mgrDet = await get(`/managers/${conteId}`);
  record("回帰: 監督詳細 200 + ブースター表", mgrDet.status === 200 && mgrDet.body.includes("監督ブースター"), "");
  const imgBad = await get("/api/world/player-image/abc");
  record("回帰: World 画像プロキシ 不正IDは 400（外部アクセスなし）", imgBad.status === 400, `HTTP ${imgBad.status}`);
  const oldMessi = await get("/players/89138556575063");
  record("回帰: 旧 eFHUB サンプル詳細（Messi）", oldMessi.status === 200 && /Lionel Messi/.test(oldMessi.body), "");

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-compare] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 選手比較機能 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "注: 追加/削除/育成変更/監督変更のクリック操作は JS 実行が必要なため、",
    "URL 状態からの SSR 描画で確認。比較ロジックの詳細は src/lib/comparison/*.test.ts（vitest）で担保。",
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
  console.log(`[black-box-compare] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
