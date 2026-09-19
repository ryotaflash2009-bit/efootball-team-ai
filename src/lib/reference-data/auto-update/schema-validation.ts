import type { StagingRecord } from "./types";

/**
 * 取得結果(StagingRecord[])に対する構造検証の純関数群。
 * 実DB・実ネットワークへは一切接続しない。
 */

export interface FieldRangeRule {
  field: string;
  min: number;
  max: number;
}

export interface RecordSchemaConfig {
  idPattern: RegExp;
  requiredFields: readonly string[];
  numericRanges?: readonly FieldRangeRule[];
  /** このテーブルで既知のフィールド名一覧。未知フィールドの検出に使う(スキーマ変更の早期発見)。 */
  knownFields: readonly string[];
}

export interface SchemaValidationIssue {
  recordId: string | null;
  reason: string;
}

export interface SchemaValidationResult {
  ok: boolean;
  validCount: number;
  invalidCount: number;
  issues: SchemaValidationIssue[];
  unknownFields: readonly string[];
}

export function validateStagingRecords(
  records: readonly StagingRecord[],
  config: RecordSchemaConfig,
): SchemaValidationResult {
  const issues: SchemaValidationIssue[] = [];
  const unknownFieldSet = new Set<string>();
  let validCount = 0;

  for (const record of records) {
    let recordOk = true;

    if (!config.idPattern.test(record.id)) {
      issues.push({ recordId: record.id, reason: `ID形式が不正: ${record.id}` });
      recordOk = false;
    }

    for (const field of config.requiredFields) {
      const value = record.fields[field];
      if (value === undefined || value === null || value === "") {
        issues.push({ recordId: record.id, reason: `必須フィールド欠損: ${field}` });
        recordOk = false;
      }
    }

    for (const rule of config.numericRanges ?? []) {
      const value = record.fields[rule.field];
      if (typeof value === "number" && (value < rule.min || value > rule.max)) {
        issues.push({
          recordId: record.id,
          reason: `${rule.field}が範囲外(${rule.min}〜${rule.max}): ${value}`,
        });
        recordOk = false;
      }
    }

    for (const key of Object.keys(record.fields)) {
      if (!config.knownFields.includes(key)) unknownFieldSet.add(key);
    }

    if (recordOk) validCount += 1;
  }

  return {
    ok: issues.length === 0,
    validCount,
    invalidCount: records.length - validCount,
    issues,
    unknownFields: [...unknownFieldSet].sort(),
  };
}

/** ID一意性の検証(取得結果内での重複を検出する)。 */
export function findDuplicateIds(records: readonly StagingRecord[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const r of records) {
    if (seen.has(r.id)) duplicates.add(r.id);
    seen.add(r.id);
  }
  return [...duplicates].sort();
}
