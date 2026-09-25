import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRecordedFixtureTransport, type RecordedExchange } from "./source-transport";
import { buildManagersRequest } from "./source-managers";
import { buildWorldSearchRequest } from "./source-world";
import { buildStagingDataset } from "./source-snapshot";
import { collectManagersSnapshot } from "./update-dry-run";
import { APPLIED_STATE_FILE, parseAppliedState, runDetection, type AppliedState } from "./update-detection";
import { main as detectionMain } from "./update-detection-cli";
import { SYNTHETIC_MANAGERS, managersResponse } from "./__fixtures__/stage4-fixtures";
import { buildManagersCandidate } from "./stage4-managers";
import { buildWorldCandidate } from "./stage4-world";
import { recordedWorldPages, upstreamPlayers, worldState } from "./__fixtures__/stage4-world-fixtures";

const FETCHED = "2026-09-25T09:00:00.000Z";
const noSleep = async () => undefined;

function transport(world = recordedWorldPages()) {
  const exchanges: RecordedExchange[] = [
    ...world.map((p) => ({ request: buildWorldSearchRequest(p.page, "CREATED_AT"), responses: [{ status: 200, headers: { "content-type": p.contentType }, bodyText: p.bodyText }] })),
    { request: buildManagersRequest(), responses: [{ status: 200, headers: { "content-type": "text/plain" }, bodyText: managersResponse().bodyText }] },
  ];
  return createRecordedFixtureTransport(exchanges);
}

/** applied-stateに記録される値と同じ基準: 適用したcandidateのsourceChecksum(先頭12文字)。 */
async function managersChecksum12(): Promise<string> {
  const b = await buildManagersCandidate(managersResponse(SYNTHETIC_MANAGERS), FETCHED, [], FETCHED);
  return b.candidate.sourceChecksum.slice(0, 12);
}
async function worldChecksum12(): Promise<string> {
  const b = await buildWorldCandidate(recordedWorldPages(), FETCHED, worldState(), FETCHED);
  return b.candidate.sourceChecksum.slice(0, 12);
}

const applied = (patch: Partial<AppliedState["datasets"]> = {}): AppliedState => ({
  schema: "reference-data-applied-state/v1",
  updatedAt: "2026-09-25",
  datasets: {
    world_player_cards: { sourceChecksum12: null, recordCount: 4, appliedAt: null, maxAppearanceUpdatedAt: null, evidence: null },
    managers: { sourceChecksum12: "000000000000", recordCount: 4, appliedAt: null, evidence: null },
    ...patch,
  },
});

describe("定期検出(Productionなし)", () => {
  it("World全件1回 + managers.json 1件だけを取得し、適用済みのchecksumと比べて判定する", async () => {
    const t = transport();
    const r = await runDetection({ transport: t, fetchedAt: FETCHED, sleep: noSleep, applied: applied({ managers: { sourceChecksum12: await managersChecksum12(), recordCount: 5, appliedAt: null, evidence: null } }) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(t.calls.filter((c) => c.sourceId === "efootball-world")).toHaveLength(2);
    expect(t.calls.filter((c) => c.sourceId === "managers-json")).toHaveLength(1);
    expect(r.managers).toMatchObject({ decision: "no_change", recordCount: 5 });
    expect(r.world).toMatchObject({ decision: "update_available", recordCount: 5, appliedRecordCount: 4 });
    expect(r.world.signals).toContain("no_applied_baseline");
    expect(r.world.timestamps).toMatchObject({ rawWithoutTimezone: 5, futureCount: 0 });
    expect(JSON.stringify(r)).not.toMatch(/Synthetic|合成/);
  });

  it("適用したcandidateと同じupstreamならWorld・managersともno_change(applied-stateと同じchecksum基準)", async () => {
    const r = await runDetection({
      transport: transport(),
      fetchedAt: FETCHED,
      sleep: noSleep,
      applied: applied({
        world_player_cards: { sourceChecksum12: await worldChecksum12(), recordCount: 5, appliedAt: null, maxAppearanceUpdatedAt: "2026-04-01T00:00:00.000Z", evidence: null },
        managers: { sourceChecksum12: await managersChecksum12(), recordCount: 5, appliedAt: null, evidence: null },
      }),
    });
    expect(r.ok && r.world.decision).toBe("no_change");
    expect(r.ok && r.managers.decision).toBe("no_change");
    // staging単体のchecksum(誤った基準)とは一致しないこと = 基準の取り違えを検出できる。
    const m = await collectManagersSnapshot(createRecordedFixtureTransport([{ request: buildManagersRequest(), responses: [{ status: 200, headers: { "content-type": "text/plain" }, bodyText: JSON.stringify(SYNTHETIC_MANAGERS) }] }]), { fetchedAt: FETCHED, sleep: noSleep });
    if (!m.ok) throw new Error("fixture");
    expect(buildStagingDataset(m.snapshot).sourceChecksum.slice(0, 12)).not.toBe(await managersChecksum12());
  });

  it("件数の大きな減少・将来日時・逆行はattention_required(applyへは進まない判定)", async () => {
    const drop = await runDetection({ transport: transport(), fetchedAt: FETCHED, sleep: noSleep, applied: applied({ world_player_cards: { sourceChecksum12: null, recordCount: 100, appliedAt: null, evidence: null } }) });
    expect(drop.ok && drop.world.decision).toBe("attention_required");
    const future = await runDetection({ transport: transport(recordedWorldPages(upstreamPlayers({ updatedAt: "2027-01-01T00:00:00" }))), fetchedAt: FETCHED, sleep: noSleep, applied: applied() });
    expect(future.ok && future.world.signals).toContain("future_timestamps");
    expect(future.ok && future.world.decision).toBe("attention_required");
    const regressed = await runDetection({
      transport: transport(),
      fetchedAt: FETCHED,
      sleep: noSleep,
      applied: applied({ world_player_cards: { sourceChecksum12: null, recordCount: 4, appliedAt: null, maxAppearanceUpdatedAt: "2026-09-01T00:00:00.000Z", evidence: null } }),
    });
    expect(regressed.ok && regressed.world.decision).toBe("attention_required");
  });

  it("取得の失敗・不完全は判定せずに失敗", async () => {
    const t = createRecordedFixtureTransport([{ request: buildWorldSearchRequest(1, "CREATED_AT"), responses: [{ status: 503, headers: {}, bodyText: "" }, { status: 503, headers: {}, bodyText: "" }, { status: 503, headers: {}, bodyText: "" }] }]);
    const r = await runDetection({ transport: t, fetchedAt: FETCHED, sleep: noSleep, applied: applied() });
    expect(r.ok).toBe(false);
  });

  it("リポジトリのapplied-state記録は形式が正しく、managersはStage 4のEvidenceと一致する", () => {
    const root = path.resolve(__dirname, "..", "..", "..", "..");
    const state = parseAppliedState(readFileSync(path.join(root, APPLIED_STATE_FILE), "utf8"));
    const ev = JSON.parse(readFileSync(path.join(root, "docs", "production-readiness", "evidence", "stage4-managers-rehearsal-2026-09-24.json"), "utf8"));
    expect(state.datasets.managers).toMatchObject({ sourceChecksum12: ev.candidate.sourceChecksum12, recordCount: ev.diff.after });
    const wev = JSON.parse(readFileSync(path.join(root, "docs", "production-readiness", "evidence", "stage4-world-rehearsal-2026-09-25.json"), "utf8"));
    expect(state.datasets.world_player_cards).toMatchObject({
      sourceChecksum12: wev.candidate.sourceChecksum12, recordCount: wev.diff.after, appliedAt: wev.apply.appliedAt, maxAppearanceUpdatedAt: wev.sourceTimestamps.max,
    });
    expect(() => parseAppliedState("{}")).toThrow("applied_state_shape");
  });

  it("CLIは有効化の変数が'true'でなければupstreamへ1件も送らずに止まる", async () => {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => (chunks.push(String(s)), true);
    try {
      expect(await detectionMain({ REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED: "" })).toBe(1);
      expect(await detectionMain({})).toBe(1);
    } finally {
      (process.stdout as unknown as { write: typeof orig }).write = orig;
    }
    expect(chunks.join("")).toContain('"not_enabled"');
    expect(chunks.join("")).toContain('"upstreamRequests": 0');
  });
});
