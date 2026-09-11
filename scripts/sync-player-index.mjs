/**
 * Phase C: eFHUB の player-index.json を GET 1回で取得し、全索引を SQLite の
 * player_index_entries へ投入する。個別選手ページへはアクセスしない。
 *
 *   node scripts/sync-player-index.mjs [--mode initial|incremental]
 *
 * - 外部 GET は player-index.json へ 1回のみ。再試行なし・リダイレクト非追跡・Cookie/認証なし。
 * - 冪等: 取得した entries[] を DB へ2回適用して件数・ID集合が不変であることを確認（再フェッチなし）。
 * - 既存の player_cards 系6テーブルには一切書き込まない（19カード詳細データを保護）。
 * - 全件投入は単一トランザクション（BEGIN→UPSERT→COMMIT）。失敗時 ROLLBACK。
 * - レスポンス全文は保存しない（sha256 ハッシュ + 先頭3件のみ source_snapshots へ）。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { openDb, DB_PATH, tableCounts, classifyIndexAnomaly } from "./sqlite/db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "phase-c-index-sync.md");

const SOURCE_URL = "https://efhub.com/search/player-index.json";
const TIMEOUT_MS = 60_000;
const MIN_EXPECTED = 10_000;
const UA = "eFootball-Team-AI-dev/0.1 (index sync; 1 GET; no cookies)";

const modeArg = (() => {
  const i = process.argv.indexOf("--mode");
  const m = i >= 0 ? process.argv[i + 1] : "initial";
  return m === "incremental" ? "incremental" : "initial";
})();

let fetched = false;

function stop(reason, detail) {
  console.error("\n[index-sync] 停止:", reason);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 500));
  process.exit(1);
}

const PC_TABLES = [
  "player_cards", "player_card_stats", "player_card_skills",
  "player_card_com_skills", "player_card_positions", "player_card_boosters",
];
function pcCounts(db) {
  const o = {};
  for (const t of PC_TABLES) o[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  return o;
}

async function fetchIndex() {
  if (fetched) stop("player-index.json への2回目のアクセスが必要になりました（再試行しません）");
  fetched = true;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  console.log(`[index-sync] GET ${SOURCE_URL} (timeout ${TIMEOUT_MS}ms)`);
  let res;
  try {
    res = await fetch(SOURCE_URL, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
    });
  } catch (err) {
    clearTimeout(t);
    stop("ネットワークエラーまたはタイムアウト", err?.message ?? String(err));
  }
  clearTimeout(t);

  if (res.status >= 300 && res.status < 400) {
    stop(`リダイレクト(${res.status})（自動追跡しません）`, `Location: ${res.headers.get("location") ?? "(なし)"}`);
  }
  if (res.status !== 200) stop(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  const rawText = await res.text();
  if (!rawText || rawText.trim() === "") stop("空レスポンス（DB へ反映しません）");

  const hash = createHash("sha256").update(rawText).digest("hex");

  // i（ID）を文字列化してから JSON.parse（大きな数値の精度劣化を防ぐ）
  const idSafe = rawText.replace(/([{,]\s*)"i"\s*:\s*(\d+)/g, '$1"i":"$2"');
  let data;
  try {
    data = JSON.parse(idSafe);
  } catch (err) {
    stop("JSON として解釈できません", err?.message ?? String(err));
  }
  if (!Array.isArray(data)) stop(`JSON 配列ではありません（型: ${typeof data}）`);
  if (data.length < MIN_EXPECTED) stop(`取得件数が極端に少ない: ${data.length} < ${MIN_EXPECTED}`);

  return { rawLen: rawText.length, contentType, hash, data, httpStatus: res.status };
}

function classifyEntry(raw, pos) {
  const idStr = raw && raw.i != null ? String(raw.i) : "";
  const nameEn = typeof raw?.e === "string" ? raw.e : "";
  const nameJa = typeof raw?.j === "string" ? raw.j : "";
  const ovrRaw = typeof raw?.o === "string" ? Number(raw.o) : raw?.o;
  const ovr = Number.isFinite(ovrRaw) ? ovrRaw : null;

  const reason = classifyIndexAnomaly(idStr, nameEn, nameJa, ovr);

  return {
    id: idStr,
    nameEn,
    nameJa,
    ovrCand: ovr,
    pos,
    anomalous: reason ? 1 : 0,
    reason,
  };
}

function startRun(db, kind) {
  const now = new Date().toISOString();
  const info = db.prepare("INSERT INTO sync_runs (kind, started_at, status) VALUES (?, ?, 'running')").run(kind, now);
  return { id: Number(info.lastInsertRowid), startedAt: now };
}
function finishRun(db, runId, status, ok, fail) {
  db.prepare("UPDATE sync_runs SET finished_at=?, status=?, ok_count=?, fail_count=? WHERE id=?")
    .run(new Date().toISOString(), status, ok, fail, runId);
}
function setState(db, key, value) {
  db.prepare("INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .run(key, String(value), new Date().toISOString());
}
function getState(db, key) {
  const r = db.prepare("SELECT value FROM sync_state WHERE key=?").get(key);
  return r ? r.value : null;
}

/** entries[] を DB へ UPSERT（単一トランザクション）。new/updated/unchanged を分類。 */
function applyEntries(db, entries, runId) {
  const now = new Date().toISOString();
  const sel = db.prepare("SELECT name_en, name_ja, ovr_max_candidate, detail_sync_status FROM player_index_entries WHERE efhub_card_id=?");
  const ins = db.prepare(`INSERT INTO player_index_entries
    (efhub_card_id, name_en, name_ja, ovr_max_candidate, source, source_url, fetched_at,
     raw_index_position, index_sync_run_id, detail_sync_status, is_anomalous, anomaly_reason,
     first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, 'efhub', ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const updChanged = db.prepare(`UPDATE player_index_entries SET
     name_en=?, name_ja=?, ovr_max_candidate=?, fetched_at=?, raw_index_position=?,
     index_sync_run_id=?, is_anomalous=?, anomaly_reason=?, detail_sync_status=?, last_seen_at=?
     WHERE efhub_card_id=?`);
  const updSeen = db.prepare("UPDATE player_index_entries SET last_seen_at=?, raw_index_position=? WHERE efhub_card_id=?");

  let nw = 0, updated = 0, unchanged = 0, anomaly = 0;

  db.exec("BEGIN");
  try {
    for (const e of entries) {
      if (e.anomalous) anomaly++;
      const existing = sel.get(e.id);
      const status = e.anomalous ? "anomalous" : "pending";
      if (!existing) {
        ins.run(e.id, e.nameEn, e.nameJa, e.ovrCand, SOURCE_URL, now, e.pos, runId,
          status, e.anomalous, e.reason, now, now);
        nw++;
      } else {
        const changed =
          existing.name_en !== e.nameEn ||
          existing.name_ja !== e.nameJa ||
          (existing.ovr_max_candidate ?? null) !== (e.ovrCand ?? null);
        if (changed) {
          // OVR 候補が変化し、既に詳細取得済みなら再取得対象に戻す
          let nextStatus = existing.detail_sync_status;
          if (e.anomalous) nextStatus = "anomalous";
          else if ((existing.ovr_max_candidate ?? null) !== (e.ovrCand ?? null) && existing.detail_sync_status === "fetched") {
            nextStatus = "pending";
          }
          updChanged.run(e.nameEn, e.nameJa, e.ovrCand, now, e.pos, runId,
            e.anomalous, e.reason, nextStatus, now, e.id);
          updated++;
        } else {
          updSeen.run(now, e.pos, e.id);
          unchanged++;
        }
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { new: nw, updated, unchanged, anomaly };
}

function markFetchedFromPlayerCards(db) {
  const info = db.prepare(`UPDATE player_index_entries
    SET detail_sync_status='fetched'
    WHERE is_anomalous=0
      AND detail_sync_status IN ('pending')
      AND efhub_card_id IN (SELECT efhub_card_id FROM player_cards)`).run();
  return info.changes;
}

async function main() {
  const db = await openDb();

  // 既存19カード保護: 事前カウント
  const pcBefore = pcCounts(db);
  console.log("[index-sync] player_cards 系（事前）:", JSON.stringify(pcBefore));

  const initialDone = getState(db, "index_initial_done") === "true";
  if (modeArg === "initial" && initialDone) {
    console.log("[index-sync] 注意: index_initial_done=true。initial を再実行します（UPSERT で冪等）。");
  }

  const prevHash = getState(db, "index_last_snapshot_hash");
  const run = startRun(db, `${modeArg}-index-sync`);

  // --- 取得（1回のみ） ---
  const fetchResult = await fetchIndex();
  const entries = fetchResult.data.map((raw, i) => classifyEntry(raw, i));

  // source_snapshots（全文は保存しない）
  db.prepare(`INSERT INTO source_snapshots
    (sync_run_id, source, source_url, fetched_at, http_status, content_length, record_count, content_hash, sample_json)
    VALUES (?, 'efhub', ?, ?, ?, ?, ?, ?, ?)`).run(
    run.id, SOURCE_URL, new Date().toISOString(), fetchResult.httpStatus,
    fetchResult.rawLen, entries.length, fetchResult.hash,
    JSON.stringify(fetchResult.data.slice(0, 3)),
  );

  // --- 1回目適用 ---
  const stat1 = applyEntries(db, entries, run.id);
  const count1 = db.prepare("SELECT COUNT(*) AS n FROM player_index_entries").get().n;
  const ids1 = db.prepare("SELECT efhub_card_id FROM player_index_entries ORDER BY efhub_card_id").all().length;
  const dup1 = db.prepare("SELECT COUNT(*) AS n FROM (SELECT efhub_card_id FROM player_index_entries GROUP BY efhub_card_id HAVING COUNT(*) > 1)").get().n;

  // 既存詳細（19カード）を fetched に更新
  const markedFetched = markFetchedFromPlayerCards(db);

  // --- 2回目適用（冪等性・再フェッチなし） ---
  const stat2 = applyEntries(db, entries, run.id);
  const count2 = db.prepare("SELECT COUNT(*) AS n FROM player_index_entries").get().n;
  const dup2 = db.prepare("SELECT COUNT(*) AS n FROM (SELECT efhub_card_id FROM player_index_entries GROUP BY efhub_card_id HAVING COUNT(*) > 1)").get().n;
  const idempotent = count1 === count2 && dup1 === 0 && dup2 === 0 && stat2.new === 0;

  // 異常エントリ: 代表を sync_errors へ（上限20）
  const anomalies = entries.filter((e) => e.anomalous);
  let recordedErr = 0;
  const insErr = db.prepare("INSERT INTO sync_errors (run_id, efhub_card_id, http_status, error, attempt, at) VALUES (?, ?, 200, ?, 0, ?)");
  for (const a of anomalies.slice(0, 20)) {
    insErr.run(run.id, a.id, `index anomaly: ${a.reason}`, new Date().toISOString());
    recordedErr++;
  }

  // 既存19カード保護: 事後カウント & assert
  const pcAfter = pcCounts(db);
  const pcUnchanged = JSON.stringify(pcBefore) === JSON.stringify(pcAfter);

  // メトリクス
  const anomalyReasons = {};
  for (const a of anomalies) {
    for (const r of (a.reason ?? "").split("; ")) anomalyReasons[r] = (anomalyReasons[r] ?? 0) + 1;
  }
  const statusDist = Object.fromEntries(
    db.prepare("SELECT detail_sync_status AS s, COUNT(*) AS n FROM player_index_entries GROUP BY detail_sync_status").all().map((r) => [r.s, r.n]),
  );

  const hashChanged = prevHash !== null && prevHash !== fetchResult.hash;
  const nextState = {
    index_initial_done: "true",
    index_last_fetch_at: new Date().toISOString(),
    index_last_snapshot_hash: fetchResult.hash,
    index_record_count: String(entries.length),
    index_detail_cursor: getState(db, "index_detail_cursor") ?? "0",
  };

  db.prepare(`INSERT INTO index_sync_stats
    (sync_run_id, mode, started_at, finished_at, received_count, new_count, updated_count,
     unchanged_count, anomaly_count, fail_count, status, prev_snapshot_hash, this_snapshot_hash,
     diff_summary, next_state_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    run.id, modeArg, run.startedAt, new Date().toISOString(),
    entries.length, stat1.new, stat1.updated, stat1.unchanged, stat1.anomaly, 0,
    "done", prevHash, fetchResult.hash,
    prevHash === null ? "first snapshot" : hashChanged ? "snapshot hash changed" : "snapshot hash unchanged",
    JSON.stringify(nextState),
  );

  for (const [k, v] of Object.entries(nextState)) setState(db, k, v);
  finishRun(db, run.id, "done", stat1.new + stat1.updated + stat1.unchanged, 0);

  const finalCounts = tableCounts(db);
  const snapshotRow = db.prepare("SELECT id, record_count, content_length, content_hash FROM source_snapshots ORDER BY id DESC LIMIT 1").get();

  db.close();

  const success =
    entries.length >= MIN_EXPECTED &&
    idempotent &&
    pcUnchanged &&
    stat1.new + stat1.updated + stat1.unchanged === entries.length;

  const md = buildReport({
    now: new Date().toISOString(),
    mode: modeArg,
    dbRel: path.relative(ROOT, DB_PATH),
    fetchResult, entries, stat1, stat2,
    count1, count2, ids1, dup1, dup2, idempotent,
    markedFetched, statusDist, anomalies, anomalyReasons, recordedErr,
    pcBefore, pcAfter, pcUnchanged,
    prevHash, hashChanged, nextState, finalCounts, snapshotRow, success,
  });
  await fs.writeFile(REPORT, md, "utf8");

  console.log(`\n[index-sync] 完了: received=${entries.length} new=${stat1.new} updated=${stat1.updated} unchanged=${stat1.unchanged} anomaly=${stat1.anomaly}`);
  console.log(`[index-sync] 冪等=${idempotent} / player_cards 保護=${pcUnchanged} / 成功=${success}`);
  console.log(`[index-sync] レポート: ${path.relative(ROOT, REPORT)}`);
  if (!success) process.exit(2);
}

function buildReport(x) {
  const L = [];
  L.push("# Phase C 索引同期レポート（player-index.json → SQLite）");
  L.push("");
  L.push(`実行日時: ${x.now}`);
  L.push(`モード: ${x.mode}`);
  L.push(`DB: ${x.dbRel}`);
  L.push(`外部アクセス: player-index.json へ GET 1回のみ（個別選手ページ 0回）`);
  L.push("");
  L.push("## 1. 取得");
  L.push(`- URL: ${SOURCE_URL}`);
  L.push(`- HTTP: ${x.fetchResult.httpStatus} / Content-Type: ${x.fetchResult.contentType}`);
  L.push(`- レスポンスサイズ: ${x.fetchResult.rawLen} bytes（**全文は保存せず** sha256 と先頭3件のみ source_snapshots へ）`);
  L.push(`- sha256: \`${x.fetchResult.hash}\``);
  L.push(`- 受信レコード数: **${x.entries.length}**`);
  L.push(`- 先頭3件（生データ）:`);
  L.push("```json");
  for (const e of x.fetchResult.data.slice(0, 3)) L.push("  " + JSON.stringify(e));
  L.push("```");
  L.push("");
  L.push("## 2. 投入結果（1回目適用）");
  L.push(`- 新規: ${x.stat1.new} / 更新: ${x.stat1.updated} / 変更なし: ${x.stat1.unchanged} / 異常: ${x.stat1.anomaly}`);
  L.push(`- player_index_entries 総数: ${x.count1}`);
  L.push(`- 既存19カード（player_cards）を detail_sync_status='fetched' に更新: ${x.markedFetched} 件`);
  L.push("");
  L.push("### detail_sync_status 分布");
  L.push("```");
  L.push(JSON.stringify(x.statusDist, null, 2));
  L.push("```");
  L.push("");
  L.push("## 3. 冪等性（同一 entries[] を2回適用・再フェッチなし）");
  L.push(`- 2回目: 新規 ${x.stat2.new} / 更新 ${x.stat2.updated} / 変更なし ${x.stat2.unchanged}`);
  L.push(`- player_index_entries 総数 1回目==2回目: ${x.count1} == ${x.count2} → **${x.count1 === x.count2}**`);
  L.push(`- 重複 efhub_card_id: 1回目 ${x.dup1} / 2回目 ${x.dup2}`);
  L.push(`- 2回目の新規 = 0: **${x.stat2.new === 0}**`);
  L.push(`- **冪等: ${x.idempotent}**`);
  L.push("");
  L.push("## 4. 異常データ");
  L.push(`- 異常エントリ総数: ${x.anomalies.length}`);
  L.push("- 理由別:");
  L.push("```");
  L.push(JSON.stringify(x.anomalyReasons, null, 2));
  L.push("```");
  L.push(`- sync_errors へ記録した代表: ${x.recordedErr} 件（上限20）`);
  if (x.anomalies.length) {
    L.push("");
    L.push("| efhub_card_id | name_en | name_ja | ovr | reason |");
    L.push("|---|---|---|---|---|");
    for (const a of x.anomalies.slice(0, 30)) {
      L.push(`| ${a.id} | ${a.nameEn} | ${a.nameJa} | ${a.ovrCand ?? "-"} | ${a.reason} |`);
    }
  }
  L.push("");
  L.push("> 異常エントリも player_index_entries には記録（is_anomalous=1 / detail_sync_status='anomalous'）。");
  L.push("> Phase D の詳細取得キューは `WHERE detail_sync_status='pending' AND is_anomalous=0` で作るため自動スキップされる。");
  L.push("");
  L.push("## 5. 既存19カードの保護");
  L.push("```");
  L.push("事前: " + JSON.stringify(x.pcBefore));
  L.push("事後: " + JSON.stringify(x.pcAfter));
  L.push("```");
  L.push(`- player_cards 系6テーブルの件数が投入前後で不変: **${x.pcUnchanged}**`);
  L.push("- sync-player-index.mjs はこれらのテーブルに一切書き込まない。");
  L.push("");
  L.push("## 6. 自動差分更新の準備");
  L.push(`- prev snapshot hash: ${x.prevHash ?? "(なし=初回)"}`);
  L.push(`- this snapshot hash: ${x.fetchResult.hash}`);
  L.push(`- snapshot 変化: ${x.prevHash === null ? "初回" : x.hashChanged ? "あり" : "なし"}`);
  L.push("- sync_state（次回同期用）:");
  L.push("```");
  L.push(JSON.stringify(x.nextState, null, 2));
  L.push("```");
  L.push("- `--mode incremental`: 前回との差分（name / ovr_max_candidate の変化）だけ更新。");
  L.push("  ovr_max_candidate が変化し、かつ detail_sync_status='fetched' のエントリは 'pending' に戻す（Phase D が再取得）。");
  L.push("- 将来: サーバー側 cron で `node scripts/sync-player-index.mjs --mode incremental` を定期実行 → ユーザー操作不要で索引が最新化。");
  L.push("");
  L.push("## 7. テーブル件数（最終）");
  L.push("```");
  L.push(JSON.stringify(x.finalCounts, null, 2));
  L.push("```");
  L.push("");
  L.push("## 8. 判定");
  L.push(`- **Phase C 成功: ${x.success}**`);
  L.push(`  - 受信件数 >= ${MIN_EXPECTED} / 冪等 / player_cards 保護 / 全件が new+updated+unchanged に分類`);
  L.push("- UI のデータ参照先は players.sample.json のまま（未切替）。");
  L.push("");
  return L.join("\n") + "\n";
}

main().catch((err) => {
  console.error("\n[index-sync] 中断:", err?.stack ?? err);
  process.exit(1);
});
