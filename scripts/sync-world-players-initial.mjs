/**
 * eFootball World 初回全件同期。
 * players/search（POST・size 500）を page 1..27 で取得し、World 専用テーブルへ UPSERT する。
 * 個別選手ページ（13,009件）へはアクセスしない。
 *
 *   node scripts/sync-world-players-initial.mjs [--max-pages N] [--force]
 *
 * - 外部アクセスは players/search のみ。最大 27（+新規確認1 = 28）。
 * - GET/POST 以外なし。同時1。間隔 3000ms 開始・下限 2000ms・上限 10000ms。各20秒。
 *   5xx/ネットワーク障害のみ最大2回再試行（5s, 15s）。429/403/CAPTCHA/ログインは即停止。
 * - Cookie/Authorization/APIキー不使用。UA 偽装なし。リダイレクト非追跡。
 * - ページ単位トランザクション。検証成功後 COMMIT。失敗は ROLLBACK + world_sync_errors。
 * - world_card_id 主キー・UPSERT。再実行で二重登録なし。中断は world_page_cursor から再開。
 * - kill switch: ./data/STOP または world_sync_state['world_detail_sync_paused']='true'。
 * - 既存 eFHUB データ（player_cards 19 / player_index_entries 47,479）に一切書き込まない。
 */

import { promises as fs } from "node:fs";
import fss from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, DB_PATH } from "./sqlite/db.mjs";
import {
  WORLD_SEARCH_URL, WORLD_UA, WORLD_HOST, WORLD_PAGE_SIZE, WORLD_TIMEOUT_MS,
  WORLD_STAT_KEYS, sha256, looksSensitive, normalizeWorldPlayer, seedWorldReference,
} from "./sqlite/world.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const STOP_FILE = path.join(ROOT, "data", "STOP");
const RESULT_REPORT = path.join(ROOT, "docs", "phase-world-full-sync-result.md");

const argv = process.argv.slice(2);
const MAX_PAGES_THIS_RUN = (() => {
  const i = argv.indexOf("--max-pages");
  return i >= 0 ? Math.max(1, parseInt(argv[i + 1], 10) || 0) : Infinity;
})();
const FORCE = argv.includes("--force");

const INTERVAL_START = 3000;
const INTERVAL_MIN = 2000;
const INTERVAL_MAX = 10000;
const ACCEL_STEPS = [3000, 2500, 2000];
const DECEL_STEPS = [2000, 3000, 5000, 10000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

function stopFilePresent() {
  try {
    return fss.existsSync(STOP_FILE);
  } catch {
    return false;
  }
}

// ---- state ----
let db;
let runId;
let interval = INTERVAL_START;
let consecutiveClean = 0;
let lastReqAt = 0;

const metrics = {
  startedAt: nowIso(),
  totalCount: 0,
  totalPages: 0,
  completedPages: 0,
  completedCards: 0,
  successCount: 0,
  failedCount: 0,
  duplicateCount: 0,
  requestCount: 0,
  http429: 0,
  http403: 0,
  http5xx: 0,
  timeoutCount: 0,
  consecutiveFailure: 0,
  responseMs: [],
  saveMs: [],
  resumeCount: 0,
  stopReason: null,
};

function getState(key) {
  const r = db.prepare("SELECT value FROM world_sync_state WHERE key=?").get(key);
  return r ? r.value : null;
}
function setState(key, value) {
  db.prepare(
    "INSERT INTO world_sync_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
  ).run(key, value == null ? null : String(value), nowIso());
}

const PC_GUARD = ["player_cards", "player_index_entries"];
function efhubCounts() {
  const o = {};
  for (const t of PC_GUARD) o[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  return o;
}

function finishRun(status) {
  db.prepare("UPDATE world_sync_runs SET finished_at=?, status=?, cursor=?, ok_count=?, fail_count=? WHERE id=?")
    .run(nowIso(), status, String(metrics.completedPages), metrics.successCount, metrics.failedCount, runId);
}

function recordError(page, cardId, httpStatus, error, attempt) {
  db.prepare("INSERT INTO world_sync_errors (run_id, page, world_card_id, http_status, error, attempt, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(runId, page ?? null, cardId ?? null, httpStatus ?? null, String(error).slice(0, 500), attempt ?? 0, nowIso());
}

function avg(a) {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

function saveProgress() {
  const remainingPages = Math.max(0, metrics.totalPages - metrics.completedPages);
  const remainingCards = Math.max(0, metrics.totalCount - metrics.completedCards);
  const avgResp = avg(metrics.responseMs);
  const avgSave = avg(metrics.saveMs);
  const perPageMs = avgResp + avgSave + interval;
  const etaSec = metrics.completedPages >= 1 ? (remainingPages * perPageMs) / 1000 : null;
  const etaAt = etaSec != null ? new Date(Date.now() + etaSec * 1000).toISOString() : null;
  const ratePerMin = perPageMs > 0 ? (WORLD_PAGE_SIZE * 60000) / perPageMs : null;
  const cursor = Number(getState("world_page_cursor") || 0);
  db.prepare(`INSERT INTO world_sync_progress
    (world_sync_run_id, status, started_at, updated_at, finished_at, total_count, total_pages,
     completed_pages, completed_cards, success_count, failed_count, duplicate_count,
     remaining_pages, remaining_cards, progress_percent, current_page, page_cursor,
     last_completed_page, next_page, request_interval_ms, average_response_ms, average_save_ms,
     current_rate_per_minute, estimated_remaining_seconds, estimated_completion_at, request_count,
     http_429_count, http_403_count, http_5xx_count, timeout_count, consecutive_failure_count,
     stop_reason, resume_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(world_sync_run_id) DO UPDATE SET
      status=excluded.status, updated_at=excluded.updated_at, finished_at=excluded.finished_at,
      completed_pages=excluded.completed_pages, completed_cards=excluded.completed_cards,
      success_count=excluded.success_count, failed_count=excluded.failed_count,
      duplicate_count=excluded.duplicate_count, remaining_pages=excluded.remaining_pages,
      remaining_cards=excluded.remaining_cards, progress_percent=excluded.progress_percent,
      current_page=excluded.current_page, page_cursor=excluded.page_cursor,
      last_completed_page=excluded.last_completed_page, next_page=excluded.next_page,
      request_interval_ms=excluded.request_interval_ms, average_response_ms=excluded.average_response_ms,
      average_save_ms=excluded.average_save_ms, current_rate_per_minute=excluded.current_rate_per_minute,
      estimated_remaining_seconds=excluded.estimated_remaining_seconds,
      estimated_completion_at=excluded.estimated_completion_at, request_count=excluded.request_count,
      http_429_count=excluded.http_429_count, http_403_count=excluded.http_403_count,
      http_5xx_count=excluded.http_5xx_count, timeout_count=excluded.timeout_count,
      consecutive_failure_count=excluded.consecutive_failure_count, stop_reason=excluded.stop_reason,
      resume_count=excluded.resume_count`).run(
    runId,
    metrics.stopReason ? "stopped" : metrics.completedPages >= metrics.totalPages && metrics.totalPages > 0 ? "done" : "running",
    metrics.startedAt, nowIso(), metrics.completedPages >= metrics.totalPages && metrics.totalPages > 0 ? nowIso() : null,
    metrics.totalCount, metrics.totalPages, metrics.completedPages, metrics.completedCards,
    metrics.successCount, metrics.failedCount, metrics.duplicateCount, remainingPages, remainingCards,
    metrics.totalPages ? Math.round((metrics.completedPages / metrics.totalPages) * 1000) / 10 : 0,
    cursor + 1 <= metrics.totalPages ? cursor + 1 : cursor, cursor, cursor, cursor + 1,
    interval, Math.round(avgResp), Math.round(avgSave), ratePerMin ? Math.round(ratePerMin) : null,
    etaSec != null ? Math.round(etaSec) : null, etaAt, metrics.requestCount,
    metrics.http429, metrics.http403, metrics.http5xx, metrics.timeoutCount, metrics.consecutiveFailure,
    metrics.stopReason, metrics.resumeCount,
  );
}

function printProgress(tag) {
  const remainingPages = Math.max(0, metrics.totalPages - metrics.completedPages);
  const remainingCards = Math.max(0, metrics.totalCount - metrics.completedCards);
  const elapsed = ((Date.now() - Date.parse(metrics.startedAt)) / 1000).toFixed(0);
  const avgResp = Math.round(avg(metrics.responseMs));
  const avgSave = Math.round(avg(metrics.saveMs));
  const perPageMs = avgResp + avgSave + interval;
  const etaSec = metrics.completedPages >= 1 ? Math.round((remainingPages * perPageMs) / 1000) : null;
  const ratePerMin = perPageMs > 0 ? Math.round((WORLD_PAGE_SIZE * 60000) / perPageMs) : null;
  console.log(`\n【eFootball World 全件同期の進捗】${tag ? " " + tag : ""}`);
  console.log(`  現在時刻: ${nowIso()}  開始: ${metrics.startedAt}  経過: ${elapsed}s`);
  console.log(`  完了ページ: ${metrics.completedPages}/${metrics.totalPages}   完了カード: ${metrics.completedCards}/${metrics.totalCount}`);
  console.log(`  成功: ${metrics.successCount}  失敗: ${metrics.failedCount}  重複: ${metrics.duplicateCount}`);
  console.log(`  残りページ: ${remainingPages}   残りカード: ${remainingCards}   完了率: ${metrics.totalPages ? ((metrics.completedPages / metrics.totalPages) * 100).toFixed(1) : 0}%`);
  console.log(`  平均応答: ${avgResp}ms   平均保存: ${avgSave}ms   間隔: ${interval}ms   速度: ${ratePerMin ?? "-"} cards/min`);
  console.log(`  推定残り: ${etaSec != null ? etaSec + "s" : "-"}   推定完了: ${etaSec != null ? new Date(Date.now() + etaSec * 1000).toISOString() : "-"}`);
  console.log(`  最後に完了したページ: ${metrics.completedPages}   次に取得するページ: ${metrics.completedPages + 1}`);
  console.log(`  HTTP 429: ${metrics.http429}  403: ${metrics.http403}  5xx: ${metrics.http5xx}  timeout: ${metrics.timeoutCount}  連続失敗: ${metrics.consecutiveFailure}`);
  console.log(`  同期状態: ${metrics.stopReason ? "stopped (" + metrics.stopReason + ")" : "running"}`);
}

async function fetchPage(page, attempt = 0) {
  // レート制御
  const wait = interval - (Date.now() - lastReqAt);
  if (wait > 0) await sleep(wait);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), WORLD_TIMEOUT_MS);
  const t0 = Date.now();
  metrics.requestCount++;
  lastReqAt = Date.now();
  let res;
  try {
    res = await fetch(WORLD_SEARCH_URL, {
      method: "POST",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": WORLD_UA, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ page, size: WORLD_PAGE_SIZE, sortBy: "CREATED_AT", sortOrder: "DESC" }),
    });
  } catch (err) {
    clearTimeout(t);
    const isTimeout = err?.name === "AbortError";
    if (isTimeout) metrics.timeoutCount++;
    if (attempt < 2) {
      const backoff = attempt === 0 ? 5000 : 15000;
      console.log(`[world] page ${page} ${isTimeout ? "timeout" : "network error"} → ${backoff}ms 待機して再試行 (${attempt + 1}/2)`);
      recordError(page, null, null, `${isTimeout ? "timeout" : "network"}: ${err?.message ?? err}`, attempt + 1);
      await sleep(backoff);
      return fetchPage(page, attempt + 1);
    }
    recordError(page, null, null, `${isTimeout ? "timeout" : "network"} (retries exhausted): ${err?.message ?? err}`, attempt);
    return { fatal: `page ${page}: ${isTimeout ? "timeout" : "network error"}（再試行上限）` };
  }
  clearTimeout(t);
  const respMs = Date.now() - t0;

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    return { fatal: `page ${page}: リダイレクト ${res.status} → ${loc}（追跡しない）` };
  }
  if (res.status === 429) {
    metrics.http429++;
    return { fatal: `page ${page}: HTTP 429（レート制限）Retry-After: ${res.headers.get("retry-after") ?? "(なし)"}` };
  }
  if (res.status === 403) {
    metrics.http403++;
    return { fatal: `page ${page}: HTTP 403（拒否）` };
  }
  if (res.status === 401) return { fatal: `page ${page}: HTTP 401（認証要求）` };
  if (res.status >= 500) {
    metrics.http5xx++;
    if (attempt < 2) {
      const backoff = attempt === 0 ? 5000 : 15000;
      console.log(`[world] page ${page} HTTP ${res.status} → ${backoff}ms 待機して再試行 (${attempt + 1}/2)`);
      recordError(page, null, res.status, `HTTP ${res.status}`, attempt + 1);
      await sleep(backoff);
      return fetchPage(page, attempt + 1);
    }
    recordError(page, null, res.status, `HTTP ${res.status} (retries exhausted)`, attempt);
    return { fatal: `page ${page}: HTTP ${res.status}（再試行上限）` };
  }
  if (res.status !== 200) return { fatal: `page ${page}: 想定外 HTTP ${res.status}` };

  const raw = await res.text();
  metrics.responseMs.push(respMs);

  const sensitive = looksSensitive(raw + "\n" + [...res.headers.keys()].join(","));
  if (sensitive.length) return { fatal: `page ${page}: レスポンスに個人情報/認証情報の兆候: ${sensitive.join(", ")}（保存せず停止）` };
  if (raw.length > 20_000_000) return { fatal: `page ${page}: レスポンスが想定より著しく大きい ${raw.length} bytes` };

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    recordError(page, null, 200, `JSON parse: ${err?.message ?? err}`, attempt);
    return { fatal: `page ${page}: JSON 解析失敗` };
  }
  const players = Array.isArray(json?.players) ? json.players : null;
  if (!players) return { fatal: `page ${page}: players 配列がない（構造変化の可能性）` };

  return {
    respMs,
    hash: sha256(raw),
    players,
    totalCount: json.totalCount ?? null,
    totalPages: json.totalPages ?? null,
    pageSize: json.pageSize ?? null,
    hasNext: json.hasNext ?? null,
  };
}

// ---- ページ書き込み（1トランザクション） ----
const stmts = {};
function prepareStmts() {
  const pcCols = [
    "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality",
    "region", "league", "team", "ovr_base", "ovr_max", "maximum_level", "card_rating",
    "playing_style", "playing_style_def", "preferred_foot", "age", "height", "weight",
    "image_url", "mobile_image_url", "boost1", "boost2", "likes_count", "view_count",
    "average_rating", "total_ratings", "appearance_updated_at", "source", "source_url",
    "fetched_at", "world_sync_run_id",
  ];
  const ph = pcCols.map(() => "?").join(",");
  const upd = pcCols.slice(1).map((c) => `${c}=excluded.${c}`).join(",");
  stmts.upsertCard = db.prepare(`INSERT INTO world_player_cards (${pcCols.join(",")}) VALUES (${ph})
    ON CONFLICT(world_card_id) DO UPDATE SET ${upd}`);
  stmts.delStats = db.prepare("DELETE FROM world_player_stats WHERE world_card_id=?");
  stmts.insStat = db.prepare("INSERT INTO world_player_stats (world_card_id, stat_key, stat_kind, value) VALUES (?, ?, 'base', ?)");
  stmts.delSkills = db.prepare("DELETE FROM world_player_skills WHERE world_card_id=?");
  stmts.insSkill = db.prepare("INSERT INTO world_player_skills (world_card_id, skill_name, display_order) VALUES (?, ?, ?)");
  stmts.delAi = db.prepare("DELETE FROM world_player_ai_styles WHERE world_card_id=?");
  stmts.insAi = db.prepare("INSERT INTO world_player_ai_styles (world_card_id, style_name, display_order) VALUES (?, ?, ?)");
  stmts.delApp = db.prepare("DELETE FROM world_player_appearances WHERE world_card_id=?");
  stmts.insApp = db.prepare(`INSERT INTO world_player_appearances
    (world_card_id, position, leg_coverage_radius, arm_coverage_radius, torso_collision,
     jumping_height, dribble_height, leg_length, ranks_json, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  stmts.snapshot = db.prepare(`INSERT INTO world_source_snapshots
    (world_sync_run_id, page, size, record_count, content_hash, updated_at_min, updated_at_max, fetched_at)
    VALUES (?,?,?,?,?,?,?,?)`);
}

function writePage(page, players, hash) {
  const t0 = Date.now();
  const fetchedAt = nowIso();
  let inserted = 0;
  let dupInPage = 0;
  const seen = new Set();
  const updatedAts = [];

  db.exec("BEGIN");
  try {
    for (const raw of players) {
      const c = normalizeWorldPlayer(raw);
      if (!c.world_card_id || !/^[0-9A-Za-z_-]{1,40}$/.test(c.world_card_id)) {
        recordError(page, c.world_card_id ?? "(null)", 200, "invalid world_card_id", 0);
        continue;
      }
      if (seen.has(c.world_card_id)) {
        dupInPage++;
        continue;
      }
      seen.add(c.world_card_id);
      if (c.appearance_updated_at) updatedAts.push(c.appearance_updated_at);

      stmts.upsertCard.run(
        c.world_card_id, c.name_en, c.name_ja, c.card_type, c.registered_position, c.nationality,
        c.region, c.league, c.team, c.ovr_base, c.ovr_max, c.maximum_level, c.card_rating,
        c.playing_style, c.playing_style_def, c.preferred_foot, c.age, c.height, c.weight,
        c.image_url, c.mobile_image_url, c.boost1, c.boost2, c.likes_count, c.view_count,
        c.average_rating, c.total_ratings, c.appearance_updated_at, "world", WORLD_SEARCH_URL,
        fetchedAt, runId,
      );
      stmts.delStats.run(c.world_card_id);
      for (const k of WORLD_STAT_KEYS) {
        const v = c.stats[k];
        if (typeof v === "number") stmts.insStat.run(c.world_card_id, k, v);
      }
      stmts.delSkills.run(c.world_card_id);
      c.skills.forEach((s, i) => stmts.insSkill.run(c.world_card_id, s, i));
      stmts.delAi.run(c.world_card_id);
      c.aiStyles.forEach((s, i) => stmts.insAi.run(c.world_card_id, s, i));
      stmts.delApp.run(c.world_card_id);
      if (c.appearance) {
        const a = c.appearance;
        stmts.insApp.run(c.world_card_id, a.position, a.leg_coverage_radius, a.arm_coverage_radius,
          a.torso_collision, a.jumping_height, a.dribble_height, a.leg_length, a.ranks_json, a.updated_at);
      }
      inserted++;
    }
    updatedAts.sort();
    stmts.snapshot.run(runId, page, WORLD_PAGE_SIZE, inserted, hash,
      updatedAts[0] ?? null, updatedAts[updatedAts.length - 1] ?? null, fetchedAt);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    recordError(page, null, null, `write: ${err?.message ?? err}`, 0);
    throw err;
  }
  metrics.saveMs.push(Date.now() - t0);
  return { inserted, dupInPage };
}

function quickIntegrityOk() {
  const qc = db.prepare("PRAGMA quick_check(1)").get();
  const val = qc && (qc.quick_check ?? Object.values(qc)[0]);
  return val === "ok";
}

// ---- 速度調整 ----
function onCleanPage() {
  consecutiveClean++;
  metrics.consecutiveFailure = 0;
  const idx = ACCEL_STEPS.indexOf(interval);
  if (consecutiveClean >= 3 && interval === ACCEL_STEPS[0]) interval = ACCEL_STEPS[1];
  else if (consecutiveClean >= 13 && interval === ACCEL_STEPS[1]) interval = ACCEL_STEPS[2];
  void idx;
}
function onProblemPage() {
  consecutiveClean = 0;
  metrics.consecutiveFailure++;
  const i = DECEL_STEPS.indexOf(interval);
  interval = DECEL_STEPS[Math.min((i < 0 ? 0 : i) + 1, DECEL_STEPS.length - 1)];
  interval = Math.min(INTERVAL_MAX, Math.max(INTERVAL_MIN, interval));
}

async function main() {
  db = await openDb();
  seedWorldReference(db);

  const efhubBefore = efhubCounts();
  console.log("[world] 既存 eFHUB データ（事前）:", JSON.stringify(efhubBefore));

  // 総ページ数の把握 & 状態
  const prevStatus = getState("world_initial_status");
  const cursor0 = Number(getState("world_page_cursor") || 0);
  const savedTotalPages = Number(getState("world_total_pages") || 0);
  const savedTotalCount = Number(getState("world_total_count") || 0);

  if (prevStatus === "done" && !FORCE) {
    console.log(`[world] 初回同期は既に完了（world_page_cursor=${cursor0}）。--force で再実行。何もせず終了。`);
    db.close();
    return;
  }

  // run 行（既存の running/stopped を再利用）
  const existingRun = db.prepare("SELECT id FROM world_sync_runs WHERE kind='world-initial' AND status IN ('running','stopped') ORDER BY id DESC LIMIT 1").get();
  if (existingRun) {
    runId = existingRun.id;
    metrics.resumeCount = Number(getState("world_resume_count") || 0) + 1;
    setState("world_resume_count", metrics.resumeCount);
    db.prepare("UPDATE world_sync_runs SET status='running' WHERE id=?").run(runId);
    console.log(`[world] 既存 run #${runId} を再開（resume #${metrics.resumeCount}, page ${cursor0} まで完了済み）`);
  } else {
    const info = db.prepare("INSERT INTO world_sync_runs (kind, started_at, status) VALUES ('world-initial', ?, 'running')").run(metrics.startedAt);
    runId = Number(info.lastInsertRowid);
    console.log(`[world] 新規 run #${runId}`);
  }
  prepareStmts();

  // ---- 開始前の推定 ----
  metrics.totalPages = savedTotalPages || 27;
  metrics.totalCount = savedTotalCount || 13009;
  metrics.completedPages = cursor0;
  metrics.completedCards = db.prepare("SELECT COUNT(*) AS n FROM world_player_cards").get().n;
  const remain = Math.max(0, metrics.totalPages - cursor0);
  console.log("\n【開始前の推定】");
  console.log(`  総件数: ${metrics.totalCount}  総ページ数: ${metrics.totalPages}  page size: ${WORLD_PAGE_SIZE}  最大リクエスト: 27（+新規確認1）`);
  console.log(`  開始時刻: ${nowIso()}  完了済みページ: ${cursor0}  残りページ: ${remain}`);
  console.log(`  最短推定: 約 ${Math.round((remain * (INTERVAL_MIN + 1500)) / 1000)}s`);
  console.log(`  標準推定: 約 ${Math.round((remain * (INTERVAL_START + 2500)) / 1000)}s`);
  console.log(`  最長推定: 約 ${Math.round((remain * (INTERVAL_MAX + 4000)) / 1000)}s`);
  saveProgress();

  let pagesThisRun = 0;

  for (let page = cursor0 + 1; ; page++) {
    // 上限（初回把握前は 27 を仮に使う。把握後は totalPages）
    if (metrics.totalPages && page > metrics.totalPages) break;
    if (metrics.requestCount >= 27) {
      metrics.stopReason = "external request cap (27) reached";
      break;
    }
    if (pagesThisRun >= MAX_PAGES_THIS_RUN) {
      metrics.stopReason = `--max-pages ${MAX_PAGES_THIS_RUN} reached`;
      break;
    }
    if (stopFilePresent()) {
      metrics.stopReason = "STOP file present (before fetch)";
      break;
    }
    if (getState("world_detail_sync_paused") === "true") {
      metrics.stopReason = "world_detail_sync_paused=true (before fetch)";
      break;
    }

    console.log(`[world] page ${page}/${metrics.totalPages}  interval=${interval}ms`);
    const r = await fetchPage(page);

    if (r.fatal) {
      const isRate = /HTTP 429|HTTP 403|401|リダイレクト|認証/.test(r.fatal);
      metrics.stopReason = r.fatal;
      if (!isRate) onProblemPage();
      break;
    }

    // 総ページ数を実値で更新
    if (r.totalPages && r.totalPages !== metrics.totalPages) {
      metrics.totalPages = r.totalPages;
      setState("world_total_pages", r.totalPages);
    }
    if (r.totalCount) {
      metrics.totalCount = r.totalCount;
      setState("world_total_count", r.totalCount);
    }

    // 書き込み
    let w;
    try {
      w = writePage(page, r.players, r.hash);
    } catch (err) {
      metrics.stopReason = `page ${page} 書き込み失敗: ${err?.message ?? err}`;
      onProblemPage();
      break;
    }

    if (!quickIntegrityOk()) {
      metrics.stopReason = `page ${page} 後の SQLite quick_check が ok でない`;
      break;
    }
    const efhubNow = efhubCounts();
    if (JSON.stringify(efhubNow) !== JSON.stringify(efhubBefore)) {
      metrics.stopReason = `既存 eFHUB データ件数が変化: ${JSON.stringify(efhubBefore)} → ${JSON.stringify(efhubNow)}`;
      break;
    }

    metrics.successCount += w.inserted;
    metrics.duplicateCount += w.dupInPage;
    metrics.completedCards = db.prepare("SELECT COUNT(*) AS n FROM world_player_cards").get().n;
    metrics.completedPages = page;
    setState("world_page_cursor", page);
    setState("world_last_snapshot_hash", r.hash);
    pagesThisRun++;
    onCleanPage();

    if (stopFilePresent()) {
      metrics.stopReason = "STOP file present (after page)";
      saveProgress();
      break;
    }

    if (page <= 3 || page % 5 === 0 || Date.now() - Date.parse(metrics.startedAt) > 300000 * (Math.floor((Date.now() - Date.parse(metrics.startedAt)) / 300000) || 1)) {
      saveProgress();
      if (page === 3 || page <= 3 || page % 5 === 0) printProgress(`page ${page} 完了`);
    } else {
      saveProgress();
    }

    if (metrics.completedPages >= metrics.totalPages) break;
  }

  const done = !metrics.stopReason && metrics.completedPages >= metrics.totalPages;
  if (done) {
    setState("world_initial_status", "done");
    metrics.stopReason = null;
    finishRun("done");
  } else {
    setState("world_initial_status", "stopped");
    finishRun("stopped");
  }
  saveProgress();
  printProgress(done ? "全件完了" : "停止");

  // 最終整合性
  const integrity = db.prepare("PRAGMA integrity_check").all();
  const fkc = db.prepare("PRAGMA foreign_key_check").all();
  const dup = db.prepare("SELECT COUNT(*) AS n FROM (SELECT world_card_id FROM world_player_cards GROUP BY world_card_id HAVING COUNT(*)>1)").get().n;
  const counts = {
    world_player_cards: db.prepare("SELECT COUNT(*) AS n FROM world_player_cards").get().n,
    world_player_stats: db.prepare("SELECT COUNT(*) AS n FROM world_player_stats").get().n,
    world_player_skills: db.prepare("SELECT COUNT(*) AS n FROM world_player_skills").get().n,
    world_player_ai_styles: db.prepare("SELECT COUNT(*) AS n FROM world_player_ai_styles").get().n,
    world_player_appearances: db.prepare("SELECT COUNT(*) AS n FROM world_player_appearances").get().n,
    world_source_snapshots: db.prepare("SELECT COUNT(*) AS n FROM world_source_snapshots").get().n,
  };
  const efhubAfter = efhubCounts();

  db.close();

  await writeResultReport({
    done, metrics, counts, integrity, fkc, dup, efhubBefore, efhubAfter,
    dbRel: path.relative(ROOT, DB_PATH),
  });

  console.log(`\n[world] ${done ? "完了" : "停止: " + metrics.stopReason}`);
  console.log(`[world] world_player_cards=${counts.world_player_cards} / stats=${counts.world_player_stats} / 重複=${dup} / integrity=${JSON.stringify(integrity)}`);
  console.log(`[world] 結果レポート: ${path.relative(ROOT, RESULT_REPORT)}`);
  if (!done) process.exitCode = 2;
}

async function writeResultReport(x) {
  const L = [];
  L.push("# eFootball World 全件同期 結果");
  L.push("");
  L.push(`実行: ${x.metrics.startedAt} 〜 ${nowIso()}`);
  L.push(`DB: ${x.dbRel}`);
  L.push(`状態: ${x.done ? "**完了**" : "**停止** — " + x.metrics.stopReason}`);
  L.push("");
  L.push("## 件数");
  L.push("```");
  L.push(JSON.stringify(x.counts, null, 2));
  L.push("```");
  L.push(`- 完了ページ: ${x.metrics.completedPages}/${x.metrics.totalPages} / 完了カード: ${x.metrics.completedCards}/${x.metrics.totalCount}`);
  L.push(`- 成功: ${x.metrics.successCount} / 失敗: ${x.metrics.failedCount} / 重複(ページ内): ${x.metrics.duplicateCount}`);
  L.push(`- world_card_id の重複行: ${x.dup}`);
  L.push("");
  L.push("## リクエスト");
  L.push(`- 総リクエスト数: ${x.metrics.requestCount}`);
  L.push(`- HTTP 429: ${x.metrics.http429} / 403: ${x.metrics.http403} / 5xx: ${x.metrics.http5xx} / timeout: ${x.metrics.timeoutCount}`);
  L.push(`- 平均応答: ${Math.round(avg(x.metrics.responseMs))}ms / 平均保存: ${Math.round(avg(x.metrics.saveMs))}ms / 最終間隔: ${interval}ms`);
  L.push(`- 再開回数: ${x.metrics.resumeCount}`);
  L.push("");
  L.push("## 整合性");
  L.push(`- PRAGMA integrity_check: ${JSON.stringify(x.integrity)}`);
  L.push(`- PRAGMA foreign_key_check 違反: ${x.fkc.length}`);
  L.push("- 既存 eFHUB データ:");
  L.push("```");
  L.push("事前: " + JSON.stringify(x.efhubBefore));
  L.push("事後: " + JSON.stringify(x.efhubAfter));
  L.push("```");
  L.push(`- 既存 eFHUB データ不変: ${JSON.stringify(x.efhubBefore) === JSON.stringify(x.efhubAfter)}`);
  L.push("");
  L.push("## 未取得（推測で生成しない）");
  L.push("- 副ポジション適性 / Weak Foot / Form / Injury Resistance / 育成ポイント・規則・自動配分 / Max Level 各能力値 / 監督補正 / Tier");
  L.push("  → すべて null（未確認）。別フェーズで調査。");
  L.push("");
  await fs.mkdir(path.dirname(RESULT_REPORT), { recursive: true });
  await fs.writeFile(RESULT_REPORT, L.join("\n") + "\n", "utf8");
}

main().catch(async (err) => {
  console.error("\n[world] 中断:", err?.stack ?? err);
  try {
    if (db) {
      metrics.stopReason = `例外: ${err?.message ?? err}`;
      setState("world_initial_status", "stopped");
      finishRun("failed");
      saveProgress();
      db.close();
    }
  } catch {
    /* ignore */
  }
  process.exit(1);
});
