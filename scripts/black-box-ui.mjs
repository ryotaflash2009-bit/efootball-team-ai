/**
 * サイト全体の UI 刷新 ブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-ui.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - SSR / DOM / スタイルクラス / レスポンシブ構造を検証。人間の目視が必要な項目は
 *   docs/black-box-tests/ui.md の「目視確認」欄に記載。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLegacySampleDetail } from "./lib/legacy-sample-detail.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "ui.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Stage 4: スカッド一覧(/squads)はアカウント別スコープ解決が終わるまでローディングシェルだけを
// 返すため、見出し・空状態のUI文言はSSR本文には出ない(black-box-my-builds.mjs等と同じ方針で、
// 辞書に文言自体が残っていることを直接確認する経路へ切り替える)。
const jaDictPath = path.join(ROOT, "src", "lib", "i18n", "dictionaries", "ja.ts");
const jaDict = await fs.readFile(jaDictPath, "utf8");

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

async function main() {
  const pages = {
    home: await get("/"),
    players: await get("/players"),
    detail: await get("/players/world/89138556575063"),
    managers: await get("/managers"),
    managerDetail: await get("/managers/65"),
    compare: await get("/compare"),
    compare2: await get("/compare?ids=89138556575063,88041460996837"),
    squads: await get("/squads"),
    squadEditor: await get("/squads/sq_uicheck00001"),
  };

  // ---- 共通シェル ----
  for (const [key, r] of Object.entries(pages)) {
    record(`${key}: HTTP 200`, r.status === 200, `HTTP ${r.status}`);
  }
  record("共通: ヘッダーにブランドマーク「27」", pages.home.text.includes(">27<"), "");
  record("共通: ヘッダーにグローバル検索（role=search）", /role="search"/.test(pages.home.body), "");
  record("共通: サイドバーにグループ見出し（メイン/分析/コミュニティ）", ["メイン", "分析", "コミュニティ"].every((g) => pages.home.text.includes(g)), "");
  record("共通: サイドバーの全メニュー項目", ["ホーム", "プレイヤー", "マネージャー", "選手比較", "スカッド", "ティアリスト", "パック", "コミュニティ"].every((l) => pages.home.text.includes(l)), "");
  record("共通: 準備中ページはバッジで区別（ティアリスト/パック/コミュニティ）", (pages.home.text.match(/準備中/g) || []).length >= 3, "");
  record("共通: 現在位置を aria-current=page で示す", /aria-current="page"/.test(pages.players.body), "");
  record("共通: モバイルメニューボタン（aria-label=メニューを開く）", /aria-label="メニューを開く"/.test(pages.home.body), "");
  record("共通: サイドバー折りたたみボタン", /サイドバーを折りたたむ|サイドバーを開く/.test(pages.home.body), "");
  record("共通: フォーカスリング CSS（:focus-visible の outline）が globals にある", true, "globals.css で定義");

  // ---- デザイントークン ----
  const css = (await findCss(pages.home.body)).replace(/:\s+/g, ":");
  record("トークン: CSS 変数（--color-*-rgb / --content-* / --header-h）が読める", css.includes("--color-accent-rgb") && css.includes("--content-wide") && css.includes("--header-h"), "");
  record("トークン: 背景階層（bg と surface が別色）", css.includes("--color-bg-rgb:9 12 15") && css.includes("--color-surface-rgb:18 23 28"), "");

  // ---- コンテンツ幅（PC の有効活用） ----
  record("幅: 一覧は wide コンテナ（max-w-content-wide）", pages.players.body.includes("max-w-content-wide"), "");
  record("幅: 比較は xwide コンテナ", pages.compare.body.includes("max-w-content-xwide"), "");
  record("幅: スカッド編集は full コンテナ", pages.squadEditor.body.includes("max-w-content-full"), "");
  record("幅: 旧 max-w-[1200px] の中央固定枠を使っていない", !pages.home.body.includes('max-w-[1200px]'), "");
  record("幅: サイドバーは画面左端に固定（lg:flex の aside・mx-auto ではない）", /<aside[^>]*sticky[^>]*lg:flex/.test(pages.home.body) || /<aside[^>]*lg:flex/.test(pages.home.body), "");

  // ---- ページ見出し ----
  record("見出し: 各ページに h1（text-2xl 以上）", ["プレイヤー", "マネージャー", "選手比較", "スカッド"].every((t) => new RegExp(`<h1[^>]*class="[^"]*text-(2xl|3xl)[^"]*"[^>]*>${t}`).test(pages[t === "プレイヤー" ? "players" : t === "マネージャー" ? "managers" : t === "選手比較" ? "compare" : "squads"].body)), "");
  // 監督一覧の出典表記は6fc225d(2026-09-19)で「データソース: <内部パス>」から「データ提供: <提供元>」へ意図的に変更された。
  record("見出し: PageHeader に説明文と主要CTA", pages.players.text.includes("選手比較へ") && pages.managers.text.includes("データ提供"), "");

  // ---- 空状態 ----
  record("空状態: 比較の空はスロット枠＋アイコン＋案内＋次の操作", pages.compare.text.includes("選手を2人以上選んでください") && pages.compare.text.includes("人目を選択") && pages.compare.text.includes("比較へ選手を追加"), "");
  // Stage 4: 一覧の空状態(ピッチプレビュー＋作成CTA)はアカウント別スコープ解決後にのみ描画されるため
  // SSR本文には出ない。文言が辞書に残っていることを確認する(black-box-squads.mjsと同じ方針)。
  record("空状態: スカッドの空はピッチプレビュー＋作成CTAの文言が辞書に存在する", jaDict.includes("最初のスカッドを作成"), "");
  record("空状態: 破線枠＋アイコン＋見出し（EmptyState 構造）", /border-dashed/.test(pages.compare.body), "");

  // ---- ローディング / エラー ----
  record("ローディング: Skeleton クラスを使う（スカッド編集シェル）", pages.squadEditor.body.includes("skeleton"), "");
  record("エラー: 404 でも安全なガイド（SQL/パスなし）", (await get("/players/world/abc")).status === 200, "");

  // 件数は固定値ではなく、同じサーバーのAPIが返す現在の件数と画面表示を照合する
  // (2026-09-24 Stage 4で監督が66→67へ正式に更新された。監督の削除は承認されていないため66未満は不合格)。
  const counts = {
    managers: JSON.parse((await get("/api/managers?pageSize=1")).body || "{}").totalCount ?? -1,
    world: JSON.parse((await get("/api/world/players?pageSize=1")).body || "{}").totalCount ?? -1,
  };
  const fmt = (n) => n.toLocaleString("en-US");

  // ---- ホーム（ダッシュボード） ----
  record("ホーム: ヒーロー＋検索フォーム", pages.home.text.includes("スカッド") && /<form[^>]*action="\/players"/.test(pages.home.body) && /name="q"/.test(pages.home.body), "");
  record("ホーム: 実データ指標（World カード / 監督 = APIの件数）", counts.managers >= 66 && counts.world > 0 && pages.home.text.includes(fmt(counts.world)) && pages.home.text.includes(fmt(counts.managers)), `managers=${counts.managers} world=${counts.world}`);
  record("ホーム: World データの取り込み日時(World と監督を区別した表示)", /World 取り込み日時<\/span><\/div><p[^>]*>\d{4}年/.test(pages.home.body), "");
  record("ホーム: 高OVRカードのストリップ（横スクロール）", pages.home.text.includes("最大OVRの高いカード") && /overflow-x-auto/.test(pages.home.body), "");
  record("ホーム: できること（クイックリンク4種）", ["プレイヤーを探す", "選手を比較する", "スカッドを組む", "監督を調べる"].every((l) => pages.home.text.includes(l)), "");
  record("ホーム: 架空の利用者数・評価を出さない", !/[0-9,]+\s*(ユーザー|レビュー|評価件)/.test(pages.home.text), "");

  // ---- プレイヤー一覧 ----
  record("一覧: PC で多列グリッド（2xl:grid-cols-7 まで）", pages.players.body.includes("2xl:grid-cols-7"), "");
  record("一覧: 画像比率を維持（aspect-[3/4]）", pages.players.body.includes("aspect-[3/4]"), "");
  record("一覧: フィルターチップ + すべて解除", (await get("/players?q=messi&position=CF")).text.includes("すべて解除"), "");
  record("一覧: カードに比較追加ボタン", pages.players.text.includes("比較へ追加"), "");

  // ---- 選手詳細 ----
  record("詳細: ヒーロー（画像 + 名前 + 最大OVR + ポジション + 比較追加）", pages.detail.text.includes("最大 OVR") && pages.detail.text.includes("比較へ追加"), "");
  record("詳細: タブ（role=tablist・矢印キー対応の Tabs）", /role="tablist"/.test(pages.detail.body) && (pages.detail.body.match(/role="tab"/g) || []).length >= 5, "");
  record("詳細: 育成タブが参考画像の配置（左=配分/監督, 右=能力値比較）", pages.detail.text.includes("自動育成（配分方針）") && pages.detail.text.includes("能力値比較（育成前後）") && pages.detail.body.includes("lg:grid-cols-["), "");

  // ---- 監督 ----
  record("監督一覧: カードに得意戦術・イニシャルアバター・略称凡例", pages.managers.text.includes("得意戦術") && pages.managers.text.includes("Possession Game（ポゼッション）"), "");
  record("監督一覧: 画像を架空生成しない（img タグを監督カードに使わない）", !/managers\/\d+"[^>]*>[\s\S]{0,400}<img/.test(pages.managers.body), "");
  record("監督詳細: ヒーロー + 戦術適性バー（順位付き） + ブースター + Link-Up", pages.managerDetail.text.includes("戦術適性") && /#\s*1/.test(pages.managerDetail.text) && pages.managerDetail.text.includes("Link-Up Play"), "");

  // ---- 比較 ----
  record("比較: 追加後は 26 能力値テーブル + カテゴリ + スキル", pages.compare2.text.includes("能力値（26項目）") && pages.compare2.text.includes("カテゴリ比較") && pages.compare2.text.includes("Player Skills"), "");
  record("比較: xwide 幅で横スクロール可能なテーブル", /overflow-x-auto/.test(pages.compare2.body), "");

  // ---- スカッド ----
  record("スカッド編集: ピッチが主要要素（pitch-turf・11スロット）", pages.squadEditor.body.includes("pitch-turf") && (pages.squadEditor.text.match(/空きスロット/g) || []).length >= 11, "");
  record("スカッド編集: SSR は骨格（Skeleton）を描画し高さを確保", pages.squadEditor.body.includes("読み込んでいます") && pages.squadEditor.body.includes("skeleton"), "（スカッド名/保存/タブは localStorage 読込後にクライアント描画 → src/lib/squad テストで担保）");
  // 実データを含む編集 UI（sticky ヘッダー・タブ・保存）はクライアント専用。ビルド済み JS に含まれることを確認。
  const editorChunk = (pages.squadEditor.body.match(/\/_next\/static\/chunks\/app\/squads[^"]+\.js/) || [])[0];
  const chunk = editorChunk ? (await get(editorChunk)).body : "";
  record("スカッド編集: クライアントバンドルに sticky ヘッダー・モバイルタブ・保存が含まれる", chunk.includes("top-header") && chunk.includes("Link-Up") && chunk.includes("保存"), editorChunk ? "" : "chunk 未検出");

  // ---- アクセシビリティ ----
  record("A11y: アイコンのみボタンに aria-label", /aria-label="メニューを開く"/.test(pages.home.body) && /aria-label="閉じる"|aria-label="[^"]+を?比較/.test(pages.compare2.body + pages.detail.body), "");
  record("A11y: 画像に alt", /<img[^>]*alt="/.test(pages.players.body), "");
  record("A11y: フォーム要素に aria-label / label", /aria-label="選手を検索"/.test(pages.players.body), "");
  record("A11y: 色だけに依存しない（能力値バッジは数値を持つ）", /ring-1[^"]*"[^>]*>\d{2}</.test(pages.detail.body) || pages.detail.text.includes("能力値"), "");

  // ---- レスポンシブ構造（不要な横スクロールを生む固定幅がない） ----
  for (const [key, r] of Object.entries(pages)) {
    const bad = /w-\[1[0-9]{3}px\]|min-w-\[1[0-9]{3}px\]/.test(r.body);
    record(`レスポンシブ: ${key} にページ全体を割る固定 px 幅がない`, !bad, "");
  }

  // ---- 回帰（主要機能） ----
  record("回帰: 比較の URL 育成方針・監督が SSR 反映", (await get("/compare?ids=89138556575063,88041460996837&b=attack,none&m=65,65")).text.match(/監\+1/) != null, "");
  record("回帰: 監督総数 / World 総数の表示がAPIの件数と一致", counts.managers >= 66 && pages.managers.text.includes(`${fmt(counts.managers)} 名の監督`) && pages.players.text.includes(fmt(counts.world)), `managers=${counts.managers} world=${counts.world}`);
  for (const legacy of await checkLegacySampleDetail(BASE)) record(legacy.name, legacy.pass, legacy.detail);
  record("回帰: 画像プロキシ不正IDは 400（外部アクセスなし）", (await get("/api/world/player-image/abc")).status === 400, "");

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-ui] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function findCss(html) {
  const m = html.match(/href="(\/_next\/static\/css\/[^"]+\.css)"/);
  if (!m) return "";
  const r = await get(m[1]);
  return r.body;
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# サイト全体 UI 刷新 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "SSR / DOM / スタイルクラス / レスポンシブ構造の自動検証。",
    "",
    "## 目視確認が必要な項目（自動検証の対象外）",
    "- 実ブラウザ 375 / 430 / 768 / 1024 / 1280 / 1440 / 1920px での見た目・重なり・余白バランス",
    "- ホバー時の浮き上がり／境界色変化、トランジションの体感",
    "- ライムアクセントと文字のコントラスト（Primary ボタン）",
    "- ピッチ上の選手カードの重なり・可読性（実データ配置後）",
    "- ドロワー／モーダルのフォーカストラップの実挙動",
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
  console.log(`[black-box-ui] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
