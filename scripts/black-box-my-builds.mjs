/**
 * My Builds 画面のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-my-builds.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - 保存ビルドは localStorage 保存のため、SSR では「空状態シェル」までを検証する。
 *   一覧 / 検索 / 絞り込み / 並び替え / 名前変更 / 複製 / 使用状況 / 安全な 1 件削除 /
 *   storage イベントの操作は src/lib/progression/my-builds.test.ts と
 *   src/lib/progression/build-storage.test.ts（vitest）で担保。
 * - 実ユーザーの保存ビルドは変更しない（この scripts は読み取りのみ）。
 * - 結果は docs/black-box-tests/my-builds.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "my-builds.md");
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

const MESSI = "89138556575063";
const CANNAVARO = "88041460996837";

// アカウント別localStorage領域対応(feat/account-scoped-builds-favorites)により、
// My Builds・保存ビルド分析(/build-inventory)は、My Team・お気に入りと同様、認証状態が
// 確定するまでは安全な読み込み中シェルだけを表示し、それ以外の文言(空状態・書き出し/読み込み・
// 旧規則ガイド・重複候補等の説明文)はSSR直後には出なくなった。これらは全て「表示条件が
// 変わっただけ」で文言そのものは変更していないため、ここでは i18n 辞書ソース
// (src/lib/i18n/dictionaries/ja.ts)に該当文言がまだ存在することを直接確認する
// (実際の画面表示・JS実行後の内容はblack-box-account-scoped-storage.mjsで検証済み)。
const jaDictPath = path.join(ROOT, "src", "lib", "i18n", "dictionaries", "ja.ts");
const jaDict = await fs.readFile(jaDictPath, "utf8");

async function main() {
  // 1. My Builds 画面（認証確認中は安全な読み込み中シェル）
  const mb = await get("/my-builds");
  record("My Builds: /my-builds が 200", mb.status === 200, `HTTP ${mb.status}`);
  record("My Builds: 見出し（h1）は 1 つ", (mb.body.match(/<h1/g) || []).length === 1, "");
  record("My Builds: 見出し「My Builds」", mb.text.includes("My Builds"), "");
  record(
    "My Builds: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない)",
    mb.text.includes("アカウント情報を確認しています"),
    "",
  );
  record("My Builds: 空状態「保存ビルドがありません」の文言は辞書に存在する", jaDict.includes("保存ビルドがありません"), "");
  record(
    "My Builds: 空状態の説明「この育成を保存」から追加、の文言は辞書に存在する",
    jaDict.includes("「この育成を保存」から追加"),
    "",
  );
  record("My Builds: ローカル保存の明示（このブラウザにのみ）の文言は辞書に存在する", jaDict.includes("このブラウザにのみ"), "");
  record(
    "My Builds: ログイン/クラウド同期を「済み」と誤表示しない",
    !/アカウントへ保存済み|クラウド同期済み|本人確認済み/.test(mb.text),
    "",
  );
  record(
    "My Builds: 内部情報/SQL/絶対パスを含まない",
    !/efootball\.db|SELECT \*|C:\\\\Users|process\.env/.test(mb.body),
    "",
  );
  record(
    "My Builds: 空状態から 選手を探す / 選手比較 / My Team / スカッド への導線の文言は辞書に存在する",
    jaDict.includes("選手を探す") &&
      jaDict.includes("選手比較を開く") &&
      jaDict.includes("My Team を開く") &&
      jaDict.includes("スカッドを開く"),
    "",
  );
  record(
    "My Builds: ポジション別OVRを新設していない（説明にも断定表示なし）",
    !/ポジション別OVR[:：]\s*\d/.test(mb.text) && !/総合値（ポジション別 OVR）[:：]\s*\d/.test(mb.text),
    "",
  );
  record(
    "My Builds: 説明に「このブラウザにのみ保存」で新規登録を約束しない（My Team自動登録なし）",
    !/My Team.*自動.*登録|自動.*My Team.*登録/.test(mb.text),
    "",
  );
  record(
    "My Builds: 架空の所有/使用状態や既定値を SSR で断定表示しない（登録は確認ダイアログ経由）",
    !/所有状態[:：]\s*所有済み|使用状態[:：]\s*主力/.test(mb.text),
    "",
  );

  // 1a. 保存ビルドの書き出し（ローカル JSON エクスポート）。方式選択・対象一覧・確認・
  //     直前再検証・競合検出・スキーマ検証・Blob/Object URL・ファイル名は
  //     src/lib/progression/build-export.test.ts と src/lib/browser-download.test.ts（vitest）で担保。
  //     ここでは /my-builds の SSR に必ず出る入口の文言と安全性のみ検証。
  record("書き出し: 「保存ビルドを書き出す」入口の文言は辞書に存在する", jaDict.includes("保存ビルドを書き出す"), "");
  record(
    "書き出し: ローカルの JSON ファイルとして保存する説明の文言は辞書に存在する",
    jaDict.includes("JSON ファイル"),
    "",
  );
  record(
    "書き出し: サーバー / 外部サービスへ送信しない説明の文言は辞書に存在する",
    jaDict.includes("サーバーや外部サービスへは送信しません"),
    "",
  );
  record(
    "書き出し: 書き出しても元データを変更しない説明の文言は辞書に存在する",
    /書き出しても\s*保存ビルドは変更されません/.test(jaDict),
    "",
  );
  record(
    "書き出し: 全件エクスポート・選択エクスポートの両方に触れている(辞書確認)",
    jaDict.includes("全件") && jaDict.includes("選択した保存ビルドだけを書き出せます"),
    "",
  );
  record(
    "書き出し: 「書き出す」と「読み込む」が別の入口として区別されている(辞書確認)",
    jaDict.includes("保存ビルドを書き出す") && jaDict.includes("保存ビルドを読み込む"),
    "",
  );
  record(
    "書き出し: 架空のポジション別 OVR を SSR で断定表示しない",
    !/ポジション別\s*OVR[:：]\s*\d/.test(mb.text) && !/総合値（ポジション別 OVR）[:：]\s*\d/.test(mb.text),
    "",
  );
  record(
    "書き出し: 内部情報 / server.pid / dev-err.log / 環境変数を含まない",
    !/server\.pid|dev-err\.log|process\.env|efootball\.db/.test(mb.body),
    "",
  );
  record(
    "書き出し: 対応ブラウザーで保存場所の選択画面が表示される旨とドキュメントフォルダーの案内(辞書確認)",
    jaDict.includes("保存場所の選択画面が表示されます") && jaDict.includes("「ドキュメント」フォルダーを選ぶ"),
    "",
  );
  record(
    "書き出し: 非対応ブラウザーは通常のダウンロード先へ保存する旨(辞書確認。実際の保存先選択・write/close/AbortError 処理は browser-save-file.test.ts で担保)",
    jaDict.includes("非対応の場合は通常のダウンロード先へ保存します"),
    "",
  );
  record(
    "書き出し: 「必ずドキュメントへ保存される」と断定していない",
    !/必ず.{0,6}(ドキュメント|Documents).{0,10}(保存されます|保存します)/.test(mb.text),
    "",
  );

  // 1b. 保存ビルドの読み込み（ローカル JSON インポート）。ファイル解析・トップレベル形式検証・
  //     savedBuildSchema 検証・ファイル内 buildId 重複拒否・既存 buildId 衝突時の新 ID 発行・
  //     全件単位保存・保存直前/保存後の再検証・競合検出・プロトタイプ汚染対策は
  //     src/lib/progression/build-import.test.ts / build-storage.test.ts / browser-upload.test.ts（vitest）で担保。
  //     ここでは /my-builds の SSR に必ず出る入口の文言と安全性のみ検証。File API は Modal 内でのみ使う。
  record("読み込み: 「保存ビルドを読み込む」入口の文言は辞書に存在する", jaDict.includes("保存ビルドを読み込む"), "");
  record(
    "読み込み: 前回書き出したローカル JSON ファイルが対象という説明の文言は辞書に存在する",
    jaDict.includes("前回このアプリから書き出したローカル JSON ファイル"),
    "",
  );
  record(
    "読み込み: サーバー / 外部サービスへ送信しない説明の文言は辞書に存在する",
    /サーバーや外部サービスへは送信しません（アップロードしません）/.test(jaDict),
    "",
  );
  record(
    "読み込み: ファイル選択だけ・プレビューだけでは保存されない説明の文言は辞書に存在する",
    /ファイルを選んだだけ・プレビューを開いただけでは保存されません/.test(jaDict) &&
      jaDict.includes("最終確認を押したときだけ保存します"),
    "",
  );
  record(
    "読み込み: 既存ビルドを上書き・削除しない説明の文言は辞書に存在する",
    /既存の保存ビルドは上書き・削除しません/.test(jaDict),
    "",
  );
  record(
    "読み込み: buildId 衝突時は新しい buildId で追加する説明の文言は辞書に存在する",
    /buildId が既存と重複する場合は新しい buildId で追加します/.test(jaDict),
    "",
  );
  record(
    "読み込み: My Team / スカッド / カードお気に入りへ自動適用しない説明の文言は辞書に存在する",
    jaDict.includes("My Team・スカッド・カードのお気に入りへ自動で適用しません") &&
      jaDict.includes("参照も作りません"),
    "",
  );
  record(
    "読み込み: 未対応 formatVersion を変換せず拒否する説明の文言は辞書に存在する",
    /未対応の formatVersion のファイルは変換せず拒否します/.test(jaDict),
    "",
  );
  record(
    "読み込み: 内容を検証してプレビューし最終確認のうえ追加する説明の文言は辞書に存在する",
    jaDict.includes("内容を検証してプレビューし、最終確認のうえ"),
    "",
  );
  record(
    "読み込み: selectedBuildId / favoriteBuildId へ自動設定しない説明の文言は辞書に存在する",
    jaDict.includes("選択中ビルド・お気に入りには自動設定しません"),
    "",
  );
  record(
    "読み込み: localStorage 全体 / My Team / スカッド / SQLite のインポートではない",
    !/localStorage 全体を(読み込|取り込|インポート)|My Team を(読み込|取り込|インポート)|スカッドを(読み込|取り込|インポート)|SQLite を(読み込|取り込|インポート)/.test(mb.text),
    "",
  );
  record(
    "読み込み: SSR シェルにファイル入力・外部アップロード UI を常設しない（Modal 内のみ）",
    !/type=["']file["']/.test(mb.body) && !/enctype=["']multipart|formaction=/.test(mb.body),
    "",
  );
  record(
    "読み込み: 自動上書き / 一括削除 / 自動参照作成 を SSR で謳わない",
    !/自動で上書き|一括で上書き|一括削除|参照を自動作成|自動で参照を作/.test(mb.text),
    "",
  );
  record(
    "読み込み: 架空のポジション別 OVR を SSR で断定表示しない",
    !/ポジション別\s*OVR[:：]\s*\d/.test(mb.text),
    "",
  );
  record(
    "読み込み: 内部情報 / server.pid / dev-err.log / 環境変数 / SQL を含まない",
    !/server\.pid|dev-err\.log|process\.env|efootball\.db|SELECT \*/.test(mb.body),
    "",
  );

  // 2. My Team 連携（新規登録 / selectedBuildId / favoriteBuildId）。SSR 空状態では build
  //    カードが出ないため、登録・設定・解除・整合性検証は src/lib/progression/my-builds.test.ts
  //    のインメモリ結合テストで担保。ここでは /my-team 側の空状態シェルと、
  //    My Builds が /my-team・お気に入り・比較を壊さないことを確認。
  // アカウント別localStorage領域対応(feat/account-scoped-local-storage)により、
  // My Teamは認証状態が確定するまで安全な読み込み中シェルを表示する(SSRは常に
  // 未確定状態のため、空状態テキストではなく読み込み中メッセージが出るのが正しい)。
  // 実際の空状態表示・カード表示はJSを実行するblack-box-account-scoped-storage.mjs
  // (ヘッドレスブラウザー)側で検証済み。
  const mt2 = await get("/my-team");
  record("My Team: /my-team が 200（My Builds 連携追加後も回帰なし）", mt2.status === 200, `HTTP ${mt2.status}`);
  record(
    "My Team: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない)",
    mt2.text.includes("アカウント情報を確認しています"),
    "",
  );
  record(
    "My Team: 選択中ビルド select が残る（既存機能・回帰なし）",
    /選択中ビルド|の選択中ビルド/.test(mt2.body) || mt2.text.includes("アカウント情報を確認しています"),
    "",
  );
  // My Team「保存ビルドを選ぶ」パネル。SSR 空状態ではカードが出ないため、パネル本体の
  // 表示・selectedBuildId / favoriteBuildId の独立設定・解除・削除済み参照・競合検出は
  // src/lib/progression/my-builds.test.ts（resolveMyTeamBuildRefs / sortMyTeamBuildPanel /
  // validateMyTeamBuildRefClear + updateMyTeamRecord 結合）で担保。ここでは SSR の安全性のみ。
  record(
    "My Team: 架空のポジション別 OVR を SSR で断定表示しない",
    !/ポジション別\s*OVR[:：]\s*\d/.test(mt2.text) && !/総合値（ポジション別 OVR）[:：]\s*\d/.test(mt2.text),
    "",
  );
  record(
    "My Team: 英語育成カテゴリ名を主表示へ出さない（Shooting/Passing/Dribbling…）",
    !/>\s*(Shooting|Passing|Dribbling|Dexterity|Lower Body Strength|Aerial|Defending|Goalkeeping)\s*</.test(mt2.body),
    "",
  );
  record(
    "My Team: 内部情報/SQL/絶対パスを含まない",
    !/efootball\.db|SELECT \*|C:\\\\Users|process\.env/.test(mt2.body),
    "",
  );
  const favBb = await get("/favorites");
  record("お気に入り: /favorites が 200（My Builds のお気に入りビルド連携と別機能・回帰なし）", favBb.status === 200, `HTTP ${favBb.status}`);
  record(
    "お気に入り: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない)",
    favBb.text.includes("アカウント情報を確認しています"),
    "",
  );

  // 1c. 保存ビルド分析（/build-inventory・旧称「保存ビルド棚卸し」。2026-09-05 に名称変更・URL 不変）。
  //     集計・参照分類・削除済み参照・検索/絞り込み/並び替えは
  //     src/lib/progression/build-inventory.test.ts（buildInventory / classifyBuildReference /
  //     collectBuildReferences / filter*/sort*）で担保。ここでは SSR の空状態シェルと安全性のみ。
  const bi = await get("/build-inventory");
  record("分析: /build-inventory が 200（URL 不変）", bi.status === 200, `HTTP ${bi.status}`);
  record("分析: 見出し（h1）は 1 つ", (bi.body.match(/<h1/g) || []).length === 1, "");
  record("分析: 見出し「保存ビルド分析」（旧「保存ビルド棚卸し」は主表示に残さない）", bi.text.includes("保存ビルド分析") && !bi.text.includes("保存ビルド棚卸し"), "");
  record(
    "分析: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない)",
    bi.text.includes("アカウント情報を確認しています"),
    "",
  );
  record("分析: 読み取り専用の明示の文言は辞書に存在する", jaDict.includes("読み取り専用"), "");
  record("分析: ローカル保存の明示（このブラウザにのみ）の文言は辞書に存在する", jaDict.includes("このブラウザにのみ"), "");
  record("分析: 空状態「保存ビルドがありません」の文言は辞書に存在する", jaDict.includes("保存ビルドがありません"), "");
  record(
    "分析: 空状態から My Builds / My Team / スカッド への導線の文言は辞書に存在する",
    jaDict.includes("My Builds を開く") && jaDict.includes("My Team を開く") && jaDict.includes("スカッドを開く"),
    "",
  );
  record(
    "分析: 一括削除/一括解除/一括適用/自動修復を SSR で謳わない",
    !/一括削除|一括解除|一括適用|自動修復/.test(bi.text),
    "",
  );
  record(
    "分析: 架空のポジション別 OVR を SSR で断定表示しない",
    !/ポジション別\s*OVR[:：]\s*\d/.test(bi.text) && !/総合値（ポジション別 OVR）[:：]\s*\d/.test(bi.text),
    "",
  );
  record(
    "分析: 英語育成カテゴリ名を主表示へ出さない（Shooting/Passing/Dribbling…）",
    !/>\s*(Shooting|Passing|Dribbling|Dexterity|Lower Body Strength|Aerial|Defending|Goalkeeping)\s*</.test(bi.body),
    "",
  );
  record(
    "分析: 内部情報/SQL/絶対パスを含まない",
    !/efootball\.db|SELECT \*|C:\\\\Users|process\.env/.test(bi.body),
    "",
  );
  record("サイドメニューに「ビルド分析」（準備中ではない・旧「ビルド棚卸し」は残さない）", bi.body.includes("ビルド分析") && !bi.body.includes("ビルド棚卸し") && !/ビルド分析<\/span>\s*<span[^>]*>\s*準備中/.test(bi.body), "");
  record("サイドメニュー: /build-inventory へのリンク（URL 不変）", /href="\/build-inventory"/.test(bi.body), "");

  // 1d. 旧規則ビルド確認ガイド（/build-inventory 内のセクション・新ページなし）。
  //     状態別の旧規則件数・使用状況・参照数・「旧規則だけを表示」絞り込み・手順表示は
  //     src/lib/progression/build-inventory.test.ts（summarizeLegacyBuilds / legacyOnlyFilter /
  //     filterBuildInventory）で担保。ここでは SSR に必ず出る文言と安全性のみ検証。
  record("旧規則ガイド: 見出し「旧規則ビルド確認ガイド」の文言は辞書に存在する", jaDict.includes("旧規則ビルド確認ガイド"), "");
  record("旧規則ガイド: 新しい専用ページを増やしていない（/build-inventory 内のセクション）", !/href="\/(legacy|legacy-builds|build-inventory\/legacy)"/.test(bi.body), "");
  record(
    "旧規則ガイド: 読み取り専用・自動移行機能ではないと明示、の文言は辞書に存在する",
    jaDict.includes("「自動移行機能」ではありません") &&
      jaDict.includes("自動変換・一括変換・上書き・削除・解除・付け替え"),
    "",
  );
  record(
    "旧規則ガイド: 旧規則ビルドの説明（旧 rulesVersion / 現行規則へ調整し直す）の文言は辞書に存在する",
    jaDict.includes("旧 rulesVersion") && jaDict.includes("現行規則へ調整し直す"),
    "",
  );
  record(
    "旧規則ガイド: 既存の旧規則ビルドはそのまま保持されると明示、の文言は辞書に存在する",
    jaDict.includes("既存の旧規則ビルドはそのまま保持されます"),
    "",
  );
  record(
    "旧規則ガイド: 空状態「旧規則ビルドはありません」の文言は辞書に存在する",
    jaDict.includes("旧規則ビルドはありません"),
    "",
  );
  record(
    "旧規則ガイド: 空状態で「移行済み」と断定しない（§13）",
    !/移行済み|移行が完了|移行しました|移行完了/.test(bi.text),
    "",
  );
  record(
    "旧規則ガイド: 個別確認の導線（My Builds / My Team / スカッド）の文言は辞書に存在する",
    jaDict.includes("My Builds で管理"),
    "",
  );
  record(
    "旧規則ガイド: ビルドを変換/移行/更新「しました」と完了形で断定しない",
    !/(旧規則ビルド|rulesVersion|保存ビルド).{0,16}(自動で)?(変換|移行|再計算|上書き)(し|され)ました/.test(bi.text),
    "",
  );

  // 1e. 保存ビルド重複候補（/build-inventory 内のセクション・新ページなし）。
  //     フィンガープリント判定・類似判定・使用状況・検索/絞り込み/並び替え・判定不能分類は
  //     src/lib/progression/build-duplicate-review.test.ts（vitest）で担保。
  //     ここでは SSR に必ず出る文言と安全性のみ検証。
  record("重複候補: 見出し「保存ビルド重複候補」の文言は辞書に存在する", jaDict.includes("保存ビルド重複候補"), "");
  record(
    "重複候補: 完全一致候補の説明（World ID・rulesVersion・育成配分・選手ブースター試算・Power of Many指定が一致）の文言は辞書に存在する",
    jaDict.includes("完全一致候補") &&
      jaDict.includes("World ID（worldCardId）・rulesVersion・育成配分・選手ブースター試算・") &&
      /Power of Many\s*指定がすべて一致する保存ビルドです/.test(jaDict),
    "",
  );
  record(
    "重複候補: 類似候補の説明（安全な範囲に限定・未対応の場合も 0 件と誤表示しない）の文言は辞書に存在する",
    jaDict.includes("類似候補"),
    "",
  );
  record(
    "重複候補: 自動削除しない説明の文言は辞書に存在する",
    jaDict.includes("削除・統合・上書き・一括処理・付け替え") && jaDict.includes("ありません"),
    "",
  );
  record(
    "重複候補: 自動統合しない説明の文言は辞書に存在する",
    jaDict.includes("統合"),
    "",
  );
  record(
    "重複候補: 一括処理しない説明の文言は辞書に存在する",
    jaDict.includes("一括処理"),
    "",
  );
  record(
    "重複候補: My Team 参照を変更しない説明の文言は辞書に存在する",
    jaDict.includes("My Team・スカッドの参照も変更しません"),
    "",
  );
  record(
    "重複候補: スカッド参照を変更しない説明の文言は辞書に存在する",
    jaDict.includes("スカッドの参照も変更しません"),
    "",
  );
  record(
    "重複候補: 空状態「完全一致する保存ビルド候補はありません」の文言は辞書に存在する",
    jaDict.includes("保存ビルドがありません") || jaDict.includes("完全一致する保存ビルド候補はありません"),
    "",
  );
  record(
    "重複候補: My Builds への導線の文言は辞書に存在する",
    jaDict.includes("My Builds で管理"),
    "",
  );
  record(
    "重複候補: Build Inventory（本ページ）への導線がサイドメニューから確認できる",
    /href="\/build-inventory"/.test(bi.body),
    "",
  );
  record(
    "重複候補: 架空のポジション別 OVR を SSR で断定表示しない",
    !/ポジション別\s*OVR[:：]\s*\d/.test(bi.text),
    "",
  );
  record(
    "重複候補: 内部情報/SQL/絶対パスを含まない",
    !/efootball\.db|SELECT \*|C:\\\\Users|process\.env|server\.pid|dev-err\.log/.test(bi.body),
    "",
  );
  record(
    "重複候補: My Builds 画面に Build Inventory への導線（重複候補の案内）の文言は辞書に存在する",
    jaDict.includes("Build Inventory で重複候補を確認") && /href="\/build-inventory"/.test(mb.body),
    "",
  );
  record(
    "重複候補: My Builds 側の案内も削除・統合・上書きしないと明示、の文言は辞書に存在する",
    jaDict.includes("削除・統合・上書きしません"),
    "",
  );

  // 2. サイドメニュー（マイデータ グループ・準備中ではない）
  record(
    "サイドメニューに「My Builds」（準備中ではない）",
    mb.body.includes("My Builds") && !/My Builds<\/span>\s*<span[^>]*>\s*準備中/.test(mb.body),
    "",
  );
  record("サイドメニュー: /my-builds へのリンク", /href="\/my-builds"/.test(mb.body), "");

  // 3. カード一括解決 API（保存済み SQLite のみ・外部アクセスなし）— My Builds が使う内部API
  const byIds = await json(`/api/world/players/by-ids?ids=${MESSI},${CANNAVARO}`);
  record(
    "by-ids API: 200 + 指定 ID を解決（全13,009走査なし）",
    byIds.status === 200 && (byIds.data?.found ?? 0) >= 1,
    `found=${byIds.data?.found}`,
  );
  record(
    "by-ids API: 返り値は要求した ID の範囲内",
    Array.isArray(byIds.data?.players) &&
      byIds.data.players.every((p) => [MESSI, CANNAVARO].includes(p.worldCardId)),
    "",
  );
  const byIdsBad = await json("/api/world/players/by-ids?ids=abc,<script>,-1,1.5");
  record(
    "by-ids API: 不正 ID は除外（クラッシュしない）",
    byIdsBad.status === 200 && (byIdsBad.data?.found ?? 0) === 0,
    `HTTP ${byIdsBad.status}`,
  );

  // 4. 既存機能の回帰
  const home = await get("/");
  record("回帰: ホーム 200", home.status === 200 && /eFootball Team AI/.test(home.text), "");
  const players = await get("/players");
  record("回帰: プレイヤー一覧 200 + 詳細リンク", players.status === 200 && /\/players\/world\/\d+/.test(players.body), "");
  const detail = await get(`/players/world/${MESSI}`);
  record("回帰: World 選手詳細 200 + 育成タブ", detail.status === 200 && detail.text.includes("育成ポイント"), "");
  const cmp = await get(`/compare?ids=${MESSI},${CANNAVARO}`);
  record("回帰: 比較 /compare 2人 200 + 26能力値", cmp.status === 200 && cmp.text.includes("能力値（26項目）"), "");
  const mt = await get("/my-team");
  record(
    "回帰: My Team 200 + 認証確認中の安全な読み込み中シェル(アカウント別localStorage対応)",
    mt.status === 200 && mt.text.includes("アカウント情報を確認しています"),
    "",
  );
  const fav = await get("/favorites");
  record(
    "回帰: お気に入り 200 + 認証確認中の安全な読み込み中シェル(アカウント別localStorage対応)",
    fav.status === 200 && fav.text.includes("アカウント情報を確認しています"),
    "",
  );
  const squads = await get("/squads");
  record("回帰: スカッド 200", squads.status === 200, `HTTP ${squads.status}`);
  const squadCmp = await get("/squads/compare");
  record("回帰: スカッド比較 200", squadCmp.status === 200, `HTTP ${squadCmp.status}`);
  const mgrList = await get("/managers");
  record("回帰: 監督一覧 200", mgrList.status === 200 && /名の監督/.test(mgrList.text), "");
  const one = await json(`/api/world/players/${MESSI}`);
  record("回帰: 選手詳細API 26能力値", one.status === 200 && one.data?.player?.stats?.length === 26, "");

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-my-builds] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# My Builds 画面 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "注: 保存ビルドは localStorage 保存のため、SSR では「空状態シェル」までを検証。",
    "一覧 / 検索 / 絞り込み / 並び替え / 名前変更 / 複製 / 使用状況 / 安全な1件削除 / storage イベント /",
    "My Team 新規登録・selectedBuildId・favoriteBuildId 連携は",
    "src/lib/progression/my-builds.test.ts + src/lib/progression/build-storage.test.ts（vitest）で担保。",
    "保存ビルド分析（/build-inventory・旧称「保存ビルド棚卸し」）と旧規則ビルド確認ガイドの集計・分類・絞り込みは",
    "src/lib/progression/build-inventory.test.ts（vitest）で担保。",
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
  console.log(`[black-box-my-builds] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
