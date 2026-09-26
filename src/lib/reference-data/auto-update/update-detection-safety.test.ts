import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRecordedFixtureTransport, type RecordedExchange } from "./source-transport";
import { buildManagersRequest } from "./source-managers";
import { buildWorldSearchRequest } from "./source-world";
import { APPLIED_STATE_FILE, parseAppliedState, runDetection, type AppliedState, type DetectionResult } from "./update-detection";
import { DETECTION_SAFETY, buildDetectionSummary, main as detectionMain } from "./update-detection-cli";
import { validateDetectionSummary } from "./detection-summary-validator";
import type { UpstreamRequestLogEntry } from "./upstream-http-transport";
import { managersResponse } from "./__fixtures__/stage4-fixtures";
import { recordedWorldPages, upstreamPlayers, worldPlayer } from "./__fixtures__/stage4-world-fixtures";

const FETCHED = "2026-09-25T09:00:00.000Z";
const noSleep = async () => undefined;
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

type Resp = { status: number; headers: Record<string, string>; bodyText: string };
function transport(worldPages: { page: number; responses: Resp[] }[], managers: Resp[] = [{ status: 200, headers: { "content-type": "text/plain" }, bodyText: managersResponse().bodyText }]) {
  const exchanges: RecordedExchange[] = [
    ...worldPages.map((p) => ({ request: buildWorldSearchRequest(p.page, "CREATED_AT"), responses: p.responses })),
    { request: buildManagersRequest(), responses: managers },
  ];
  return createRecordedFixtureTransport(exchanges);
}
const okPages = (players = upstreamPlayers()) => recordedWorldPages(players).map((p) => ({ page: p.page, responses: [{ status: 200, headers: { "content-type": p.contentType }, bodyText: p.bodyText }] }));

const applied = (): AppliedState => ({
  schema: "reference-data-applied-state/v1",
  updatedAt: "2026-09-25",
  datasets: {
    world_player_cards: { sourceChecksum12: "000000000000", recordCount: 5, appliedAt: null, maxAppearanceUpdatedAt: "2026-04-01T00:00:00.000Z", evidence: null },
    managers: { sourceChecksum12: "000000000000", recordCount: 5, appliedAt: null, evidence: null },
  },
});

const log = (world: number, managers = 1, status = 200): UpstreamRequestLogEntry[] => [
  ...Array.from({ length: world }, () => ({ sourceId: "efootball-world" as const, status, outcome: "response" as const, durationMs: 1, bytes: 10 })),
  ...Array.from({ length: managers }, () => ({ sourceId: "managers-json" as const, status: 200, outcome: "response" as const, durationMs: 1, bytes: 10 })),
];

async function captureCli(env: Record<string, string | undefined>): Promise<{ code: number; text: string }> {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => (chunks.push(String(s)), true);
  try {
    const code = await detectionMain(env);
    return { code, text: chunks.join("") };
  } finally {
    (process.stdout as unknown as { write: typeof orig }).write = orig;
  }
}

describe("検出の品質と異常時の判定", () => {
  it("正常な取得: 重複0・schema drift 0・rejected 0・complete、page数を記録し、World・managers以外へ送らない", async () => {
    const t = transport(okPages());
    const r = await runDetection({ transport: t, fetchedAt: FETCHED, sleep: noSleep, applied: applied() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const d of [r.world, r.managers]) expect(d.quality).toEqual({ complete: true, duplicateIdentities: 0, rejectedRecords: 0, schemaDrift: 0 });
    expect(r.world.pages).toBe(2);
    expect(new Set(t.calls.map((c) => c.sourceId))).toEqual(new Set(["efootball-world", "managers-json"]));
    expect(r.world.decision).toBe("update_available");
  });

  it("同じカードの再出現(重複identity)はattention_required", async () => {
    const players = [...upstreamPlayers().slice(0, 4), worldPlayer(1)];
    const r = await runDetection({ transport: transport(okPages(players)), fetchedAt: FETCHED, sleep: noSleep, applied: applied() });
    expect(r).toMatchObject({ ok: false, attention: true, failure: { table: "world_player_cards", code: "duplicate_identity" } });
  });

  it("schema drift(players配列なし)はattention_required", async () => {
    const r = await runDetection({
      transport: transport([{ page: 1, responses: [{ status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify({ items: [] }) }] }]),
      fetchedAt: FETCHED,
      sleep: noSleep,
      applied: applied(),
    });
    expect(r).toMatchObject({ ok: false, attention: true, failure: { code: "schema_drift" } });
  });

  it("不完全なsnapshot(totalCountと受信件数の不一致)はattention_required", async () => {
    const pages = recordedWorldPages().map((p) => ({ ...p, bodyText: JSON.stringify({ ...JSON.parse(p.bodyText), totalCount: 6 }) }));
    const r = await runDetection({ transport: transport(pages.map((p) => ({ page: p.page, responses: [{ status: 200, headers: { "content-type": p.contentType }, bodyText: p.bodyText }] }))), fetchedAt: FETCHED, sleep: noSleep, applied: applied() });
    expect(r).toMatchObject({ ok: false, attention: true, failure: { code: "source_incomplete" } });
  });

  it("403・429・CAPTCHAは再試行せず即停止(attentionではなく取得停止)", async () => {
    for (const [resp, code] of [
      [{ status: 403, headers: {}, bodyText: "" }, "http_403"],
      [{ status: 429, headers: {}, bodyText: "" }, "http_429"],
      [{ status: 403, headers: { "content-type": "text/html" }, bodyText: "<html>cf-challenge</html>" }, "captcha"],
    ] as const) {
      const t = transport([{ page: 1, responses: [resp] }]);
      const r = await runDetection({ transport: t, fetchedAt: FETCHED, sleep: noSleep, applied: applied() });
      expect(r).toMatchObject({ ok: false, attention: false, failure: { code } });
      expect(t.calls).toHaveLength(1);
    }
  });
});

describe("要約v2(安全項目を明示)", () => {
  const okResult = async () => runDetection({ transport: transport(okPages()), fetchedAt: FETCHED, sleep: noSleep, applied: applied() });

  it("自動実行なし・Production 0・Secret 0・本文保存なしを要約に明示し、validatorを通る", async () => {
    const s = buildDetectionSummary({ trigger: "schedule", fetchedAt: FETCHED, result: await okResult(), log: log(2) });
    expect(s).toMatchObject({ schema: "reference-data-detection-summary/v2", ok: true, overall: "update_available", productionAccess: 0, automaticApply: false, safety: DETECTION_SAFETY });
    expect(DETECTION_SAFETY).toMatchObject({ productionAccess: 0, secretsUsed: 0, automaticBackup: false, automaticApply: false, automaticRollback: false, automaticRestore: false, rawPayloadStored: false, appliedStateUpdated: false });
    const v = validateDetectionSummary(JSON.stringify(s), applied());
    expect(v.problems).toEqual([]);
    expect(v.verdict).toBe("DETECTION_SUMMARY_VALID");
  });

  it("no_change / update_available / attention_requiredのoverall", async () => {
    const r = (await okResult()) as Extract<DetectionResult, { ok: true }>;
    const same = { ...r, world: { ...r.world, decision: "no_change" as const }, managers: { ...r.managers, decision: "no_change" as const } };
    expect(buildDetectionSummary({ trigger: "schedule", fetchedAt: FETCHED, result: same, log: log(2) }).overall).toBe("no_change");
    expect(buildDetectionSummary({ trigger: "schedule", fetchedAt: FETCHED, result: r, log: log(2) }).overall).toBe("update_available");
    const att = { ...r, managers: { ...r.managers, decision: "attention_required" as const } };
    expect(buildDetectionSummary({ trigger: "schedule", fetchedAt: FETCHED, result: att, log: log(2) }).overall).toBe("attention_required");
    const stopped = buildDetectionSummary({ trigger: "schedule", fetchedAt: FETCHED, result: { ok: false, failure: { table: "world_player_cards", stage: "source_fetch", code: "captcha" }, attention: false }, log: log(1, 0, 403) });
    expect(stopped).toMatchObject({ ok: false, overall: "fetch_stopped", upstream: { http403: 1, challenge: 1 } });
  });

  it("validatorは改ざん・異常を拒否する(判定とchecksumの矛盾・安全項目・request数・本文混入・attention)", async () => {
    const s = buildDetectionSummary({ trigger: "workflow_dispatch", fetchedAt: FETCHED, result: await okResult(), log: log(2) }) as Record<string, unknown>;
    const bad = (patch: (x: Record<string, any>) => void) => {
      const c = JSON.parse(JSON.stringify(s));
      patch(c);
      return validateDetectionSummary(JSON.stringify(c), applied()).problems;
    };
    expect(bad((c) => (c.world.decision = "no_change"))).toContain("world_no_change_but_checksum_differs");
    expect(bad((c) => (c.safety.automaticBackup = true))).toContain("safety_automaticBackup");
    expect(bad((c) => (c.safety.secretsUsed = 1))).toContain("safety_secretsUsed");
    expect(bad((c) => (c.productionAccess = 1))).toContain("production_access_not_zero");
    expect(bad((c) => (c.upstream.managersRequests = 2))).toContain("managers_requests_not_one");
    expect(bad((c) => (c.upstream.http429 = 1))).toContain("upstream_http429_not_zero");
    expect(bad((c) => (c.upstream.worldRequests = 999))).toContain("world_requests_outside_contract");
    expect(bad((c) => (c.world.quality.duplicateIdentities = 1))).toContain("world_quality_not_clean");
    expect(bad((c) => (c.world.quality.schemaDrift = 1))).toContain("world_quality_not_clean");
    expect(bad((c) => (c.rows = [{ id: 1 }]))).toContain("unexpected_key:rows");
    expect(bad((c) => (c.nextStep = "x".repeat(400)))).toContain("long_string:$.nextStep");
    expect(bad((c) => (c.managers.decision = "attention_required"))).toContain("managers_attention_required");
  });

  it("初回Run #1のv1要約(2026-09-25)は、明示されていない安全項目をfalse扱いせずに区別して検証する", () => {
    const v1 = {
      ok: true, phase: "detection", fetchedAt: "2026-09-25T10:50:48.137Z",
      upstream: { requests: 445, worldRequests: 444, managersRequests: 1, non200: 0, totalBytes: 29123516 },
      world: { decision: "update_available", recordCount: 13297, appliedRecordCount: 13297, sourceChecksum12: "ed068757c555", signals: [], timestamps: { total: 13297, rawWithoutTimezone: 13297, min: "2026-04-28T17:17:02.021Z", max: "2026-09-24T17:03:33.478Z", futureCount: 0, regression: false, mostCommonShare: 0.0001 } },
      managers: { decision: "no_change", recordCount: 67, appliedRecordCount: 67, sourceChecksum12: "8c1d654ec48e", signals: [] },
      productionAccess: 0, automaticApply: false, nextStep: "update_available/attention_required → owner runs the approval-gated plan", checkedAt: "2026-09-25T11:16:30.393Z",
    };
    // Run #1時点のapplied-state(2026-09-25。その後のWorld更新でリポジトリの記録は変わる)。
    const state = parseAppliedState(readFileSync(path.join(ROOT, APPLIED_STATE_FILE), "utf8"));
    const atRun1: AppliedState = {
      ...state,
      datasets: {
        world_player_cards: { sourceChecksum12: "33fb0c2ee49c", recordCount: 13297, appliedAt: "2026-09-25T10:24:25.370Z", maxAppearanceUpdatedAt: "2026-09-24T17:03:33.478Z", evidence: null },
        managers: { sourceChecksum12: "8c1d654ec48e", recordCount: 67, appliedAt: null, evidence: null },
      },
    };
    const v = validateDetectionSummary(JSON.stringify(v1), atRun1);
    expect(v.verdict).toBe("DETECTION_SUMMARY_VALID");
    expect(v.facts).toMatchObject({ summaryVersion: 1, explicitSafetyFields: false, world: { checksumMatchesApplied: false }, managers: { checksumMatchesApplied: true }, worldMaxMatchesApplied: true });
  });
});

describe("検出CLIの安全Gate(upstreamへ送る前に停止)", () => {
  it("変数が未設定・'false'・'True'ならrequest 0で停止", async () => {
    for (const v of [undefined, "", "false", "True", "TRUE"]) {
      const r = await captureCli({ REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED: v, GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule" });
      expect(r.code).toBe(1);
      expect(r.text).toContain('"not_enabled"');
      expect(r.text).toContain('"upstreamRequests": 0');
    }
  });

  it("GitHub Actions上: 手動は確認入力'detect'が無ければ、許可外のeventなら、request 0で停止", async () => {
    const noConfirm = await captureCli({ REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED: "true", GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", REFERENCE_DATA_DETECTION_CONFIRM: "" });
    expect(noConfirm.text).toContain('"confirmation_missing"');
    expect(noConfirm.text).toContain('"upstreamRequests": 0');
    const push = await captureCli({ REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED: "true", GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", REFERENCE_DATA_DETECTION_CONFIRM: "detect" });
    expect(push.text).toContain('"trigger_not_allowed"');
    expect(push.code).toBe(1);
  });

  it("検出のコードはProduction・DB・R2・Backup・applyを参照しない(Secretも読まない)", () => {
    for (const f of ["update-detection.ts", "update-detection-cli.ts", "detection-summary-validator.ts", "detection-summary-validator-cli.ts"]) {
      const src = readFileSync(path.join(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/from "pg"|postgres|DATABASE_URL|SUPABASE|R2_|process\.env\.[A-Z]|from "\.\/(production|backup-execution|backup-runner|restore)/i);
    }
  });
});
