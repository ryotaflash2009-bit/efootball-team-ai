import { MANAGER_SOURCE_COLUMNS } from "./source-managers";
import { WORLD_SOURCE_COLUMNS } from "./source-world";
import { UPDATE_TABLE_CONTRACTS, UPDATER_ROLE_CONTRACT } from "./update-contract";

/**
 * 自動更新 Phase G準備: Production書込み用role `reference_data_updater` の権限契約。
 *
 * 権限は列単位で与え、DB自体が保持規則を強制する:
 *   - UPDATEできるのはupstream由来の列と適用メタデータ(fetched_at・dataset_version・import_batch_id・
 *     updated_at)だけ。preserveOnUpdateColumns(World ai_styles・appearance、managersのinsert時のみの列)、
 *     eFHUB由来のlocally computed列(efhub_card_id・efhub_conflicts)、identity/主キーはUPDATEできない。
 *   - INSERTはsource列+主キー+適用メタデータだけ(eFHUB列・insert時のみの列はDDL既定値)。
 *   - DELETE・TRUNCATE・REFERENCES・TRIGGERは一切与えない。player_card_analysis・auth・publicへは何も与えない。
 *   - import_batchesはINSERTと、pending行のstatus遷移に必要な列のUPDATEだけ(RLSでpending行に限定)。
 * このmoduleはSQLを実行しない(SQL草案の監査・apply実装の列選択に使う定数だけ)。
 */

export const UPDATER_ROLE_NAME = UPDATER_ROLE_CONTRACT.roleName;
export type UpdaterTable = (typeof UPDATER_ROLE_CONTRACT.writableTables)[number];

const APPLY_METADATA_COLUMNS = ["fetched_at", "dataset_version", "import_batch_id"] as const;

function without(cols: readonly string[], excluded: readonly string[]): string[] {
  return cols.filter((c) => !excluded.includes(c));
}

const worldPreserved = [...UPDATE_TABLE_CONTRACTS.world_player_cards.preserveOnUpdateColumns, "efhub_card_id", "efhub_conflicts"];
const managerPreserved = [...UPDATE_TABLE_CONTRACTS.managers.preserveOnUpdateColumns];

export interface UpdaterColumnGrants {
  readonly select: "all";
  readonly insert: readonly string[];
  readonly update: readonly string[];
}

export const UPDATER_COLUMN_GRANTS: Readonly<Record<UpdaterTable, UpdaterColumnGrants>> = Object.freeze({
  world_player_cards: Object.freeze({
    select: "all",
    insert: Object.freeze([...WORLD_SOURCE_COLUMNS, ...APPLY_METADATA_COLUMNS]),
    update: Object.freeze([...without(WORLD_SOURCE_COLUMNS, ["world_card_id", ...worldPreserved]), ...APPLY_METADATA_COLUMNS, "updated_at"]),
  }),
  managers: Object.freeze({
    select: "all",
    insert: Object.freeze(["internal_manager_id", ...MANAGER_SOURCE_COLUMNS, ...APPLY_METADATA_COLUMNS]),
    update: Object.freeze([...without(MANAGER_SOURCE_COLUMNS, ["source", "source_manager_id", ...managerPreserved]), ...APPLY_METADATA_COLUMNS, "updated_at"]),
  }),
  import_batches: Object.freeze({
    select: "all",
    insert: Object.freeze(["batch_id", "dataset_version", "target_table", "source", "source_row_count", "inserted_row_count", "payload_hash", "status", "approved_by", "notes"]),
    update: Object.freeze(["status", "verified_at", "rolled_back_at"]),
  }),
});

/** 更新してはならない列(列単位grantの対象外であることを監査・テストで確認する)。 */
export const UPDATER_NEVER_UPDATED_COLUMNS: Readonly<Record<UpdaterTable, readonly string[]>> = Object.freeze({
  world_player_cards: Object.freeze(["world_card_id", ...worldPreserved, "created_at"]),
  managers: Object.freeze(["internal_manager_id", "source", "source_manager_id", ...without(managerPreserved, ["internal_manager_id"]), "created_at"]),
  import_batches: Object.freeze(["batch_id", "dataset_version", "target_table", "source", "source_row_count", "payload_hash", "approved_by", "notes", "created_at"]),
});

export const UPDATER_ROLE_SETTINGS = Object.freeze({
  statement_timeout: "120s",
  lock_timeout: "5s",
  idle_in_transaction_session_timeout: "60s",
  search_path: "reference_data",
  connectionLimit: 1,
} as const);

export const UPDATER_POLICY_NAMES = Object.freeze([
  "world_player_cards_updater_select",
  "world_player_cards_updater_insert",
  "world_player_cards_updater_update",
  "managers_updater_select",
  "managers_updater_insert",
  "managers_updater_update",
  "import_batches_updater_select",
  "import_batches_updater_insert",
  "import_batches_updater_update_pending",
] as const);

/** 更新文で使ってよい列だけを選ぶ(apply実装が列単位grantを超えないようにする)。 */
export function updaterUpdatableColumns(table: UpdaterTable): readonly string[] {
  return UPDATER_COLUMN_GRANTS[table].update;
}

export function updaterInsertableColumns(table: UpdaterTable): readonly string[] {
  return UPDATER_COLUMN_GRANTS[table].insert;
}
