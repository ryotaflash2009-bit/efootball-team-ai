/**
 * お気に入り / My Team 基盤のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-favorites.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - お気に入り / My Team は localStorage 保存のため、SSR では「空状態シェル」までを検証する。
 *   追加/解除/重複防止/タグ/メモ/ビルド関連付け/独立性のクリック操作は
 *   src/lib/user-cards/user-cards.test.ts（vitest 28件）で担保。
 * - 結果は docs/black-box-tests/favorites-my-team.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "favorites-my-team.md");
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

// アカウント別localStorage領域対応(feat/account-scoped-builds-favorites)により、お気に入りも
// 認証状態が確定するまでは安全な読み込み中シェルを表示する。空状態文言はSSR直後には出なくなった
// (文言自体は変更していないため、辞書ソースに存在することを直接確認する。実際の画面表示は
// black-box-account-scoped-storage.mjsで検証済み)。
const jaDictPath = path.join(ROOT, "src", "lib", "i18n", "dictionaries", "ja.ts");
const jaDict = await fs.readFile(jaDictPath, "utf8");

async function main() {
  // 1. お気に入り画面（認証確認中は安全な読み込み中シェル）
  const fav = await get("/favorites");
  record("お気に入り: /favorites が 200", fav.status === 200, `HTTP ${fav.status}`);
  record("お気に入り: 見出し「お気に入り」", fav.text.includes("お気に入り"), "");
  record(
    "お気に入り: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない)",
    fav.text.includes("アカウント情報を確認しています"),
    "",
  );
  record("お気に入り: 空状態「お気に入りはまだありません」の文言は辞書に存在する", jaDict.includes("お気に入りはまだありません"), "");
  record("お気に入り: ローカル保存の明示（このブラウザにのみ）の文言は辞書に存在する", jaDict.includes("このブラウザにのみ"), "");
  record(
    "お気に入り: ログイン/クラウド同期を「済み」と誤表示しない",
    !/アカウントへ保存済み|クラウド同期済み|本人確認済み/.test(fav.text),
    "",
  );
  record("お気に入り: 内部情報/SQL/絶対パスを含まない", !/efootball\.db|SELECT \*|C:\\\\Users/.test(fav.body), "");

  // 2. My Team 画面（SSR シェル）
  // アカウント別localStorage領域対応(feat/account-scoped-local-storage)により、
  // 認証状態が確定するまでは安全な読み込み中シェルだけを表示し、空状態テキストや
  // 各種案内文は表示しない(SSRは常に未確定状態のため)。空状態・案内文の実表示は
  // JSを実行するblack-box-account-scoped-storage.mjs(ヘッドレスブラウザー)側で検証済み。
  const mt = await get("/my-team");
  record("My Team: /my-team が 200", mt.status === 200, `HTTP ${mt.status}`);
  record("My Team: 見出し「My Team」", mt.text.includes("My Team"), "");
  record(
    "My Team: SSRは認証確認中の安全な読み込み中シェルを表示する(空状態を先走って表示しない)",
    mt.text.includes("アカウント情報を確認しています"),
    "",
  );

  // 3. サイドメニュー（マイデータ グループ・準備中ではない）
  record(
    "サイドメニューに「お気に入り」（準備中ではない）",
    fav.text.includes(">お気に入り<") && !/お気に入り<\/span>\s*<span[^>]*>\s*準備中/.test(fav.body),
    "",
  );
  record(
    "サイドメニューに「My Team」（準備中ではない）",
    fav.body.includes("My Team") && !/My Team<\/span>\s*<span[^>]*>\s*準備中/.test(fav.body),
    "",
  );

  // 4. カード一括解決 API（保存済み SQLite のみ・外部アクセスなし）
  const byIds = await json(`/api/world/players/by-ids?ids=${MESSI},${CANNAVARO}`);
  record("by-ids API: 200 + 指定 ID を解決", byIds.status === 200 && byIds.data?.found >= 1, `found=${byIds.data?.found}`);
  record(
    "by-ids API: 返り値は要求した ID の範囲内",
    Array.isArray(byIds.data?.players) &&
      byIds.data.players.every((p) => [MESSI, CANNAVARO].includes(p.worldCardId)),
    "",
  );
  const byIdsEmpty = await json("/api/world/players/by-ids?ids=");
  record("by-ids API: ids 空 → players:[]（500ではない）", byIdsEmpty.status === 200 && Array.isArray(byIdsEmpty.data?.players) && byIdsEmpty.data.players.length === 0, `HTTP ${byIdsEmpty.status}`);
  const byIdsBad = await json("/api/world/players/by-ids?ids=abc,<script>,-1,1.5");
  record("by-ids API: 不正 ID は除外（クラッシュしない）", byIdsBad.status === 200 && (byIdsBad.data?.found ?? 0) === 0, `HTTP ${byIdsBad.status}`);
  const many = Array.from({ length: 600 }, (_, i) => 100000 + i).join(",");
  const byIdsMany = await json(`/api/world/players/by-ids?ids=${many}`);
  record("by-ids API: 大量 ID でも 500 にならない（上限で頭打ち）", byIdsMany.status === 200, `HTTP ${byIdsMany.status}`);

  // 5. お気に入りボタンの設置（SSR で確認できる範囲）
  const players = await get("/players");
  record("プレイヤー一覧カードにお気に入りボタン（aria-label）", /aria-label="お気に入りに追加"/.test(players.body), "");
  const detail = await get(`/players/world/${MESSI}`);
  record("選手詳細にお気に入り追加ボタン", detail.text.includes("お気に入りに追加"), "");
  record("選手詳細に My Team へ追加ボタン", detail.text.includes("My Team"), "");
  record(
    "お気に入り = 色だけに依存しない（aria-pressed を持つ）",
    /aria-pressed="(true|false)"/.test(players.body) || /aria-pressed=/.test(detail.body),
    "",
  );

  // 6. 育成タブのディープリンク（My Team → 育成で開く）
  const prog = await get(`/players/world/${MESSI}?tab=progression`);
  record("?tab=progression: 育成タブが初期選択（育成ポイント表示）", prog.status === 200 && prog.text.includes("育成ポイント"), "");

  // 7. スカッド連携バナー（My Team → スカッドで使用）
  // Stage 4: スカッド一覧はアカウント別スコープ解決が終わるまでローディングシェルだけを返すため、
  // 案内バナーはSSR本文には出ない(クライアント側でスコープ解決後に描画される)。
  // クラッシュしないことと、文言が辞書に残っていることを確認する。
  const squadCard = await get(`/squads?card=${MESSI}`);
  record("/squads?card=<id>: クラッシュしない", squadCard.status === 200, `HTTP ${squadCard.status}`);
  record("/squads?card=<id>: My Team カードの案内バナー文言は辞書に存在する", jaDict.includes("My Team のカード「{name}」"), "");
  const squadNoCard = await get("/squads");
  record("/squads（card なし）: バナーを出さない・回帰なし", squadNoCard.status === 200 && !squadNoCard.text.includes("My Team のカード（ID"), "");

  // 8. 既存機能の回帰
  const home = await get("/");
  record("回帰: ホーム 200", home.status === 200 && /eFootball Team AI/.test(home.text), "");
  record("回帰: プレイヤー一覧 200 + 詳細リンク", players.status === 200 && /\/players\/world\/\d+/.test(players.body), "");
  const cmp = await get(`/compare?ids=${MESSI},${CANNAVARO}`);
  record("回帰: 比較 /compare 2人 200 + 26能力値", cmp.status === 200 && cmp.text.includes("能力値（26項目）"), "");
  record("回帰: World 選手詳細 200 + 育成タブ", detail.status === 200 && detail.text.includes("育成ポイント"), "");
  const mgrList = await get("/managers");
  record("回帰: 監督一覧 200", mgrList.status === 200 && /名の監督/.test(mgrList.text), "");
  const search = await json(`/api/world/players?q=${encodeURIComponent("メッシ")}&pageSize=20`);
  record("回帰: 選手検索API 到達・件数あり", search.status === 200 && search.data?.totalCount > 0, `total=${search.data?.totalCount}`);
  const one = await json(`/api/world/players/${MESSI}`);
  record("回帰: 選手詳細API 26能力値", one.status === 200 && one.data?.player?.stats?.length === 26, "");

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-favorites] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# お気に入り / My Team 基盤 ブラックボックステスト結果",
    "",
    `実行日時: ${new Date().toISOString()}`,
    `対象: ${BASE}（localhost のみ）  外部アクセス: **0 回**`,
    "",
    "注: お気に入り / My Team は localStorage 保存のため、SSR では「空状態シェル」までを検証。",
    "追加/解除/重複防止/同名別カード/タグ/メモ/ビルド関連付け/お気に入りと My Team の独立性の操作は",
    "src/lib/user-cards/user-cards.test.ts（vitest 28件）で担保。",
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
  console.log(`[black-box-favorites] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
