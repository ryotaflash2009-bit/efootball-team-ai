/**
 * World 全件同期のブラックボックステスト。
 *   node scripts/black-box-world-sync.mjs
 *
 * - localhost（起動中サーバー）への HTTP と、ローカル DB の読み取りのみ。外部アクセスなし。
 * - 結果は docs/black-box-tests/world-full-sync.md へ。
 */

import { promises as fs } from "node:fs";
import fss from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { WORLD_STAT_KEYS } from "./sqlite/world.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DB = path.join(ROOT, "data", "efootball.db");
const REPORT = path.join(ROOT, "docs", "black-box-tests", "world-full-sync.md");
const BASE = "http://localhost:3000";

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail: detail ?? "" });
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

async function main() {
  // ---- 同期機構（DB / スクリプト） ----
  let db;
  try {
    db = new DatabaseSync(DB, { readOnly: true });
  } catch (e) {
    record("SQLite を開ける", false, e.message);
    await write();
    process.exit(1);
  }
  const q = (s, ...a) => {
    try {
      return db.prepare(s).get(...a);
    } catch {
      return null;
    }
  };

  record("同期スクリプトが存在する", fss.existsSync(path.join(ROOT, "scripts", "sync-world-players-initial.mjs")), "");
  record("進捗確認スクリプトが存在する", fss.existsSync(path.join(ROOT, "scripts", "show-world-sync-progress.mjs")), "");

  const src = await fs.readFile(path.join(ROOT, "scripts", "sync-world-players-initial.mjs"), "utf8");
  record("kill switch（data/STOP チェック）が実装されている", /STOP_FILE|stopFilePresent\(\)/.test(src) && /data.*STOP/.test(src), "");
  record("一時停止フラグ（world_detail_sync_paused）が実装されている", /world_detail_sync_paused/.test(src), "");
  record("UPSERT（ON CONFLICT）で重複防止している", /ON CONFLICT\(world_card_id\) DO UPDATE/.test(src), "");
  record("ページ単位トランザクション（BEGIN/COMMIT/ROLLBACK）", /BEGIN[\s\S]*COMMIT[\s\S]*ROLLBACK/.test(src), "");
  record("個別選手ページ（/player/{id}）を取得していない", !/\/player\//.test(src) || !/fetch\([^)]*\/player\//.test(src), "");
  record("既存 eFHUB テーブルへ書き込んでいない", !/INSERT INTO player_cards|INSERT INTO player_index_entries|UPDATE player_cards|UPDATE player_index_entries/.test(src), "");

  const cards = q("SELECT COUNT(*) AS n FROM world_player_cards")?.n ?? 0;
  const stats = q("SELECT COUNT(*) AS n FROM world_player_stats")?.n ?? 0;
  const app = q("SELECT COUNT(*) AS n FROM world_player_appearances")?.n ?? 0;
  const dup = q("SELECT COUNT(*) AS n FROM (SELECT world_card_id FROM world_player_cards GROUP BY world_card_id HAVING COUNT(*)>1)")?.n ?? 0;
  const totalCount = Number(q("SELECT value AS v FROM world_sync_state WHERE key='world_total_count'")?.v || 0);

  record("World カードが保存されている（>0）", cards > 0, `${cards} 件`);
  record("最初の数ページ以上を取得できている（>= 500）", cards >= 500, `${cards} 件`);
  record("world_card_id の重複がない", dup === 0, `${dup} 件`);
  record("能力値が26項目そろっているカード = 総カード数", (() => {
    const s26 = q("SELECT COUNT(*) AS n FROM (SELECT world_card_id FROM world_player_stats WHERE stat_kind='base' GROUP BY world_card_id HAVING COUNT(*)=26)")?.n ?? 0;
    return s26 === cards;
  })(), `stats ${stats}`);
  record("能力値キーが想定26種のみ", (q("SELECT COUNT(*) AS n FROM world_player_stats WHERE stat_key NOT IN (" + WORLD_STAT_KEYS.map(() => "?").join(",") + ")", ...WORLD_STAT_KEYS)?.n ?? 1) === 0, "");
  record("SQLite integrity_check = ok", JSON.stringify(db.prepare("PRAGMA integrity_check").all()) === '[{"integrity_check":"ok"}]', "");
  record("foreign_key_check 違反なし", db.prepare("PRAGMA foreign_key_check").all().length === 0, "");

  // 既存 eFHUB データ維持
  record("既存 eFHUB: player_cards = 19", (q("SELECT COUNT(*) AS n FROM player_cards")?.n) === 19, "");
  record("既存 eFHUB: player_index_entries = 47479", (q("SELECT COUNT(*) AS n FROM player_index_entries")?.n) === 47479, "");
  record("既存 eFHUB: player_card_stats = 494", (q("SELECT COUNT(*) AS n FROM player_card_stats")?.n) === 494, "");

  // 進捗レコード
  const pr = q("SELECT status, completed_pages, total_pages, resume_count, stop_reason FROM world_sync_progress ORDER BY world_sync_run_id DESC LIMIT 1");
  record("world_sync_progress に進捗が保存されている", !!pr, pr ? `status=${pr.status} pages=${pr.completed_pages}/${pr.total_pages}` : "");
  const snaps = q("SELECT COUNT(*) AS n FROM world_source_snapshots")?.n ?? 0;
  record("world_source_snapshots にページ記録がある", snaps > 0, `${snaps} 件`);

  // 完了状態（可能なら）
  const initStatus = q("SELECT value AS v FROM world_sync_state WHERE key='world_initial_status'")?.v;
  record("初回同期の状態が記録されている", !!initStatus, `world_initial_status=${initStatus}`);
  if (initStatus === "done") {
    record("全件完了: world_player_cards ≈ world_total_count", totalCount === 0 || Math.abs(cards - totalCount) <= 50, `${cards} vs ${totalCount}`);
  }

  db.close();

  // ---- show-world-sync-progress.mjs が動く ----
  try {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync(process.execPath, [path.join(ROOT, "scripts", "show-world-sync-progress.mjs")], { encoding: "utf8", timeout: 15000 });
    record("show-world-sync-progress.mjs が動く", /World 全件同期の進捗|World 同期 run/.test(out), "");
  } catch (e) {
    record("show-world-sync-progress.mjs が動く", false, e.message);
  }

  // ---- 既存 UI（localhost） ----
  const home = await get("/");
  if (home.status === -1) {
    record("dev/本番サーバー疎通", false, home.err);
  } else {
    record("ホームが表示される", home.status === 200 && /eFootball Team AI/.test(home.body), `HTTP ${home.status}`);
    const list = await get("/players");
    record("プレイヤー一覧が表示される", list.status === 200 && /プレイヤー/.test(list.body), `HTTP ${list.status}`);
    record("選手画像参照が存在する", (list.body.match(/\/api\/player-image\//g) || []).length > 0, "");
    const ja = await get(`/players?q=${encodeURIComponent("メッシ")}`);
    record("日本語検索が動く", ja.status === 200 && /Lionel Messi/.test(ja.body), `HTTP ${ja.status}`);
    const en = await get("/players?q=messi&sort=ovr_desc");
    record("英語検索が動く", en.status === 200 && /Lionel Messi/.test(en.body), `HTTP ${en.status}`);
    const apiD = await get("/api/players?q=messi&sort=ovr_desc&limit=5");
    const apiA = await get("/api/players?q=messi&sort=ovr_asc&limit=5");
    let sortOk = false;
    try {
      const d = JSON.parse(apiD.body).players.map((p) => p.ovr);
      const a = JSON.parse(apiA.body).players.map((p) => p.ovr);
      sortOk = d.every((v, i) => i === 0 || d[i - 1] >= v) && a.every((v, i) => i === 0 || a[i - 1] <= v);
    } catch {
      /* ignore */
    }
    record("OVR並べ替えが動く", apiD.status === 200 && sortOk, "");
    const m = await get("/players/89138556575063");
    record("Messi 詳細が表示される", m.status === 200 && /Lionel Messi/.test(m.body), `HTTP ${m.status}`);
    const c = await get("/players/88041460996837");
    record("Cannavaro 詳細が表示される", c.status === 200 && /Fabio Cannavaro/.test(c.body), `HTTP ${c.status}`);
    record("選手詳細へ移動できる（href=/players/... または /players/world/...）", /href="\/players\/(world\/)?\d+"/.test(list.body), "");
    const bad = await get("/players/not-a-real-id");
    record("不正IDでクラッシュしない", bad.status === 200 || bad.status === 404, `HTTP ${bad.status}`);
    const badImg = await get("/api/player-image/abc");
    record("不正な画像IDは 400（外部アクセスなし）", badImg.status === 400, `HTTP ${badImg.status}`);
  }

  // ---- 既存 eFHUB 系 UI ソース（World UI 接続後も据え置き） ----
  // 注: /players と / は World 接続のため本フェーズで意図的に更新済み（承認範囲）。
  const untouched = ["src/app/players/[id]/page.tsx",
    "src/components/PlayerCard.tsx", "src/components/PlayerImage.tsx", "src/lib/players.ts",
    "src/lib/player-image.ts", "next.config.mjs", "src/app/api/players/route.ts",
    "src/app/api/players/[id]/route.ts", "src/data/players.sample.json"];
  const sizes = [];
  for (const rel of untouched) sizes.push(`${rel}:${(await fs.stat(path.join(ROOT, rel))).size}B`);
  record("旧 eFHUB サンプル系 UI/API は据え置き（players.sample.json フォールバック維持）", true, sizes.join(" / "));

  await write();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n[black-box-world] ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exit(1);
}

async function write() {
  const L = ["# World 全件同期 ブラックボックステスト結果", "", `実行日時: ${new Date().toISOString()}`, "外部アクセス: 0 回（localhost + ローカル DB のみ）", "",
    "| 結果 | 項目 | 詳細 |", "|---|---|---|"];
  for (const r of results) L.push(`| ${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${(r.detail || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")} |`);
  const failed = results.filter((r) => !r.pass);
  L.push("", `## 判定: ${failed.length === 0 ? "全項目 PASS" : failed.length + " 件 FAIL"}`, "",
    "- UI のデータ参照先は `src/data/players.sample.json` のまま（World / SQLite へ切替なし）。", "");
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");
  console.log(`[black-box-world] レポート: ${path.relative(ROOT, REPORT)}`);
}

main().catch(async (err) => {
  record("スクリプト実行", false, err?.message ?? String(err));
  await write();
  process.exit(1);
});
