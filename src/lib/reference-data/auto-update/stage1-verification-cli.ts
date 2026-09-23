import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { buildManagerCurrentRowsFromSqlite, buildWorldCurrentRowsFromSqlite, type ReadOnlySqlite } from "./sqlite-current-state";
import {
  STAGE1_APPROVED_WORLD_FULL_SCAN,
  STAGE1_LIMITS,
  analyzeSourceTimestamps,
  runStage1Full,
  runStage1IsolatedValidation,
  runWorldProbe,
  summarizeStage1Full,
} from "./stage1-verification";
import { STAGE1_APPROVAL_TOKEN, createUpstreamHttpTransport, type UpstreamRequestLogEntry } from "./upstream-http-transport";

/**
 * Stage 1 upstream読み取り検証のCLI(本人承認済みの手動実行だけ。scheduleからは呼ばない)。
 *
 *   node scripts/reference-data-stage1-verify-entry.mjs probe | full | incremental | managers
 *   node scripts/reference-data-stage1-verify-entry.mjs world-full world-full-scan-once-2026-09-23
 *
 * - world-full: 本人が2026-09-23に承認した1回限りのWorld完全性検証(443 page・14,000件・40MB・445 request)。
 *   managers.jsonは取得しない(検証済み)。同じ承認でのEvidenceが既にあれば実行しない(1回限り)。
 * - ローカルSQLite(data/efootball.db)は読み取り専用。Productionへは接続しない。
 * - upstreamの本文・選手名・監督名は出力しない。Evidenceは要約だけをdocs配下へ書く。
 * - PHASE2_TEST_PG_* があれば使い捨てPostgreSQLでdry run・rollback simulationを行う。
 */

const ROOT = process.cwd();
const SQL_DIR = path.join(ROOT, "docs", "production-readiness", "sql");
const EVIDENCE_DIR = path.join(ROOT, "docs", "production-readiness", "evidence");
const MODES = ["probe", "full", "incremental", "managers", "world-full"] as const;
type Mode = (typeof MODES)[number];

/** node:sqliteは読み取り専用で開く(型はこのCLIが使う最小限だけ)。 */
function openSqliteReadOnly(file: string): ReadOnlySqlite & { close(): void } {
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (p: string, o: { readOnly: boolean }) => ReadOnlySqlite & { close(): void } };
  return new DatabaseSync(file, { readOnly: true });
}

function writeEvidence(name: string, data: Record<string, unknown>): string {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = path.join(EVIDENCE_DIR, name);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function histogram(values: readonly string[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const v of values) h[v] = (h[v] ?? 0) + 1;
  return h;
}

function requestSummary(log: readonly UpstreamRequestLogEntry[]): Record<string, unknown> {
  return {
    count: log.length,
    bySource: histogram(log.map((l) => l.sourceId)),
    outcomes: histogram(log.map((l) => `${l.sourceId}:${l.status ?? l.outcome}`)),
    totalBytes: log.reduce((a, l) => a + l.bytes, 0),
    maxDurationMs: Math.max(0, ...log.map((l) => l.durationMs)),
    avgDurationMs: log.length === 0 ? 0 : Math.round(log.reduce((a, l) => a + l.durationMs, 0) / log.length),
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const mode = argv[0] as Mode;
  if (!MODES.includes(mode)) {
    process.stdout.write(`usage: ${MODES.join(" | ")}\n`);
    return 2;
  }
  if (mode === "world-full") {
    if (argv[1] !== STAGE1_APPROVED_WORLD_FULL_SCAN.approvalId) {
      process.stdout.write("world-full requires the approval id of the owner-approved one-time scan\n");
      return 2;
    }
    const already = existsSync(EVIDENCE_DIR) && readdirSync(EVIDENCE_DIR).some((f) => f.startsWith(`stage1-world-full-${STAGE1_APPROVED_WORLD_FULL_SCAN.approvalId}`));
    if (already) {
      process.stdout.write("world-full under this approval has already run once; refusing to repeat\n");
      return 2;
    }
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
          : mode === "world-full"
            ? { "efootball-world": STAGE1_APPROVED_WORLD_FULL_SCAN.worldMaxRequests, "managers-json": 0 }
            : { "efootball-world": STAGE1_LIMITS.worldMaxPages + 2, "managers-json": 1 },
    maxTotalBytes: mode === "world-full" ? STAGE1_APPROVED_WORLD_FULL_SCAN.maxTotalBytes : undefined,
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
  const rawUpdatedAt: (string | null)[] = [];
  const full = await runStage1Full({
    transport,
    currentRows,
    history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null },
    fetchedAt,
    now: fetchedAt,
    worldMode: mode === "incremental" ? "incremental" : mode === "managers" ? "skip" : "full",
    includeManagers: mode !== "world-full",
    worldLimits: mode === "world-full" ? { maxPages: STAGE1_APPROVED_WORLD_FULL_SCAN.worldMaxPages, maxRecords: STAGE1_APPROVED_WORLD_FULL_SCAN.worldMaxRecords } : undefined,
    onWorldRecord: (n) => rawUpdatedAt.push(n.appearance_updated_at),
  });
  const finishedFetchingAt = new Date().toISOString();
  const evidence: Record<string, unknown> = {
    kind: `stage1-${mode}-verification`,
    approvalId: mode === "world-full" ? STAGE1_APPROVED_WORLD_FULL_SCAN.approvalId : null,
    startedAt: fetchedAt,
    finishedFetchingAt,
    fetchDurationSeconds: Math.round((Date.parse(finishedFetchingAt) - startedAt.getTime()) / 1000),
    limits: mode === "world-full" ? STAGE1_APPROVED_WORLD_FULL_SCAN : STAGE1_LIMITS,
    currentStateSource: "local SQLite (read-only), same transforms as the original Production import; not Production itself",
    currentRowCounts: { world_player_cards: currentRows.world_player_cards.length, managers: currentRows.managers.length },
    requests: requestSummary(transport.log),
    result: summarizeStage1Full(full),
  };
  const worldSnapshot = full.snapshots.find((s) => s.table === "world_player_cards");
  if (worldSnapshot) {
    let previousMax: string | null = null;
    for (const r of currentRows.world_player_cards) {
      const u = typeof r.appearance_updated_at === "string" ? new Date(r.appearance_updated_at).toISOString() : null;
      if (u && (previousMax == null || u > previousMax)) previousMax = u;
    }
    evidence.sourceTimestamps = {
      ...analyzeSourceTimestamps(
        worldSnapshot.rows.map((r) => {
          const v = (r as Record<string, unknown>).appearance_updated_at;
          return typeof v === "string" ? v : null;
        }),
        rawUpdatedAt,
        fetchedAt,
        previousMax,
      ),
      previousMaxFromSqlite: previousMax,
      interpretation:
        "upstream appearance.updatedAt has no time zone; interpreted as UTC (provisional). Backup v2 proves storage/restore integrity only, not the semantic correctness of this interpretation. Unresolved before any Production apply.",
    };
  }

  if (full.candidate && process.env.PHASE2_TEST_PG_USER) {
    const client = new Client(buildTestOnlyPgConfigFromEnv(process.env));
    await client.connect();
    try {
      const read = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
      const started = Date.now();
      const result = await runStage1IsolatedValidation(client, full.plans, full.stagings, full.candidate, currentRows, {
        reference: {
          base: read(REPOSITORY_REFERENCE_SQL_FILES.base),
          detailExtension: read(REPOSITORY_REFERENCE_SQL_FILES.detailExtension),
          nameSortKeyExtension: read(REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension),
        },
        createUpdaterRole: read("create-reference-data-updater-role.sql"),
        updaterPolicies: read("create-reference-data-updater-rls-policies.sql"),
        rollbackUpdaterRole: read("rollback-reference-data-updater-role.sql"),
      }, new Date());
      evidence.isolated = { ...result, durationSeconds: Math.round((Date.now() - started) / 1000) };
    } finally {
      await client.end();
    }
  } else {
    evidence.isolated = { skipped: full.candidate ? "PHASE2_TEST_PG_* not set" : "no candidate" };
  }
  const name = mode === "world-full" ? `stage1-world-full-${STAGE1_APPROVED_WORLD_FULL_SCAN.approvalId}.json` : `stage1-${mode}-verification-${fetchedAt.slice(0, 10)}.json`;
  const file = writeEvidence(name, evidence);
  process.stdout.write(`${JSON.stringify({ ...evidence, evidenceFile: file }, null, 2)}\n`);
  return full.failure ? 1 : 0;
}
