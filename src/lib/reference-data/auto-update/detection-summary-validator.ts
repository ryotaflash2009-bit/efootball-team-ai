import { ATTENTION_SIGNALS, type AppliedState } from "./update-detection";
import { WORLD_LIMITS } from "./stage4-world";

/**
 * 検出要約artifact(`reference-data-detection-summary`)の検証(ネットワーク・DB・Secretを使わない)。
 *
 * - v2(`schema: reference-data-detection-summary/v2`): 安全項目・品質・403/429/challenge件数を要約自体で確認する。
 * - v1(schemaなし。2026-09-25のRun #1): 当時の要約に無い項目は判定せず、`facts.explicitSafetyFields: false` で明示する
 *   (v1で確認できるのは ok・request数・non200・productionAccess・automaticApply・判定・checksum比較まで)。
 * - どちらも: applied-stateとのchecksum・件数比較が判定と矛盾しないこと、行データ・本文が含まれないこと。
 */

export const DETECTION_SUMMARY_MAX_BYTES = 16 * 1024;
const CHECKSUM12 = /^[0-9a-f]{12}$/;
const DECISIONS = ["no_change", "update_available", "attention_required"];
const TOP_KEYS_V1 = ["ok", "phase", "fetchedAt", "upstream", "world", "managers", "productionAccess", "automaticApply", "nextStep", "checkedAt"];
const TOP_KEYS_V2 = [...TOP_KEYS_V1, "schema", "trigger", "overall", "safety"];
const SAFETY_EXPECTED: Readonly<Record<string, number | boolean>> = {
  productionAccess: 0,
  secretsUsed: 0,
  automaticPlan: false,
  automaticBackup: false,
  automaticApply: false,
  automaticRollback: false,
  automaticRestore: false,
  appliedStateUpdated: false,
  rawPayloadStored: false,
};

export interface DetectionSummaryValidation {
  readonly ok: boolean;
  readonly verdict: "DETECTION_SUMMARY_VALID" | "DETECTION_SUMMARY_INVALID";
  readonly problems: readonly string[];
  readonly facts: Record<string, unknown>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const nonNegInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** 本文・行データが紛れ込んでいないこと(長い文字列・想定外の配列を拒否する)。 */
function scanForPayload(v: unknown, at: string, problems: string[]): void {
  if (typeof v === "string") {
    if (v.length > 300) problems.push(`long_string:${at}`);
  } else if (Array.isArray(v)) {
    if (!at.endsWith(".signals")) problems.push(`unexpected_array:${at}`);
    else for (const x of v) if (typeof x !== "string" || !/^[a-z_]{1,64}$/.test(x)) problems.push(`bad_signal:${at}`);
  } else if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) scanForPayload(x, `${at}.${k}`, problems);
  }
}

export function validateDetectionSummary(text: string, applied: AppliedState): DetectionSummaryValidation {
  const problems: string[] = [];
  const facts: Obj = {};
  const done = (): DetectionSummaryValidation => ({ ok: problems.length === 0, verdict: problems.length === 0 ? "DETECTION_SUMMARY_VALID" : "DETECTION_SUMMARY_INVALID", problems, facts });
  if (Buffer.byteLength(text, "utf8") > DETECTION_SUMMARY_MAX_BYTES) {
    problems.push("summary_too_large");
    return done();
  }
  let s: Obj;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isObj(parsed)) throw new Error("x");
    s = parsed;
  } catch {
    problems.push("summary_not_json_object");
    return done();
  }
  const v2 = s.schema === "reference-data-detection-summary/v2";
  if (s.schema !== undefined && !v2) problems.push("unknown_schema");
  facts.summaryVersion = v2 ? 2 : 1;
  facts.explicitSafetyFields = v2;
  const allowed = v2 ? TOP_KEYS_V2 : TOP_KEYS_V1;
  for (const k of Object.keys(s)) if (!allowed.includes(k)) problems.push(`unexpected_key:${k}`);
  scanForPayload(s, "$", problems);

  if (s.ok !== true) problems.push("ok_not_true");
  if (s.phase !== "detection") problems.push("phase_not_detection");
  if (s.productionAccess !== 0) problems.push("production_access_not_zero");
  if (s.automaticApply !== false) problems.push("automatic_apply_not_false");

  const u = isObj(s.upstream) ? s.upstream : {};
  const world = isObj(s.world) ? s.world : {};
  const managers = isObj(s.managers) ? s.managers : {};
  for (const k of ["requests", "worldRequests", "managersRequests", "non200", "totalBytes"]) if (!nonNegInt(u[k])) problems.push(`upstream_${k}_invalid`);
  const wr = u.worldRequests as number;
  const worldCount = world.recordCount as number;
  facts.worldRequests = wr;
  facts.managersRequests = u.managersRequests;
  if (u.managersRequests !== 1) problems.push("managers_requests_not_one");
  if (u.non200 !== 0) problems.push("non200_responses");
  if (nonNegInt(wr) && nonNegInt(u.managersRequests) && u.requests !== wr + (u.managersRequests as number)) problems.push("requests_outside_world_and_managers");
  if (nonNegInt(wr) && (wr < 1 || wr > WORLD_LIMITS.maxRequests)) problems.push("world_requests_outside_contract");
  if (nonNegInt(u.totalBytes) && (u.totalBytes as number) > WORLD_LIMITS.maxTotalBytes) problems.push("transfer_cap_exceeded");
  if (nonNegInt(worldCount) && worldCount > WORLD_LIMITS.maxRecords) problems.push("world_records_over_cap");

  if (v2) {
    for (const k of ["http403", "http429", "challenge"]) if (u[k] !== 0) problems.push(`upstream_${k}_not_zero`);
    if (nonNegInt(world.pages)) {
      facts.worldPages = world.pages;
      // non200が0なので再試行は無い: request数 = page数。
      if (wr !== world.pages || (world.pages as number) > WORLD_LIMITS.maxPages) problems.push("world_requests_not_equal_pages");
    } else problems.push("world_pages_missing");
    const safety = isObj(s.safety) ? s.safety : {};
    for (const [k, want] of Object.entries(SAFETY_EXPECTED)) if (safety[k] !== want) problems.push(`safety_${k}`);
    if (Object.keys(safety).length !== Object.keys(SAFETY_EXPECTED).length) problems.push("safety_unexpected_keys");
    if (!["schedule", "workflow_dispatch", "local"].includes(s.trigger as string)) problems.push("trigger_invalid");
  }

  const datasets: [string, Obj, AppliedState["datasets"][keyof AppliedState["datasets"]]][] = [
    ["world", world, applied.datasets.world_player_cards],
    ["managers", managers, applied.datasets.managers],
  ];
  const decisions: string[] = [];
  for (const [name, d, a] of datasets) {
    const decision = d.decision as string;
    decisions.push(decision);
    if (!DECISIONS.includes(decision)) problems.push(`${name}_decision_invalid`);
    if (decision === "attention_required") problems.push(`${name}_attention_required`);
    if (!nonNegInt(d.recordCount)) problems.push(`${name}_record_count_invalid`);
    if (d.appliedRecordCount !== a.recordCount) problems.push(`${name}_applied_count_mismatch`);
    if (typeof d.sourceChecksum12 !== "string" || !CHECKSUM12.test(d.sourceChecksum12)) problems.push(`${name}_checksum_invalid`);
    const same = a.sourceChecksum12 !== null && d.sourceChecksum12 === a.sourceChecksum12;
    // 判定とchecksum比較が矛盾しないこと(no_change ⇔ applied-stateと同じchecksum)。
    if (decision === "no_change" && !same) problems.push(`${name}_no_change_but_checksum_differs`);
    if (decision === "update_available" && same) problems.push(`${name}_update_available_but_checksum_same`);
    // attention相当のsignalがあるのにattention_requiredでない = 判定の取り違え。
    if (Array.isArray(d.signals) && decision !== "attention_required" && (d.signals as string[]).some((x) => ATTENTION_SIGNALS.includes(x))) {
      problems.push(`${name}_signals_without_attention`);
    }
    if (v2) {
      const q = isObj(d.quality) ? d.quality : {};
      if (q.complete !== true || q.duplicateIdentities !== 0 || q.rejectedRecords !== 0 || q.schemaDrift !== 0) problems.push(`${name}_quality_not_clean`);
    }
    facts[name] = {
      decision,
      recordCount: d.recordCount,
      appliedRecordCount: a.recordCount,
      sourceChecksum12: d.sourceChecksum12,
      appliedChecksum12: a.sourceChecksum12,
      checksumMatchesApplied: same,
    };
  }
  if (v2 && s.overall !== (decisions.includes("attention_required") ? "attention_required" : decisions.includes("update_available") ? "update_available" : "no_change")) problems.push("overall_inconsistent");

  if (isObj(world.timestamps)) {
    const t = world.timestamps;
    if (t.futureCount !== 0) problems.push("world_future_timestamps");
    if (t.regression !== false) problems.push("world_timestamp_regression");
    facts.worldMaxAppearanceUpdatedAt = t.max;
    facts.worldMaxMatchesApplied = t.max === applied.datasets.world_player_cards.maxAppearanceUpdatedAt;
  } else problems.push("world_timestamps_missing");
  return done();
}
