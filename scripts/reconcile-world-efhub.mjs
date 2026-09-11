/**
 * World カードと eFHUB 索引（player_index_entries）を照合する。
 *
 *   node scripts/reconcile-world-efhub.mjs
 *
 * - 外部アクセスなし（ローカル DB のみ）。
 * - World ID と eFHUB ID は別体系。同一と仮定しない。
 * - 高信頼一致のみ source_record_links へ。曖昧なものは merge_candidates（自動統合しない）。
 * - 紐付いたカードの値の不一致は data_conflicts へ（自動上書きしない）。
 * - 既存 eFHUB 詳細データ（player_cards）は変更しない。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { openDb, DB_PATH } from "./sqlite/db.mjs";
import { STAT_KEY_MAP } from "./sqlite/world.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "phase-world-efhub-reconcile.md");

const nowIso = () => new Date().toISOString();

function normName(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s.\-'’]/g, "")
    .trim();
}

function main() {
  return openDb().then(async (db) => {
    const runInfo = db.prepare("INSERT INTO sync_runs (kind, started_at, status) VALUES ('world-efhub-reconcile', ?, 'running')").run(nowIso());
    const runId = Number(runInfo.lastInsertRowid);

    // 対象
    const worldCards = db.prepare(
      "SELECT world_card_id, name_en, name_ja, card_type, registered_position, ovr_base, ovr_max, maximum_level, height, weight, playing_style FROM world_player_cards",
    ).all();
    const efhubIdx = db.prepare(
      "SELECT efhub_card_id, name_en, name_ja, ovr_max_candidate FROM player_index_entries WHERE is_anomalous=0",
    ).all();

    // eFHUB 索引を正規化名でグルーピング
    const efhubByName = new Map();
    for (const e of efhubIdx) {
      const key = normName(e.name_en) || normName(e.name_ja);
      if (!key) continue;
      if (!efhubByName.has(key)) efhubByName.set(key, []);
      efhubByName.get(key).push(e);
    }

    // eFHUB 詳細（player_cards）を id で
    const efhubDetail = new Map(
      db.prepare("SELECT efhub_card_id, name_en, ovr_base, ovr_max, level_cap, registered_position, playing_style_name, height, weight FROM player_cards").all().map((r) => [r.efhub_card_id, r]),
    );

    let nextInternalId = (db.prepare("SELECT COALESCE(MAX(internal_card_id),0) AS m FROM source_record_links").get().m) + 1;

    const linkStmt = db.prepare("INSERT OR IGNORE INTO source_record_links (internal_card_id, source, source_card_id, linked_at) VALUES (?,?,?,?)");
    const mcStmt = db.prepare("INSERT INTO merge_candidates (internal_card_id, efhub_card_id, world_card_id, match_score, match_reason, status, created_at) VALUES (?,?,?,?,?,'pending',?)");
    const setInternal = db.prepare("UPDATE world_player_cards SET internal_card_id=? WHERE world_card_id=?");
    const dcStmt = db.prepare("INSERT INTO data_conflicts (internal_card_id, efhub_card_id, world_card_id, field_name, efhub_value, world_value, detected_at, confidence, resolution_status) VALUES (?,?,?,?,?,?,?,?, 'open')");

    let highConfidence = 0;
    let candidates = 0;
    let noMatch = 0;
    let conflicts = 0;

    db.exec("BEGIN");
    try {
      for (const w of worldCards) {
        const key = normName(w.name_en) || normName(w.name_ja);
        const pool = (key && efhubByName.get(key)) || [];
        if (pool.length === 0) {
          noMatch++;
          continue;
        }
        // スコアリング: 名前一致(前提) + maxOVR 近接 + 詳細があれば追加要素
        const scored = pool
          .map((e) => {
            let score = 0.5; // 名前一致
            const reasons = ["name"];
            if (e.ovr_max_candidate != null && w.ovr_max != null) {
              const d = Math.abs(e.ovr_max_candidate - w.ovr_max);
              if (d === 0) { score += 0.25; reasons.push("maxOvr=="); }
              else if (d <= 1) { score += 0.15; reasons.push("maxOvr~1"); }
              else if (d <= 3) { score += 0.05; reasons.push("maxOvr~3"); }
            }
            const det = efhubDetail.get(e.efhub_card_id);
            if (det) {
              if (det.registered_position && w.registered_position && det.registered_position === w.registered_position) { score += 0.1; reasons.push("pos=="); }
              if (det.ovr_base != null && w.ovr_base != null && Math.abs(det.ovr_base - w.ovr_base) <= 1) { score += 0.1; reasons.push("baseOvr~1"); }
              if (det.level_cap != null && w.maximum_level != null && det.level_cap === w.maximum_level) { score += 0.05; reasons.push("levelCap=="); }
              if (det.height != null && w.height != null && det.height === w.height) { score += 0.03; reasons.push("h=="); }
              if (det.weight != null && w.weight != null && det.weight === w.weight) { score += 0.03; reasons.push("w=="); }
            }
            return { e, score, reasons };
          })
          .sort((a, b) => b.score - a.score);

        const best = scored[0];
        const second = scored[1];
        const clearWinner = best.score >= 0.75 && (!second || best.score - second.score >= 0.15);

        if (clearWinner) {
          const internalId = nextInternalId++;
          linkStmt.run(internalId, "efhub", best.e.efhub_card_id, nowIso());
          linkStmt.run(internalId, "world", w.world_card_id, nowIso());
          setInternal.run(internalId, w.world_card_id);
          highConfidence++;

          // 値の不一致（eFHUB 詳細がある場合のみ）
          const det = efhubDetail.get(best.e.efhub_card_id);
          if (det) {
            const cmp = [
              ["ovr_base", det.ovr_base, w.ovr_base],
              ["ovr_max", det.ovr_max, w.ovr_max],
              ["level_cap / maximum_level", det.level_cap, w.maximum_level],
              ["registered_position", det.registered_position, w.registered_position],
              ["playing_style", det.playing_style_name, w.playing_style],
              ["height", det.height, w.height],
              ["weight", det.weight, w.weight],
            ];
            for (const [field, ev, wv] of cmp) {
              if (ev != null && wv != null && String(ev) !== String(wv)) {
                dcStmt.run(internalId, best.e.efhub_card_id, w.world_card_id, field, String(ev), String(wv), nowIso(), best.score);
                conflicts++;
              }
            }
          }
        } else {
          // 候補として保存（自動統合しない）
          for (const s of scored.slice(0, 3)) {
            mcStmt.run(null, s.e.efhub_card_id, w.world_card_id, Math.round(s.score * 100) / 100, s.reasons.join("+"), nowIso());
          }
          candidates++;
        }
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      db.prepare("UPDATE sync_runs SET status='failed', finished_at=? WHERE id=?").run(nowIso(), runId);
      db.close();
      throw e;
    }

    db.prepare("UPDATE sync_runs SET status='done', finished_at=?, ok_count=? WHERE id=?").run(nowIso(), highConfidence, runId);

    const linkedInternal = db.prepare("SELECT COUNT(DISTINCT internal_card_id) AS n FROM source_record_links").get().n;
    const mcCount = db.prepare("SELECT COUNT(*) AS n FROM merge_candidates").get().n;
    const dcCount = db.prepare("SELECT COUNT(*) AS n FROM data_conflicts").get().n;
    const worldTotal = worldCards.length;

    db.close();

    const L = [];
    L.push("# World × eFHUB 照合レポート");
    L.push("");
    L.push(`実行日時: ${nowIso()}`);
    L.push(`DB: ${path.relative(ROOT, DB_PATH)}  外部アクセス: 0 回`);
    L.push("");
    L.push("## 結果");
    L.push(`- World カード総数: ${worldTotal}`);
    L.push(`- 高信頼一致（source_record_links に登録・internal_card_id 採番）: **${highConfidence}**（内部カード ${linkedInternal} 件）`);
    L.push(`- 曖昧（merge_candidates・人間確認待ち・自動統合しない）: World カード ${candidates} 件 / 候補行 ${mcCount}`);
    L.push(`- eFHUB 索引にマッチなし（World のみ）: ${noMatch}`);
    L.push(`- 値の不一致（data_conflicts・自動上書きしない）: ${dcCount}`);
    L.push("");
    L.push("## 照合キー");
    L.push("- 前提: 正規化英語名（無ければ日本語名）");
    L.push("- 加点: maxOVR 近接 / 登録ポジション一致 / 基礎OVR 近接 / levelCap 一致 / 身長・体重一致（eFHUB 詳細がある場合）");
    L.push("- 高信頼: score >= 0.75 かつ 2位との差 >= 0.15");
    L.push("");
    L.push("## 注意");
    L.push("- eFHUB 索引47,479件のうち多く（レガシーカード）は World（13,009件）に存在しない → World のみ / eFHUB のみ の非対称は想定内。");
    L.push("- eFHUB 詳細は19件のみのため、詳細レベルの競合検出は現状その19件に限られる。");
    L.push("- 能力値の対応は stat_key_map（tackling↔ballWinning など）で行う。能力値の値比較は Phase 次で。");
    L.push("- `player_cards`（eFHUB 詳細19件）は本処理で変更していない。");
    L.push("");
    L.push("## stat_key_map（World キー → eFHUB キー）");
    for (const [w, e] of STAT_KEY_MAP) if (w !== e) L.push(`- \`${w}\` → \`${e}\``);
    L.push("（他22キーは同一）");
    L.push("");
    await fs.mkdir(path.dirname(REPORT), { recursive: true });
    await fs.writeFile(REPORT, L.join("\n") + "\n", "utf8");

    console.log(`[reconcile] 高信頼一致 ${highConfidence} / 候補 ${candidates} / マッチなし ${noMatch} / 競合 ${dcCount}`);
    console.log(`[reconcile] レポート: ${path.relative(ROOT, REPORT)}`);
  });
}

main().catch((err) => {
  console.error("\n[reconcile] 中断:", err?.stack ?? err);
  process.exit(1);
});
