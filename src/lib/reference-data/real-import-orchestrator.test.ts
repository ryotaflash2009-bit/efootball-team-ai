import { describe, it, expect } from "vitest";
import { runRealImport, type QueryClient, type QueryResult } from "./real-import-orchestrator";
import { computePayloadHash, type WorldPlayerCardPgRow, type ManagerPgRow, type PlayerCardAnalysisPgRow } from "./migration-transform";

/**
 * 実Postgresへ接続しないテストダブル。`reference_data`スキーマの4テーブルを
 * メモリ上のMapとして再現し、BEGIN時点のスナップショットへROLLBACKで戻す、
 * player_card_analysisへの外部キー違反はエラーを投げる、という最小限の振る舞いだけを再現する。
 * SQL全体を解釈する汎用エンジンではなく、本オーケストレーターが発行する既知の文だけに対応する。
 */
class FakeReferenceDataClient implements QueryClient {
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
  /** テスト側で意図的にFK違反を再現したい場合、trueにする */
  simulateOrphanForeignKeyViolation = false;
  /** 同一クライアントでquery()が並行実行された場合にtrueになる(単一コネクションでの禁止事項の検出用)。 */
  concurrentCallDetected = false;
  private inFlight = false;

  async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
    if (this.inFlight) this.concurrentCallDetected = true;
    this.inFlight = true;
    try {
      // 実際のネットワークI/Oを模した非同期の間(マイクロタスクの巻き戻し)を挟み、
      // Promise.all等による並行呼び出しがあれば確実に検出できるようにする。
      await new Promise((resolve) => setTimeout(resolve, 0));
      return await this.executeQuery(sql, params);
    } finally {
      this.inFlight = false;
    }
  }

  private async executeQuery(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
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

    const countMatch = sql.match(/select count\(\*\)::int as count from reference_data\.(\w+)/i);
    if (countMatch) {
      return { rows: [{ count: this.tables[countMatch[1]].size }] };
    }

    const idsMatch = sql.match(/select (\w+) as id from reference_data\.(\w+)/i);
    if (idsMatch) {
      const table = idsMatch[2];
      return { rows: [...this.tables[table].keys()].map((id) => ({ id })) };
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
        inserted_row_count: 0,
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

    const insertMatch = sql.match(/^insert into reference_data\.(\w+) \(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const columns = insertMatch[2].split(",").map((s) => s.trim());
      const rowLen = columns.length;
      for (let i = 0; i < params.length; i += rowLen) {
        const rowParams = params.slice(i, i + rowLen);
        const pk = String(rowParams[0]);
        if (table === "player_card_analysis" && this.simulateOrphanForeignKeyViolation && !this.tables.world_player_cards.has(pk)) {
          throw new Error(`simulated foreign key violation: world_card_id ${pk} not present in world_player_cards`);
        }
        const rowObj: Record<string, unknown> = {};
        columns.forEach((c, idx) => (rowObj[c] = rowParams[idx]));
        this.tables[table].set(pk, rowObj);
      }
      return { rows: [] };
    }

    throw new Error(`FakeReferenceDataClient: 未対応のSQL: ${sql}`);
  }
}

function structuredCloneTables(tables: Record<string, Map<string, Record<string, unknown>>>) {
  const clone: Record<string, Map<string, Record<string, unknown>>> = {};
  for (const [table, map] of Object.entries(tables)) {
    clone[table] = new Map([...map.entries()].map(([k, v]) => [k, { ...v }]));
  }
  return clone;
}

function makeWorldRow(id: string, over: Partial<WorldPlayerCardPgRow> = {}): WorldPlayerCardPgRow {
  return {
    world_card_id: id,
    name_en: `Player ${id}`,
    name_ja: null,
    card_type: null,
    registered_position: null,
    nationality: null,
    region: null,
    league: null,
    team: null,
    ovr_base: null,
    ovr_max: null,
    maximum_level: null,
    card_rating: null,
    playing_style: null,
    playing_style_def: null,
    preferred_foot: null,
    age: null,
    height: null,
    weight: null,
    image_url: null,
    mobile_image_url: null,
    boost1: null,
    boost2: null,
    stats: { finishing: 80 },
    skills: ["skill-a"],
    source: "efootball-world.com",
    source_url: null,
    appearance_updated_at: null,
    fetched_at: "2026-09-14T00:00:00.000Z",
    dataset_version: "world-2026-09-14",
    import_batch_id: "batch-world",
    ...over,
  };
}

function makeManagerRow(id: number, over: Partial<ManagerPgRow> = {}): ManagerPgRow {
  return {
    internal_manager_id: id,
    source: "amine250",
    source_manager_id: String(id),
    name_en: `Manager ${id}`,
    name_ja: null,
    team_name: null,
    nationality: null,
    age: null,
    released_at: null,
    possession_game: null,
    quick_counter: null,
    long_ball_counter: null,
    out_wide: null,
    long_ball: null,
    overload: null,
    manager_rating: null,
    coaching_affinity: null,
    formation: null,
    has_booster: false,
    has_link_up_play: false,
    booster_confirmation: null,
    source_url: null,
    fetched_at: "2026-09-14T00:00:00.000Z",
    dataset_version: "managers-2026-09-14",
    import_batch_id: "batch-managers",
    ...over,
  };
}

function makeAnalysisRow(worldCardId: string, over: Partial<PlayerCardAnalysisPgRow> = {}): PlayerCardAnalysisPgRow {
  return {
    world_card_id: worldCardId,
    weak_foot_usage: null,
    weak_foot_accuracy: null,
    form: null,
    condition_value: null,
    injury_resistance: null,
    player_model: {},
    positions: [],
    com_skills: [],
    player_skills: [],
    source: "efhub",
    fetched_at: "2026-09-14T00:00:00.000Z",
    dataset_version: "player-card-analysis-2026-09-14",
    import_batch_id: "batch-analysis",
    ...over,
  };
}

function baseInput(overrides: Partial<Parameters<typeof runRealImport>[1]> = {}) {
  const worldRows = [makeWorldRow("1"), makeWorldRow("2")];
  const managerRows = [makeManagerRow(1)];
  const analysisRows = [makeAnalysisRow("1")];
  return {
    worldRows,
    managerRows,
    analysisRows,
    worldBatchId: "batch-world",
    managersBatchId: "batch-managers",
    analysisBatchId: "batch-analysis",
    datasetVersions: { world: "world-2026-09-14", managers: "managers-2026-09-14", analysis: "player-card-analysis-2026-09-14" },
    payloadHashes: {
      world: computePayloadHash(worldRows),
      managers: computePayloadHash(managerRows),
      analysis: computePayloadHash(analysisRows),
    },
    chunkSize: 1, // 小さいチャンクでチャンク分割ロジックも一緒に検証する
    expectedCounts: { world_player_cards: worldRows.length, managers: managerRows.length, player_card_analysis: analysisRows.length },
    ...overrides,
  };
}

describe("runRealImport (テストダブルのみ、実DB接続なし)", () => {
  it("正常系: 全チェック成功でCOMMITし、3テーブルへ正しい件数が入る", async () => {
    const client = new FakeReferenceDataClient();
    const result = await runRealImport(client, baseInput());

    expect(result.decision).toBe("commit");
    expect(result.reasons).toEqual([]);
    expect(client.committed).toBe(true);
    expect(client.rolledBack).toBe(false);
    expect(client.tables.world_player_cards.size).toBe(2);
    expect(client.tables.managers.size).toBe(1);
    expect(client.tables.player_card_analysis.size).toBe(1);
  });

  it("正常系: import_batchesが3件ともverifiedになる", async () => {
    const client = new FakeReferenceDataClient();
    await runRealImport(client, baseInput());
    const statuses = [...client.tables.import_batches.values()].map((r) => r.status);
    expect(statuses).toEqual(["verified", "verified", "verified"]);
  });

  it("既存行がある場合は初回投入を中止し、何も投入されない", async () => {
    const client = new FakeReferenceDataClient();
    client.tables.world_player_cards.set("999", { world_card_id: "999" });
    const result = await runRealImport(client, baseInput());

    expect(result.decision).toBe("rollback");
    expect(result.reasons[0]).toMatch(/既存行が見つかった/);
    expect(client.rolledBack).toBe(true);
    // ロールバックで元の1件だけが残り、新規は何も入っていない
    expect(client.tables.world_player_cards.size).toBe(1);
    expect(client.tables.managers.size).toBe(0);
    expect(client.tables.import_batches.size).toBe(0);
  });

  it("import_batchesだけに既存行があっても(他3テーブルが0件でも)初回投入を中止する(多層防御)", async () => {
    const client = new FakeReferenceDataClient();
    client.tables.import_batches.set("old-batch", { batch_id: "old-batch", dataset_version: "old-version", status: "verified" });
    const result = await runRealImport(client, baseInput());

    // 空テーブル確認(import_batchesも対象)が最初に失敗するため、ここで停止する。
    // checkIdempotencyGuard自体は、このツール(初回投入専用・全4テーブル0件が前提)の設計上、
    // 空テーブル確認より後段の防御であり、通常はこちらが先に検知する。
    expect(result.decision).toBe("rollback");
    expect(result.reasons[0]).toMatch(/既存行が見つかった/);
    expect(result.reasons[0]).toMatch(/import_batches/);
    expect(client.tables.world_player_cards.size).toBe(0);
    expect(client.tables.import_batches.size).toBe(1); // ロールバックで元の1件だけが残る
  });

  it("孤立参照(FK違反)が起きた場合は例外を投げ、全体がROLLBACKされて何も残らない", async () => {
    const client = new FakeReferenceDataClient();
    client.simulateOrphanForeignKeyViolation = true;
    const input = baseInput({ analysisRows: [makeAnalysisRow("does-not-exist")] });

    await expect(runRealImport(client, input)).rejects.toThrow(/foreign key/);
    expect(client.rolledBack).toBe(true);
    expect(client.committed).toBe(false);
    // world_player_cardsへは投入されたが、例外によりROLLBACKで消えている(部分投入が残らない)
    expect(client.tables.world_player_cards.size).toBe(0);
    expect(client.tables.managers.size).toBe(0);
    expect(client.tables.import_batches.size).toBe(0);
  });

  it("投入順序はworld_player_cards → managers → player_card_analysisの順(外部キーのため)", async () => {
    const client = new FakeReferenceDataClient();
    await runRealImport(client, baseInput());
    const insertOrder = client.executedSql
      .filter((sql) => /^insert into reference_data\.(world_player_cards|managers|player_card_analysis)\b/i.test(sql))
      .map((sql) => sql.match(/^insert into reference_data\.(\w+)/i)![1]);
    const firstOccurrence = (table: string) => insertOrder.indexOf(table);
    expect(firstOccurrence("world_player_cards")).toBeLessThan(firstOccurrence("managers"));
    expect(firstOccurrence("managers")).toBeLessThan(firstOccurrence("player_card_analysis"));
  });

  it("public/authスキーマを参照するSQLは1件も発行しない", async () => {
    const client = new FakeReferenceDataClient();
    await runRealImport(client, baseInput());
    for (const sql of client.executedSql) {
      expect(sql.toLowerCase()).not.toMatch(/\bpublic\./);
      expect(sql.toLowerCase()).not.toMatch(/\bauth\./);
      expect(sql.toLowerCase()).not.toMatch(/my_team_snapshots|rls_probe_records/);
    }
  });

  it("chunkSizeどおりに複数回のINSERTへ分割される", async () => {
    const client = new FakeReferenceDataClient();
    const worldRows = [makeWorldRow("1"), makeWorldRow("2"), makeWorldRow("3")];
    await runRealImport(
      client,
      baseInput({
        worldRows,
        payloadHashes: { world: computePayloadHash(worldRows), managers: computePayloadHash([makeManagerRow(1)]), analysis: computePayloadHash([makeAnalysisRow("1")]) },
        chunkSize: 2,
        expectedCounts: { world_player_cards: worldRows.length, managers: 1, player_card_analysis: 1 },
      }),
    );
    const worldInserts = client.executedSql.filter((sql) => /^insert into reference_data\.world_player_cards \(/i.test(sql));
    expect(worldInserts.length).toBe(2); // 3件を2件+1件の2チャンクへ分割
  });

  it("同一クライアントに対してquery()を並行実行しない(Promise.all等の再発を検出する)", async () => {
    const client = new FakeReferenceDataClient();
    await runRealImport(client, baseInput());
    expect(client.concurrentCallDetected).toBe(false);
  });

  it("ROLLBACK自体が失敗した場合、元エラーを握りつぶさず区別して報告する", async () => {
    class RollbackFailingClient extends FakeReferenceDataClient {
      async query(sql: string, params: readonly unknown[] = []) {
        if (sql.trim().toLowerCase() === "rollback") {
          throw new Error("simulated rollback failure (connection already closed)");
        }
        return super.query(sql, params);
      }
    }
    const client = new RollbackFailingClient();
    client.simulateOrphanForeignKeyViolation = true;
    const input = baseInput({ analysisRows: [makeAnalysisRow("does-not-exist")] });

    // 1回の呼び出しで、ROLLBACK失敗の事実と元エラー(FK違反)の両方がメッセージに含まれることを確認する
    // (元エラーを握りつぶさない。2回目の呼び出しはしない: 1回目でROLLBACKが失敗し後片付けできていないため、
    // クライアントの状態は汚染されたままであり、そのまま再利用するテストは意味を持たない)。
    await expect(runRealImport(client, input)).rejects.toThrow(/ROLLBACKにも失敗した.*foreign key/s);
  });
});

describe("配列/JSONBカラムのパラメーター化シリアライズ(malformed array literal再発防止)", () => {
  it("text[]カラム(skills)にはJS配列をそのまま渡す(JSON文字列化しない)", async () => {
    const client = new FakeReferenceDataClient();
    const worldRows = [makeWorldRow("1", { skills: ["Acrobatic Finishing", "Long Range Drive"] })];
    await runRealImport(
      client,
      baseInput({
        worldRows,
        payloadHashes: { world: computePayloadHash(worldRows), managers: computePayloadHash([makeManagerRow(1)]), analysis: computePayloadHash([makeAnalysisRow("1")]) },
        expectedCounts: { world_player_cards: 1, managers: 1, player_card_analysis: 1 },
      }),
    );
    const stored = client.tables.world_player_cards.get("1");
    expect(Array.isArray(stored?.skills)).toBe(true);
    expect(stored?.skills).toEqual(["Acrobatic Finishing", "Long Range Drive"]);
  });

  it("jsonbカラム(stats)にはJSON文字列化した値を渡す", async () => {
    const client = new FakeReferenceDataClient();
    const worldRows = [makeWorldRow("1", { stats: { finishing: 90, dribbling: 85 } })];
    await runRealImport(
      client,
      baseInput({
        worldRows,
        payloadHashes: { world: computePayloadHash(worldRows), managers: computePayloadHash([makeManagerRow(1)]), analysis: computePayloadHash([makeAnalysisRow("1")]) },
        expectedCounts: { world_player_cards: 1, managers: 1, player_card_analysis: 1 },
      }),
    );
    const stored = client.tables.world_player_cards.get("1");
    expect(typeof stored?.stats).toBe("string");
    expect(JSON.parse(stored?.stats as string)).toEqual({ finishing: 90, dribbling: 85 });
  });

  it("jsonbカラムに格納するJSON配列(positions)はJSON文字列化する(ネイティブ配列のまま渡さない)", async () => {
    const client = new FakeReferenceDataClient();
    const analysisRows = [makeAnalysisRow("1", { positions: [{ code: "CF", familiarity: 3, isRegistered: true }] })];
    await runRealImport(
      client,
      baseInput({
        analysisRows,
        payloadHashes: { world: computePayloadHash([makeWorldRow("1")]), managers: computePayloadHash([makeManagerRow(1)]), analysis: computePayloadHash(analysisRows) },
        expectedCounts: { world_player_cards: 2, managers: 1, player_card_analysis: 1 },
      }),
    );
    const stored = client.tables.player_card_analysis.get("1");
    expect(typeof stored?.positions).toBe("string");
    expect(JSON.parse(stored?.positions as string)).toEqual([{ code: "CF", familiarity: 3, isRegistered: true }]);
  });

  it("text[]カラム(com_skills/player_skills)にはJS配列をそのまま渡す", async () => {
    const client = new FakeReferenceDataClient();
    const analysisRows = [makeAnalysisRow("1", { com_skills: ["skill_a", "skill_b"], player_skills: ["skill_c"] })];
    await runRealImport(
      client,
      baseInput({
        analysisRows,
        payloadHashes: { world: computePayloadHash([makeWorldRow("1")]), managers: computePayloadHash([makeManagerRow(1)]), analysis: computePayloadHash(analysisRows) },
        expectedCounts: { world_player_cards: 2, managers: 1, player_card_analysis: 1 },
      }),
    );
    const stored = client.tables.player_card_analysis.get("1");
    expect(Array.isArray(stored?.com_skills)).toBe(true);
    expect(Array.isArray(stored?.player_skills)).toBe(true);
  });

  it.each([
    ["カンマを含む文字", ["Chop Turn, Feint", "Pinpoint Crossing"]],
    ["アポストロフィを含む文字", ["Trick's Move"]],
    ["引用符を含む文字", ['"Quoted" Skill']],
    ["バックスラッシュを含む文字", ["Back\\Slash"]],
    ["日本語・Unicode", ["ロングフィード", "アクロバティック"]],
    ["括弧を含む文字", ["Skill (Advanced)"]],
    ["改行を含む文字", ["Line1\nLine2"]],
    ["重複値", ["Same Skill", "Same Skill"]],
    ["空配列", []],
  ])("skills配列に%sが含まれても、そのままJS配列として渡す(text[]化はpgに任せる)", async (_label, skills) => {
    const client = new FakeReferenceDataClient();
    const worldRows = [makeWorldRow("1", { skills })];
    await runRealImport(
      client,
      baseInput({
        worldRows,
        payloadHashes: { world: computePayloadHash(worldRows), managers: computePayloadHash([makeManagerRow(1)]), analysis: computePayloadHash([makeAnalysisRow("1")]) },
        expectedCounts: { world_player_cards: 1, managers: 1, player_card_analysis: 1 },
      }),
    );
    const stored = client.tables.world_player_cards.get("1");
    expect(stored?.skills).toEqual(skills);
  });

  it("null許容カラムにnullを渡した場合はnullのまま(JSON.stringifyしない)", async () => {
    const client = new FakeReferenceDataClient();
    const worldRows = [makeWorldRow("1", { name_ja: null, card_type: null })];
    await runRealImport(
      client,
      baseInput({
        worldRows,
        payloadHashes: { world: computePayloadHash(worldRows), managers: computePayloadHash([makeManagerRow(1)]), analysis: computePayloadHash([makeAnalysisRow("1")]) },
        expectedCounts: { world_player_cards: 1, managers: 1, player_card_analysis: 1 },
      }),
    );
    const stored = client.tables.world_player_cards.get("1");
    expect(stored?.name_ja).toBeNull();
    expect(stored?.card_type).toBeNull();
  });
});
