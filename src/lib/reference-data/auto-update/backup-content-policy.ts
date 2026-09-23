import type { GuardCheck } from "../real-import-guards";
import { BACKUP_TARGET_TABLES } from "./backup-target";

/**
 * Production Backupの「内容妥当性」ゲート。
 *
 * 2026-09-23追記(workflow Run #6): workflowはsuccessで終了し、暗号化・R2 upload・
 * remote checksum検証もすべて成功したが、manifestを確認すると対象4テーブルが
 * すべて0行だった。空データ同士でも2回のexportのchecksumは一致し、空のRestoreも
 * 成功し、restoreVerified/storageVerifiedがtrueになってしまった。暗号化・保存・
 * checksumの成功は「内容が正しいこと」を何も保証しないため、行数そのものを
 * 独立したゲートとして検査する。
 *
 * 最低件数は「空または明らかに不正なBackupを必ず拒否する」ための下限であり、
 * UIの表示件数(選手13,009件・監督66件等)を固定値としてハードコードしない
 * (データ更新で件数が変わっても、正当なBackupを妨げないようにするため)。
 *
 * import_batchesも1件以上を要求する: 参照データの投入経路(初回投入・差分投入)は
 * すべてimport_batchesへ記録する設計であり、読み取り専用preflightの記録でも
 * Productionには既に複数件存在する。コアテーブルに行があるのにimport_batchesが
 * 0件という状態は、それ自体が異常(または行が見えていない)とみなす。
 */

export interface BackupContentPolicy {
  readonly minimumRowsByTable: Readonly<Record<string, number>>;
  readonly minimumTotalRows: number;
}

export const PRODUCTION_BACKUP_CONTENT_POLICY: BackupContentPolicy = Object.freeze({
  minimumRowsByTable: Object.freeze({
    world_player_cards: 1,
    managers: 1,
    player_card_analysis: 1,
    import_batches: 1,
  }),
  minimumTotalRows: 1,
});

/** manifest等のrowCountsが、対象4テーブルすべてについて妥当かつ最低件数を満たすかを判定する。失敗理由をすべて返す。 */
export function evaluateBackupContentPolicy(rowCounts: Readonly<Record<string, unknown>> | null | undefined, policy: BackupContentPolicy): GuardCheck[] {
  if (!rowCounts || typeof rowCounts !== "object") {
    return [{ ok: false, reason: "rowCountsが存在しない(内容妥当性を判定できない、blocked)" }];
  }

  const checks: GuardCheck[] = [];
  let total = 0;
  for (const table of BACKUP_TARGET_TABLES) {
    const minimum = policy.minimumRowsByTable[table];
    if (typeof minimum !== "number" || !Number.isInteger(minimum) || minimum < 0) {
      checks.push({ ok: false, reason: `${table}の最低件数がpolicyに定義されていない(blocked)` });
      continue;
    }
    const count = rowCounts[table];
    if (typeof count !== "number" || !Number.isInteger(count)) {
      checks.push({ ok: false, reason: `${table}の行数が整数ではない、または存在しない(blocked)` });
      continue;
    }
    if (count < 0) {
      checks.push({ ok: false, reason: `${table}の行数が負の値(blocked)` });
      continue;
    }
    if (count < minimum) {
      checks.push({ ok: false, reason: `${table}の行数(${count})が最低件数(${minimum})を下回る(空または不完全なBackup、blocked)` });
      continue;
    }
    total += count;
    checks.push({ ok: true });
  }

  const unexpected = Object.keys(rowCounts).filter((t) => !BACKUP_TARGET_TABLES.includes(t));
  if (unexpected.length > 0) {
    checks.push({ ok: false, reason: `rowCountsに対象外のテーブルが含まれている: ${unexpected.join(",")}(blocked)` });
  }

  if (checks.every((c) => c.ok) && total < policy.minimumTotalRows) {
    checks.push({ ok: false, reason: `全テーブル合計行数(${total})が最低件数(${policy.minimumTotalRows})を下回る(空Backup、blocked)` });
  }
  return checks;
}

export function failedContentPolicyReasons(rowCounts: Readonly<Record<string, unknown>> | null | undefined, policy: BackupContentPolicy): string[] {
  return evaluateBackupContentPolicy(rowCounts, policy)
    .filter((c) => !c.ok)
    .map((c) => c.reason ?? "理由不明");
}
