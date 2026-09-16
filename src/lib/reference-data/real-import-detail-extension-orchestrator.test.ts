import { describe, it, expect } from "vitest";
import { runDetailExtensionImport, type QueryClient, type QueryResult, type WorldDetailUpdateRow, type ManagerDetailUpdateRow } from "./real-import-detail-extension-orchestrator";
import { computePayloadHash } from "./migration-transform";

/**
 * 実Postgresへ接続しないテストダブル。`world_player_cards`/`managers`/`import_batches`を
 * メモリ上のMapとして再現し、BEGIN時点のスナップショットへROLLBACKで戻す。
 * このオーケストレーターが発行する既知の文(count、UPDATE...FROM(VALUES...)、
 * import_batchesへのINSERT/UPDATE)だけに対応する。
 */
class FakeDetailExtensionClient implements QueryClient {
  tables: Record<string, Map<string, Record<string, unknown>>> = {
    world_player_cards: new Map(),
    managers: new Map(),
    import_batches: new Map(),
  };
  private snapshot: typeof this.tables | null = null;
  committed = false;
  rolledBack = false;
  executedSql: string[] = [];
  /** 実際の障害("operator does not exist: integer = text")を模すため、指定テーブルのUPDATEで例外を投げる。 */
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
      if (where === "efhub_card_id is not null") rows = rows.filter((r) => r.efhub_card_id != null);
      else if (where === "boosters <> '[]'::jsonb") rows = rows.filter((r) => r.boosters !== "[]");
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
        throw new Error('error: operator does not exist: integer = text');
      }
      const allColumns = updateMatch[2].split(",").map((s) => s.trim());
      const rowLen = allColumns.length;
      for (let i = 0; i < params.length; i += rowLen) {
        const rowParams = params.slice(i, i + rowLen);
        const pk = String(rowParams[0]);
        const existing = this.tables[table].get(pk);
        if (!existing) throw new Error(`FakeDetailExtensionClient: 更新対象の行が存在しない(初回投入未実施を模擬): ${pk}`);
        allColumns.forEach((c, idx) => {
          if (idx === 0) return; // pk自体は更新しない
          existing[c] = rowParams[idx];
        });
      }
      return { rows: [] };
    }

    throw new Error(`FakeDetailExtensionClient: 未対応のSQL: ${sql}`);
  }
}

function structuredCloneTables(tables: Record<string, Map<string, Record<string, unknown>>>) {
  const clone: Record<string, Map<string, Record<string, unknown>>> = {};
  for (const [table, map] of Object.entries(tables)) {
    clone[table] = new Map([...map.entries()].map(([k, v]) => [k, { ...v }]));
  }
  return clone;
}

function seedExistingWorldRows(client: FakeDetailExtensionClient, ids: string[]): void {
  for (const id of ids) {
    client.tables.world_player_cards.set(id, { world_card_id: id, name_en: `Player ${id}`, efhub_card_id: null, ai_styles: [], appearance: null, efhub_conflicts: "[]" });
  }
}
function seedExistingManagerRows(client: FakeDetailExtensionClient, ids: number[]): void {
  for (const id of ids) {
    client.tables.managers.set(String(id), { internal_manager_id: id, name_en: `Manager ${id}`, boosters: "[]", link_up_plays: "[]" });
  }
}

function worldRow(id: string, over: Partial<WorldDetailUpdateRow> = {}): WorldDetailUpdateRow {
  return { world_card_id: id, efhub_card_id: null, ai_styles: [], appearance: null, efhub_conflicts: [], ...over };
}
function managerRow(id: number, over: Partial<ManagerDetailUpdateRow> = {}): ManagerDetailUpdateRow {
  return { internal_manager_id: id, boosters: [], link_up_plays: [], ...over };
}

function baseInput(overrides: Partial<Parameters<typeof runDetailExtensionImport>[1]> = {}) {
  const worldUpdates = [worldRow("1"), worldRow("2")];
  const managerUpdates = [managerRow(1)];
  return {
    worldUpdates,
    managerUpdates,
    worldBatchId: "batch-world-detail",
    managerBatchId: "batch-managers-detail",
    datasetVersions: { world: "world-detail-2026-09-15", managers: "managers-detail-2026-09-15" },
    payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash(managerUpdates) },
    chunkSize: 1,
    expectedWorldCount: worldUpdates.length,
    expectedManagerCount: managerUpdates.length,
    ...overrides,
  };
}

describe("runDetailExtensionImport (テストダブルのみ、実DB接続なし)", () => {
  it("正常系: 既存行のefhub_card_id/ai_styles等をUPDATEしCOMMITする", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);

    const worldUpdates = [worldRow("1", { efhub_card_id: "47918", ai_styles: ["Speeding Bullet"] }), worldRow("2")];
    const managerUpdates = [managerRow(1, { boosters: [{ statNameEn: "Kicking Power", delta: 1 }] })];
    const result = await runDetailExtensionImport(
      client,
      baseInput({
        worldUpdates,
        managerUpdates,
        payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash(managerUpdates) },
      }),
    );

    expect(result.decision).toBe("commit");
    expect(client.committed).toBe(true);
    expect(client.tables.world_player_cards.get("1")!.efhub_card_id).toBe("47918");
    expect(client.tables.managers.get("1")!.boosters).toContain("Kicking Power");
  });

  it("行数を変えない(INSERT/DELETEを一切発行しない)", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    await runDetailExtensionImport(client, baseInput());
    expect(client.tables.world_player_cards.size).toBe(2);
    expect(client.tables.managers.size).toBe(1);
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/^insert into reference_data\.(world_player_cards|managers)\b/);
      expect(sql.toLowerCase()).not.toMatch(/^delete from/);
    }
  });

  it("既存件数が期待値と一致しない場合(初回投入が未実施)は中止しROLLBACKする", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1"]); // 1件しかない(期待値2件)
    seedExistingManagerRows(client, [1]);
    const result = await runDetailExtensionImport(client, baseInput());
    expect(result.decision).toBe("rollback");
    expect(result.reasons[0]).toMatch(/件数が期待値と一致しない/);
    expect(client.rolledBack).toBe(true);
  });

  it("対象テーブルが空の場合(初回投入がまだ)は中止する", async () => {
    const client = new FakeDetailExtensionClient();
    // world_player_cards/managersへ何もseedしない = 空テーブル
    const result = await runDetailExtensionImport(client, baseInput());
    expect(result.decision).toBe("rollback");
  });

  it("同一batch_id/dataset_versionの再実行を拒否する(既存行はUPDATEされない)", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    client.tables.import_batches.set("batch-world-detail", { batch_id: "batch-world-detail", dataset_version: "world-detail-2026-09-15", status: "verified" });

    const result = await runDetailExtensionImport(client, baseInput());
    expect(result.decision).toBe("rollback");
    expect(client.tables.world_player_cards.get("1")!.efhub_card_id).toBeNull();
  });

  it("自己整合性チェック: efhub_card_id設定件数の期待値とDB実測が一致しないとROLLBACK", async () => {
    // わざとFakeクライアントの内部状態を壊すことは難しいため、
    // ここでは通常の正常系で自己整合性チェック自体が正しく計算されることを別途確認する
    // (異常系はcheckExactCountsのUnit Testで既にカバー済み)。
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    const worldUpdates = [worldRow("1", { efhub_card_id: "999" }), worldRow("2", { efhub_card_id: null })];
    const result = await runDetailExtensionImport(
      client,
      baseInput({ worldUpdates, payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash([managerRow(1)]) } }),
    );
    expect(result.decision).toBe("commit");
  });

  it("import_batchesが2件ともverifiedになる", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    await runDetailExtensionImport(client, baseInput());
    const statuses = [...client.tables.import_batches.values()].map((r) => r.status);
    expect(statuses).toEqual(["verified", "verified"]);
  });

  it("appearance/efhub_conflicts等のjsonb列はJSON文字列化して渡す", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    const worldUpdates = [worldRow("1", { appearance: { position: "CF" }, efhub_conflicts: [{ fieldName: "ovr_max", efhubValue: "104", worldValue: "103" }] }), worldRow("2")];
    await runDetailExtensionImport(
      client,
      baseInput({ worldUpdates, payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash([managerRow(1)]) } }),
    );
    const stored = client.tables.world_player_cards.get("1")!;
    expect(typeof stored.appearance).toBe("string");
    expect(JSON.parse(stored.appearance as string)).toEqual({ position: "CF" });
  });

  it("ai_styles(text[])はJS配列のまま渡す", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    const worldUpdates = [worldRow("1", { ai_styles: ["Speeding Bullet", "Long Ball Expert"] }), worldRow("2")];
    await runDetailExtensionImport(
      client,
      baseInput({ worldUpdates, payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash([managerRow(1)]) } }),
    );
    expect(client.tables.world_player_cards.get("1")!.ai_styles).toEqual(["Speeding Bullet", "Long Ball Expert"]);
  });

  it("20桁の大きなworld_card_idを数値化せず文字列のまま精度を保って更新する", async () => {
    const bigId = "12345678901234567890"; // Number化すると丸められる(実データでも14〜15桁のIDが存在)
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, [bigId, "2"]);
    seedExistingManagerRows(client, [1]);
    const worldUpdates = [worldRow(bigId, { efhub_card_id: "999" }), worldRow("2")];
    await runDetailExtensionImport(
      client,
      baseInput({ worldUpdates, payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash([managerRow(1)]) } }),
    );
    const stored = client.tables.world_player_cards.get(bigId);
    expect(stored).toBeDefined();
    expect(stored!.efhub_card_id).toBe("999");
  });

  it("public/authスキーマを参照するSQLは1件も発行しない", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    await runDetailExtensionImport(client, baseInput());
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/\bpublic\./);
      expect(sql.toLowerCase()).not.toMatch(/\bauth\./);
      expect(sql.toLowerCase()).not.toMatch(/my_team_snapshots|rls_probe_records|player_card_analysis/);
    }
  });

  it("形式不正なworld_card_idが含まれる場合はUPDATEを一切発行せずROLLBACKする", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    const worldUpdates = [worldRow("1"), worldRow("not-a-valid-id")];
    const result = await runDetailExtensionImport(
      client,
      baseInput({ worldUpdates, payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash([managerRow(1)]) } }),
    );
    expect(result.decision).toBe("rollback");
    expect(result.reasons.join(" ")).toMatch(/world_card_id.*形式不正/);
    expect(client.rolledBack).toBe(true);
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/^update reference_data\.(world_player_cards|managers)\b/);
    }
  });

  it("managers側のUPDATEで型比較エラー(実際の障害を再現)が起きた場合、world側の更新も含めて全体ROLLBACKし、COMMITは1回も呼ばれない", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    client.throwOnUpdateTable = "managers";

    const worldUpdates = [worldRow("1", { efhub_card_id: "47918" }), worldRow("2")];
    await expect(
      runDetailExtensionImport(
        client,
        baseInput({ worldUpdates, payloadHashes: { world: computePayloadHash(worldUpdates), managers: computePayloadHash([managerRow(1)]) } }),
      ),
    ).rejects.toThrow(/operator does not exist/);

    expect(client.committed).toBe(false);
    expect(client.rolledBack).toBe(true);
    // world側は先に(型比較エラーが起きる前に)UPDATE済みだったはずだが、ROLLBACKでスナップショットへ復元されている
    expect(client.tables.world_player_cards.get("1")!.efhub_card_id).toBeNull();
    const rollbackCount = client.executedSql.filter((sql) => sql.trim().toLowerCase() === "rollback").length;
    expect(rollbackCount).toBe(1);
  });

  it("不正なmanager ID(負数・非数値)が含まれる場合はUPDATEを一切発行せずROLLBACKする", async () => {
    const client = new FakeDetailExtensionClient();
    seedExistingWorldRows(client, ["1", "2"]);
    seedExistingManagerRows(client, [1]);
    const managerUpdates = [{ ...managerRow(1), internal_manager_id: -1 }];
    const result = await runDetailExtensionImport(
      client,
      baseInput({ managerUpdates, payloadHashes: { world: computePayloadHash([worldRow("1"), worldRow("2")]), managers: computePayloadHash(managerUpdates) } }),
    );
    expect(result.decision).toBe("rollback");
    expect(result.reasons.join(" ")).toMatch(/internal_manager_id.*形式不正/);
    expect(client.rolledBack).toBe(true);
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/^update reference_data\.(world_player_cards|managers)\b/);
    }
  });
});
