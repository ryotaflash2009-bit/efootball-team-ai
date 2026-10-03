/**
 * 参照データ Production apply workflow の機械可読 Evidence（Secret を含まない）。
 *
 * - 誰が・どの workflow / commit / run / attempt で・どの mode と dataset を実行し、何を入力に何を出力したか
 *   （ファイルの sha256）と結果を 1 つの JSON にまとめる。値は許可した形だけを通す。
 * - apply が applied_verified で、apply 結果がこの run のもので、plan bundle の sourceChecksum が正しい形のときだけ
 *   applied-state の候補を作る。候補は main へ自動では入らず、apply 後の Evidence PR で使う。
 */
export const EVIDENCE_SCHEMA = "reference-data-apply-evidence/v1";
export const APPLIED_STATE_CANDIDATE_SCHEMA = "reference-data-applied-state-candidate/v1";

const TABLE = { world: "world_player_cards", managers: "managers" };
const MODES = ["preflight", "plan", "dry-run", "apply", "verify"];
const RUN_ID = /^[0-9]{1,20}$/;
const SHA = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const LOGIN = /^[0-9A-Za-z._@\-[\]]{1,64}$/;
const REF = /^refs\/(heads|tags)\/[0-9A-Za-z._/-]{1,100}$/;
const REPO = /^[0-9A-Za-z._-]{1,100}\/[0-9A-Za-z._-]{1,100}$/;
const FILE = /^[0-9A-Za-z._-]{1,120}$/;

const pick = (v, re) => (typeof v === "string" && re.test(v) ? v : null);
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** summary の理由は短い文字列だけ（URL・改行は捨てる）。 */
function safeReasons(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .filter((r) => typeof r === "string" && r.length <= 200 && !/[\r\n]|:\/\//.test(r))
    .slice(0, 20);
}

/** 結果の区分。summary が無い・形が違うものを成功にしない。 */
export function classifyOutcome(mode, summary) {
  if (!isObj(summary) || typeof summary.ok !== "boolean") return "no_summary";
  const status = isObj(summary.facts) ? summary.facts.status : undefined;
  if (status === "rollback_required") return "rollback_required";
  if (!summary.ok) return "failed";
  if (mode === "apply") return status === "applied_verified" ? "applied_verified" : "unexpected_apply_status";
  return "ok";
}

function appliedStateCandidate({ ctx, outcome, applyResult, bundle, now }) {
  if (ctx.mode !== "apply" || outcome !== "applied_verified") return null;
  const table = TABLE[ctx.dataset];
  if (!table || !ctx.runId) return null;
  if (!isObj(applyResult) || applyResult.status !== "applied_verified" || applyResult.applyRunId !== ctx.runId) return null;
  const e = applyResult.expectation;
  const before = isObj(e) && isObj(e.before) && isObj(e.before.counts) ? e.before.counts[table] : undefined;
  if (!Number.isInteger(before) || before < 0 || !Array.isArray(e.insertedIdentities)) return null;
  if (!isObj(bundle) || !HEX64.test(bundle.sourceChecksum ?? "")) return null;
  return {
    schema: APPLIED_STATE_CANDIDATE_SCHEMA,
    dataset: table,
    note: "Candidate only. Copy into docs/production-readiness/reference-data-applied-state.json in the Evidence PR after reviewing this run.",
    entry: {
      sourceChecksum12: bundle.sourceChecksum.slice(0, 12),
      recordCount: before + e.insertedIdentities.length,
      appliedAt: now,
      applyRunId: ctx.runId,
    },
  };
}

/**
 * @param {{ env: Record<string,string|undefined>, summary: unknown, inputs: {path:string, sha256:string}[], outputs: {path:string, sha256:string}[], applyResult?: unknown, bundle?: unknown, now: string }} p
 */
export function buildApplyEvidence({ env, summary, inputs, outputs, applyResult, bundle, now }) {
  const mode = MODES.includes(env.EVIDENCE_MODE) ? env.EVIDENCE_MODE : null;
  const dataset = env.EVIDENCE_DATASET in TABLE ? env.EVIDENCE_DATASET : null;
  const ctx = {
    repository: pick(env.GITHUB_REPOSITORY, REPO),
    workflow: "reference-data-production-apply.yml",
    runId: pick(env.GITHUB_RUN_ID, RUN_ID),
    runAttempt: pick(env.GITHUB_RUN_ATTEMPT, RUN_ID),
    commitSha: pick(env.GITHUB_SHA, SHA),
    ref: pick(env.GITHUB_REF, REF),
    actor: pick(env.GITHUB_ACTOR, LOGIN),
    approvedBy: mode === "apply" ? pick(env.STAGE4_APPROVED_BY, LOGIN) : null,
    mode,
    dataset,
  };
  const outcome = classifyOutcome(mode, summary);
  const files = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((f) => isObj(f) && typeof f.path === "string" && f.path.split("/").every((s) => FILE.test(s) && s !== "." && s !== "..") && HEX64.test(f.sha256))
      .map((f) => ({ path: f.path, sha256: f.sha256 }));
  const evidence = {
    schema: EVIDENCE_SCHEMA,
    createdAt: now,
    ...ctx,
    // job の結果（success / failure / cancelled）。secret の確認などで CLI の前に止まったときは outcome が no_summary になる。
    jobStatus: ["success", "failure", "cancelled"].includes(env.EVIDENCE_JOB_STATUS) ? env.EVIDENCE_JOB_STATUS : null,
    outcome,
    summary: isObj(summary)
      ? { ok: summary.ok === true, phase: typeof summary.phase === "string" ? summary.phase.slice(0, 40) : null, reasons: safeReasons(summary.reasons), status: isObj(summary.facts) && typeof summary.facts.status === "string" ? summary.facts.status.slice(0, 40) : null, checkedAt: typeof summary.checkedAt === "string" ? summary.checkedAt.slice(0, 40) : null }
      : null,
    inputs: files(inputs),
    outputs: files(outputs),
    // plan・dry-run・preflight・verify は Production へ書かない。apply は書き込みが確定した結果だけ true。
    productionWritten: mode === "apply" && (outcome === "applied_verified" || outcome === "rollback_required"),
    automaticUndo: false,
  };
  return { evidence, candidate: appliedStateCandidate({ ctx, outcome, applyResult, bundle, now }) };
}
