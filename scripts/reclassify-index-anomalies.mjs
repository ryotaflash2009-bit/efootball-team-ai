/**
 * Phase C 補正: player_index_entries の is_anomalous / anomaly_reason / detail_sync_status を
 * 修正済みの異常判定ルール（scripts/sqlite/db.mjs の classifyIndexAnomaly）で再計算する。
 *
 *   node scripts/reclassify-index-anomalies.mjs
 *
 * - **外部アクセス0回**。既存の DB 行（stored な id / name / ovr）だけで再判定する。
 * - 初回同期の "short id (< 10桁)" ルールが誤り（Mbappe 等の標準カードを大量に誤検出）だったため。
 *   実際の異常は 8554053 / 8554076（OVR120・詳細ページなし）のみ。
 * - player_cards 系6テーブルには書き込まない（19カード詳細データを保護）。
 * - 単一トランザクション。DELETE FROM は使わない（UPDATE のみ）。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, DB_PATH, tableCounts, classifyIndexAnomaly } from "./sqlite/db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPORT = path.join(ROOT, "docs", "phase-c-index-reclassify.md");

const PC_TABLES = [
  "player_cards", "player_card_stats", "player_card_skills",
  "player_card_com_skills", "player_card_positions", "player_card_boosters",
];
function pcCounts(db) {
  const o = {};
  for (const t of PC_TABLES) o[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  return o;
}

function main() {
  return openDb().then(async (db) => {
    const pcBefore = pcCounts(db);
    const now = new Date().toISOString();
    const runInfo = db.prepare("INSERT INTO sync_runs (kind, started_at, status) VALUES ('index-anomaly-reclassify', ?, 'running')").run(now);
    const runId = Number(runInfo.lastInsertRowid);

    const rows = db.prepare("SELECT efhub_card_id, name_en, name_ja, ovr_max_candidate, is_anomalous, detail_sync_status FROM player_index_entries").all();
    const cardIds = new Set(db.prepare("SELECT efhub_card_id FROM player_cards").all().map((r) => r.efhub_card_id));

    const updAnom = db.prepare("UPDATE player_index_entries SET is_anomalous=1, anomaly_reason=?, detail_sync_status='anomalous' WHERE efhub_card_id=?");
    const updNorm = db.prepare("UPDATE player_index_entries SET is_anomalous=0, anomaly_reason=NULL, detail_sync_status=? WHERE efhub_card_id=?");

    let becameNormal = 0;
    let stillAnom = 0;
    let becameAnom = 0;
    let unchanged = 0;
    const anomalyList = [];

    db.exec("BEGIN");
    try {
      for (const r of rows) {
        const reason = classifyIndexAnomaly(r.efhub_card_id, r.name_en, r.name_ja, r.ovr_max_candidate);
        const nowAnom = reason ? 1 : 0;
        if (nowAnom === 1) {
          anomalyList.push({ id: r.efhub_card_id, name_en: r.name_en, ovr: r.ovr_max_candidate, reason });
          if (r.is_anomalous === 1) {
            updAnom.run(reason, r.efhub_card_id); // 理由を最新化
            stillAnom++;
          } else {
            updAnom.run(reason, r.efhub_card_id);
            becameAnom++;
          }
        } else {
          if (r.is_anomalous === 1) {
            const status = cardIds.has(r.efhub_card_id) ? "fetched" : "pending";
            updNorm.run(status, r.efhub_card_id);
            becameNormal++;
          } else {
            unchanged++;
          }
        }
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      db.prepare("UPDATE sync_runs SET status='failed', finished_at=? WHERE id=?").run(new Date().toISOString(), runId);
      db.close();
      throw e;
    }

    // 誤って sync_errors に記録された「index anomaly: short id …」を SUPERSEDED マーク（DELETE しない）
    const supersede = db.prepare(
      "UPDATE sync_errors SET error = '[SUPERSEDED - anomaly rule corrected] ' || error " +
        "WHERE error LIKE 'index anomaly: short id%' AND error NOT LIKE '[SUPERSEDED%'",
    ).run();

    // 修正後の真の異常（8554053 / 8554076）を sync_errors へ（重複回避）
    const insErr = db.prepare("INSERT INTO sync_errors (run_id, efhub_card_id, http_status, error, attempt, at) VALUES (?, ?, 200, ?, 0, ?)");
    let addedErr = 0;
    for (const a of anomalyList) {
      const exists = db.prepare("SELECT COUNT(*) AS n FROM sync_errors WHERE efhub_card_id=? AND error LIKE 'index anomaly (corrected)%'").get(a.id).n;
      if (exists === 0) {
        insErr.run(runId, a.id, `index anomaly (corrected): ${a.reason}`, new Date().toISOString());
        addedErr++;
      }
    }

    // index_sync_stats に補正記録
    const finishedAt = new Date().toISOString();
    db.prepare(`INSERT INTO index_sync_stats
      (sync_run_id, mode, started_at, finished_at, received_count, new_count, updated_count,
       unchanged_count, anomaly_count, fail_count, status, prev_snapshot_hash, this_snapshot_hash,
       diff_summary, next_state_json)
      VALUES (?, 'reclassify', ?, ?, ?, 0, ?, ?, ?, 0, 'done', NULL, NULL, ?, NULL)`).run(
      runId, now, finishedAt, rows.length, becameNormal + stillAnom + becameAnom, unchanged, anomalyList.length,
      `becameNormal=${becameNormal} stillAnom=${stillAnom} becameAnom=${becameAnom}`,
    );
    db.prepare("UPDATE sync_runs SET status='done', finished_at=?, ok_count=?, fail_count=0 WHERE id=?")
      .run(finishedAt, rows.length, runId);

    // 分布
    const statusDist = Object.fromEntries(
      db.prepare("SELECT detail_sync_status AS s, COUNT(*) AS n FROM player_index_entries GROUP BY detail_sync_status").all().map((r) => [r.s, r.n]),
    );
    const anomCount = db.prepare("SELECT COUNT(*) AS n FROM player_index_entries WHERE is_anomalous=1").get().n;
    const pendingNonAnom = db.prepare("SELECT COUNT(*) AS n FROM player_index_entries WHERE detail_sync_status='pending' AND is_anomalous=0").get().n;
    const total = db.prepare("SELECT COUNT(*) AS n FROM player_index_entries").get().n;
    const finalCounts = tableCounts(db);
    const pcAfter = pcCounts(db);

    db.close();

    const pcUnchanged = JSON.stringify(pcBefore) === JSON.stringify(pcAfter);
    const md = buildReport({
      now, total, becameNormal, stillAnom, becameAnom, unchanged,
      anomalyList, statusDist, anomCount, pendingNonAnom,
      supersededErrors: supersede.changes, addedErr,
      pcBefore, pcAfter, pcUnchanged, finalCounts,
      dbRel: path.relative(ROOT, DB_PATH),
    });
    await fs.writeFile(REPORT, md, "utf8");

    console.log(`[reclassify] becameNormal=${becameNormal} stillAnom=${stillAnom} becameAnom=${becameAnom} unchanged=${unchanged}`);
    console.log(`[reclassify] 異常 ${anomCount} / 詳細取得対象(pending,非異常) ${pendingNonAnom} / 合計 ${total}`);
    console.log(`[reclassify] player_cards 保護=${pcUnchanged} / superseded sync_errors=${supersede.changes}`);
    console.log(`[reclassify] レポート: ${path.relative(ROOT, REPORT)}`);
  });
}

function buildReport(x) {
  const L = [];
  L.push("# Phase C 索引 異常判定の補正レポート");
  L.push("");
  L.push(`実行日時: ${x.now}`);
  L.push(`DB: ${x.dbRel}`);
  L.push("外部アクセス: 0 回（既存 DB 行のみで再判定）");
  L.push("");
  L.push("## 背景");
  L.push("- 初回索引同期の異常ルールに `short id (< 10桁)` を含めていたのが誤り。");
  L.push("  eFHUB の選手ID は「短いID（2〜8桁・標準カード）」と「長いID（14〜15桁・特殊カード）」の2レンジがあり、");
  L.push("  短いIDのカード（Mbappe 110718 / Haaland 133543 / C.Ronaldo 4522 等）を **34,088件も誤検出**していた。");
  L.push("- 修正後ルール（`scripts/sqlite/db.mjs` classifyIndexAnomaly）: invalid id / 両名空 / ovr 欠損or<1 / **ovr >= 115**。");
  L.push("");
  L.push("## 再判定結果");
  L.push(`- 対象行: ${x.total}`);
  L.push(`- 異常 → 正常 に変更: **${x.becameNormal}**`);
  L.push(`- 異常のまま（理由更新）: ${x.stillAnom}`);
  L.push(`- 正常 → 異常 に変更: ${x.becameAnom}`);
  L.push(`- 変更なし: ${x.unchanged}`);
  L.push("");
  L.push(`## 補正後の異常エントリ（全 ${x.anomalyList.length} 件）`);
  L.push("");
  L.push("| efhub_card_id | name_en | ovr | reason |");
  L.push("|---|---|---|---|");
  for (const a of x.anomalyList) L.push(`| ${a.id} | ${a.name_en} | ${a.ovr ?? "-"} | ${a.reason} |`);
  L.push("");
  L.push("## detail_sync_status 分布（補正後）");
  L.push("```");
  L.push(JSON.stringify(x.statusDist, null, 2));
  L.push("```");
  L.push(`- 異常（is_anomalous=1）: ${x.anomCount}`);
  L.push(`- Phase D の詳細取得対象（detail_sync_status='pending' AND is_anomalous=0）: **${x.pendingNonAnom}**`);
  L.push("");
  L.push("## sync_errors の整理");
  L.push(`- 誤記録（"index anomaly: short id …"）を SUPERSEDED マーク: ${x.supersededErrors} 件（DELETE せず UPDATE）`);
  L.push(`- 補正後の真の異常を追加記録: ${x.addedErr} 件`);
  L.push("");
  L.push("## 既存19カードの保護");
  L.push("```");
  L.push("事前: " + JSON.stringify(x.pcBefore));
  L.push("事後: " + JSON.stringify(x.pcAfter));
  L.push("```");
  L.push(`- player_cards 系6テーブル 不変: **${x.pcUnchanged}**`);
  L.push("");
  L.push("## テーブル件数（最終）");
  L.push("```");
  L.push(JSON.stringify(x.finalCounts, null, 2));
  L.push("```");
  L.push("");
  return L.join("\n") + "\n";
}

main().catch((err) => {
  console.error("\n[reclassify] 中断:", err?.stack ?? err);
  process.exit(1);
});
