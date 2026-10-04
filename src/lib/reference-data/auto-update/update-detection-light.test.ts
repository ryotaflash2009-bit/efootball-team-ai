import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  decideWorldScan,
  nextWorldLightState,
  parseWorldLightState,
  worldPage1Fingerprint,
  markRepeatCandidate,
  parseCandidateState,
  WORLD_FULL_SCAN_INTERVAL_MS,
  WORLD_FAILURE_RETRY_MS,
  REPEAT_CANDIDATE_WINDOW_MS,
} from "./update-detection-light";
import { applyRepeatMarking, buildLightDetectionSummary } from "./update-detection-cli";
import { decideFromDetection } from "./update-orchestrator";
import { validateDetectionSummary } from "./detection-summary-validator";
import { parseAppliedState, APPLIED_STATE_FILE, type DatasetDetection } from "./update-detection";
import { buildDetectionNotification } from "../../../../scripts/lib/reference-data-notify.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const applied = parseAppliedState(readFileSync(path.join(ROOT, APPLIED_STATE_FILE), "utf8"));
const signal = { totalCount: 13372, totalPages: 446, page1ContentHash: "a".repeat(64) };
const T0 = "2026-10-04T00:17:00.000Z";
const at = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();
const state = (over: Partial<ReturnType<typeof nextWorldLightState>> = {}) =>
  JSON.stringify({ ...nextWorldLightState({ signal, fullAt: T0, outcome: "complete", worldChecksum12: "0123456789ab" }), ...over });

describe("毎時の検出: World の全件取得を行うかの判定（fail-safe）", () => {
  it("手動の実行は常に完全な検出", () => {
    expect(decideWorldScan({ signal, stateText: state(), now: at(60_000), trigger: "workflow_dispatch" })).toEqual({ scan: "full", reason: "manual_trigger" });
  });
  it("状態が無い・壊れている・未来の時刻 → 完全な検出（推測で変化なしとしない）", () => {
    expect(decideWorldScan({ signal, stateText: null, now: T0, trigger: "schedule" }).reason).toBe("no_previous_state");
    expect(decideWorldScan({ signal, stateText: "{bad", now: T0, trigger: "schedule" }).reason).toBe("invalid_state");
    expect(decideWorldScan({ signal, stateText: state({ lastFullAt: at(3_600_000) }), now: T0, trigger: "schedule" }).reason).toBe("invalid_state");
  });
  it("信号（総件数・総ページ数・1 ページ目の指紋）のどれかが変われば完全な検出", () => {
    for (const s of [{ ...signal, totalCount: 13373 }, { ...signal, totalPages: 447 }, { ...signal, page1ContentHash: "b".repeat(64) }]) {
      expect(decideWorldScan({ signal: s, stateText: state(), now: at(3_600_000), trigger: "schedule" })).toEqual({ scan: "full", reason: "world_signal_changed" });
    }
  });
  it("信号が同じで 6 時間未満 → 軽い回。6 時間以上 → 完全な検出（既存カードの変更も遅くとも 6 時間で検出）", () => {
    expect(decideWorldScan({ signal, stateText: state(), now: at(WORLD_FULL_SCAN_INTERVAL_MS - 1), trigger: "schedule" })).toEqual({ scan: "light", reason: "world_signal_unchanged" });
    expect(decideWorldScan({ signal, stateText: state(), now: at(WORLD_FULL_SCAN_INTERVAL_MS), trigger: "schedule" })).toEqual({ scan: "full", reason: "full_scan_due" });
  });
  it("完全な検出の失敗の後は 2 時間あけて再試行（毎時の全件取得の繰り返しで上流へ負荷をかけない）", () => {
    const failed = state({ lastFullOutcome: "failed" });
    expect(decideWorldScan({ signal, stateText: failed, now: at(WORLD_FAILURE_RETRY_MS - 1), trigger: "schedule" })).toEqual({ scan: "light", reason: "failure_backoff" });
    expect(decideWorldScan({ signal, stateText: failed, now: at(WORLD_FAILURE_RETRY_MS), trigger: "schedule" })).toEqual({ scan: "full", reason: "retry_after_failure" });
  });
  it("状態の検証: 形が違えば null", () => {
    expect(parseWorldLightState(state())).not.toBeNull();
    expect(parseWorldLightState(JSON.stringify({ ...JSON.parse(state()), schema: "x" }))).toBeNull();
    expect(parseWorldLightState(JSON.stringify({ ...JSON.parse(state()), lastFullWorldChecksum12: "zz" }))).toBeNull();
  });
  it("1 ページ目の指紋は ID と更新時刻だけから作る（同じ内容なら同じ・更新時刻が変われば変わる）", () => {
    const p = [{ id: 1, playerId: "89138556575063", appearanceUpdatedAt: "2026-10-01T00:00:00Z" }];
    expect(worldPage1Fingerprint(p)).toBe(worldPage1Fingerprint(JSON.parse(JSON.stringify(p))));
    expect(worldPage1Fingerprint(p)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("毎時の検出: 同じ候補を何度も Pipeline へ渡さない", () => {
  it("同じ checksum を 24 時間以内に報告済み → repeat。新しい checksum・24 時間後 → repeat でない", () => {
    let s = parseCandidateState(null);
    const a = markRepeatCandidate({ state: s, dataset: "managers", checksum12: "aaaaaaaaaaaa", now: T0 });
    expect(a.repeat).toBe(false);
    s = a.state;
    expect(markRepeatCandidate({ state: s, dataset: "managers", checksum12: "aaaaaaaaaaaa", now: at(3_600_000) }).repeat).toBe(true);
    expect(markRepeatCandidate({ state: s, dataset: "managers", checksum12: "bbbbbbbbbbbb", now: at(3_600_000) }).repeat).toBe(false);
    expect(markRepeatCandidate({ state: s, dataset: "managers", checksum12: "aaaaaaaaaaaa", now: at(REPEAT_CANDIDATE_WINDOW_MS) }).repeat).toBe(false);
    expect(markRepeatCandidate({ state: s, dataset: "world", checksum12: "aaaaaaaaaaaa", now: at(3_600_000) }).repeat).toBe(false);
  });
});

const managersDet = (decision: DatasetDetection["decision"], checksum12: string): DatasetDetection => ({
  decision,
  recordCount: applied.datasets.managers.recordCount,
  appliedRecordCount: applied.datasets.managers.recordCount,
  sourceChecksum12: checksum12,
  signals: [],
  quality: { complete: true, duplicateIdentities: 0, rejectedRecords: 0, schemaDrift: 0 },
});
const log = [
  { sourceId: "efootball-world", status: 200, bytes: 1000 },
  { sourceId: "managers-json", status: 200, bytes: 500 },
] as never;
const light = (m: DatasetDetection) =>
  buildLightDetectionSummary({
    trigger: "schedule",
    fetchedAt: T0,
    managers: { ok: true, managers: m },
    world: { signal, decision: { scan: "light", reason: "world_signal_unchanged" }, lastFullAt: T0 },
    log,
  });

describe("毎時の検出の軽い回の要約", () => {
  it("変化なし: World は not_scanned（変更なしと書かない）・overall no_change_light・Pipeline も通知もなし", () => {
    const s = light(managersDet("no_change", applied.datasets.managers.sourceChecksum12 as string));
    expect(s.overall).toBe("no_change_light");
    expect((s.world as { decision: string }).decision).toBe("not_scanned");
    expect(decideFromDetection(JSON.stringify(s))).toEqual({ ok: false, reasons: ["no_update_available"] });
    expect(buildDetectionNotification(s, { conclusion: "success", runId: "1", runUrl: "" })).toEqual({ notify: false, reason: "no_change_light" });
    expect(validateDetectionSummary(JSON.stringify({ ...s, checkedAt: T0 }), applied).problems).toEqual([]);
  });
  it("Managers だけ変化: Managers だけを Pipeline へ（World は処理しない）", () => {
    const s = light(managersDet("update_available", "ffffffffffff"));
    expect(s.overall).toBe("update_available");
    expect(decideFromDetection(JSON.stringify(s))).toEqual({ ok: true, value: { dataset: "managers", pending: [] } });
    expect(validateDetectionSummary(JSON.stringify({ ...s, checkedAt: T0 }), applied).problems).toEqual([]);
  });
  it("軽い回で World を no_change と書いた要約は検証で拒否する", () => {
    const s = light(managersDet("no_change", applied.datasets.managers.sourceChecksum12 as string));
    const bad = { ...s, world: { ...(s.world as object), decision: "no_change" }, checkedAt: T0 };
    expect(validateDetectionSummary(JSON.stringify(bad), applied).problems).toContain("light_world_decision_not_not_scanned");
  });
});

describe("完全な回の World だけ・両方の変化と、同じ候補の重複起動の防止", () => {
  const full = (world: string, managers: string) => ({
    schema: "reference-data-detection-summary/v2",
    ok: true,
    overall: world === "update_available" || managers === "update_available" ? "update_available" : "no_change",
    world: { decision: world, sourceChecksum12: "111111111111" },
    managers: { decision: managers, sourceChecksum12: "222222222222" },
  });
  it("World だけ → World だけ・両方 → World の後に Managers", () => {
    expect(decideFromDetection(JSON.stringify(full("update_available", "no_change")))).toEqual({ ok: true, value: { dataset: "world", pending: [] } });
    expect(decideFromDetection(JSON.stringify(full("update_available", "update_available")))).toEqual({ ok: true, value: { dataset: "world", pending: ["managers"] } });
  });
  it("同じ checksum の 2 回目（24 時間以内）は Pipeline を起動せず、通知もしない", () => {
    const first = applyRepeatMarking(full("update_available", "no_change"), null, T0);
    expect((first.summary.world as { repeatCandidate: boolean }).repeatCandidate).toBe(false);
    const second = applyRepeatMarking(full("update_available", "no_change"), JSON.stringify(first.stateJson), at(3_600_000));
    expect((second.summary.world as { repeatCandidate: boolean }).repeatCandidate).toBe(true);
    expect(decideFromDetection(JSON.stringify(second.summary))).toEqual({ ok: false, reasons: ["repeat_candidate_within_24h:world"] });
    expect(buildDetectionNotification(second.summary, { conclusion: "success", runId: "2", runUrl: "" })).toEqual({ notify: false, reason: "repeat_candidate" });
  });
  it("新しい checksum（古い候補の後）→ 改めて Pipeline へ（Apply は Plan で最新の上流を取り直す）", () => {
    const first = applyRepeatMarking(full("update_available", "no_change"), null, T0);
    const next = { ...full("update_available", "no_change"), world: { decision: "update_available", sourceChecksum12: "333333333333" } };
    const marked = applyRepeatMarking(next, JSON.stringify(first.stateJson), at(3_600_000));
    expect(decideFromDetection(JSON.stringify(marked.summary))).toEqual({ ok: true, value: { dataset: "world", pending: [] } });
  });
});

describe("同時実行: 前の検出・重い Pipeline を途中で取り消さない", () => {
  const wf = (f: string) => readFileSync(path.join(ROOT, ".github", "workflows", f), "utf8");
  it("検出・Orchestrator・Backup・Apply の concurrency は cancel-in-progress: false（進行中は待機、待機中は最新の 1 件）", () => {
    for (const f of ["reference-data-update-detection.yml", "reference-data-update-orchestrator.yml", "reference-data-production-backup.yml", "reference-data-production-apply.yml"]) {
      const y = wf(f);
      expect(y, f).toMatch(/concurrency:\s*\n\s+group: [\w${}.-]+/);
      expect(y, f).not.toMatch(/cancel-in-progress: true/);
    }
  });
});
