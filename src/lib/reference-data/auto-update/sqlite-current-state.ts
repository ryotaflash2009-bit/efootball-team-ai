import { transformManager, transformWorldPlayerCard, type ManagerSqliteRow, type WorldPlayerCardSqliteRow, type WorldPlayerSkillRow, type WorldPlayerStatRow } from "../migration-transform";
import {
  buildAiStylesMap,
  buildAppearanceMap,
  buildEfhubConflictsMap,
  buildEfhubLinkMap,
  buildManagerBoostersMap,
  buildManagerLinkUpPlaysMap,
  type AiStyleRow,
  type AppearanceRow,
  type DataConflictRow,
  type ManagerBoosterRow,
  type ManagerLinkUpConditionRow,
  type ManagerLinkUpPlayRow,
  type SourceRecordLinkRow,
} from "../detail-extension-transform";
import { computeNameSortKey } from "../name-sort-key";
import { UPDATE_TABLE_CONTRACTS } from "./update-contract";
import { assumeUtcIfNaiveIso } from "./source-world";

/**
 * 自動更新 Stage 1: ローカルSQLite(読み取り専用)から、Productionと同じ形の現在行を再構成する。
 *
 * Productionの参照データは、このSQLiteから一回限りの移行(pg-real-import・detail extension・
 * name_sort_key remediation)で作られた。同じtransformを使って現在行を作ることで、Productionへ
 * 接続せずに(Stage 1ではProduction接続は未承認)diff・policy・dry runを検証する。
 * 実Productionとの一致は保証しない(Stage 4ではBackupまたはread-only検証で確認する)。
 * SQLiteへは書き込まない(呼び出し側がreadOnlyで開いたDBを渡す)。
 */

export interface ReadOnlySqlite {
  prepare(sql: string): { all(): unknown[] };
}

export const SQLITE_DERIVED_DATASET_VERSION = "sqlite-derived-current-state";
const PLACEHOLDER_BATCH_ID = "00000000-0000-4000-8000-000000000000";

function pick(row: Readonly<Record<string, unknown>>, columns: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of columns) if (c in row) out[c] = row[c];
  return out;
}

function comparableColumns(table: "world_player_cards" | "managers"): string[] {
  const c = UPDATE_TABLE_CONTRACTS[table];
  return c.productionColumns.filter((col) => !["created_at", "updated_at"].includes(col));
}

/** PGのtext列へ移行されたboostは十進文字列。数値のままだとdiffで全件changedになるため揃える。 */
function boostText(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

function group<T extends { world_card_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const arr = m.get(r.world_card_id) ?? [];
    arr.push(r);
    m.set(r.world_card_id, arr);
  }
  return m;
}

export function buildWorldCurrentRowsFromSqlite(db: ReadOnlySqlite): Record<string, unknown>[] {
  const cards = db.prepare("SELECT * FROM world_player_cards").all() as WorldPlayerCardSqliteRow[];
  const stats = group(db.prepare("SELECT world_card_id, stat_key, value FROM world_player_stats").all() as WorldPlayerStatRow[]);
  const skills = group(db.prepare("SELECT world_card_id, skill_name, display_order FROM world_player_skills").all() as WorldPlayerSkillRow[]);
  const links = buildEfhubLinkMap(db.prepare("SELECT internal_card_id, source, source_card_id FROM source_record_links").all() as SourceRecordLinkRow[]);
  const ai = buildAiStylesMap(db.prepare("SELECT world_card_id, style_name, display_order FROM world_player_ai_styles").all() as AiStyleRow[]);
  const appearance = buildAppearanceMap(db.prepare("SELECT * FROM world_player_appearances").all() as AppearanceRow[]);
  const conflicts = buildEfhubConflictsMap(db.prepare("SELECT world_card_id, field_name, efhub_value, world_value FROM data_conflicts").all() as DataConflictRow[]);
  const cols = comparableColumns("world_player_cards");
  return cards.map((card) => {
    const base = transformWorldPlayerCard(card, stats.get(card.world_card_id) ?? [], skills.get(card.world_card_id) ?? [], SQLITE_DERIVED_DATASET_VERSION, PLACEHOLDER_BATCH_ID);
    return pick(
      {
        ...base,
        boost1: boostText(base.boost1),
        boost2: boostText(base.boost2),
        efhub_card_id: links.get(card.world_card_id) ?? null,
        ai_styles: ai.get(card.world_card_id) ?? [],
        appearance: appearance.get(card.world_card_id) ?? null,
        efhub_conflicts: conflicts.get(card.world_card_id) ?? [],
        name_sort_key: computeNameSortKey(base.name_en),
        // SQLiteにはupstreamの値(タイムゾーン無し)がそのまま入っている。Productionと同じくUTCとして扱う。
        appearance_updated_at: typeof base.appearance_updated_at === "string" ? assumeUtcIfNaiveIso(base.appearance_updated_at) : base.appearance_updated_at,
        import_batch_id: null,
      },
      cols,
    );
  });
}

export function buildManagerCurrentRowsFromSqlite(db: ReadOnlySqlite): Record<string, unknown>[] {
  const managers = db.prepare("SELECT * FROM managers").all() as ManagerSqliteRow[];
  const boosters = buildManagerBoostersMap(db.prepare("SELECT * FROM manager_boosters").all() as ManagerBoosterRow[]);
  const linkUps = buildManagerLinkUpPlaysMap(
    db.prepare("SELECT * FROM manager_link_up_plays").all() as ManagerLinkUpPlayRow[],
    db.prepare("SELECT * FROM manager_link_up_conditions").all() as ManagerLinkUpConditionRow[],
  );
  const cols = comparableColumns("managers");
  return managers.map((m) => {
    const base = transformManager(m, SQLITE_DERIVED_DATASET_VERSION, PLACEHOLDER_BATCH_ID);
    return pick(
      {
        ...base,
        boosters: boosters.get(m.internal_manager_id) ?? [],
        link_up_plays: linkUps.get(m.internal_manager_id) ?? [],
        name_sort_key: computeNameSortKey(base.name_en),
        import_batch_id: null,
      },
      cols,
    );
  });
}
