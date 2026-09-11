/**
 * eFootball World 差分同期（定期実行用）。初回全件同期の完了後に使う。
 *
 *   node scripts/sync-world-players-incremental.mjs [--max-pages N]
 *
 * 方式:
 *  1. sortBy=UPDATED_AT, sortOrder=DESC でページ1から取得
 *  2. 各カードの appearance.updatedAt を world_player_cards.appearance_updated_at と比較
 *  3. 変化した / 新規のカードだけ UPSERT
 *  4. 1ページ全件が「前回同期の最新 updatedAt 以前」になったら早期停止
 *  5. 先頭ページの content hash が前回と同じなら「変化なし」で即終了
 *  6. 別途 sortBy=CREATED_AT で新規カードのみ確認
 *
 * UPDATED_AT が使えない場合は、別方式へ勝手に切り替えず、結果と推奨代替案を出力して停止する。
 *
 * 制約: players/search のみ / 同時1 / 間隔3秒 / 各20秒 / 5xx・network のみ2回再試行 /
 *       429/403/CAPTCHA 即停止 / Cookie・認証なし / UA 偽装なし / リダイレクト非追跡 /
 *       個別ページ非アクセス / 既存 eFHUB データに書き込まない。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./sqlite/db.mjs";
import {
  WORLD_SEARCH_URL, WORLD_UA, WORLD_PAGE_SIZE, WORLD_TIMEOUT_MS,
  WORLD_STAT_KEYS, sha256, looksSensitive, normalizeWorldPlayer, seedWorldReference,
} from "./sqlite/world.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const argv = process.argv.slice(2);
const MAX_PAGES = (() => {
  const i = argv.indexOf("--max-pages");
  return i >= 0 ? Math.max(1, parseInt(argv[i + 1], 10) || 0) : 15;
})();
const INTERVAL = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

let db;
let runId;
let lastReqAt = 0;
let reqCount = 0;

function getState(k) {
  const r = db.prepare("SELECT value FROM world_sync_state WHERE key=?").get(k);
  return r ? r.value : null;
}
function setState(k, v) {
  db.prepare("INSERT INTO world_sync_state (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .run(k, v == null ? null : String(v), nowIso());
}
function recErr(page, msg, http) {
  db.prepare("INSERT INTO world_sync_errors (run_id, page, http_status, error, attempt, at) VALUES (?,?,?,?,0,?)")
    .run(runId, page ?? null, http ?? null, String(msg).slice(0, 500), nowIso());
}

async function fetchPage(sortBy, page, attempt = 0) {
  const wait = INTERVAL - (Date.now() - lastReqAt);
  if (wait > 0) await sleep(wait);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), WORLD_TIMEOUT_MS);
  reqCount++;
  lastReqAt = Date.now();
  let res;
  try {
    res = await fetch(WORLD_SEARCH_URL, {
      method: "POST", redirect: "manual", signal: ctrl.signal,
      headers: { "User-Agent": WORLD_UA, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ page, size: WORLD_PAGE_SIZE, sortBy, sortOrder: "DESC" }),
    });
  } catch (err) {
    clearTimeout(t);
    if (attempt < 2) {
      await sleep(attempt === 0 ? 5000 : 15000);
      return fetchPage(sortBy, page, attempt + 1);
    }
    return { fatal: `network/timeout: ${err?.message ?? err}` };
  }
  clearTimeout(t);
  if (res.status >= 300 && res.status < 400) return { fatal: `redirect ${res.status} -> ${res.headers.get("location")}` };
  if (res.status === 429) return { fatal: `HTTP 429 (Retry-After: ${res.headers.get("retry-after") ?? "none"})` };
  if (res.status === 403 || res.status === 401) return { fatal: `HTTP ${res.status}` };
  if (res.status >= 500) {
    if (attempt < 2) {
      await sleep(attempt === 0 ? 5000 : 15000);
      return fetchPage(sortBy, page, attempt + 1);
    }
    return { fatal: `HTTP ${res.status} (retries exhausted)` };
  }
  if (res.status !== 200) return { fatal: `HTTP ${res.status}` };

  const raw = await res.text();
  if (looksSensitive(raw).length) return { fatal: `個人情報/認証情報の兆候` };
  let j;
  try {
    j = JSON.parse(raw);
  } catch (e) {
    return { fatal: `JSON parse: ${e.message}` };
  }
  const players = Array.isArray(j?.players) ? j.players : null;
  if (!players) return { fatal: `players 配列がない` };
  return { players, raw, hash: sha256(raw), totalCount: j.totalCount, totalPages: j.totalPages };
}

function upsertCard(c) {
  const pcCols = [
    "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality",
    "region", "league", "team", "ovr_base", "ovr_max", "maximum_level", "card_rating",
    "playing_style", "playing_style_def", "preferred_foot", "age", "height", "weight",
    "image_url", "mobile_image_url", "boost1", "boost2", "likes_count", "view_count",
    "average_rating", "total_ratings", "appearance_updated_at", "source", "source_url",
    "fetched_at", "world_sync_run_id",
  ];
  const ph = pcCols.map(() => "?").join(",");
  const upd = pcCols.slice(1).map((k) => `${k}=excluded.${k}`).join(",");
  db.prepare(`INSERT INTO world_player_cards (${pcCols.join(",")}) VALUES (${ph}) ON CONFLICT(world_card_id) DO UPDATE SET ${upd}`).run(
    c.world_card_id, c.name_en, c.name_ja, c.card_type, c.registered_position, c.nationality,
    c.region, c.league, c.team, c.ovr_base, c.ovr_max, c.maximum_level, c.card_rating,
    c.playing_style, c.playing_style_def, c.preferred_foot, c.age, c.height, c.weight,
    c.image_url, c.mobile_image_url, c.boost1, c.boost2, c.likes_count, c.view_count,
    c.average_rating, c.total_ratings, c.appearance_updated_at, "world", WORLD_SEARCH_URL, nowIso(), runId,
  );
  db.prepare("DELETE FROM world_player_stats WHERE world_card_id=?").run(c.world_card_id);
  const insS = db.prepare("INSERT INTO world_player_stats (world_card_id, stat_key, stat_kind, value) VALUES (?,?,'base',?)");
  for (const k of WORLD_STAT_KEYS) if (typeof c.stats[k] === "number") insS.run(c.world_card_id, k, c.stats[k]);
  db.prepare("DELETE FROM world_player_skills WHERE world_card_id=?").run(c.world_card_id);
  const insSk = db.prepare("INSERT INTO world_player_skills (world_card_id, skill_name, display_order) VALUES (?,?,?)");
  c.skills.forEach((s, i) => insSk.run(c.world_card_id, s, i));
  db.prepare("DELETE FROM world_player_ai_styles WHERE world_card_id=?").run(c.world_card_id);
  const insAi = db.prepare("INSERT INTO world_player_ai_styles (world_card_id, style_name, display_order) VALUES (?,?,?)");
  c.aiStyles.forEach((s, i) => insAi.run(c.world_card_id, s, i));
  db.prepare("DELETE FROM world_player_appearances WHERE world_card_id=?").run(c.world_card_id);
  if (c.appearance) {
    const a = c.appearance;
    db.prepare(`INSERT INTO world_player_appearances (world_card_id,position,leg_coverage_radius,arm_coverage_radius,torso_collision,jumping_height,dribble_height,leg_length,ranks_json,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(c.world_card_id, a.position, a.leg_coverage_radius, a.arm_coverage_radius, a.torso_collision, a.jumping_height, a.dribble_height, a.leg_length, a.ranks_json, a.updated_at);
  }
}

async function main() {
  db = await openDb();
  seedWorldReference(db);

  if (getState("world_initial_status") !== "done") {
    console.log("[world-inc] 初回全件同期が未完了。先に sync-world-players-initial.mjs を完了させてください。");
    db.close();
    process.exit(1);
  }

  const info = db.prepare("INSERT INTO world_sync_runs (kind, started_at, status) VALUES ('world-incremental', ?, 'running')").run(nowIso());
  runId = Number(info.lastInsertRowid);

  const prevMaxUpdated = getState("world_last_updated_at_seen") || db.prepare("SELECT MAX(appearance_updated_at) AS m FROM world_player_cards").get().m || "";
  const prevPage1Hash = getState("world_inc_page1_hash");
  console.log(`[world-inc] 前回の最新 updatedAt: ${prevMaxUpdated}`);

  // --- UPDATED_AT が使えるか（page 1） ---
  const p1 = await fetchPage("UPDATED_AT", 1);
  if (p1.fatal) {
    console.log(`[world-inc] 停止: ${p1.fatal}`);
    db.prepare("UPDATE world_sync_runs SET status='stopped', finished_at=? WHERE id=?").run(nowIso(), runId);
    recErr(1, p1.fatal);
    db.close();
    process.exit(2);
  }
  const p1UpdatedAts = p1.players.map((x) => x?.appearance?.updatedAt).filter(Boolean);
  const updatedAtSorted = [...p1UpdatedAts].sort().reverse();
  const isDesc = JSON.stringify(p1UpdatedAts) === JSON.stringify(updatedAtSorted);
  if (p1UpdatedAts.length < p1.players.length * 0.5 || !isDesc) {
    console.log("[world-inc] 停止: sortBy=UPDATED_AT が期待どおり機能していない（updatedAt が降順でない/欠損多数）。");
    console.log("  推奨代替案:");
    console.log("   1. sortBy=CREATED_AT DESC で新規カードのみ取得し、既存カードは TTL（例14日）で定期的に再取得");
    console.log("   2. 全27ページを月1回フル取得（約3分）し、appearance.updatedAt が変化したものだけ UPSERT");
    console.log("   3. 先頭ページの content hash を毎回比較し、変化があった時だけフル取得");
    db.prepare("UPDATE world_sync_runs SET status='stopped', finished_at=? WHERE id=?").run(nowIso(), runId);
    db.close();
    process.exit(3);
  }

  if (prevPage1Hash && prevPage1Hash === p1.hash) {
    console.log("[world-inc] 先頭ページの content hash が前回と同一 → 変化なし。終了。");
    db.prepare("UPDATE world_sync_runs SET status='done', finished_at=?, ok_count=0 WHERE id=?").run(nowIso(), runId);
    db.close();
    return;
  }

  let changed = 0;
  let newCards = 0;
  let maxSeen = prevMaxUpdated;
  let stopEarly = false;

  for (let page = 1; page <= (p1.totalPages || 27) && page <= MAX_PAGES && !stopEarly; page++) {
    const r = page === 1 ? p1 : await fetchPage("UPDATED_AT", page);
    if (r.fatal) {
      console.log(`[world-inc] page ${page} 停止: ${r.fatal}`);
      recErr(page, r.fatal);
      break;
    }
    let pageAllOld = true;
    db.exec("BEGIN");
    try {
      for (const raw of r.players) {
        const c = normalizeWorldPlayer(raw);
        if (!c.world_card_id) continue;
        const existing = db.prepare("SELECT appearance_updated_at FROM world_player_cards WHERE world_card_id=?").get(c.world_card_id);
        const u = c.appearance_updated_at || "";
        if (u > maxSeen) maxSeen = u;
        if (!existing) {
          upsertCard(c);
          newCards++;
          pageAllOld = false;
        } else if ((existing.appearance_updated_at || "") !== u || u > prevMaxUpdated) {
          upsertCard(c);
          changed++;
          pageAllOld = false;
        }
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      recErr(page, `write: ${e.message}`);
      break;
    }
    console.log(`[world-inc] page ${page}: 変更 ${changed} / 新規 ${newCards}`);
    if (page > 1 && pageAllOld) {
      stopEarly = true;
      console.log("[world-inc] このページは全件が前回同期以前 → 早期停止。");
    }
  }

  setState("world_last_updated_at_seen", maxSeen);
  setState("world_inc_page1_hash", p1.hash);
  setState("world_last_sync_at", nowIso());
  db.prepare("UPDATE world_sync_runs SET status='done', finished_at=?, ok_count=?, fail_count=0 WHERE id=?")
    .run(nowIso(), changed + newCards, runId);

  console.log(`\n[world-inc] 完了: 変更 ${changed} / 新規 ${newCards} / リクエスト ${reqCount}`);
  db.close();
}

main().catch((err) => {
  console.error("\n[world-inc] 中断:", err?.stack ?? err);
  try {
    if (db) {
      db.prepare("UPDATE world_sync_runs SET status='failed', finished_at=? WHERE id=?").run(nowIso(), runId);
      db.close();
    }
  } catch {
    /* ignore */
  }
  process.exit(1);
});
