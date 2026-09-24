import { readFileSync } from "node:fs";
import path from "node:path";
import { buildBackupSummaryArtifact, serializeBackupSummaryArtifact } from "../backup-summary-artifact";
import { getBackupTableSpec } from "../backup-schema";
import { BACKUP_V2_ADDED_COLUMNS } from "../backup-column-coverage";
import { toManagerSourceRow } from "../source-managers";
import { normalizeWorldPlayerRecord, toWorldSourceRow } from "../source-world";
import { buildInsertRow } from "../update-diff";
import { APPLY_WORKFLOW_PATH, BACKUP_WORKFLOW_PATH, stage4RunTitle, type RecordedManagersResponse, type WorkflowRunFacts } from "../stage4-managers";

/**
 * Stage 4テスト用の合成データ(実データではない)。
 * 現在のmanagers 4件 + upstream 5件 = 追加1件・変更0件(Productionの66→67と同じ形)。
 */

const FIX = path.join(__dirname, "source");
export const T0 = "2026-09-20T00:00:00.000Z";
const TEMPLATE = (JSON.parse(readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8")) as Record<string, unknown>[])[0];
/** 有効な合成manager 5件(synthetic fixtureの1件目を雛形に、idと名前だけを変える)。 */
export const SYNTHETIC_MANAGERS: Record<string, unknown>[] = [1, 2, 3, 4, 5].map((i) => ({ ...TEMPLATE, id: `stage4-manager-${i}`, name: `Synthetic Stage4 Manager ${i}` }));
const SYNTHETIC_PLAYERS = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: Record<string, unknown>[] }).players;
export const SEED_BATCH_ID = "11111111-1111-4111-8111-111111111111";
export const COMMIT_SHA = "a".repeat(40);

export function managersResponse(list: readonly unknown[] = SYNTHETIC_MANAGERS): RecordedManagersResponse {
  return { status: 200, contentType: "text/plain; charset=utf-8", bodyText: JSON.stringify(list) };
}

/** Production形の現在行(先頭n件)。import_batch_idは既存の監査batchを指す。 */
export function currentManagerRows(n = 4): Record<string, unknown>[] {
  return SYNTHETIC_MANAGERS.slice(0, n)
    .map((m) => toManagerSourceRow(m, T0))
    .flatMap((r, i) => (r.ok ? [{ ...buildInsertRow("managers", r.row, i + 1), dataset_version: "v0", import_batch_id: SEED_BATCH_ID, created_at: T0, updated_at: T0 }] : []));
}

export function seedImportBatch(): Record<string, unknown> {
  return {
    batch_id: SEED_BATCH_ID, dataset_version: "v0", target_table: "managers", source: "managers-json", source_row_count: 4, inserted_row_count: 4,
    payload_hash: "0".repeat(64), status: "verified", approved_by: "owner", notes: "initial import", created_at: T0, verified_at: T0, rolled_back_at: null,
  };
}

export function worldRow(): Record<string, unknown> {
  const r = toWorldSourceRow(normalizeWorldPlayerRecord({ ...SYNTHETIC_PLAYERS[0], appearance: { ...((SYNTHETIC_PLAYERS[0].appearance as object) ?? {}), updatedAt: "2026-04-01T00:00:00" } }), T0);
  if (!r.ok) throw new Error("fixture world row");
  return { ...buildInsertRow("world_player_cards", r.row), dataset_version: "v0", import_batch_id: SEED_BATCH_ID };
}

export function state(n = 4) {
  const managers = currentManagerRows(n);
  return {
    managers,
    importBatches: [seedImportBatch()],
    counts: { world_player_cards: 1, managers: managers.length, import_batches: 1 },
    worldMaxUpdatedAt: T0,
  };
}

/** Backup workflowの非秘密要約(形式"2"・pre-apply)と同じ形の文字列。 */
export function backupSummaryText(runId: string, rowCounts: Record<string, number>, patch: (s: Record<string, unknown>) => void = () => undefined): string {
  const addedColumns: Record<string, unknown> = {};
  for (const key of BACKUP_V2_ADDED_COLUMNS) addedColumns[key] = { included: true, rows: rowCounts[key.split(".")[0]], nonNullRows: 0 };
  const summary: Record<string, unknown> = {
    phase: "upload", ok: true, storageVerified: true, restoreVerified: true,
    objectKey: `pre-apply/2026-09-24/gha-${runId}-1/0123456789ab.age`, manifestKey: `pre-apply/2026-09-24/gha-${runId}-1/0123456789ab.manifest.json`,
    jobId: `gha-${runId}-1`, category: "pre-apply", prefix: "pre-apply/", retentionCategory: "production-pre-apply", retentionDays: null, expiresAt: null,
    rowCounts, totalChecksum: "b".repeat(64), encryptionAlgorithm: "age-x25519", backupVersion: "2",
    columnCoverage: {
      formatVersion: "2",
      columnCounts: Object.fromEntries(["world_player_cards", "managers", "player_card_analysis", "import_batches"].map((t) => [t, getBackupTableSpec(t, "2").columns.length])),
      addedColumns,
    },
  };
  patch(summary);
  return serializeBackupSummaryArtifact(buildBackupSummaryArtifact({ ok: true, reasons: [], summary }, new Date("2026-09-24T10:00:00.000Z")), []);
}

export function runFacts(kind: "plan" | "dry-run" | "backup" | "apply", id: number, at: { created: string; updated: string }, patch: Partial<WorkflowRunFacts> = {}): WorkflowRunFacts {
  return {
    id,
    path: kind === "backup" ? BACKUP_WORKFLOW_PATH : APPLY_WORKFLOW_PATH,
    event: "workflow_dispatch",
    headBranch: "main",
    headSha: COMMIT_SHA,
    status: "completed",
    conclusion: "success",
    runAttempt: 1,
    displayTitle: kind === "backup" ? "Reference data Production backup (manual, approval-gated)" : stage4RunTitle(kind),
    createdAt: at.created,
    updatedAt: at.updated,
    ...patch,
  };
}

export const minutesAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000).toISOString();
