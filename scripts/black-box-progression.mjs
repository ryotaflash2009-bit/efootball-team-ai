/**
 * 選手育成機能のブラックボックステスト（HTML 構造 + エンジン整合）。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-progression.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**（画像バイト取得はしない）。
 * - 育成の対話操作（クリック）は JS 実行が必要なため、ここでは
 *   「育成タブが SSR で正しく描画される」「エンジン規則メタが表示される」を確認する。
 *   対話フローは src/lib/progression/flow.test.ts（vitest）で検証済み。
 * - 結果は docs/black-box-tests/progression.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLegacySampleDetail } from "./lib/legacy-sample-detail.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "progression.md");
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
  // 代表カード（育成規則調査で選定）
  const CARDS = {
    messi: "89138556575063", // BIGTIME SS lv32
    cannavaro: "88041460996837", // EPIC CB lv27
    gk: "106788187832737", // Neuer GK lv28
    messiAlt: "89136409091415", // Messi 別カード lv34
    booster2: "88045755964133", // ブースター2つ
    level1: "52902186095121", // 最大レベル1
  };

  // 1. プレイヤー一覧 → World カード → 詳細
  const list = await json("/api/world/players?pageSize=1");
  record("一覧APIが応答（外部アクセスなし）", list.status === 200 && list.data?.totalCount > 12000, `total=${list.data?.totalCount}`);

  const messi = await get(`/players/world/${CARDS.messi}`);
  record("World 選手詳細が 200", messi.status === 200, `HTTP ${messi.status}`);

  // 2. タブ構成
  for (const tab of ["概要", "能力値", "スキル", "育成", "データ情報"]) {
    record(`詳細にタブ「${tab}」がある`, messi.body.includes(tab), "");
  }
  record("タブ role=tablist / role=tab がある", /role="tablist"/.test(messi.body) && /role="tab"/.test(messi.body), "");

  // 3. 育成タブ（全パネルを SSR で描画・非アクティブは hidden）
  const b = messi.body;
  record("育成: 「育成ポイント」表示", b.includes("育成ポイント"), "");
  record("育成: ポイント総数の式を明示（(最大レベル − 1) × 2）", b.includes("(最大レベル − 1) × 2"), "");
  record("育成: ポイント総数は「確認済」表記", b.includes("(最大レベル − 1) × 2（確認済）"), "");
  record("育成: 計算モード「確定（基礎値のみ）」を初期表示", b.includes("確定（基礎値のみ）"), "");
  record("育成: 現行規則バージョン v2 表示（日付は作成日 08-28）", b.includes("progression/2026-08-28.v2"), "");
  record("育成: 未来日付 08-29 のバージョン名を使わない", !b.includes("progression/2026-08-29"), "");
  record("育成: 能力値上限のレイヤー表示（基礎=確認済 / 最終=未確認）", b.includes("能力値上限:") && b.includes("暫定クランプ"), "");
  record("育成: 最終能力値の99上限は暫定と明記", b.includes("最終能力値の上限（暫定で99にクランプ）"), "");
  record("育成: 段階コストは「外挿・confirmed ではない」と明記", b.includes("外挿・confirmed ではない"), "");
  record("育成: 「検証中」の明示がある", b.includes("検証中"), "");
  record("育成: 能力値グループ10種を日本語表示", ["シュート", "パス", "ドリブル", "クイックネス", "脚力", "エアバトル", "ディフェンス", "GK1", "GK2", "GK3"].every((g) => b.includes(g)), "");
  record("育成: グループレベルの +/- ボタン（aria-label）", /aria-label="[^"]*のレベルを上げる"/.test(b) && /aria-label="[^"]*のレベルを下げる"/.test(b), "");
  record("育成: 次の1段階のコスト表示（次の+1: Npt）", /次の\+1: \d+pt/.test(b), "");
  record("育成: Shooting は「確認済」、他グループは「検証中」表記", b.includes("確認済") && b.includes("対象能力は検証中"), "");
  record("育成: 自動育成（攻撃/守備/バランス/GK重視）", ["攻撃重視", "守備重視", "バランス重視", "GK重視"].every((x) => b.includes(x)), "");
  record("育成: 「最大OVR保証」を主張しない", !b.includes("最大OVR保証") && !b.includes("最大OVRを保証") && !b.includes("最大OVR を保証"), "");
  record("育成: 「育成リセット」ボタン", b.includes("育成リセット"), "");
  record("育成: 能力値比較テーブル（基礎/育成/選手B/監督/最終）", ["基礎", "育成", "選手B", "監督", "最終"].every((h) => b.includes(h)), "");
  record("育成: 推定OVR を表示", b.includes("推定OVR"), "");
  record(
    "表記: 26能力値名を日本語・カタカナで主表示（stat-labels.ts）",
    ["オフェンスセンス", "ボールコントロール", "グラウンダーパス", "フライパス", "決定力", "プレースキック", "ボール奪取", "守備意識", "瞬発力", "フィジカルコンタクト", "ボディコントロール"].every((x) => b.includes(x)),
    "",
  );
  record(
    "表記: 英語能力値名を主表示に残さない（title 併記は可）",
    !/>Offensive Awareness<|>Ball Control<|>Low Pass<|>Lofted Pass<|>Set Piece Taking<|>Physical Contact<|>Defensive Engagement</.test(b),
    "",
  );
  // Messi(89138556575063) の付属 = Accuracy +4 / Ball Protection +3（external_cross_verified → 標準モードで適用）
  record("育成: 付属ブースターの名称を解決して表示（Accuracy / Ball Protection）", b.includes("Accuracy") && b.includes("Ball Protection"), "");
  record("育成: 外部照合済みの付属は「外部照合済み（KONAMI 公式未確認）」バッジ", b.includes("外部照合済み（KONAMI 公式未確認）"), "");
  record("育成: eFootball World は外部コミュニティDBと明記（公式サイトと呼ばない）", b.includes("外部コミュニティDB") && !b.includes("eFootball 公式サイト") && !b.includes("ゲーム公式サイト"), "");
  record("育成: ブースター適用モード（厳密/標準/実験）を表示", b.includes("厳密モード") && b.includes("標準モード（既定）") && b.includes("実験モード"), "");
  record("育成: 標準モードは KONAMI 公式の計算結果ではない旨", b.includes("KONAMI 公式の計算結果として確認された値ではありません"), "");
  record("育成: カード付属（B1）と追加ブースター（B2）をUIで分離（見出し・2026-09-05 B2標準統合で名称変更）", b.includes("カード付属ブースター（カードに収録・自動）") && b.includes("追加ブースター（B2・手動選択）"), "");
  record("育成: 確認済みB2の追加ブースター欄は実験モード不要でSSRに出る（2026-09-05 B2標準統合）", b.includes("の追加ブースター（B2）を指定"), "");
  record("育成: 実験モードの切替に警告がある", b.includes("ゲーム内の正式値ではありません"), "");
  record("育成: 監督補正セクション（監督を選択 / 監督なし）", b.includes("監督を選択") || b.includes("監督なし"), "");
  record("育成: 監督なし時 managerBoosterDelta=0 を明示", b.includes("managerBoosterDelta = 0"), "");
  record("育成: 能力値比較の「監督」列は選択した監督の効果と説明", b.includes("選択した監督のブースター効果"), "");
  record("育成: ビルド保存 UI", b.includes("ビルド保存") && b.includes("ビルド名"), "");
  record("育成: 確認済み規則リストに「レベルアップあたりの育成ポイント」", b.includes("レベルアップあたりの育成ポイント"), "");
  record("育成: 未確認規則リストがある", b.includes("公式のOVR計算式") || b.includes("追加調査中"), "");
  record("育成: 未確認値を偽装しない（±0 + 注記）", b.includes("±0") && b.includes("架空の上昇量は生成しません"), "");

  // 4. 固定選手情報（ヘッダー）
  record("ヘッダー: 選手名・最大OVRラベル・ポジション", b.includes("Lionel Messi") && b.includes("最大 OVR") && b.includes("SS"), "");
  record("ヘッダー: 最大レベル表記（Lv上限）", b.includes("Lv上限"), "");
  record("ヘッダー: World カード ID 表示", b.includes(CARDS.messi), "");

  // 5. 他の代表カード（クラッシュしない・タブがある）
  for (const [label, id] of Object.entries(CARDS)) {
    if (id === CARDS.messi) continue;
    const r = await get(`/players/world/${id}`);
    record(`代表カード ${label} (${id}) の育成タブが 200 でクラッシュしない`, r.status === 200 && r.body.includes("育成ポイント") && r.body.includes("能力値グループ"), `HTTP ${r.status}`);
  }
  // 最大レベル1 / TRENDING カードは育成不可
  const lv1 = await get(`/players/world/${CARDS.level1}`);
  record("最大レベル1/TRENDINGカード: 育成不可の明示", /育成できません|育成ポイントがありません/.test(lv1.body), "");
  record("最大レベル1/TRENDINGカード: 能力値は基礎値のまま表示（クラッシュしない）", lv1.status === 200 && lv1.body.includes("能力値グループ"), "");
  // GK カードは GK 系グループを表示（全カード同一グループ構成）
  const gk = await get(`/players/world/${CARDS.gk}`);
  record("GK カード: Goalkeeping グループを表示（GK1）", gk.body.includes("GK1"), "");

  // 5b. 選手分析レール + 3カラム整理（表示専用・既存計算に影響しない）
  record("分析: 「選手分析（選手固有）」セクションがある", b.includes("選手分析（選手固有）"), "");
  record("分析: 3カラム化（1400px 相当の arbitrary media + 右カラム span）", b.includes("[@media(min-width:1400px)]:grid-cols-[") && b.includes("[@media(min-width:1400px)]:col-span-1"), "");
  record("分析: 2xl でより広い 3カラム", b.includes("2xl:grid-cols-["), "");
  record("分析: ポジション適性グリッド + 登録/適性の文字表記", b.includes("ポジション適性") && b.includes("登録:"), "");
  record("分析: ポジション別OVR（数値）は捏造せず「計算規則を確認中」+「—」", b.includes("計算規則を確認") && b.includes("総合値（ポジション別 OVR）:"), "");
  record("分析: ポジション別OVR未実装の理由（KONAMI 未公開・サンプル1件・推測しない）を明記", b.includes("推測で算式を作りません") && b.includes("KONAMI は算式・重みを公開しておらず"), "");
  record("分析: 適性度の生値テーブル（登録 / 副ポジション / 適性度 (生値)）を詳細に表示", b.includes("適性度 (生値)") && b.includes("情報源 —"), "");
  record("分析: ポジション別OVRの架空数値が本文に無い（OVR欄はダッシュのみ）", !/OVR\)?:\s*<b>\s*\d{2,3}/.test(b), "");
  record("分析: Messi は eFHUB 詳細ありスコープ", b.includes("World + eFHUB 詳細"), "");
  record("分析: プレーヤーモデル（腕の長さ / 脚の長さ / 肩幅）", b.includes("プレーヤーモデル") && b.includes("腕の長さ") && b.includes("脚の長さ") && b.includes("肩幅"), "");
  record("分析: モデル値に cm を付けない旨・0 と未収録を区別", b.includes("cm として確認された値ではありません") && b.includes("0 も実値です"), "");
  record("分析: 物理データ 5項目", ["脚カバー半径", "腕カバー半径", "ジャンプ高", "胴体衝突", "脚の長さ基準の身長"].every((x) => b.includes(x)), "");
  record("分析: 物理順位は全カード実データ・「値の大きい順」明示", b.includes("13,009") && b.includes("値の大きい順") && b.includes("大きさ順位"), "");
  record("分析: パーセンタイルは「100 に近いほど大」で誤解を避ける", b.includes("100 に近いほど大") && !b.includes("上位 98%") && !b.includes("上位98%"), "");
  record("分析: その他特性は内部値と表示名を分離（内部特性値・意味は追加検証中）", b.includes("内部特性値") && b.includes("段階の意味は追加検証中") && b.includes("逆足頻度"), "");
  record("分析: レールは育成計算に影響しない旨", b.includes("育成計算・ブースター計算・監督補正には影響しません"), "");

  // スキル / AI・COM プレースタイルは中央カラムへ移動（右レールと二重表示しない）
  record("中央: 「スキル / AI・COM プレースタイル」セクション（能力値の下）", b.includes("スキル / AI・COM プレースタイル"), "");
  record("中央: 選手スキル + AI・COM プレースタイルのバッジ", b.includes("選手スキル（") && b.includes("AI・COM プレースタイル（"), "");
  record("中央: Highlight Skill は推測分類しない旨", b.includes("すべて「選手スキル」として表示"), "");
  // 「AI・COM プレースタイル（」の見出しは中央に 1 回だけ（右レールに二重表示しない）
  record("重複なし: AI・COM プレースタイル見出しは 1 箇所", (b.match(/AI・COM プレースタイル（/g) || []).length === 1, "");

  // GK 育成の折りたたみ（非GK は初期折りたたみ / GK カードは初期展開）
  record("GK折りたたみ: 非GK(Messi) は「GK育成 3 項目」を表示", b.includes("GK育成 3 項目"), "");
  record("GK折りたたみ: 非GK は初期折りたたみ（details に open が付かない）", /<details(?![^>]*\bopen\b)[^>]*>\s*<summary[^>]*>\s*<span>GK育成 3 項目/.test(b) || b.includes("非GK・初期折りたたみ"), "");
  record("GK折りたたみ: GK育成の対象能力を日本語で明記", b.includes("GKセンス / キャッチング / クリアリング / コラプシング / ディフレクティング"), "");
  record("GK折りたたみ: GK カードでは初期展開（open 付き）", /<details open[^>]*>\s*<summary[^>]*>\s*<span>GK育成 3 項目/.test(gk.body), "");

  // eFHUB 詳細が無いカード = 適性未確認・架空値なし
  const noEfhub = await get("/players/world/106779597991855"); // Osimhen（19件の eFHUB 詳細に無い）
  record("分析: eFHUB 詳細なしカードは「適性未確認」バッジ + 「登録ポジションのみ確認済み」", noEfhub.body.includes("適性未確認") && noEfhub.body.includes("登録ポジションのみ確認済み"), "");
  record("分析: eFHUB 詳細なしカードのスコープは「World データ」", noEfhub.body.includes("World データ") && !noEfhub.body.includes("World + eFHUB 詳細"), "");
  record("分析: 数値の 0 埋めや架空ポジション OVR が本文に出ない", !/ポジション別 OVR[^。]*<b>\s*\d{2,3}\s*<\/b>/.test(b), "");
  record("分析: GK カードでも選手分析レールを描画", gk.body.includes("選手分析（選手固有）") && gk.body.includes("ポジション適性"), "");

  // 6. 不正・存在しない ID
  const bad = await get("/players/world/not-real");
  record("不正 World ID: クラッシュせず not-found（育成本文を描画しない）", bad.status !== 500 && !bad.body.includes("育成ポイント"), `HTTP ${bad.status}`);
  const missing = await get("/players/world/99999999999999");
  record("存在しない World ID: クラッシュせず not-found", missing.status !== 500 && !missing.body.includes("育成ポイント"), `HTTP ${missing.status}`);

  // 7. 既存機能の回帰（HTML / API のみ・外部アクセス 0）
  const home = await get("/");
  record("回帰: ホーム 200 + サイドメニュー", home.status === 200 && /eFootball Team AI/.test(home.body) && /マネージャー/.test(home.body), "");
  const players = await get("/players");
  record("回帰: 一覧 200 + 総件数 + 詳細リンク", players.status === 200 && /人の選手/.test(players.body) && /\/players\/world\/\d+/.test(players.body), "");
  const ja = await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=5`);
  record("回帰: 日本語検索", ja.status === 200 && ja.data?.totalCount > 0, `total=${ja.data?.totalCount}`);
  const en = await json("/api/world/players?q=messi&sort=ovr_max_desc&pageSize=5");
  record("回帰: 英語検索 + 並べ替え", en.status === 200 && en.data?.players?.[0]?.nameEn?.includes("Messi"), "");
  const p2 = await json("/api/world/players?page=2&pageSize=24");
  record("回帰: ページネーション", p2.status === 200 && p2.data?.page === 2, "");
  const gkf = await json("/api/world/players?position=GK&pageSize=50");
  record("回帰: フィルター(GK)", gkf.status === 200 && gkf.data?.players?.every((x) => x.registeredPosition === "GK"), "");
  const det = await json(`/api/world/players/${CARDS.messi}`);
  record("回帰: 詳細API 26能力値 + スキル", det.status === 200 && det.data?.player?.stats?.length === 26 && det.data?.player?.playerSkills?.length > 0, "");
  const detBad = await get("/api/world/players/abc");
  record("回帰: 詳細API 不正IDは 400", detBad.status === 400, `HTTP ${detBad.status}`);
  const detMiss = await get("/api/world/players/99999999999999");
  record("回帰: 詳細API 存在しないIDは 404", detMiss.status === 404, `HTTP ${detMiss.status}`);
  const imgBad = await get("/api/world/player-image/abc");
  record("回帰: World 画像プロキシ 不正IDは 400（外部アクセスなし）", imgBad.status === 400, `HTTP ${imgBad.status}`);
  const imgMiss = await get("/api/world/player-image/99999999999999");
  record("回帰: World 画像プロキシ 存在しないIDはプレースホルダー200（外部アクセスなし）", imgMiss.status === 200, `HTTP ${imgMiss.status}`);
  record("回帰: 一覧に画像プロキシ src が配線・loading=lazy", /\/api\/world\/player-image\/\d+/.test(players.body) && /loading="lazy"/.test(players.body), "");
  record("回帰: cloudfront URL をブラウザへ露出しない", !/d1zxa6glxh8sq9\.cloudfront\.net/.test(players.body + messi.body), "");
  for (const legacy of await checkLegacySampleDetail(BASE)) record(legacy.name, legacy.pass, legacy.detail);

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-progression] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 選手育成機能 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "注: 育成の対話操作（ポイント +/- のクリック等）は JS 実行が必要なため、対話フローは",
    "`src/lib/progression/flow.test.ts`（vitest, item 22 の1〜20）で検証。本スクリプトは SSR HTML 構造を確認する。",
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
  console.log(`[black-box-progression] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
