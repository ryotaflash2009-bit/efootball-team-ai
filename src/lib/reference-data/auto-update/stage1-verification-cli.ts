import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { buildManagerCurrentRowsFromSqlite, buildWorldCurrentRowsFromSqlite, type ReadOnlySqlite } from "./sqlite-current-state";
import { STAGE1_LIMITS, runStage1Full, runStage1IsolatedValidation, runWorldProbe, summarizeStage1Full } from "./stage1-verification";
import { STAGE1_APPROVAL_TOKEN, createUpstreamHttpTransport } from "./upstream-http-transport";

/**
 * Stage 1 upstream読み取り検証のCLI(本人承認済みの手動実行だけ。scheduleからは呼ばない)。
 *
 *   node scripts/reference-data-stage1-verify-entry.mjs probe
 *   node scripts/reference-data-stage1-verify-entry.mjs full   (PHASE2_TEST_PG_* があれば使い捨てPostgreSQLで検証)
 *
 * - upstreamへのrequest上限: probe = World 1(+再試行2)、full = World 上限page数+2・managers.json 1。
 * - ローカルSQLite(data/efootball.db)は読み取り専用で開く。Productionへは接続しない。
 * - upstreamの本文・選手名・監督名は出力しない。Evidenceは要約だけをdocs配下へ書く。
 */

const ROOT = process.cwd();

/** node:sqliteは読み取り専用で開く(型はこのCLIが使う最小限だけ)。 */
function openSqliteReadOnly(file: string): ReadOnlySqlite & { close(): void } {
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (p: string, o: { readOnly: boolean }) => ReadOnlySqlite & { close(): void } };
  return new DatabaseSync(file, { readOnly: true });
}
const SQL_DIR = path.join(ROOT, "docs", "production-readiness", "sql");
const EVIDENCE_DIR = path.join(ROOT, "docs", "production-readiness", "evidence");

function writeEvidence(name: string, data: Record<string, unknown>): string {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = path.join(EVIDENCE_DIR, name);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const mode = argv[0];
  if (mode !== "probe" && mode !== "full" && mode !== "incremental" && mode !== "managers") {
    process.stdout.write("usage: probe | full | incremental | managers\n");
    return 2;
  }
  const startedAt = new Date();
  const fetchedAt = startedAt.toISOString();
  const transport = createUpstreamHttpTransport({
    approval: STAGE1_APPROVAL_TOKEN,
    maxRequests:
      mode === "probe"
        ? { "efootball-world": 3, "managers-json": 0 }
        : mode === "managers"
          ? { "efootball-world": 0, "managers-json": 1 }
          : { "efootball-world": STAGE1_LIMITS.worldMaxPages + 2, "managers-json": 1 },
  });

  if (mode === "probe") {
    const probe = await runWorldProbe(transport, fetchedAt);
    const evidence = { kind: "stage1-world-probe", startedAt: fetchedAt, limits: STAGE1_LIMITS, requests: transport.log, result: probe };
    const file = writeEvidence(`stage1-world-probe-${fetchedAt.slice(0, 10)}.json`, evidence);
    process.stdout.write(`${JSON.stringify({ ...evidence, evidenceFile: file }, null, 2)}\n`);
    return probe.ok && !probe.report.schemaDrift && probe.report.withinLimits ? 0 : 1;
  }

  const db = openSqliteReadOnly(path.join(ROOT, "data", "efootball.db"));
  let currentRows;
  try {
    currentRows = { world_player_cards: buildWorldCurrentRowsFromSqlite(db), managers: buildManagerCurrentRowsFromSqlite(db) };
  } finally {
    db.close();
  }
  const full = await runStage1Full({
    transport,
    currentRows,
    history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null },
    fetchedAt,
    now: fetchedAt,
    worldMode: mode === "incremental" ? "incremental" : mode === "managers" ? "skip" : "full",
  });
  const evidence: Record<string, unknown> = {
    kind: `stage1-${mode}-verification`,
    startedAt: fetchedAt,
    finishedFetchingAt: new Date().toISOString(),
    limits: STAGE1_LIMITS,
    currentStateSource: "local SQLite (read-only), same transforms as the original Production import; not Production itself",
    currentRowCounts: { world_player_cards: currentRows.world_player_cards.length, managers: currentRows.managers.length },
    requests: {
      count: transport.log.length,
      bySource: Object.fromEntries(["efootball-world", "managers-json"].map((s) => [s, transport.log.filter((l) => l.sourceId === s).length])),
      statuses: transport.log.map((l) => `${l.sourceId}:${l.status ?? l.outcome}`),
      totalBytes: transport.log.reduce((a, l) => a + l.bytes, 0),
      maxDurationMs: Math.max(0, ...transport.log.map((l) => l.durationMs)),
    },
    result: summarizeStage1Full(full),
  };

  if (full.candidate && process.env.PHASE2_TEST_PG_USER) {
    const client = new Client(buildTestOnlyPgConfigFromEnv(process.env));
    await client.connect();
    try {
      const read = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
      evidence.isolated = await runStage1IsolatedValidation(client, full.plans, full.stagings, full.candidate, currentRows, {
        reference: {
          base: read(REPOSITORY_REFERENCE_SQL_FILES.base),
          detailExtension: read(REPOSITORY_REFERENCE_SQL_FILES.detailExtension),
          nameSortKeyExtension: read(REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension),
        },
        createUpdaterRole: read("create-reference-data-updater-role.sql"),
        updaterPolicies: read("create-reference-data-updater-rls-policies.sql"),
        rollbackUpdaterRole: read("rollback-reference-data-updater-role.sql"),
      }, new Date());
    } finally {
      await client.end();
    }
  } else {
    evidence.isolated = { skipped: full.candidate ? "PHASE2_TEST_PG_* not set" : "no candidate" };
  }
  const file = writeEvidence(`stage1-${mode}-verification-${fetchedAt.slice(0, 10)}.json`, evidence);
  process.stdout.write(`${JSON.stringify({ ...evidence, evidenceFile: file }, null, 2)}\n`);
  return full.failure ? 1 : 0;
}
