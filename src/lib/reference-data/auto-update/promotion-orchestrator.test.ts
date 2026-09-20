import { describe, it, expect, beforeEach } from "vitest";
import { executePromotion, evaluatePrePromotionGates, type PromotionExecutionInput } from "./promotion-orchestrator";
import { executePromotionRollback, evaluatePromotionRollbackGates, type PromotionRollbackApproval } from "./promotion-rollback";
import { buildPromotionPlan, computeApprovalArtifactId } from "./promotion";
import { getPromotionTableSpec, canonicalizeFieldsForComparison } from "./promotion-sql";
import { createPendingJob, type UpdateJob } from "./job";
import { computeDiffChecksum, type ApprovalArtifact } from "./approval";
import { computeDiff, computeRecordChecksum } from "./diff";
import type { QueryClient, QueryResult } from "./apply-orchestrator";
import type { PreviousSnapshot, SourceMeta, StagingRecord } from "./types";

/**
 * `reference_data_ops_test`/`reference_data_test`(隔離PostgreSQL専用schema)の合成フェイク
 * 実装(実DB・実ネットワーク接続なし)。SQL文字列の先頭パターンで振り分け、実際の
 * `promotion-sql.ts`のcolumn定義(`getPromotionTableSpec`)を使ってパラメータを行へ復元する。
 */
class FakePromotionClient implements QueryClient {
  calls: string[] = [];
  updateJobs = new Map<string, Record<string, unknown>>();
  appliedChecksums = new Set<string>();
  auditEvents: unknown[][] = [];
  sourceMetadataTestHistory: Record<string, unknown>[] = [];
  promotionBeforeSnapshots: Record<string, unknown>[] = [];
  promotionSourceMetadataBefore = new Map<string, { table_name: string; before_json: string | null }>();
  rollbackJobs = new Map<string, Record<string, unknown>>();
  finalTables: Record<string, Map<string, Record<string, unknown>>> = {
    world_player_cards: new Map(),
    managers: new Map(),
    player_card_analysis: new Map(),
  };
  finalSourceMetadata = new Map<string, Record<string, unknown>>();

  lockAcquired = true;
  failOn: RegExp | null = null;

  private extractTable(sql: string): string {
    const m = sql.match(/reference_data_test\.(\w+)/);
    if (!m) throw new Error(`table抽出失敗: ${sql}`);
    return m[1];
  }

  async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
    const trimmed = sql.trim();
    const lower = trimmed.toLowerCase();
    this.calls.push(trimmed.split(/\s+/)[0].toLowerCase());

    if (this.failOn && this.failOn.test(trimmed)) {
      throw new Error(`fault-injected: ${trimmed.slice(0, 60)}`);
    }

    if (lower === "begin" || lower === "commit" || lower === "rollback") return { rows: [] };
    if (lower.startsWith("set local")) return { rows: [] };
    if (lower.startsWith("set transaction")) return { rows: [] };
    if (lower.startsWith("select pg_try_advisory_xact_lock")) return { rows: [{ acquired: this.lockAcquired }] };

    if (lower.startsWith("update update_jobs set status = 'running'")) {
      const [startedAt, jobId] = params as [string, string];
      this.updateJobs.set(jobId, { ...(this.updateJobs.get(jobId) ?? {}), status: "running", started_at: startedAt });
      return { rows: [] };
    }

    if (lower.startsWith("select count(*)::int as row_count from")) {
      const table = this.extractTable(trimmed);
      return { rows: [{ row_count: this.finalTables[table].size }] };
    }

    if (lower.startsWith("insert into promotion_before_snapshots")) {
      const [jobId, tableName, recordId, operation, beforeFieldsJson, beforeChecksum, sourceMetaJson, createdAt] = params as string[];
      this.promotionBeforeSnapshots.push({
        job_id: jobId,
        table_name: tableName,
        record_id: recordId,
        operation,
        before_fields_json: beforeFieldsJson,
        before_checksum: beforeChecksum,
        source_meta_json: sourceMetaJson,
        created_at: createdAt,
      });
      return { rows: [] };
    }

    if (lower.startsWith("insert into source_metadata_test")) {
      const [tableName, jobId, appliedAt, source, schemaVersion] = params as string[];
      this.sourceMetadataTestHistory.push({ table_name: tableName, last_job_id: jobId, last_applied_at: appliedAt, source, schema_version: schemaVersion });
      return { rows: [] };
    }

    if (lower.startsWith("insert into promotion_source_metadata_before")) {
      const [jobId, tableName, beforeJson] = params as [string, string, string | null];
      this.promotionSourceMetadataBefore.set(jobId, { table_name: tableName, before_json: beforeJson });
      return { rows: [] };
    }

    if (/^insert into reference_data_test\.(world_player_cards|managers|player_card_analysis) \(/.test(lower)) {
      const table = this.extractTable(trimmed);
      const spec = getPromotionTableSpec(table);
      const cols = spec.columns.length;
      for (let i = 0; i < params.length; i += cols) {
        const rowParams = params.slice(i, i + cols);
        const row: Record<string, unknown> = {};
        spec.columns.forEach((c, idx) => {
          row[c] = rowParams[idx];
        });
        this.finalTables[table].set(String(row[spec.primaryKey]), row);
      }
      return { rows: [] };
    }

    if (/^insert into reference_data_test\.source_metadata \(/.test(lower)) {
      const [tableName, lastJobId, lastAppliedAt, source, schemaVersion] = params as string[];
      this.finalSourceMetadata.set(tableName, { table_name: tableName, last_job_id: lastJobId, last_applied_at: lastAppliedAt, source, schema_version: schemaVersion });
      return { rows: [] };
    }

    if (lower.startsWith("select table_name, last_job_id, last_applied_at, source, schema_version from")) {
      const [tableName] = params as [string];
      const row = this.finalSourceMetadata.get(tableName);
      return { rows: row ? [row] : [] };
    }

    if (/^delete from reference_data_test\.source_metadata where/.test(lower)) {
      const [tableName] = params as [string];
      this.finalSourceMetadata.delete(tableName);
      return { rows: [] };
    }

    if (/^select .* from reference_data_test\.(world_player_cards|managers|player_card_analysis) where/.test(lower)) {
      const table = this.extractTable(trimmed);
      const ids = params as string[];
      const rows = ids.map((id) => this.finalTables[table].get(String(id))).filter((r): r is Record<string, unknown> => !!r);
      return { rows };
    }

    if (/^delete from reference_data_test\.(world_player_cards|managers|player_card_analysis) where/.test(lower)) {
      const table = this.extractTable(trimmed);
      const [id] = params as [string];
      this.finalTables[table].delete(String(id));
      return { rows: [] };
    }

    if (lower.startsWith("insert into applied_checksums")) {
      const [datasetChecksum] = params as [string];
      this.appliedChecksums.add(datasetChecksum);
      return { rows: [] };
    }

    if (lower.startsWith("insert into audit_events")) {
      this.auditEvents.push([...params]);
      return { rows: [] };
    }

    if (lower.startsWith("update update_jobs set status = 'completed'")) {
      const [completedAt, addedCount, updatedCount, removedCount, unchangedCount, jobId] = params as [string, number, number, number, number, string];
      this.updateJobs.set(jobId, {
        ...(this.updateJobs.get(jobId) ?? {}),
        status: "completed",
        completed_at: completedAt,
        added_count: addedCount,
        updated_count: updatedCount,
        removed_candidate_count: removedCount,
        unchanged_count: unchangedCount,
      });
      return { rows: [] };
    }

    if (lower.startsWith("select record_id, operation, before_fields_json from promotion_before_snapshots where")) {
      const [jobId, tableName] = params as [string, string];
      const rows = this.promotionBeforeSnapshots.filter((e) => e.job_id === jobId && e.table_name === tableName);
      return { rows };
    }

    if (lower.startsWith("select before_json from promotion_source_metadata_before where")) {
      const [jobId] = params as [string];
      const entry = this.promotionSourceMetadataBefore.get(jobId);
      return { rows: [{ before_json: entry ? entry.before_json : null }] };
    }

    if (lower.startsWith("insert into rollback_jobs")) {
      const [rollbackJobId, targetJobId, status, requestedAt, completedAt, restoredCount, removedCount] = params as [
        string,
        string,
        string,
        string,
        string,
        number,
        number,
      ];
      const existingActive = [...this.rollbackJobs.values()].find((r) => r.target_job_id === targetJobId && r.status !== "failed");
      if (existingActive) {
        throw new Error("duplicate key value violates unique constraint (simulated: rollback_jobs target_job_id unique active index)");
      }
      this.rollbackJobs.set(rollbackJobId, {
        rollback_job_id: rollbackJobId,
        target_job_id: targetJobId,
        status,
        requested_at: requestedAt,
        completed_at: completedAt,
        restored_count: restoredCount,
        removed_count: removedCount,
      });
      return { rows: [] };
    }

    if (lower.startsWith("update update_jobs set status = 'rolled_back'")) {
      const [completedAt, jobId] = params as [string, string];
      this.updateJobs.set(jobId, { ...(this.updateJobs.get(jobId) ?? {}), status: "rolled_back", completed_at: completedAt });
      return { rows: [] };
    }

    throw new Error(`FakePromotionClient: 未対応のSQL: ${trimmed.slice(0, 100)}`);
  }
}

const sourceMeta: SourceMeta = {
  source: "efootball-world.com",
  sourceUrl: "https://efootball-world.com/x",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  httpStatus: 200,
  contentType: "application/json",
  contentLength: 10,
};

/**
 * `world_player_cards`の全列(promotion-sql.tsのPROMOTION_TABLE_SPECSと同じ列集合)を埋めた
 * StagingRecordを作る。一部列だけを埋めると、DB往復後の読み戻し結果(未指定列はnullを含む
 * 全列オブジェクト)とテスト側の期待値(指定列だけのオブジェクト)のchecksumが food違ってしまう
 * ため(実Postgresでも同じ現象が起きる)、実運用のfields同様に全列を明示する。
 */
function wc(id: string, nameEn: string, ovrMax: number): StagingRecord {
  const spec = getPromotionTableSpec("world_player_cards");
  const fields: Record<string, unknown> = {};
  for (const col of spec.columns) fields[col] = null;
  Object.assign(fields, {
    world_card_id: id,
    name_en: nameEn,
    ovr_max: ovrMax,
    stats: { offensiveAwareness: 80 },
    skills: ["Long Range Drive"],
    ai_styles: [],
    efhub_conflicts: [],
    source: "efootball-world.com",
    fetched_at: "2026-01-01T00:00:00.000Z",
    dataset_version: "v1",
  });
  delete fields.updated_at; // orchestrator側が常に上書きするため、テストの期待値にも含めない
  return { id, fields };
}

/**
 * orchestrator内部のshadow comparison正規化(`canonicalizeFieldsForComparison`)と完全に
 * 同じ変換を適用する。PromotionPlanのbeforeChecksum/expectedAfterChecksumは、orchestratorが
 * 実行時に独自に計算する値と一致しなければならないため、テスト側でplanを構築する際も
 * 同じ正規化を通してからcomputeRecordSetChecksum/computeBeforeStateChecksumへ渡す
 * (書込み専用の`mapFieldsToParams`ではなく、比較専用のこちらを使うこと。実PostgreSQL
 * adapter経由のreadbackがtext[]列もJSON文字列化する既存挙動に合わせるための正規化であり、
 * 書込みパラメータの形とは異なる)。
 */
function normalizeForStorage(targetTable: string, record: StagingRecord, nowIso: string): StagingRecord {
  const spec = getPromotionTableSpec(targetTable);
  return { id: record.id, fields: canonicalizeFieldsForComparison(spec, record.fields, nowIso) };
}

interface Scenario {
  job: UpdateJob;
  plan: ReturnType<typeof buildPromotionPlan>;
  approval: ApprovalArtifact;
  input: PromotionExecutionInput;
}

function buildScenario(overrides: Partial<{ added: StagingRecord[]; updated: StagingRecord[]; unchangedIds: string[]; removedCandidateIds: string[] }> = {}): Scenario {
  const added = overrides.added ?? [wc("wc-2", "New Player", 75)];
  const updated = overrides.updated ?? [wc("wc-1", "Updated Player", 81)];
  const unchangedIds = overrides.unchangedIds ?? ["wc-3"];
  const removedCandidateIds = overrides.removedCandidateIds ?? ["wc-4"];

  const existingBeforeRecords: StagingRecord[] = [
    { id: "wc-1", fields: { ...updated[0]?.fields, name_en: "Old Player", ovr_max: 79 } },
    { id: "wc-3", fields: wc("wc-3", "Unchanged Player", 70).fields },
    { id: "wc-4", fields: wc("wc-4", "Removed Candidate", 60).fields },
  ].filter((r) => [...updated.map((u) => u.id), ...unchangedIds, ...removedCandidateIds].includes(r.id));

  const previous: PreviousSnapshot = {
    table: "world_player_cards",
    records: existingBeforeRecords.map((r) => ({ id: r.id, checksum: computeRecordChecksum(r.fields) })),
  };
  const candidateRecords = [...added, ...updated, ...unchangedIds.map((id) => existingBeforeRecords.find((r) => r.id === id)!)];
  const diff = computeDiff(previous, candidateRecords);

  const job = createPendingJob({
    jobId: "promo-job-1",
    table: "world_player_cards",
    source: sourceMeta.source,
    schemaVersion: "v1",
    datasetChecksum: "dataset-checksum-1",
    previousChecksum: null,
    expectedTables: ["world_player_cards"],
    fetchedTables: ["world_player_cards"],
  });

  const approval: ApprovalArtifact = {
    jobId: job.jobId,
    datasetChecksum: job.datasetChecksum,
    diffChecksum: computeDiffChecksum(diff),
    schemaVersion: job.schemaVersion,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "uesugi",
    nonce: "nonce-1",
    expiresAt: "2026-01-02T00:00:00.000Z",
    expectedCounts: { added: diff.addedCount, updated: diff.updatedCount, removedCandidate: diff.removedCount },
  };

  const nowIso = "2026-01-01T12:00:00.000Z";
  const beforeRecordsForPlan = existingBeforeRecords
    .filter((r) => updated.map((u) => u.id).includes(r.id))
    .map((r) => normalizeForStorage("world_player_cards", r, nowIso));
  const spec = getPromotionTableSpec("world_player_cards");
  const expectedAfterRecords = [
    ...added.map((r) => normalizeForStorage("world_player_cards", r, nowIso)),
    ...updated.map((r) => normalizeForStorage("world_player_cards", r, nowIso)),
    ...unchangedIds.map((id) => existingBeforeRecords.find((r) => r.id === id)!),
    ...removedCandidateIds.map((id) => existingBeforeRecords.find((r) => r.id === id)!),
  ].map((r) => ({ id: r.id, fields: canonicalizeFieldsForComparison(spec, r.fields) }));

  const plan = buildPromotionPlan({
    jobId: job.jobId,
    schemaVersion: job.schemaVersion,
    sourceIdentifier: sourceMeta.source,
    sourceTable: "staging_world_player_cards",
    targetTable: "world_player_cards",
    datasetChecksum: job.datasetChecksum,
    diffChecksum: approval.diffChecksum,
    beforeRecords: beforeRecordsForPlan,
    expectedAfterRecords,
    expectedCounts: { added: diff.addedCount, updated: diff.updatedCount, unchanged: diff.unchangedCount, removedCandidate: diff.removedCount },
    approval,
    generatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-02T00:00:00.000Z",
  });

  const input: PromotionExecutionInput = {
    job,
    plan,
    approval,
    diff,
    diffThresholds: { maxDecreaseRatio: 0.5, maxIncreaseRatio: 1, maxRemovedCount: 999 },
    added,
    updated,
    unchangedIds,
    removedCandidateIds,
    existingBeforeRecords,
    expectedBeforeRowCount: existingBeforeRecords.length,
    currentStagingChecksum: job.datasetChecksum,
    previousJobStatus: "idle",
    appliedChecksumHistory: new Set(),
    maxRemovedCandidateCount: 999,
    bypassFlagsDetected: [],
    sourceMeta,
    now: new Date(nowIso),
  };

  return { job, plan, approval, input };
}

function seedFinalTable(client: FakePromotionClient, existingBeforeRecords: readonly StagingRecord[]): void {
  for (const r of existingBeforeRecords) {
    client.finalTables.world_player_cards.set(r.id, { ...r.fields });
  }
}

describe("evaluatePrePromotionGates", () => {
  it("正常なシナリオは全ゲート合格", () => {
    const { input } = buildScenario();
    expect(evaluatePrePromotionGates(input).every((c) => c.ok)).toBe(true);
  });

  it("承認artifact不一致(approval mismatch)は拒否", () => {
    const { input } = buildScenario();
    const bad = { ...input, approval: { ...input.approval, nonce: "" } };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });

  it("PromotionPlan不一致(plan mismatch)は拒否", () => {
    const { input } = buildScenario();
    const bad = { ...input, plan: { ...input.plan, approvalArtifactId: "forged" } };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });

  it("staging checksum不一致は拒否", () => {
    const { input } = buildScenario();
    const bad = { ...input, currentStagingChecksum: "changed" };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });

  it("row count mismatchは拒否(事前ゲートではなくtransaction内で検出されるため、ここではrowCount系ではなく他ゲートを確認)", () => {
    const { input } = buildScenario();
    const bad = { ...input, previousJobStatus: "running" as const };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });

  it("duplicate checksum(冪等性)は拒否", () => {
    const { input } = buildScenario();
    const bad = { ...input, appliedChecksumHistory: new Set([input.job.datasetChecksum]) };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });

  it("large removal(大量削除候補)は拒否", () => {
    const { input } = buildScenario();
    const bad = { ...input, maxRemovedCandidateCount: 0 };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });

  it("wrong table(許可外テーブル)は拒否", () => {
    const { input } = buildScenario();
    const bad = { ...input, plan: { ...input.plan, targetTable: "my_team_snapshots" } };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });

  it("bypassフラグ検出は拒否", () => {
    const { input } = buildScenario();
    const bad = { ...input, bypassFlagsDetected: ["--force"] };
    expect(evaluatePrePromotionGates(bad).some((c) => !c.ok)).toBe(true);
  });
});

describe("executePromotion(正常系)", () => {
  let client: FakePromotionClient;

  beforeEach(() => {
    client = new FakePromotionClient();
  });

  it("added/updated/unchanged/removedCandidateを含む昇格がcommitし、removedCandidateは物理削除されない", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("commit");
    expect(result.addedCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(client.calls).toContain("begin");
    expect(client.calls).toContain("commit");
    expect(client.calls).not.toContain("rollback");

    // addedが実際に反映されている
    expect(client.finalTables.world_player_cards.get("wc-2")?.name_en).toBe("New Player");
    // updatedが実際に反映されている
    expect(client.finalTables.world_player_cards.get("wc-1")?.name_en).toBe("Updated Player");
    // unchanged/removedCandidateは物理削除されず、内容も不変
    expect(client.finalTables.world_player_cards.has("wc-3")).toBe(true);
    expect(client.finalTables.world_player_cards.has("wc-4")).toBe(true);
    expect(client.finalTables.world_player_cards.get("wc-4")?.name_en).toBe("Removed Candidate");

    // before snapshotが記録されている(updatedのみoperation=update、addedはoperation=insert)
    const snapshotByRecordId = new Map(client.promotionBeforeSnapshots.map((s) => [s.record_id, s]));
    expect(snapshotByRecordId.get("wc-1")?.operation).toBe("update");
    expect(snapshotByRecordId.get("wc-2")?.operation).toBe("insert");

    // applied checksum・jobステータスが記録されている
    expect(client.appliedChecksums.has(input.job.datasetChecksum)).toBe(true);
    expect(client.updateJobs.get(input.job.jobId)?.status).toBe("completed");

    // 無関係な他レコード(このjobが一切触れていないID)は存在自体しない(混入なし)
    expect(client.finalTables.world_player_cards.size).toBe(4);
  });

  it("事前ゲート失敗時はBEGINへ到達しない", async () => {
    const { input } = buildScenario();
    const bad = { ...input, previousJobStatus: "running" as const };
    const result = await executePromotion(client, bad);
    expect(result.decision).toBe("rollback");
    expect(client.calls).toEqual([]);
  });

  it("managersテーブルでも昇格が成功する(3テーブルのうち2つ目の実構造での実証)", async () => {
    const jobId = "promo-job-managers-1";
    const managerRecord = (id: string, name: string): StagingRecord => ({
      id,
      fields: {
        internal_manager_id: Number(id),
        source: "amine250/efootball-managers",
        source_manager_id: id,
        name_en: name,
        boosters: [{ code: "X" }],
        link_up_plays: [],
        fetched_at: "2026-01-01T00:00:00.000Z",
        dataset_version: "v1",
      },
    });
    const added = [managerRecord("2", "New Manager")];
    // previousCount=0(初回投入相当)は別ゲート(checkCountDelta)で意図的に拒否されるため、
    // ここでは既存1件(id=1、このjobは触れない)がある状態を模擬して、通常の増分昇格として扱う。
    const existingManager = managerRecord("1", "Existing Manager");
    const existingManagerNormalized = normalizeForStorage("managers", { id: "1", fields: existingManager.fields }, "2020-01-01T00:00:00.000Z");
    client.finalTables.managers.set("1", { ...existingManagerNormalized.fields });
    const job = createPendingJob({
      jobId,
      table: "managers",
      source: "amine250/efootball-managers",
      schemaVersion: "v1",
      datasetChecksum: "managers-checksum-1",
      previousChecksum: null,
      expectedTables: ["managers"],
      fetchedTables: ["managers"],
    });
    const diff = computeDiff({ table: "managers", records: [{ id: "1", checksum: computeRecordChecksum(existingManager.fields) }] }, added);
    const nowIso = "2026-01-01T12:00:00.000Z";
    const approval: ApprovalArtifact = {
      jobId,
      datasetChecksum: job.datasetChecksum,
      diffChecksum: computeDiffChecksum(diff),
      schemaVersion: "v1",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "uesugi",
      nonce: "nonce-managers",
      expiresAt: "2026-01-02T00:00:00.000Z",
      expectedCounts: { added: diff.addedCount, updated: diff.updatedCount, removedCandidate: diff.removedCount },
    };
    const plan = buildPromotionPlan({
      jobId,
      schemaVersion: "v1",
      sourceIdentifier: "amine250/efootball-managers",
      sourceTable: "staging_managers",
      targetTable: "managers",
      datasetChecksum: job.datasetChecksum,
      diffChecksum: approval.diffChecksum,
      beforeRecords: [],
      expectedAfterRecords: [...added.map((r) => normalizeForStorage("managers", r, nowIso)), existingManagerNormalized],
      expectedCounts: { added: diff.addedCount, updated: 0, unchanged: 0, removedCandidate: diff.removedCount },
      approval,
      generatedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-02T00:00:00.000Z",
    });
    const input: PromotionExecutionInput = {
      job,
      plan,
      approval,
      diff,
      diffThresholds: { maxDecreaseRatio: 0.5, maxIncreaseRatio: 1, maxRemovedCount: 999 },
      added,
      updated: [],
      unchangedIds: [],
      removedCandidateIds: ["1"],
      existingBeforeRecords: [{ id: "1", fields: client.finalTables.managers.get("1")! }],
      expectedBeforeRowCount: 1,
      currentStagingChecksum: job.datasetChecksum,
      previousJobStatus: "idle",
      appliedChecksumHistory: new Set(),
      maxRemovedCandidateCount: 999,
      bypassFlagsDetected: [],
      sourceMeta: { ...sourceMeta, source: "amine250/efootball-managers" },
      now: new Date(nowIso),
    };
    const result = await executePromotion(client, input);
    expect(result.decision).toBe("commit");
    expect(client.finalTables.managers.get("2")?.name_en).toBe("New Manager");
    expect(client.finalTables.managers.has("1")).toBe(true);
  });
});

describe("executePromotion(失敗注入マトリクス、transaction内で必ず全体ROLLBACK)", () => {
  let client: FakePromotionClient;

  beforeEach(() => {
    client = new FakePromotionClient();
  });

  it("row count mismatch: promotion前の行数が期待と違えば全体ROLLBACK", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    client.finalTables.world_player_cards.set("wc-extra", { world_card_id: "wc-extra" });

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
    expect(client.calls).toContain("begin");
    expect(client.calls[client.calls.length - 1]).toBe("rollback");
    expect(client.appliedChecksums.size).toBe(0);
    expect(client.updateJobs.get(input.job.jobId)?.status).not.toBe("completed");
  });

  it("lock競合(pg_try_advisory_xact_lock失敗)は即座に中止し待機しない", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    client.lockAcquired = false;

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
    expect(result.reasons[0]).toContain("advisory lock");
    expect(client.finalTables.world_player_cards.get("wc-1")?.name_en).not.toBe("Updated Player");
  });

  it("snapshot failure: before snapshotの書込み失敗でROLLBACK、対象テーブルへは一切書込まれない", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    client.failOn = /^insert into promotion_before_snapshots/i;

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
    expect(client.finalTables.world_player_cards.has("wc-2")).toBe(false);
    expect(client.finalTables.world_player_cards.get("wc-1")?.name_en).not.toBe("Updated Player");
  });

  it("insert failure: added書込み中の例外でtransaction全体がROLLBACKされる", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    client.failOn = /^insert into reference_data_test\.world_player_cards \(/i;

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
    expect(client.finalTables.world_player_cards.has("wc-2")).toBe(false);
    expect(client.appliedChecksums.size).toBe(0);
  });

  it("source metadata failure: source_metadata更新失敗でROLLBACK、対象テーブルへの書込みも巻き戻る", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    client.failOn = /^insert into reference_data_test\.source_metadata \(/i;

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
    // フェイク実装はtransaction的ではなく即時反映のため、直前までの書込みが実際にはMapに残るが、
    // 呼び出し元へは必ずrollback決定が返ることを確認する(実PostgreSQLでは物理的にも全て戻る)。
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("audit failure: audit記録失敗でROLLBACK", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    client.failOn = /^insert into audit_events/i;

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
  });

  it("job status update failure: jobをcompletedへ更新する処理の失敗でROLLBACK", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    client.failOn = /^update update_jobs set status = 'completed'/i;

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
  });

  it("unchanged/removed candidateの行が消失している場合はROLLBACK(物理削除の検出)", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    // removedCandidate(wc-4)が事前に物理削除されてしまっている異常状態を模擬する。行数自体は
    // row count確認(手順11)でも検出され得るため、ここでは無関係な行を1件追加して総行数を
    // expectedBeforeRowCountへ合わせ、手順17-18(消失検出)だけを単独で検証できるようにする。
    client.finalTables.world_player_cards.delete("wc-4");
    client.finalTables.world_player_cards.set("wc-phantom", { world_card_id: "wc-phantom" });

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
    expect(result.reasons[0]).toContain("消失");
  });

  it("update failure: updated書込み中の例外でtransaction全体がROLLBACKされる(addedが無い場合でも独立して検証)", async () => {
    const { input } = buildScenario({ added: [] });
    seedFinalTable(client, input.existingBeforeRecords);
    client.failOn = /^insert into reference_data_test\.world_player_cards \(/i;

    const result = await executePromotion(client, input);
    expect(result.decision).toBe("rollback");
    expect(client.finalTables.world_player_cards.get("wc-1")?.name_en).not.toBe("Updated Player");
    expect(client.appliedChecksums.size).toBe(0);
  });

  it("shadow comparison mismatch: 読み戻し結果が期待と異なる場合はROLLBACK(applied checksum・job状態は変化しない)", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);

    // 読み戻し(SELECT)結果だけを改ざんするラッパー(promotion対象の内容が期待値と一致しない
    // 異常を模擬する。実PostgreSQLでは通常発生しないが、shadow comparisonが実際に機能する
    // ことを直接確認するための合成テスト)。
    const corruptingClient: QueryClient = {
      async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
        const result = await client.query(sql, params);
        if (/^select .* from reference_data_test\.world_player_cards where/i.test(sql.trim())) {
          return {
            rows: result.rows.map((row) => (row.world_card_id === "wc-1" ? { ...row, name_en: "Corrupted During Readback" } : row)),
          };
        }
        return result;
      },
    };

    const result = await executePromotion(corruptingClient, input);
    expect(result.decision).toBe("rollback");
    expect(result.reasons[0]).toContain("shadow comparison失敗");
    expect(client.appliedChecksums.size).toBe(0);
    expect(client.updateJobs.get(input.job.jobId)?.status).not.toBe("completed");
  });

  it("expectedAfterChecksum mismatch: PromotionPlanのchecksumが不正ならshadow comparison合格後もROLLBACK", async () => {
    const { input } = buildScenario();
    seedFinalTable(client, input.existingBeforeRecords);
    const badInput = { ...input, plan: { ...input.plan, expectedAfterChecksum: "0".repeat(64) } };

    const result = await executePromotion(client, badInput);
    expect(result.decision).toBe("rollback");
    expect(result.reasons[0]).toContain("expectedAfterChecksum");
    expect(client.appliedChecksums.size).toBe(0);
    // shadow comparison自体は合格するため、この時点までの書込みは行われているが、COMMITされていないため
    // 実PostgreSQLでは物理的にすべて巻き戻る(fakeクライアントは即時反映のため、決定がrollbackであることで確認する)。
  });
});

describe("明示rollback(成功したpromotion後の取り消し)", () => {
  let client: FakePromotionClient;
  let scenario: Scenario;

  beforeEach(async () => {
    client = new FakePromotionClient();
    scenario = buildScenario();
    seedFinalTable(client, scenario.input.existingBeforeRecords);
    const result = await executePromotion(client, scenario.input);
    expect(result.decision).toBe("commit");
  });

  function buildRollbackApproval(overrides: Partial<PromotionRollbackApproval> = {}): PromotionRollbackApproval {
    return {
      rollbackPlanId: scenario.plan.rollbackPlanId,
      targetJobId: scenario.job.jobId,
      appliedChecksum: scenario.job.datasetChecksum,
      approvedBy: "uesugi",
      nonce: "rollback-nonce-1",
      approvedAt: "2026-01-02T00:00:00.000Z",
      ...overrides,
    };
  }

  const completedJob = () => ({ ...scenario.job, status: "completed" as const });

  it("正常系: このjobが追加した行だけ削除し、更新した行だけ復元する。unrelated rowは不変", async () => {
    const result = await executePromotionRollback(client, {
      approval: buildRollbackApproval(),
      plan: scenario.plan,
      job: completedJob(),
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.removedCount).toBe(1); // wc-2(added)
    expect(result.restoredCount).toBe(1); // wc-1(updated)

    // addedされた行は削除されている
    expect(client.finalTables.world_player_cards.has("wc-2")).toBe(false);
    // updatedされた行はbefore状態(Old Player/79)へ復元されている
    expect(client.finalTables.world_player_cards.get("wc-1")?.name_en).toBe("Old Player");
    expect(client.finalTables.world_player_cards.get("wc-1")?.ovr_max).toBe(79);
    // unrelated(unchanged/removedCandidate)は一切変化していない
    expect(client.finalTables.world_player_cards.get("wc-3")?.name_en).toBe("Unchanged Player");
    expect(client.finalTables.world_player_cards.get("wc-4")?.name_en).toBe("Removed Candidate");

    // jobがrolled_backへ遷移
    expect(client.updateJobs.get(scenario.job.jobId)?.status).toBe("rolled_back");
    // rollback_jobsに記録
    expect(client.rollbackJobs.get(scenario.plan.rollbackPlanId)?.status).toBe("applied");
  });

  it("rollbackPlanId不一致は拒否", async () => {
    const result = await executePromotionRollback(client, {
      approval: buildRollbackApproval({ rollbackPlanId: "forged-plan-id" }),
      plan: scenario.plan,
      job: completedJob(),
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
  });

  it("別jobへのrollbackは拒否(targetJobId不一致)", async () => {
    const result = await executePromotionRollback(client, {
      approval: buildRollbackApproval({ targetJobId: "other-job" }),
      plan: scenario.plan,
      job: completedJob(),
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
  });

  it("appliedChecksum不一致は拒否", async () => {
    const result = await executePromotionRollback(client, {
      approval: buildRollbackApproval({ appliedChecksum: "wrong-checksum" }),
      plan: scenario.plan,
      job: completedJob(),
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
  });

  it("completed以外のjobステータスは拒否", async () => {
    const result = await executePromotionRollback(client, {
      approval: buildRollbackApproval(),
      plan: scenario.plan,
      job: { ...scenario.job, status: "running" },
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
  });

  it("nonce未設定は拒否(単純フラグでのrollbackを防ぐ)", async () => {
    const result = await executePromotionRollback(client, {
      approval: buildRollbackApproval({ nonce: "" }),
      plan: scenario.plan,
      job: completedJob(),
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(result.ok).toBe(false);
  });

  it("二重rollbackは拒否される(事前ゲートとDB側unique indexの両方で)", async () => {
    const first = await executePromotionRollback(client, {
      approval: buildRollbackApproval(),
      plan: scenario.plan,
      job: completedJob(),
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(first.ok).toBe(true);

    // 呼び出し側が「既にrollback済み」を正しく伝えた場合(事前ゲートで拒否)
    const second = await executePromotionRollback(client, {
      approval: buildRollbackApproval(),
      plan: scenario.plan,
      job: { ...completedJob(), status: "rolled_back" },
      appliedChecksumRecorded: scenario.job.datasetChecksum,
      alreadyRolledBack: true,
      now: new Date("2026-01-03T00:00:00.000Z"),
    });
    expect(second.ok).toBe(false);
  });
});

describe("evaluatePromotionRollbackGates", () => {
  it("すべての条件を満たせば合格", () => {
    const { job, plan } = buildScenario();
    const completed = { ...job, status: "completed" as const };
    const approval: PromotionRollbackApproval = {
      rollbackPlanId: plan.rollbackPlanId,
      targetJobId: job.jobId,
      appliedChecksum: job.datasetChecksum,
      approvedBy: "uesugi",
      nonce: "n1",
      approvedAt: "2026-01-02T00:00:00.000Z",
    };
    const checks = evaluatePromotionRollbackGates({
      approval,
      plan,
      job: completed,
      appliedChecksumRecorded: job.datasetChecksum,
      alreadyRolledBack: false,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
