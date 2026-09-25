/**
 * 選手ブースター（調査結果 + 選択式計算）のブラックボックステスト。
 *   npm run build && npm run start  の後に
 *   node scripts/black-box-boosters.mjs
 *
 * - localhost への HTTP のみ。**外部アクセス 0 回**。
 * - 検証の柱:
 *   (1) カード付属の数値ID（World boost1/boost2）は効果を自動適用しない（±0 + 「効果未確認」）
 *   (2) 選択式ブースターの UI が 育成 / 比較 に SSR される
 *   (3) 確認済み / 検証中 の区別が表示される
 *   (4) 既存ビルド・スカッドの保存形式が壊れない（回帰）
 * - 結果は docs/black-box-tests/boosters.md へ。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLegacySampleDetail } from "./lib/legacy-sample-detail.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "boosters.md");
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
  // Messi BIGTIME 89138556575063: 付属 = Accuracy +4 / Ball Protection +3（名称解決・効果は検証中）
  const messiWorld = "89138556575063";
  const prog = await get(`/players/world/${messiWorld}`);
  const b = prog.body;

  // 1. カード付属ブースター（自動）— Messi 89138556575063 = Accuracy+4 / Ball Protection+3（external_cross_verified）
  record("育成: 「選手ブースター」セクションがある", b.includes("選手ブースター"), "");
  record("育成: カード付属（B1）と追加ブースター（B2）をUIで分離（見出し・2026-09-05 B2標準統合で名称変更）", b.includes("カード付属ブースター（カードに収録・自動）") && b.includes("追加ブースター（B2・手動選択）"), "");
  record("育成: 付属ブースターの名称を解決して表示（Accuracy / Ball Protection）", b.includes("Accuracy") && b.includes("Ball Protection"), "");
  record("育成: 外部照合済みの付属は「外部照合済み（KONAMI 公式未確認）」バッジ", b.includes("外部照合済み（KONAMI 公式未確認）"), "");
  record("育成: 「現在モードで適用中」/「通常値へ未適用」の表示", b.includes("現在モードで適用中") || b.includes("通常値へ未適用"), "");
  record("育成: 解決段階を表示（① 数値IDのみ / ④外部2ソース整合 / ⑤スクリーンショット実測）", b.includes("解決段階"), "");
  record("育成: eFootball World を外部コミュニティDBと明記（公式サイトと呼ばない）", b.includes("外部コミュニティDB") && !/eFootball 公式サイト|ゲーム公式サイト|公式ページの計算結果/.test(b), "");
  record("育成: 未確認から架空の上昇量を生成しない旨の注記", b.includes("架空の上昇量は生成しません"), "");

  // 2. 適用モード（厳密/標準/実験）
  record("育成: 3モード（厳密/標準（既定）/実験）を表示", b.includes("厳密モード") && b.includes("標準モード（既定）") && b.includes("実験モード"), "");
  record("育成: 標準モードは KONAMI 公式の計算結果ではない旨", b.includes("KONAMI 公式の計算結果として確認された値ではありません"), "");
  record("育成: 確認済みB2の追加ブースター欄は実験モード不要でSSRに出る（2026-09-05 B2標準統合）", b.includes("の追加ブースター（B2）を指定"), "");
  record("育成: 旧「試算ブースターを指定」の文言は使わない（B2標準統合で名称変更）", !b.includes("試算ブースターを指定"), "");
  record("育成: 実験モードの切替に警告（ゲーム内の正式値ではありません）", b.includes("ゲーム内の正式値ではありません"), "");
  record("育成: 手動試算は通常の最終値・比較の順位・チーム集計に含めない旨", b.includes("通常の最終値・比較の順位・チーム集計は変えません"), "");

  // 3. 能力値比較テーブル（標準最終 + 試算列は実験モード時のみ）
  record("育成: 能力値比較テーブルの見出し（基礎/育成/選手B/監督/標準最終）", ["基礎", "育成", "選手B", "監督", "標準最終"].every((h) => b.includes(h)), "");
  record("育成: 標準最終の説明（スクリーンショット実測 + 外部2ソース整合）", b.includes("スクリーンショット実測") && b.includes("外部2ソースで整合"), "");
  record("育成: 実験モードOFF時は能力値表に「試算最終」列がSSRに出ない", !/>試算最終<\/th>/.test(b), "");

  // 4. 比較画面
  const cb = (await json("/api/world/players?position=CB&pageSize=1&sort=ovr_max_desc")).data.players[0].worldCardId;
  const cmp = await get(`/compare?ids=${messiWorld},${cb}`);
  record("比較: ブースター適用モードを明示（標準）", cmp.body.includes("ブースター適用モード") && cmp.body.includes("標準"), "");
  record("比較: 付属ブースターの適用可否（外部照合済み（公式未確認）・比較に反映 等）を表示", cmp.body.includes("比較に反映") || cmp.body.includes("比較に不反映"), "");
  record("比較: 26能力値テーブルの脚注（外部2ソース整合・KONAMI 公式未確認）", cmp.body.includes("外部2ソース整合") && cmp.body.includes("KONAMI 公式未確認"), "");

  // 4b. Total Package（v7・power_of_many・全モード未適用）— Osimhen SHOWTIME 106779597991855
  const tp = await get("/players/world/106779597991855");
  const tb = tp.body;
  record("育成TP: Total Package +3 を表示", tp.status === 200 && tb.includes("Total Package"), `HTTP ${tp.status}`);
  record("育成TP: 「金色・可変（Game Plan 依存）」バッジ", tb.includes("金色・可変（Game Plan 依存"), "");
  record("育成TP: 発動条件本文（The Power of Many / Game Plan / 閾値）を表示", tb.includes("The Power of Many") && tb.includes("Game Plan") && tb.includes("20 人以上で +3"), "");
  record("育成TP: 通常値へ未適用（autoApplied=false）", tb.includes("通常値へ未適用"), "");
  record("育成TP: 旧「条件未確認」表記は使わない", !tb.includes("条件未確認"), "");
  // 4c. 手動段階指定コントロール（Power of Many）
  record("育成TP: 「適用段階を指定」ボタンをタップ操作可能に表示", tb.includes("適用段階を指定"), "");
  record("育成TP: World ブースターID と現在値（未指定）を表示", tb.includes("World ブースターID") && tb.includes("未指定（能力値へ未適用）"), "");
  record("育成TP: 未選択時の文言（自動判定できないため未適用）", tb.includes("対象リーグ人数を自動判定できない"), "");
  record("育成TP: 自動判定済みと誤表示しない", !/自動判定済み|条件達成確認済み|Game Plan との一致確認済み|公式現在値/.test(tb), "");

  // 4d. Messi 89138556575063: Accuracy(青・固定) + Ball Protection(金・可変・v7)
  const messi = await get("/players/world/89138556575063");
  const mb = messi.body;
  record("育成Messi: 200", messi.status === 200, `HTTP ${messi.status}`);
  record("育成Messi: Accuracy と Ball Protection の両方を表示", mb.includes("Accuracy") && mb.includes("Ball Protection"), "");
  record("育成Messi: Ball Protection は「金色・可変」・段階指定コントロールを表示", mb.includes("金色・可変") && mb.includes("適用段階を指定"), "");
  record("育成Messi: Accuracy 側には人数条件UIを出さない（金色バッジは1個のみ想定）", (mb.match(/金色・可変（Game Plan 依存・未適用）/g) || []).length <= 1, "");
  record("育成Messi: Accuracy は標準へ反映（外部照合済みバッジ・適用中）", mb.includes("外部照合済み（KONAMI 公式未確認）"), "");

  // 4e. v8 / v8.1: 発動方式の証拠（activationEvidence）— fixed の大半は「推定」・PoM は証拠明記・適用ポリシー文言の整合
  record("育成Messi(v8.1): Accuracy は「固定型・推定」と表示（confirmed fixed とは言わない）", mb.includes("固定型・推定") && !mb.includes("固定確認済み") && !mb.includes("固定型として確認済み"), "");
  record("育成Messi(v8): 計算根拠に「発動方式:」の行がある", mb.includes("発動方式:"), "");
  record("育成Messi(v8): fixed 推定の説明（ScoreBar 差分では区別できない旨）", mb.includes("ScoreBar 差分だけでは") || mb.includes("固定と推定"), "");
  record("育成Messi(v8): Ball Protection の発動方式証拠は「ユーザー提供の画面で確認」", mb.includes("Power of Many（金色・Game Plan 依存）／ 証拠: ユーザー提供の画面で確認"), "");
  record("育成Messi(v8): Live Update を勝手に割り当てない", !mb.includes("Live Update 連動") || !mb.includes("方式: live_update"), "");
  record("育成Messi(v8): 標準自動適用は維持（Accuracy は「現在モードで適用中」）", mb.includes("現在モードで適用中"), "");
  record("育成Messi(v8.1): 標準モード説明が「外部照合済み・固定型推定を含む」の意味", mb.includes("外部照合済み・固定型推定を含む") || mb.includes("固定型と推定して暫定適用"), "");
  record("育成Messi(v8.1): 標準モード説明で「発動方式は問いません」を明示", mb.includes("発動方式は問いません"), "");
  const tpv8 = await get("/players/world/106779597991855"); // Osimhen（Total Package）
  record("育成TP(v8): Total Package の発動方式証拠は「KONAMI 公式で明記」", tpv8.body.includes("KONAMI 公式で明記"), "");

  // 条件段階を URL/クエリ経由で反映（比較は tp= パラメータ）
  const tpCmp = await get("/compare?ids=106779597991855,106757586204383&tp=3,");
  record("比較TP: tp= クエリで 200・クラッシュしない", tpCmp.status === 200, `HTTP ${tpCmp.status}`);
  record("比較TP: ユーザー指定条件を含む比較の切替を表示", tpCmp.body.includes("ユーザー指定条件を含む比較"), "");
  record("比較TP: 既定の順位に手動段階を含めない旨", tpCmp.body.includes("既定の順位に Total Package の手動段階は含めません"), "");
  // 非 PoM カードには段階指定コントロールを出さない
  const nonTp = await get("/players/world/106799730641209"); // Bruno（Balancer のみ・青・固定）
  record("育成: 金色ブースターを持たないカードに段階指定コントロールを出さない", !nonTp.body.includes("金色・可変（Game Plan 依存"), "");

  // 5. スカッド画面：クラッシュしない（スロット選択後の UI はクライアント操作）
  const sq = await get("/squads/sq_boosterbb0001");
  record("スカッド: 200 で描画（ブースター統合でクラッシュしない）", sq.status === 200, `HTTP ${sq.status}`);

  // 6. 回帰：他カードの育成タブでブースター領域が原因で 500 にならない
  for (const [label, q] of [["CF", "position=CF"], ["GK", "position=GK"], ["CB", "position=CB"]]) {
    const id = (await json(`/api/world/players?${q}&pageSize=1&sort=ovr_max_desc`)).data.players[0].worldCardId;
    const r = await get(`/players/world/${id}`);
    record(`回帰: ${label} カードの育成タブ 200 + 選手ブースター領域を描画`, r.status === 200 && r.body.includes("選手ブースター"), `HTTP ${r.status}`);
  }

  // 7. 回帰：World / eFHUB 詳細 API の形が変わっていない
  const wd = await json(`/api/world/players/${messiWorld}`);
  record("回帰: World 詳細 API 200 + stats 26件", wd.status === 200 && (wd.data?.player?.stats?.length ?? 0) === 26, `n=${wd.data?.player?.stats?.length}`);
  for (const legacy of await checkLegacySampleDetail(BASE)) record(legacy.name, legacy.pass, legacy.detail);

  // 8. 内部情報を露出しない
  record("露出なし: 本文に SQL / db パスなし", !/efootball\.db|SELECT \*|C:\\\\Users/i.test(b + cmp.body), "");

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-boosters] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const failed = results.filter((r) => !r.pass);
  const L = [
    "# 選手ブースター ブラックボックステスト結果",
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
  console.log(`[black-box-boosters] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
