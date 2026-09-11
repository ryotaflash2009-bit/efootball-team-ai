/**
 * 監督データの同期。
 *   node scripts/sync-managers.mjs
 *
 * ソース: amine250/efootball-managers リポジトリの data/managers.json（89監督・構造化済み）
 *   URL: https://raw.githubusercontent.com/amine250/efootball-managers/main/data/managers.json
 *
 * - 外部アクセスは上記 URL の GET 1回のみ。redirect 非追跡・20秒・再試行なし・Cookie/認証なし。
 * - 既存の World / eFHUB データには一切書き込まない。
 * - 監督ブースターの対象能力は stat_key_map（name_en）経由で World キーへ変換。
 * - 同名でも source_manager_id が異なれば別カード（名前だけの自動統合はしない）。
 */

import { createHash } from "node:crypto";
import { openDb, DB_PATH } from "./sqlite/db.mjs";
import { STAT_KEY_MAP } from "./sqlite/world.mjs";

const SOURCE = "amine250";
const MANAGERS_URL =
  "https://raw.githubusercontent.com/amine250/efootball-managers/main/data/managers.json";
const TIMEOUT_MS = 20_000;

const nowIso = () => new Date().toISOString();
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// 表示名 → World キー（+ eFootball 2024+ の別名エイリアス）
const NAME_TO_KEY = new Map(STAT_KEY_MAP.map(([wk, , nameEn]) => [nameEn.toLowerCase(), wk]));
const STAT_NAME_ALIASES = {
  "attacking awareness": "offensiveAwareness", // 新名称
  "ball winning": "tackling",
  "aerial reach": "gkReach",
  "gk high reach": "gkReach",
};
function statNameToKey(name) {
  const k = String(name ?? "").trim().toLowerCase();
  return NAME_TO_KEY.get(k) ?? STAT_NAME_ALIASES[k] ?? null;
}

function parseDelta(value) {
  const m = String(value ?? "").match(/([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

const PROFICIENCY_KEYS = [
  "possessionGame",
  "quickCounter",
  "longBallCounter",
  "outWide",
  "longBall",
  "overload",
];

async function fetchManagers() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(MANAGERS_URL, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": "eFootball-Team-AI-dev/0.1 (manager data sync; contact: project owner)", Accept: "application/json" },
    });
  } finally {
    clearTimeout(t);
  }
  if (res.status >= 300 && res.status < 400) {
    throw new Error(`redirect ${res.status} → ${res.headers.get("location")}（追跡しない）`);
  }
  if (res.status === 429) throw new Error("HTTP 429（レート制限）");
  if (res.status === 403) throw new Error("HTTP 403（拒否）");
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  if (/set-cookie/i.test([...res.headers.keys()].join(","))) throw new Error("set-cookie 検出（保存せず停止）");
  const json = JSON.parse(raw);
  if (!Array.isArray(json)) throw new Error("配列でない（構造変化の可能性）");
  return { managers: json, hash: sha256(raw), bytes: raw.length };
}

async function main() {
  const db = await openDb();

  // 既存データのガード
  const guardBefore = {
    world_player_cards: db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n,
    player_index_entries: db.prepare("SELECT COUNT(*) n FROM player_index_entries").get().n,
    player_cards: db.prepare("SELECT COUNT(*) n FROM player_cards").get().n,
  };
  console.log("[managers] 既存データ（事前）:", JSON.stringify(guardBefore));

  const runInfo = db
    .prepare("INSERT INTO manager_sync_runs (kind, started_at, status, source_url) VALUES ('manager-initial', ?, 'running', ?)")
    .run(nowIso(), MANAGERS_URL);
  const runId = Number(runInfo.lastInsertRowid);

  let data;
  try {
    console.log(`[managers] GET ${MANAGERS_URL}`);
    data = await fetchManagers();
  } catch (err) {
    db.prepare("INSERT INTO manager_sync_errors (run_id, error, at) VALUES (?, ?, ?)").run(runId, String(err.message ?? err), nowIso());
    db.prepare("UPDATE manager_sync_runs SET status='failed', finished_at=? WHERE id=?").run(nowIso(), runId);
    db.close();
    console.error("[managers] 取得失敗:", err.message ?? err);
    process.exit(1);
  }

  console.log(`[managers] 受信 ${data.managers.length} 件 / ${data.bytes} bytes / hash ${data.hash.slice(0, 12)}`);

  const stmts = {
    upsertMgr: db.prepare(`INSERT INTO managers
      (source, source_manager_id, name_en, name_ja, team_name, nationality, age, released_at,
       possession_game, quick_counter, long_ball_counter, out_wide, long_ball, overload,
       manager_rating, coaching_affinity, formation, photo_path, has_booster, has_link_up_play,
       booster_confirmation, source_url, fetched_at, manager_sync_run_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(source, source_manager_id) DO UPDATE SET
        name_en=excluded.name_en, released_at=excluded.released_at,
        possession_game=excluded.possession_game, quick_counter=excluded.quick_counter,
        long_ball_counter=excluded.long_ball_counter, out_wide=excluded.out_wide,
        long_ball=excluded.long_ball, overload=excluded.overload, photo_path=excluded.photo_path,
        has_booster=excluded.has_booster, has_link_up_play=excluded.has_link_up_play,
        booster_confirmation=excluded.booster_confirmation, fetched_at=excluded.fetched_at,
        manager_sync_run_id=excluded.manager_sync_run_id`),
    getMgrId: db.prepare("SELECT internal_manager_id FROM managers WHERE source=? AND source_manager_id=?"),
    srcRec: db.prepare(`INSERT INTO manager_source_records (internal_manager_id, source, source_manager_id, source_url, fetched_at, raw_hash)
      VALUES (?,?,?,?,?,?) ON CONFLICT(source, source_manager_id) DO UPDATE SET fetched_at=excluded.fetched_at, raw_hash=excluded.raw_hash`),
    delProf: db.prepare("DELETE FROM manager_tactical_proficiencies WHERE internal_manager_id=?"),
    insProf: db.prepare("INSERT INTO manager_tactical_proficiencies (internal_manager_id, proficiency_key, value) VALUES (?,?,?)"),
    delBoost: db.prepare("DELETE FROM manager_boosters WHERE internal_manager_id=?"),
    insBoost: db.prepare(`INSERT INTO manager_boosters
      (internal_manager_id, display_order, stat_name_en, stat_key, delta, raw_value, application_condition, confirmation_status)
      VALUES (?,?,?,?,?,?,?,?)`),
    delLup: db.prepare("DELETE FROM manager_link_up_conditions WHERE link_up_play_id IN (SELECT id FROM manager_link_up_plays WHERE internal_manager_id=?)"),
    delLupHead: db.prepare("DELETE FROM manager_link_up_plays WHERE internal_manager_id=?"),
    insLup: db.prepare("INSERT INTO manager_link_up_plays (internal_manager_id, display_order, name, confirmation_status) VALUES (?,?,?,?)"),
    insLupCond: db.prepare("INSERT INTO manager_link_up_conditions (link_up_play_id, role, playing_style, positions_json) VALUES (?,?,?,?)"),
    affin: db.prepare("INSERT INTO manager_affinities (internal_manager_id, coaching_affinity, confirmation_status) VALUES (?,?, 'unresolved') ON CONFLICT(internal_manager_id) DO NOTHING"),
    form: db.prepare("INSERT INTO manager_formations (internal_manager_id, formation, confirmation_status) VALUES (?,?, 'unresolved') ON CONFLICT(internal_manager_id) DO NOTHING"),
  };

  let ok = 0;
  let fail = 0;
  let boosterCount = 0;
  let unmappedStats = new Set();
  let linkUpCount = 0;

  db.exec("BEGIN");
  try {
    for (const m of data.managers) {
      try {
        const srcId = String(m.id ?? "").trim();
        if (!srcId || !/^[A-Za-z0-9_-]{1,64}$/.test(srcId)) throw new Error(`invalid id: ${JSON.stringify(m.id)}`);
        const name = String(m.name ?? "").trim();
        if (!name) throw new Error("empty name");

        const p = m.teamPlaystyleProficiency ?? {};
        const num = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);
        const boosters = Array.isArray(m.boosterEffects) ? m.boosterEffects : [];
        const lups = Array.isArray(m.linkUpPlays)
          ? m.linkUpPlays
          : m.linkUpPlay
            ? [m.linkUpPlay]
            : [];

        stmts.upsertMgr.run(
          SOURCE, srcId, name, null, null, null, null,
          m.releaseDate ? String(m.releaseDate) : null,
          num(p.possessionGame), num(p.quickCounter), num(p.longBallCounter),
          num(p.outWide), num(p.longBall), num(p.overload),
          null, null, null,
          m.photo ? String(m.photo) : null,
          boosters.length > 0 ? 1 : 0,
          lups.length > 0 ? 1 : 0,
          boosters.length > 0 ? "confirmed" : "unresolved",
          MANAGERS_URL, nowIso(), runId,
        );
        const mid = stmts.getMgrId.get(SOURCE, srcId).internal_manager_id;

        stmts.srcRec.run(mid, SOURCE, srcId, MANAGERS_URL, nowIso(), sha256(JSON.stringify(m)));

        stmts.delProf.run(mid);
        for (const key of PROFICIENCY_KEYS) {
          stmts.insProf.run(mid, key, num(p[key]));
        }

        stmts.delBoost.run(mid);
        boosters.forEach((b, i) => {
          const nameEn = String(b.stat ?? "").trim();
          const key = statNameToKey(nameEn);
          if (!key && nameEn) unmappedStats.add(nameEn);
          stmts.insBoost.run(mid, i, nameEn, key, parseDelta(b.value), String(b.value ?? ""), null, "confirmed");
          boosterCount++;
        });

        stmts.delLup.run(mid);
        stmts.delLupHead.run(mid);
        lups.forEach((lu, i) => {
          const info = stmts.insLup.run(mid, i, String(lu.name ?? "").trim() || `Link-Up ${i + 1}`, "provisional");
          const lupId = Number(info.lastInsertRowid);
          for (const role of ["centerPiece", "keyMan"]) {
            const c = lu[role];
            if (c && typeof c === "object") {
              stmts.insLupCond.run(
                lupId, role,
                c.playingStyle ? String(c.playingStyle) : null,
                JSON.stringify(Array.isArray(c.positions) ? c.positions.map(String) : []),
              );
            }
          }
          linkUpCount++;
        });

        stmts.affin.run(mid, null);
        stmts.form.run(mid, null);
        ok++;
      } catch (e) {
        fail++;
        db.prepare("INSERT INTO manager_sync_errors (run_id, source_manager_id, error, at) VALUES (?,?,?,?)")
          .run(runId, String(m?.id ?? "?"), String(e.message ?? e), nowIso());
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    db.prepare("UPDATE manager_sync_runs SET status='failed', finished_at=? WHERE id=?").run(nowIso(), runId);
    db.close();
    console.error("[managers] 書き込み失敗:", e);
    process.exit(1);
  }

  // 既存データ不変チェック
  const guardAfter = {
    world_player_cards: db.prepare("SELECT COUNT(*) n FROM world_player_cards").get().n,
    player_index_entries: db.prepare("SELECT COUNT(*) n FROM player_index_entries").get().n,
    player_cards: db.prepare("SELECT COUNT(*) n FROM player_cards").get().n,
  };
  const guardOk = JSON.stringify(guardBefore) === JSON.stringify(guardAfter);

  db.prepare("UPDATE manager_sync_runs SET status=?, finished_at=?, received_count=?, ok_count=?, fail_count=?, content_hash=? WHERE id=?")
    .run(guardOk ? "done" : "failed", nowIso(), data.managers.length, ok, fail, data.hash, runId);
  db.prepare("INSERT INTO manager_sync_state (key, value, updated_at) VALUES ('last_hash', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .run(data.hash, nowIso());

  const counts = {
    managers: db.prepare("SELECT COUNT(*) n FROM managers").get().n,
    manager_boosters: db.prepare("SELECT COUNT(*) n FROM manager_boosters").get().n,
    manager_tactical_proficiencies: db.prepare("SELECT COUNT(*) n FROM manager_tactical_proficiencies").get().n,
    manager_link_up_plays: db.prepare("SELECT COUNT(*) n FROM manager_link_up_plays").get().n,
    manager_link_up_conditions: db.prepare("SELECT COUNT(*) n FROM manager_link_up_conditions").get().n,
  };
  const dupNames = db.prepare("SELECT name_en, COUNT(*) c FROM managers GROUP BY name_en HAVING c > 1").all();
  const integ = db.prepare("PRAGMA integrity_check").all();
  const fkc = db.prepare("PRAGMA foreign_key_check").all();

  db.close();

  console.log("\n[managers] 保存完了");
  console.log("  成功:", ok, " 失敗:", fail);
  console.log("  件数:", JSON.stringify(counts));
  console.log("  同名（別カード）:", JSON.stringify(dupNames.map((r) => `${r.name_en}×${r.c}`)));
  console.log("  ブースター対象能力の未変換:", JSON.stringify([...unmappedStats]));
  console.log("  既存データ不変:", guardOk, JSON.stringify(guardBefore), "→", JSON.stringify(guardAfter));
  console.log("  integrity_check:", JSON.stringify(integ), " FK違反:", fkc.length);
  console.log("  DB:", DB_PATH);

  if (!guardOk || fkc.length > 0 || JSON.stringify(integ) !== '[{"integrity_check":"ok"}]') process.exit(2);
}

main().catch((err) => {
  console.error("\n[managers] 中断:", err?.stack ?? err);
  process.exit(1);
});
