/**
 * eFootball World 同期の進捗を表示する（読み取り専用）。
 *
 *   node scripts/show-world-sync-progress.mjs
 *
 * - 外部アクセスなし。SQLite への書き込みなし。同期の停止なし。ファイル削除なし。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DB = path.join(ROOT, "data", "efootball.db");

let db;
try {
  db = new DatabaseSync(DB, { readOnly: true });
} catch (e) {
  console.log("DB を開けません:", e.message);
  process.exit(1);
}

const one = (s, ...a) => {
  try {
    return db.prepare(s).get(...a);
  } catch {
    return null;
  }
};
const all = (s, ...a) => {
  try {
    return db.prepare(s).all(...a);
  } catch {
    return [];
  }
};

const run = one("SELECT id, kind, started_at, finished_at, status FROM world_sync_runs ORDER BY id DESC LIMIT 1");
if (!run) {
  console.log("World 同期 run はまだありません。");
  process.exit(0);
}
const pr = one("SELECT * FROM world_sync_progress WHERE world_sync_run_id=?", run.id) || {};
const state = Object.fromEntries(all("SELECT key, value FROM world_sync_state").map((r) => [r.key, r.value]));
const cards = one("SELECT COUNT(*) AS n FROM world_player_cards")?.n ?? 0;
const errs = all("SELECT page, http_status, error FROM world_sync_errors WHERE run_id=? ORDER BY id DESC LIMIT 8", run.id);
const errTotal = one("SELECT COUNT(*) AS n FROM world_sync_errors WHERE run_id=?", run.id)?.n ?? 0;

console.log("【eFootball World 全件同期の進捗（読み取り専用）】");
console.log(`  run #${run.id} (${run.kind})  状態: ${run.status}`);
console.log(`  開始: ${pr.started_at ?? run.started_at}   更新: ${pr.updated_at ?? "-"}   終了: ${pr.finished_at ?? run.finished_at ?? "-"}`);
console.log("");
console.log(`  完了ページ: ${pr.completed_pages ?? "?"} / ${pr.total_pages ?? state.world_total_pages ?? "?"}`);
console.log(`  完了カード: ${cards} / ${pr.total_count ?? state.world_total_count ?? "?"}`);
console.log(`  成功: ${pr.success_count ?? "?"}   失敗: ${pr.failed_count ?? errTotal}   重複: ${pr.duplicate_count ?? "?"}`);
console.log(`  残りページ: ${pr.remaining_pages ?? "?"}   残りカード: ${pr.remaining_cards ?? "?"}   完了率: ${pr.progress_percent ?? "?"}%`);
console.log("");
const elapsed = pr.started_at ? ((Date.parse(pr.updated_at ?? new Date().toISOString()) - Date.parse(pr.started_at)) / 1000).toFixed(0) : "?";
console.log(`  経過時間: ${elapsed}s`);
console.log(`  平均応答: ${pr.average_response_ms ?? "?"}ms   平均保存: ${pr.average_save_ms ?? "?"}ms   間隔: ${pr.request_interval_ms ?? "?"}ms`);
console.log(`  現在の処理速度: ${pr.current_rate_per_minute ?? "?"} cards/min`);
console.log(`  推定残り時間: ${pr.estimated_remaining_seconds ?? "?"}s   推定完了日時: ${pr.estimated_completion_at ?? "?"}`);
console.log("");
console.log(`  最後に完了したページ: ${pr.last_completed_page ?? state.world_page_cursor ?? "?"}`);
console.log(`  次に取得するページ: ${pr.next_page ?? (state.world_page_cursor ? Number(state.world_page_cursor) + 1 : "?")}`);
console.log("");
console.log(`  HTTP 429: ${pr.http_429_count ?? 0}   403: ${pr.http_403_count ?? 0}   5xx: ${pr.http_5xx_count ?? 0}   timeout: ${pr.timeout_count ?? 0}`);
console.log(`  連続失敗: ${pr.consecutive_failure_count ?? 0}   再開回数: ${pr.resume_count ?? state.world_resume_count ?? 0}`);
console.log(`  停止理由: ${pr.stop_reason ?? "-"}`);
console.log(`  kill switch: data/STOP=${state.__stop ?? "(未確認)"}  paused=${state.world_detail_sync_paused ?? "false"}`);
if (errTotal > 0) {
  console.log(`\n  直近のエラー（全 ${errTotal} 件中 最新8件）:`);
  for (const e of errs) console.log(`   - page ${e.page ?? "-"} / HTTP ${e.http_status ?? "-"} / ${e.error}`);
}

db.close();
