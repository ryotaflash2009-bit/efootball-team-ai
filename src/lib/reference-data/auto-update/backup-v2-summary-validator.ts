import { BACKUP_V2_ADDED_COLUMNS } from "./backup-column-coverage";
import { resolveBackupCategory, type BackupCategory } from "./backup-category";
import { PRODUCTION_BACKUP_CONTENT_POLICY, evaluateBackupContentPolicy } from "./backup-content-policy";
import { getBackupTableSpec } from "./backup-schema";
import { BACKUP_SUMMARY_ARTIFACT_SCHEMA } from "./backup-summary-artifact";
import { BACKUP_TARGET_TABLES } from "./backup-target";

/**
 * Stage 3: Production Backup v2(形式"2")を本人が実行した後、GitHub Actionsの非秘密要約artifact
 * (`reference-data-backup-summary.json`)だけを読んで、Backupが有効かを判定する。
 *
 * - 入力は要約JSONの文字列だけ(Production・R2・Secretへは一切アクセスしない)。
 * - 1つでも満たさなければ無効(BACKUP_V2_INVALID)。「警告だけで通す」項目は作らない。
 * - Run #7(形式"1")の行数を基準に、Productionの行数がApply前のまま変わっていないことも確かめる
 *   (Stage 3時点ではProductionへの書き込みは行っていないため、差があれば原因を調べるまで無効とする)。
 */

/** Run #7(2026-09-23検証済み、形式"1")の行数。Stage 3までProductionは更新していない。 */
export const RUN7_BASELINE_ROW_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  world_player_cards: 13009,
  managers: 66,
  player_card_analysis: 19,
  import_batches: 8,
});

export interface BackupV2ValidationOptions {
  readonly expectedCategory?: BackupCategory;
  /** nullなら行数の基準照合をしない(基準自体が変わったことを本人が確認した場合だけ)。 */
  readonly baselineRowCounts?: Readonly<Record<string, number>> | null;
}

export interface BackupV2ValidationResult {
  readonly ok: boolean;
  readonly verdict: "BACKUP_V2_VALID" | "BACKUP_V2_INVALID";
  readonly problems: readonly string[];
  readonly facts: Readonly<Record<string, unknown>>;
}

const TOP_KEYS = ["generatedAt", "ok", "reasons", "schema", "summary"];
const REQUIRED_SUMMARY_KEYS = [
  "phase", "ok", "storageVerified", "restoreVerified", "objectKey", "manifestKey", "jobId", "category", "prefix",
  "retentionCategory", "retentionDays", "expiresAt", "rowCounts", "totalChecksum", "encryptionAlgorithm", "backupVersion", "columnCoverage",
];
/** 要約に現れてはならない文字列(接続文字列・証明書・鍵・保存先host等)。 */
const SECRET_LIKE: readonly RegExp[] = [
  /postgres(ql)?:\/\//i, /-----BEGIN [A-Z ]+-----/, /AGE-SECRET-KEY-/i, /\bage1[0-9a-z]{50,}\b/, /r2\.cloudflarestorage\.com/i,
  /\.supabase\.(co|com)\b/i, /pooler\./i, /password/i, /secret_access_key/i,
];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

export function validateBackupV2Summary(text: string, options: BackupV2ValidationOptions = {}): BackupV2ValidationResult {
  const problems: string[] = [];
  const add = (p: string) => problems.push(p);
  const done = (facts: Record<string, unknown> = {}): BackupV2ValidationResult => ({
    ok: problems.length === 0,
    verdict: problems.length === 0 ? "BACKUP_V2_VALID" : "BACKUP_V2_INVALID",
    problems,
    facts,
  });
  const category = options.expectedCategory ?? "pre-apply";
  const baseline = options.baselineRowCounts === undefined ? RUN7_BASELINE_ROW_COUNTS : options.baselineRowCounts;

  for (const re of SECRET_LIKE) if (re.test(text)) add(`secret_like_content:${re.source}`);
  if (problems.length > 0) return done();

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    add("not_json");
    return done();
  }
  if (!isObj(doc)) {
    add("not_object");
    return done();
  }
  if (JSON.stringify(Object.keys(doc).sort()) !== JSON.stringify(TOP_KEYS)) add("top_level_keys");
  if (doc.schema !== BACKUP_SUMMARY_ARTIFACT_SCHEMA) add("artifact_schema");
  if (doc.ok !== true) add("artifact_not_ok");
  if (!Array.isArray(doc.reasons) || doc.reasons.length > 0) add("artifact_reasons_not_empty");
  if (typeof doc.generatedAt !== "string" || Number.isNaN(Date.parse(doc.generatedAt))) add("generated_at");
  const s = doc.summary;
  if (!isObj(s)) {
    add("summary_missing");
    return done();
  }

  for (const k of REQUIRED_SUMMARY_KEYS) if (!(k in s)) add(`summary_key_missing:${k}`);
  for (const k of Object.keys(s)) if (!REQUIRED_SUMMARY_KEYS.includes(k)) add(`summary_key_unexpected:${k}`);
  if (s.phase !== "upload") add("phase_not_upload");
  if (s.ok !== true) add("summary_not_ok");
  if (s.restoreVerified !== true) add("restore_not_verified");
  if (s.storageVerified !== true) add("storage_not_verified");
  if (s.backupVersion !== "2") add("format_version_not_2");
  if (s.encryptionAlgorithm !== "age-x25519") add("encryption_algorithm");
  if (typeof s.totalChecksum !== "string" || !/^[0-9a-f]{64}$/.test(s.totalChecksum)) add("total_checksum");

  // category・prefix・保持期間(backup-category.tsの対応だけが正)。
  const mapping = resolveBackupCategory(category).mapping;
  if (s.category !== category) add("category");
  if (!mapping || s.prefix !== mapping.prefix) add("prefix");
  if (!mapping || s.retentionCategory !== mapping.retentionCategory) add("retention_category");
  if (!mapping || s.retentionDays !== mapping.retentionDays) add("retention_days");
  if (mapping?.retentionDays === null ? s.expiresAt !== null : typeof s.expiresAt !== "string") add("expires_at");

  // object key: <prefix><YYYY-MM-DD>/<jobId>/<checksum12>.age と、同じbaseの.manifest.json。
  const jobId = typeof s.jobId === "string" ? s.jobId : "";
  if (!/^gha-\d{1,20}-\d{1,4}$/.test(jobId)) add("job_id");
  const keyRe = /^([a-z-]+\/)(\d{4}-\d{2}-\d{2})\/([A-Za-z0-9_-]+)\/([0-9a-f]{12})\.age$/;
  const km = typeof s.objectKey === "string" ? s.objectKey.match(keyRe) : null;
  if (!km || km[1] !== mapping?.prefix || km[3] !== jobId) add("object_key");
  else if (s.manifestKey !== km[0].replace(/\.age$/, ".manifest.json")) add("manifest_key");

  // 行数: 4 tableちょうど、空Backup(Run #6)の拒否、Run #7基準との一致。
  const rc = s.rowCounts;
  if (!isObj(rc) || JSON.stringify(Object.keys(rc).sort()) !== JSON.stringify([...BACKUP_TARGET_TABLES].sort()) || !Object.values(rc).every(isCount)) {
    add("row_counts_shape");
  } else {
    for (const c of evaluateBackupContentPolicy(rc, PRODUCTION_BACKUP_CONTENT_POLICY)) if (!c.ok) add(`content_policy:${c.reason ?? "failed"}`);
    if (baseline) for (const t of BACKUP_TARGET_TABLES) if (rc[t] !== baseline[t]) add(`row_count_differs_from_run7:${t}`);
  }

  // 形式"2"の追加4列: 収録・行数一致・非null件数の範囲。
  const cov = s.columnCoverage;
  const nonNull: Record<string, number> = {};
  if (!isObj(cov) || cov.formatVersion !== "2" || !isObj(cov.columnCounts) || !isObj(cov.addedColumns)) {
    add("column_coverage_shape");
  } else {
    for (const t of BACKUP_TARGET_TABLES) if (cov.columnCounts[t] !== getBackupTableSpec(t, "2").columns.length) add(`column_count:${t}`);
    const keys = Object.keys(cov.addedColumns).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...BACKUP_V2_ADDED_COLUMNS].sort())) add("added_columns_set");
    for (const key of BACKUP_V2_ADDED_COLUMNS) {
      const c = cov.addedColumns[key];
      const table = key.split(".")[0];
      if (!isObj(c) || c.included !== true) {
        add(`added_column_not_included:${key}`);
        continue;
      }
      if (!isCount(c.rows) || !isObj(rc) || c.rows !== rc[table]) add(`added_column_rows:${key}`);
      if (!isCount(c.nonNullRows) || (isCount(c.rows) && c.nonNullRows > c.rows)) add(`added_column_non_null:${key}`);
      else nonNull[key] = c.nonNullRows;
    }
  }

  return done({
    category: s.category ?? null,
    backupVersion: s.backupVersion ?? null,
    rowCounts: isObj(rc) ? rc : null,
    addedColumnNonNullRows: nonNull,
    restoreVerified: s.restoreVerified ?? null,
    storageVerified: s.storageVerified ?? null,
    objectKey: typeof s.objectKey === "string" ? s.objectKey : null,
  });
}
