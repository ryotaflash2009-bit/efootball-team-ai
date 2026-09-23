import { describe, it, expect } from "vitest";
import {
  AUTO_UPDATE_TARGET_TABLES,
  AUTO_UPDATE_EXCLUDED_TABLES,
  UPDATE_TABLE_CONTRACTS,
  KNOWN_BACKUP_COLUMN_GAPS,
  getUpdateTableContract,
  assertAutoUpdateTargetTable,
  normalizeTargetTableSet,
  worldCardIdentity,
  managerIdentity,
  importBatchIdentity,
  rowIdentity,
  findDuplicateIdentities,
  canonicalizeJsonbValue,
  canonicalizeTextArray,
  normalizeTimestamp,
  canonicalizeUpdateRow,
  computeUpdateRowChecksum,
  computeUpdateTableChecksum,
  computeUpdateTotalChecksum,
  compareJsonbKeys,
  shortChecksum,
  computeUpdateIdempotencyKey,
  computeBackupIdempotencyKey,
  computeApplyIdempotencyKey,
  CONCURRENCY_GROUPS,
  STAGE_CONCURRENCY,
  DIFF_CATEGORIES,
  LEGACY_DIFF_FIELD_MAP,
  MAX_SAMPLE_IDENTIFIERS,
  validateUpdateDiffReport,
  SECRET_BOUNDARIES,
  BACKUP_SECRET_NAMES,
  APPLY_SECRET_NAMES,
  UPDATER_ROLE_CONTRACT,
  validateUpdateEvidence,
  canTransitionImportBatchStatus,
  type UpdateEvidence,
} from "./update-contract";
import { ALLOWED_TARGET_TABLES } from "../real-import-guards";
import { BACKUP_TABLE_SPECS } from "./backup-schema";
import { REQUIRED_ENV_NAMES } from "./run-production-backup-cli";
import { computeRecordChecksum } from "./diff";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function worldRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of UPDATE_TABLE_CONTRACTS.world_player_cards.productionColumns) row[col] = null;
  return {
    ...row,
    world_card_id: "88041460996837",
    name_en: "Synthetic Player",
    stats: { pace: 80, ovr: 90 },
    skills: ["Skill B", "Skill A"],
    ai_styles: [],
    efhub_conflicts: [],
    source: "efootball-world.com",
    appearance_updated_at: "2026-09-01T12:00:00Z",
    fetched_at: "2026-09-02T00:00:00Z",
    dataset_version: "v1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("table contracts", () => {
  it("自動更新の対象tableは正確にworld_player_cards・managers・import_batchesの3件(固定順序)", () => {
    expect([...AUTO_UPDATE_TARGET_TABLES]).toEqual(["world_player_cards", "managers", "import_batches"]);
    expect(Object.isFrozen(AUTO_UPDATE_TARGET_TABLES)).toBe(true);
  });

  it("player_card_analysisは対象外(frozen、自動操作なし、物理削除禁止)", () => {
    expect([...AUTO_UPDATE_EXCLUDED_TABLES]).toEqual(["player_card_analysis"]);
    const c = UPDATE_TABLE_CONTRACTS.player_card_analysis;
    expect(c.tableClass).toBe("frozen_internal_manual_dataset");
    expect(c.automaticUpdateTarget).toBe(false);
    expect(c.allowedAutomaticOperations).toEqual([]);
    expect(() => assertAutoUpdateTargetTable("player_card_analysis")).toThrow(/対象外/);
  });

  it("契約tableの集合は既存の許可リスト(ALLOWED_TARGET_TABLES)と完全に一致する(別のallowlistを作らない)", () => {
    expect(Object.keys(UPDATE_TABLE_CONTRACTS).sort()).toEqual([...ALLOWED_TARGET_TABLES].sort());
  });

  it("auth/user dataのtable・reference_data以外のschema・未知tableはfail closed", () => {
    for (const t of ["auth.users", "public.my_team_snapshots", "my_team_snapshots", "rls_probe_records", "reference_data_ops.update_jobs", "unknown_table", "", "world_player_cards_x"]) {
      expect(() => getUpdateTableContract(t), t).toThrow(/blocked/);
    }
    expect(getUpdateTableContract("reference_data.managers").table).toBe("managers");
  });

  it("table集合は契約順へ正規化され、対象外・重複・空はblocked", () => {
    expect(normalizeTargetTableSet(["import_batches", "world_player_cards"])).toEqual(["world_player_cards", "import_batches"]);
    expect(() => normalizeTargetTableSet(["world_player_cards", "auth.users"])).toThrow();
    expect(() => normalizeTargetTableSet(["world_player_cards", "player_card_analysis"])).toThrow();
    expect(() => normalizeTargetTableSet(["managers", "managers"])).toThrow(/重複/);
    expect(() => normalizeTargetTableSet([])).toThrow();
  });

  it("全tableで物理削除は禁止、removedはtombstone候補またはforbidden", () => {
    for (const c of Object.values(UPDATE_TABLE_CONTRACTS)) expect(c.physicalDeleteAllowed).toBe(false);
    expect(UPDATE_TABLE_CONTRACTS.world_player_cards.removalHandling).toBe("tombstone_candidate_manual_review");
    expect(UPDATE_TABLE_CONTRACTS.managers.removalHandling).toBe("tombstone_candidate_manual_review");
    expect(UPDATE_TABLE_CONTRACTS.import_batches.removalHandling).toBe("forbidden");
  });

  it("World cardのlocally computed fieldsはefhub_card_id・efhub_conflicts・name_sort_keyで、比較対象から外さない", () => {
    const c = UPDATE_TABLE_CONTRACTS.world_player_cards;
    expect([...c.locallyComputedColumns].sort()).toEqual(["efhub_card_id", "efhub_conflicts", "name_sort_key"]);
    for (const col of c.locallyComputedColumns) expect(c.volatileColumns).not.toContain(col);
  });

  it("managersのupstream identityはsource+source_manager_idで、主キーinternal_manager_idは更新時に保持する", () => {
    const c = UPDATE_TABLE_CONTRACTS.managers;
    expect(c.identity).toBe("manager_source_identity");
    expect(c.primaryKeyColumn).toBe("internal_manager_id");
    expect(c.preserveOnUpdateColumns).toContain("internal_manager_id");
    expect(c.unresolvedRequirements.join(" ")).toMatch(/unique constraint/);
  });

  it("import_batchesはappend onlyで、status遷移はpending→verified/rolled_back・verified→rolled_backの一方向だけ", () => {
    const c = UPDATE_TABLE_CONTRACTS.import_batches;
    expect(c.tableClass).toBe("audit_metadata");
    expect(c.allowedAutomaticOperations).toEqual(["append"]);
    expect(c.volatileColumns).toEqual([]);
    expect(canTransitionImportBatchStatus("pending", "verified")).toBe(true);
    expect(canTransitionImportBatchStatus("verified", "rolled_back")).toBe(true);
    expect(canTransitionImportBatchStatus("verified", "pending")).toBe(false);
    expect(canTransitionImportBatchStatus("rolled_back", "verified")).toBe(false);
  });

  it("volatile columnsはworld/managersだけで、appearance_updated_atは含めない(upstreamの更新シグナル)", () => {
    const expected = ["created_at", "dataset_version", "fetched_at", "import_batch_id", "updated_at"];
    expect([...UPDATE_TABLE_CONTRACTS.world_player_cards.volatileColumns].sort()).toEqual(expected);
    expect([...UPDATE_TABLE_CONTRACTS.managers.volatileColumns].sort()).toEqual(expected);
    expect(UPDATE_TABLE_CONTRACTS.world_player_cards.volatileColumns).not.toContain("appearance_updated_at");
    const canonical = canonicalizeUpdateRow("world_player_cards", worldRow());
    expect(canonical.appearance_updated_at).toBe("2026-09-01T12:00:00.000Z");
    expect(computeUpdateRowChecksum("world_player_cards", worldRow())).not.toBe(computeUpdateRowChecksum("world_player_cards", worldRow({ appearance_updated_at: "2026-09-03T00:00:00Z" })));
  });

  it("Production列(DDL基準)とBackup specの差は、KNOWN_BACKUP_COLUMN_GAPSと完全に一致する(Phase Fで解消したらこのテストが知らせる)", () => {
    for (const spec of BACKUP_TABLE_SPECS) {
      const contract = UPDATE_TABLE_CONTRACTS[spec.table as keyof typeof UPDATE_TABLE_CONTRACTS];
      const missing = contract.productionColumns.filter((c) => !spec.columns.includes(c));
      const extra = spec.columns.filter((c) => !contract.productionColumns.includes(c));
      expect(missing.sort(), spec.table).toEqual([...KNOWN_BACKUP_COLUMN_GAPS[contract.table]].sort());
      expect(extra, spec.table).toEqual([]);
    }
  });

  it("jsonb/text[]列の契約はBackup specのjsonb列と一致する", () => {
    for (const spec of BACKUP_TABLE_SPECS) {
      const contract = UPDATE_TABLE_CONTRACTS[spec.table as keyof typeof UPDATE_TABLE_CONTRACTS];
      expect([...contract.jsonbColumns].sort(), spec.table).toEqual([...spec.jsonbColumns].sort());
    }
  });
});

describe("identity contracts", () => {
  it("world_card_idは数字だけの文字列、空白・非文字列・null・undefined・fallbackなし", () => {
    expect(worldCardIdentity("88041460996837")).toBe("88041460996837");
    for (const bad of ["", " 123", "123 ", "12a", "1".repeat(21), 123, null, undefined]) expect(() => worldCardIdentity(bad), String(bad)).toThrow();
  });

  it("manager identityはsource+source_manager_idのcanonical JSONで、trimされ、区切り文字で曖昧にならない", () => {
    expect(managerIdentity("  amine250/efootball-managers ", " 12 ")).toBe(JSON.stringify(["amine250/efootball-managers", "12"]));
    expect(managerIdentity("a:b", "c")).not.toBe(managerIdentity("a", "b:c"));
    expect(managerIdentity("a|b", "c")).not.toBe(managerIdentity("a", "b|c"));
    for (const [s, id] of [["", "1"], ["src", " "], [null, "1"], ["src", undefined], ["src", 12], ["sr\u0000c", "1"]] as const) {
      expect(() => managerIdentity(s, id), `${String(s)}/${String(id)}`).toThrow();
    }
  });

  it("import_batchesのidentityは小文字正規形UUIDだけ", () => {
    expect(importBatchIdentity("123e4567-e89b-42d3-a456-426614174000")).toBe("123e4567-e89b-42d3-a456-426614174000");
    for (const bad of ["123E4567-E89B-42D3-A456-426614174000", "not-a-uuid", "", null, undefined]) expect(() => importBatchIdentity(bad)).toThrow();
  });

  it("rowIdentityはtable契約に従い、manager名・表示名ではidentityを作らない", () => {
    expect(rowIdentity("world_player_cards", { world_card_id: "1" })).toBe("1");
    expect(rowIdentity("managers", { source: "s", source_manager_id: "9", name_en: "X" })).toBe('["s","9"]');
    expect(() => rowIdentity("managers", { name_en: "Only Name" })).toThrow();
  });

  it("重複identityを検出する", () => {
    expect(findDuplicateIdentities(["1", "2", "1", "3", "2"])).toEqual(["1", "2"]);
    expect(findDuplicateIdentities(["1", "2"])).toEqual([]);
  });
});

describe("canonicalization and checksum contracts", () => {
  it("jsonbのobject keyはPostgreSQL jsonbと同じ順序(短いkeyが先、同じ長さはバイト順)へ再帰的に並べる", () => {
    const out = canonicalizeJsonbValue({ pace: 1, ovr: 2, nested: { name: "x", n: 1 }, list: [{ zz: 1, a: 2 }] });
    expect(JSON.stringify(out)).toBe('{"ovr":2,"list":[{"a":2,"zz":1}],"pace":1,"nested":{"n":1,"name":"x"}}');
    expect(["name", "n", "abc", "ab"].sort(compareJsonbKeys)).toEqual(["n", "ab", "abc", "name"]);
  });

  it("key順序が違うだけのobjectは同じchecksumになる(決定性)", () => {
    const a = computeUpdateRowChecksum("world_player_cards", worldRow({ stats: { ovr: 90, pace: 80 } }));
    const b = computeUpdateRowChecksum("world_player_cards", worldRow({ stats: { pace: 80, ovr: 90 } }));
    expect(a).toBe(b);
  });

  it("text[]は元の順序を保持し、要素が文字列でなければblocked", () => {
    expect(canonicalizeTextArray(["B", "A"])).toEqual(["B", "A"]);
    const ab = computeUpdateRowChecksum("world_player_cards", worldRow({ skills: ["A", "B"] }));
    const ba = computeUpdateRowChecksum("world_player_cards", worldRow({ skills: ["B", "A"] }));
    expect(ab).not.toBe(ba);
    expect(() => canonicalizeTextArray(["A", 1])).toThrow();
    expect(() => canonicalizeTextArray("A")).toThrow();
  });

  it("SQL NULLはnullとして扱い、undefined・欠落列はblocked", () => {
    expect(canonicalizeUpdateRow("world_player_cards", worldRow({ appearance: null })).appearance).toBeNull();
    const missing = worldRow();
    delete missing.name_ja;
    expect(() => canonicalizeUpdateRow("world_player_cards", missing)).toThrow(/欠落/);
    expect(() => canonicalizeUpdateRow("world_player_cards", worldRow({ name_ja: undefined }))).toThrow(/欠落/);
    expect(() => canonicalizeJsonbValue({ a: undefined })).toThrow();
  });

  it("NaN・Infinityはblocked、負のゼロは0へ正規化する", () => {
    expect(() => canonicalizeUpdateRow("world_player_cards", worldRow({ ovr_base: Number.NaN }))).toThrow();
    expect(() => canonicalizeUpdateRow("world_player_cards", worldRow({ ovr_base: Infinity }))).toThrow();
    expect(() => canonicalizeJsonbValue({ v: -Infinity })).toThrow();
    expect(Object.is(canonicalizeJsonbValue(-0), 0)).toBe(true);
  });

  it("jsonbで表現できない値(Date・bigint・関数・NUL文字)はblocked", () => {
    for (const bad of [new Date(0), BigInt(1), () => 1, "a\u0000b"]) expect(() => canonicalizeJsonbValue({ v: bad })).toThrow();
  });

  it("timestampはUTC・ミリ秒付きISO 8601へ正規化し、タイムゾーンなし・不正値はblocked", () => {
    expect(normalizeTimestamp("2026-09-01T21:00:00+09:00")).toBe("2026-09-01T12:00:00.000Z");
    expect(normalizeTimestamp("2026-09-01T12:00:00.5Z")).toBe("2026-09-01T12:00:00.500Z");
    expect(normalizeTimestamp(new Date("2026-09-01T12:00:00Z"))).toBe("2026-09-01T12:00:00.000Z");
    for (const bad of ["2026-09-01T12:00:00", "2026-09-01", "not a date", "2026-13-45T00:00:00Z", 1_700_000_000_000, null]) expect(() => normalizeTimestamp(bad), String(bad)).toThrow();
  });

  it("volatile columnsの変化だけではchecksumが変わらない", () => {
    const a = computeUpdateRowChecksum("world_player_cards", worldRow());
    const b = computeUpdateRowChecksum("world_player_cards", worldRow({ fetched_at: "2026-09-10T00:00:00Z", dataset_version: "v2", import_batch_id: "123e4567-e89b-42d3-a456-426614174000" }));
    expect(a).toBe(b);
  });

  it("契約外の列はschema driftとしてblocked", () => {
    expect(() => canonicalizeUpdateRow("world_player_cards", worldRow({ likes_count: 3 }))).toThrow(/schema drift/);
  });

  it("row checksumは既存computeRecordChecksum(Backupと同じ関数)を正規化済みの行へ適用したもの", () => {
    const row = worldRow();
    expect(computeUpdateRowChecksum("world_player_cards", row)).toBe(computeRecordChecksum(canonicalizeUpdateRow("world_player_cards", row)));
  });

  it("table checksumは行の入力順序に依存せず、重複identityはblocked", () => {
    const r1 = worldRow({ world_card_id: "1" });
    const r2 = worldRow({ world_card_id: "2" });
    expect(computeUpdateTableChecksum("world_player_cards", [r1, r2])).toBe(computeUpdateTableChecksum("world_player_cards", [r2, r1]));
    expect(() => computeUpdateTableChecksum("world_player_cards", [r1, r1])).toThrow(/重複/);
  });

  it("total checksumは契約のtable順で決まり、入力のkey順序に依存せず、対象外tableはblocked", () => {
    expect(computeUpdateTotalChecksum({ managers: SHA_B, world_player_cards: SHA_A })).toBe(computeUpdateTotalChecksum({ world_player_cards: SHA_A, managers: SHA_B }));
    expect(() => computeUpdateTotalChecksum({ player_card_analysis: SHA_A })).toThrow();
  });

  it("Evidence用の短縮checksumは12文字", () => {
    expect(shortChecksum(SHA_A)).toBe("a".repeat(12));
    expect(() => shortChecksum("abc")).toThrow();
  });
});

describe("diff category contract", () => {
  it("9つのcategoryを持ち、duplicate/invalid/schema_drift/source_missingはhard_block、removed/resurrectedはmanual_review", () => {
    expect(Object.keys(DIFF_CATEGORIES).sort()).toEqual(["added", "changed", "duplicate", "invalid", "removed", "resurrected", "schema_drift", "source_missing", "unchanged"]);
    for (const c of ["duplicate", "invalid", "schema_drift", "source_missing"] as const) expect(DIFF_CATEGORIES[c].defaultSeverity).toBe("hard_block");
    for (const c of ["removed", "resurrected"] as const) expect(DIFF_CATEGORIES[c].defaultSeverity).toBe("manual_review");
    expect(DIFF_CATEGORIES.removed.appliesAutomatically).toBe(false);
    expect(DIFF_CATEGORIES.removed.meaning).toMatch(/物理削除を意味しない/);
  });

  it("既存diff.tsの名称(updated/removedCandidate)との対応を固定する", () => {
    expect(LEGACY_DIFF_FIELD_MAP).toEqual({ added: "added", updated: "changed", removedCandidate: "removed", unchanged: "unchanged" });
  });

  function report(overrides: Record<string, unknown> = {}) {
    return {
      table: "world_player_cards", beforeCount: 10, afterCount: 11, addedCount: 1, changedCount: 2, removedCount: 0, unchangedCount: 8,
      resurrectedCount: 0, duplicateCount: 0, invalidCount: 0, schemaDriftCount: 0, sourceMissingCount: 0,
      beforeChecksum: SHA_A, afterChecksum: SHA_B, sourceMetadataChecksum: SHA_A, sampleIdentifiers: ["1", "2"], changedFieldNames: ["stats", "skills"],
      ...overrides,
    };
  }

  it("正しいdiff reportは合格し、行データ・変更値・契約外の列名・上限超過のsampleはblocked", () => {
    expect(validateUpdateDiffReport(report())).toEqual([]);
    expect(validateUpdateDiffReport(report({ rows: [{ world_card_id: "1" }] })).join(" ")).toMatch(/契約外のkey/);
    expect(validateUpdateDiffReport(report({ changedValues: { stats: 1 } })).join(" ")).toMatch(/契約外のkey/);
    expect(validateUpdateDiffReport(report({ changedFieldNames: ["password"] })).join(" ")).toMatch(/契約外の列名/);
    expect(validateUpdateDiffReport(report({ sampleIdentifiers: Array.from({ length: MAX_SAMPLE_IDENTIFIERS + 1 }, (_, i) => String(i)) })).join(" ")).toMatch(/最大/);
    expect(validateUpdateDiffReport(report({ sampleIdentifiers: ["Lionel Messi"] })).join(" ")).toMatch(/identity形式/);
    expect(validateUpdateDiffReport(report({ table: "auth.users" })).join(" ")).toMatch(/契約外/);
  });
});

describe("idempotency and concurrency contracts", () => {
  const base = { sourceChecksum: SHA_A, targetTables: ["world_player_cards", "managers", "import_batches"], updaterVersion: "1.0.0" };

  it("idempotency keyは決定的で、table集合の順序に依存しない", () => {
    expect(computeUpdateIdempotencyKey(base)).toBe(computeUpdateIdempotencyKey(base));
    expect(computeUpdateIdempotencyKey({ ...base, targetTables: ["import_batches", "managers", "world_player_cards"] })).toBe(computeUpdateIdempotencyKey(base));
  });

  it("source checksum・updater version・table集合が変われば変化する", () => {
    const k = computeUpdateIdempotencyKey(base);
    expect(computeUpdateIdempotencyKey({ ...base, updaterVersion: "1.0.1" })).not.toBe(k);
    expect(computeUpdateIdempotencyKey({ ...base, sourceChecksum: SHA_B })).not.toBe(k);
    expect(computeUpdateIdempotencyKey({ ...base, targetTables: ["world_player_cards", "import_batches"] })).not.toBe(k);
  });

  it("不正なsource checksum・対象外table・不正なversionはblocked", () => {
    expect(() => computeUpdateIdempotencyKey({ ...base, sourceChecksum: "x" })).toThrow();
    expect(() => computeUpdateIdempotencyKey({ ...base, targetTables: ["world_player_cards", "player_card_analysis"] })).toThrow();
    expect(() => computeUpdateIdempotencyKey({ ...base, updaterVersion: "1.0 ; drop" })).toThrow();
  });

  it("Backup/apply keyはupdate keyから導出され、互いに異なる", () => {
    const k = computeUpdateIdempotencyKey(base);
    const b = computeBackupIdempotencyKey(k);
    const a = computeApplyIdempotencyKey(k, "12345");
    expect(new Set([k, b, a]).size).toBe(3);
    expect(computeApplyIdempotencyKey(k, "12346")).not.toBe(a);
    expect(() => computeApplyIdempotencyKey(k, "run-1")).toThrow();
  });

  it("Backup・apply・rollbackは同じProduction write groupで直列化し、detectionは別group", () => {
    expect(CONCURRENCY_GROUPS).toEqual({ detection: "reference-data-update-detection", productionWrite: "reference-data-production-write" });
    for (const s of ["backup", "production_apply", "rollback"] as const) {
      expect(STAGE_CONCURRENCY[s]).toEqual({ scope: "global_production_write", group: "reference-data-production-write" });
    }
    expect(STAGE_CONCURRENCY.detection.scope).toBe("parallel_allowed");
  });
});

describe("secret boundary contract", () => {
  it("Backupの7 Secretは既存CLIの必須環境変数と完全に一致する(変更なし)", () => {
    expect([...BACKUP_SECRET_NAMES].sort()).toEqual([...REQUIRED_ENV_NAMES].sort());
    expect([...SECRET_BOUNDARIES.backup.requiredSecrets].sort()).toEqual([...REQUIRED_ENV_NAMES].sort());
  });

  it("detection・dry run・通知はSecretを一切持たず、Backup/apply Secretを禁止する", () => {
    for (const c of ["detection", "dry_run", "notification"] as const) {
      expect(SECRET_BOUNDARIES[c].requiredSecrets).toEqual([]);
      for (const s of [...BACKUP_SECRET_NAMES, ...APPLY_SECRET_NAMES]) expect(SECRET_BOUNDARIES[c].forbiddenSecrets).toContain(s);
    }
  });

  it("Backup credentialとapply credentialは分離され、どのcomponentも両方を必要としない", () => {
    expect(APPLY_SECRET_NAMES.filter((s) => (BACKUP_SECRET_NAMES as readonly string[]).includes(s))).toEqual([]);
    expect(SECRET_BOUNDARIES.backup.forbiddenSecrets).toEqual([...APPLY_SECRET_NAMES]);
    expect(SECRET_BOUNDARIES.production_apply.forbiddenSecrets).toEqual([...BACKUP_SECRET_NAMES]);
    for (const b of Object.values(SECRET_BOUNDARIES)) {
      expect(b.requiredSecrets.filter((s) => b.forbiddenSecrets.includes(s))).toEqual([]);
      expect(b.logPolicy).toBe("never_log_secret_values");
    }
  });

  it("apply roleはBackup roleと別で、NOBYPASSRLS・非owner・player_card_analysisへ書き込まない", () => {
    expect(UPDATER_ROLE_CONTRACT.roleName).not.toBe(SECRET_BOUNDARIES.backup.dbRole);
    expect(UPDATER_ROLE_CONTRACT.bypassRls).toBe(false);
    expect(UPDATER_ROLE_CONTRACT.tableOwner).toBe(false);
    expect(UPDATER_ROLE_CONTRACT.writableTables).not.toContain("player_card_analysis");
    expect(SECRET_BOUNDARIES.production_apply.environment).toBe("reference-data-production-apply");
    expect(SECRET_BOUNDARIES.backup.environment).toBe("production-backup-approval");
  });
});

describe("evidence contract", () => {
  function evidence(overrides: Partial<Record<keyof UpdateEvidence | string, unknown>> = {}): Record<string, unknown> {
    const e: UpdateEvidence = {
      batchId: "123e4567-e89b-42d3-a456-426614174000",
      idempotencyKey: SHA_A,
      sourceChecksum: SHA_B,
      sourceTimestamp: "2026-09-01T00:00:00.000Z",
      detectedAt: "2026-09-02T00:00:00.000Z",
      updaterVersion: "1.0.0",
      contractVersion: "1",
      commitSha: "c".repeat(40),
      targetTables: ["world_player_cards", "managers"],
      beforeCounts: { world_player_cards: 13009, managers: 66 },
      afterCounts: { world_player_cards: 13010, managers: 66 },
      diffCounts: { world_player_cards: { added: 1, changed: 3, unchanged: 13006 } },
      beforeChecksums: { world_player_cards: "a".repeat(12) },
      afterChecksums: { world_player_cards: "b".repeat(12) },
      sourceMetadataChecksum: SHA_A,
      policyResult: "manual_review",
      policyReasons: ["world_additions"],
      sampleIdentifiers: { world_player_cards: ["88041460996837"], managers: ['["amine250/efootball-managers","12"]'] },
      backupRunId: "35589905624",
      backupValidity: "valid",
      dryRunResult: "verified",
      approvalTimestamp: null,
      applyTimestamp: null,
      postVerifyResult: "not_run",
      finalStatus: "awaiting_production_approval",
    };
    return { ...e, ...overrides };
  }

  it("許可されたfieldだけの正しいEvidenceは合格する", () => {
    expect(validateUpdateEvidence(evidence())).toEqual([]);
  });

  it("行データ・変更値・未知のfieldを拒否する", () => {
    expect(validateUpdateEvidence(evidence({ rows: [{ world_card_id: "1", name_en: "X" }] })).join(" ")).toMatch(/契約外のkey: rows/);
    expect(validateUpdateEvidence(evidence({ changedValues: { stats: { ovr: 91 } } })).join(" ")).toMatch(/契約外のkey/);
  });

  it("Secret・接続文字列・private endpoint・秘密鍵・token様の値を拒否する", () => {
    for (const bad of [
      "postgresql://u:p@db.example/postgres",
      "https://example.test/path",
      "host.pooler.supabase.com",
      "AGE-SECRET-KEY-1QQQQQQQQ",
      "eyJhbGciOiJIUzI1NiJ9.payload",
      "password=hunter2",
    ]) {
      expect(validateUpdateEvidence(evidence({ policyReasons: [bad] })).length, bad).toBeGreaterThan(0);
    }
  });

  it("完全なobject keyを拒否する(Evidenceにはrun IDだけを残す)", () => {
    expect(validateUpdateEvidence(evidence({ finalStatus: "pre-apply/2026-09-21/gha-1-1/abcdef123456.age" })).length).toBeGreaterThan(0);
  });

  it("sample identifiersは上限以下かつidentity形式だけ(名前・個人データを入れない)", () => {
    const tooMany = Array.from({ length: MAX_SAMPLE_IDENTIFIERS + 1 }, (_, i) => String(i + 1));
    expect(validateUpdateEvidence(evidence({ sampleIdentifiers: { world_player_cards: tooMany } })).join(" ")).toMatch(/最大/);
    expect(validateUpdateEvidence(evidence({ sampleIdentifiers: { world_player_cards: ["Lionel Messi"] } })).join(" ")).toMatch(/identity形式/);
  });

  it("user/auth tableをEvidenceのtable別mapへ入れられない", () => {
    expect(validateUpdateEvidence(evidence({ beforeCounts: { "auth.users": 5 } })).join(" ")).toMatch(/契約外のtable/);
    expect(validateUpdateEvidence(evidence({ sampleIdentifiers: { my_team_snapshots: ["1"] } })).join(" ")).toMatch(/契約外のtable/);
    expect(validateUpdateEvidence(evidence({ policyReasons: ["user@example.com"] })).length).toBeGreaterThan(0);
  });

  it("table別checksumは12桁の短縮表示だけ(完全なchecksumはEvidenceへ出さない)", () => {
    expect(validateUpdateEvidence(evidence({ beforeChecksums: { world_player_cards: SHA_A } })).join(" ")).toMatch(/短縮/);
    expect(validateUpdateEvidence(evidence({ policyReasons: [`checksum ${SHA_A}`] })).join(" ")).toMatch(/完全なchecksum/);
  });

  it("必須fieldの欠落を検出する", () => {
    const e = evidence();
    delete e.finalStatus;
    expect(validateUpdateEvidence(e).join(" ")).toMatch(/必須keyが無い: finalStatus/);
  });
});
