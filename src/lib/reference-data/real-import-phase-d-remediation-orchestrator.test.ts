import { describe, it, expect } from "vitest";
import {
  runPhaseDRemediationImport,
  type QueryClient,
  type QueryResult,
  type WorldNameSortKeyRow,
  type ManagerNameSortKeyRow,
  type AnalysisNameRow,
} from "./real-import-phase-d-remediation-orchestrator";
import { computePayloadHash } from "./migration-transform";

/**
 * 実Postgresへ接続しないテストダブル。`world_player_cards`/`managers`/
 * `player_card_analysis`/`import_batches`をメモリ上のMapとして再現し、
 * BEGIN時点のスナップショットへROLLBACKで戻す。
 */
class FakeRemediationClient implements QueryClient {
  tables: Record<string, Map<string, Record<string, unknown>>> = {
    world_player_cards: new Map(),
    managers: new Map(),
    player_card_analysis: new Map(),
    import_batches: new Map(),
  };
  private snapshot: typeof this.tables | null = null;
  committed = false;
  rolledBack = false;
  executedSql: string[] = [];
  throwOnUpdateTable: string | null = null;

  async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
    this.executedSql.push(sql);
    const trimmed = sql.trim().toLowerCase();

    if (trimmed === "begin") {
      this.snapshot = structuredCloneTables(this.tables);
      return { rows: [] };
    }
    if (trimmed === "commit") {
      this.committed = true;
      return { rows: [] };
    }
    if (trimmed === "rollback") {
      this.rolledBack = true;
      if (this.snapshot) this.tables = this.snapshot;
      return { rows: [] };
    }

    const countMatch = sql.match(/select count\(\*\)::int as count from reference_data\.(\w+)(?:\s+where\s+(.+))?$/is);
    if (countMatch) {
      const table = countMatch[1];
      const where = countMatch[2]?.trim();
      let rows = [...this.tables[table].values()];
      if (where === "name_sort_key is not null") rows = rows.filter((r) => r.name_sort_key != null);
      else if (where === "efhub_name_en is not null") rows = rows.filter((r) => r.efhub_name_en != null);
      return { rows: [{ count: rows.length }] };
    }

    if (/select batch_id, dataset_version from reference_data\.import_batches/i.test(sql)) {
      return { rows: [...this.tables.import_batches.values()].map((r) => ({ batch_id: r.batch_id, dataset_version: r.dataset_version })) };
    }

    if (/^insert into reference_data\.import_batches/i.test(sql)) {
      const [batchId, datasetVersion, targetTable, source, sourceRowCount, payloadHash] = params;
      this.tables.import_batches.set(String(batchId), {
        batch_id: batchId,
        dataset_version: datasetVersion,
        target_table: targetTable,
        source,
        source_row_count: sourceRowCount,
        payload_hash: payloadHash,
        status: "pending",
      });
      return { rows: [] };
    }

    if (/^update reference_data\.import_batches set status = 'verified'/i.test(sql)) {
      const [batchId, insertedRowCount] = params;
      const row = this.tables.import_batches.get(String(batchId));
      if (row) {
        row.status = "verified";
        row.inserted_row_count = insertedRowCount;
      }
      return { rows: [] };
    }

    const updateMatch = sql.match(/^update reference_data\.(\w+) as t\nset [^\n]+\nfrom \(values .+\) as v\(([^)]+)\)\nwhere/is);
    if (updateMatch) {
      const table = updateMatch[1];
      if (this.throwOnUpdateTable === table) {
        throw new Error("error: simulated failure for " + table);
      }
      const allColumns = updateMatch[2].split(",").map((s) => s.trim());
      const rowLen = allColumns.length;
      for (let i = 0; i < params.length; i += rowLen) {
        const rowParams = params.slice(i, i + rowLen);
        const pk = String(rowParams[0]);
        const existing = this.tables[table].get(pk);
        if (!existing) throw new Error(`FakeRemediationClient: 更新対象の行が存在しない(初回投入未実施を模擬): ${pk}`);
        allColumns.forEach((c, idx) => {
          if (idx === 0) return;
          existing[c] = rowParams[idx];
        });
      }
      return { rows: [] };
    }

    throw new Error(`FakeRemediationClient: 未対応のSQL: ${sql}`);
  }
}

function structuredCloneTables(tables: Record<string, Map<string, Record<string, unknown>>>) {
  const clone: Record<string, Map<string, Record<string, unknown>>> = {};
  for (const [table, map] of Object.entries(tables)) {
    clone[table] = new Map([...map.entries()].map(([k, v]) => [k, { ...v }]));
  }
  return clone;
}

function seedWorld(client: FakeRemediationClient, ids: string[]): void {
  for (const id of ids) client.tables.world_player_cards.set(id, { world_card_id: id, name_sort_key: null });
}
function seedManagers(client: FakeRemediationClient, ids: number[]): void {
  for (const id of ids) client.tables.managers.set(String(id), { internal_manager_id: id, name_sort_key: null });
}
function seedAnalysis(client: FakeRemediationClient, ids: string[]): void {
  for (const id of ids) client.tables.player_card_analysis.set(id, { world_card_id: id, efhub_name_en: null });
}

function worldRow(id: string, key = "sortkey"): WorldNameSortKeyRow {
  return { world_card_id: id, name_sort_key: key };
}
function managerRow(id: number, key = "sortkey"): ManagerNameSortKeyRow {
  return { internal_manager_id: id, name_sort_key: key };
}
function analysisRow(id: string, name = "Legacy Name"): AnalysisNameRow {
  return { world_card_id: id, efhub_name_en: name };
}

function baseInput(overrides: Partial<Parameters<typeof runPhaseDRemediationImport>[1]> = {}) {
  const worldNameSortKeyUpdates = [worldRow("1"), worldRow("2")];
  const managerNameSortKeyUpdates = [managerRow(1)];
  const analysisNameUpdates = [analysisRow("1")];
  return {
    worldNameSortKeyUpdates,
    managerNameSortKeyUpdates,
    analysisNameUpdates,
    worldBatchId: "batch-world-name-sort-key",
    managerBatchId: "batch-managers-name-sort-key",
    analysisBatchId: "batch-analysis-name",
    datasetVersions: { world: "world-name-sort-key-2026-09-15", managers: "managers-name-sort-key-2026-09-15", analysis: "analysis-name-2026-09-15" },
    payloadHashes: {
      world: computePayloadHash(worldNameSortKeyUpdates),
      managers: computePayloadHash(managerNameSortKeyUpdates),
      analysis: computePayloadHash(analysisNameUpdates),
    },
    chunkSize: 1,
    expectedWorldCount: worldNameSortKeyUpdates.length,
    expectedManagerCount: managerNameSortKeyUpdates.length,
    expectedAnalysisCount: analysisNameUpdates.length,
    ...overrides,
  };
}

describe("runPhaseDRemediationImport (テストダブルのみ、実DB接続なし)", () => {
  it("正常系: 3テーブルの追加列をUPDATEしCOMMITする", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);

    const result = await runPhaseDRemediationImport(client, baseInput());
    expect(result.decision).toBe("commit");
    expect(client.committed).toBe(true);
    expect(client.tables.world_player_cards.get("1")!.name_sort_key).toBe("sortkey");
    expect(client.tables.managers.get("1")!.name_sort_key).toBe("sortkey");
    expect(client.tables.player_card_analysis.get("1")!.efhub_name_en).toBe("Legacy Name");
  });

  it("行数を変えない(INSERT/DELETEを一切発行しない)", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    await runPhaseDRemediationImport(client, baseInput());
    expect(client.tables.world_player_cards.size).toBe(2);
    expect(client.tables.managers.size).toBe(1);
    expect(client.tables.player_card_analysis.size).toBe(1);
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/^insert into reference_data\.(world_player_cards|managers|player_card_analysis)\b/);
      expect(sql.toLowerCase()).not.toMatch(/^delete from/);
    }
  });

  it("既存件数が期待値と一致しない場合(初回投入・detail-extension投入が未実施)は中止しROLLBACKする", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1"]); // 1件しかない(期待値2件)
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    const result = await runPhaseDRemediationImport(client, baseInput());
    expect(result.decision).toBe("rollback");
    expect(result.reasons.join(" ")).toMatch(/件数が期待値と一致しない/);
    expect(client.rolledBack).toBe(true);
  });

  it("同一batch_id/dataset_versionの再実行を拒否する(既存行はUPDATEされない)", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    client.tables.import_batches.set("batch-world-name-sort-key", {
      batch_id: "batch-world-name-sort-key",
      dataset_version: "world-name-sort-key-2026-09-15",
      status: "verified",
    });
    const result = await runPhaseDRemediationImport(client, baseInput());
    expect(result.decision).toBe("rollback");
    expect(client.tables.world_player_cards.get("1")!.name_sort_key).toBeNull();
  });

  it("形式不正なworld_card_idが含まれる場合はUPDATEを一切発行せずROLLBACKする", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    const worldNameSortKeyUpdates = [worldRow("1"), worldRow("not-a-valid-id")];
    const result = await runPhaseDRemediationImport(
      client,
      baseInput({ worldNameSortKeyUpdates, payloadHashes: { world: computePayloadHash(worldNameSortKeyUpdates), managers: computePayloadHash([managerRow(1)]), analysis: computePayloadHash([analysisRow("1")]) } }),
    );
    expect(result.decision).toBe("rollback");
    expect(result.reasons.join(" ")).toMatch(/world_card_id.*形式不正/);
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/^update reference_data\.(world_player_cards|managers|player_card_analysis)\b/);
    }
  });

  it("不正なmanager ID(負数)が含まれる場合はUPDATEを一切発行せずROLLBACKする", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    const managerNameSortKeyUpdates = [{ ...managerRow(1), internal_manager_id: -1 }];
    const result = await runPhaseDRemediationImport(
      client,
      baseInput({
        managerNameSortKeyUpdates,
        payloadHashes: { world: computePayloadHash([worldRow("1"), worldRow("2")]), managers: computePayloadHash(managerNameSortKeyUpdates), analysis: computePayloadHash([analysisRow("1")]) },
      }),
    );
    expect(result.decision).toBe("rollback");
    expect(result.reasons.join(" ")).toMatch(/internal_manager_id.*形式不正/);
  });

  it("player_card_analysis側のUPDATEで失敗した場合、world/managers側の更新も含めて全体ROLLBACKし、COMMITは1回も呼ばれない", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    client.throwOnUpdateTable = "player_card_analysis";

    await expect(runPhaseDRemediationImport(client, baseInput())).rejects.toThrow(/simulated failure/);
    expect(client.committed).toBe(false);
    expect(client.rolledBack).toBe(true);
    expect(client.tables.world_player_cards.get("1")!.name_sort_key).toBeNull();
    const rollbackCount = client.executedSql.filter((sql) => sql.trim().toLowerCase() === "rollback").length;
    expect(rollbackCount).toBe(1);
  });

  it("import_batchesが3件ともverifiedになる", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    await runPhaseDRemediationImport(client, baseInput());
    const statuses = [...client.tables.import_batches.values()].map((r) => r.status);
    expect(statuses).toEqual(["verified", "verified", "verified"]);
  });

  it("public/authスキーマを参照するSQLは1件も発行しない", async () => {
    const client = new FakeRemediationClient();
    seedWorld(client, ["1", "2"]);
    seedManagers(client, [1]);
    seedAnalysis(client, ["1"]);
    await runPhaseDRemediationImport(client, baseInput());
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/\bpublic\./);
      expect(sql.toLowerCase()).not.toMatch(/\bauth\./);
      expect(sql.toLowerCase()).not.toMatch(/my_team_snapshots|rls_probe_records/);
    }
  });
});
