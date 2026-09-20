import { ALLOWED_TARGET_TABLES, REFERENCE_SCHEMA } from "../real-import-guards";
import type { GuardCheck } from "../real-import-guards";

/**
 * Production Backup対象の許可リスト(固定・外部入力から変更不可)。
 *
 * `real-import-guards.ts`の`ALLOWED_TARGET_TABLES`(初回投入・Promotionの書込み許可リストと
 * 同一の4テーブル: world_player_cards・managers・player_card_analysis・import_batches)を
 * そのまま再利用する。Backup専用の別リストを新設しない理由は、書込み対象とBackup対象を
 * 意図的に同一の単一の真実源にし、どちらかだけを更新して不整合になることを構造的に防ぐため。
 *
 * スキーマ名・テーブル名を引数から自由に組み立てる設計は一切採用しない
 * (このモジュールの外から任意の文字列を渡してBackup対象を変更することはできない)。
 */
export const BACKUP_TARGET_TABLES: readonly string[] = ALLOWED_TARGET_TABLES;
export const BACKUP_SOURCE_SCHEMA = REFERENCE_SCHEMA;

const FORBIDDEN_TABLE_PATTERNS: readonly RegExp[] = [/^auth\.users$/i, /^my_team_snapshots$/i, /^rls_probe_records$/i];

/** Backup対象テーブルが許可リストに含まれ、かつ利用者データテーブルの明示禁止リストに一致しないことを確認する。 */
export function checkBackupTargetAllowed(table: string): GuardCheck {
  if (FORBIDDEN_TABLE_PATTERNS.some((re) => re.test(table))) {
    return { ok: false, reason: `利用者データテーブルはBackup対象にできない: ${table}` };
  }
  if (!BACKUP_TARGET_TABLES.includes(table)) {
    return { ok: false, reason: `Backup対象の許可リストに含まれていないテーブル: ${table}` };
  }
  return { ok: true };
}

/** 要求されたテーブル集合が、許可リストと過不足なく一致することを確認する(想定外の追加・欠落を検出する)。 */
export function checkBackupTargetSetExact(requested: readonly string[]): GuardCheck {
  const requestedSet = new Set(requested);
  const allowedSet = new Set(BACKUP_TARGET_TABLES);
  const missing = BACKUP_TARGET_TABLES.filter((t) => !requestedSet.has(t));
  const unexpected = requested.filter((t) => !allowedSet.has(t));
  if (missing.length > 0 || unexpected.length > 0) {
    return {
      ok: false,
      reason: `Backup対象が許可リストと一致しない(不足: ${missing.join(",") || "なし"} / 想定外: ${unexpected.join(",") || "なし"})`,
    };
  }
  return { ok: true };
}
