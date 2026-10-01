/**
 * 参照データ更新検出の通知（GitHub Issue）の本文を作る（純関数・外部アクセスなし）。
 *
 * - 入力は検出の非秘密の要約（reference-data-detection-summary.json）と、検出 run の結果（success / failure）。
 * - 許可したフィールドだけを使う（件数・12 文字の checksum・判定・信号名）。行データ・URL・Secret は扱わない。
 * - no_change（変化なし）で成功したときは通知しない。
 */

export const NOTIFY_LABEL = "reference-data-update";

const SAFE_TOKEN = /^[a-z0-9_]{1,64}$/;
const CHECKSUM = /^[0-9a-f]{12}$/;
const int = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const token = (v) => (typeof v === "string" && SAFE_TOKEN.test(v) ? v : null);
const checksum = (v) => (typeof v === "string" && CHECKSUM.test(v) ? v : null);

function datasetLine(name, d) {
  if (!d || typeof d !== "object") return `- ${name}: (no data)`;
  const signals = Array.isArray(d.signals) ? d.signals.map(token).filter(Boolean).slice(0, 10) : [];
  return `- ${name}: ${token(d.decision) ?? "unknown"} — records ${int(d.recordCount) ?? "?"} (applied ${int(d.appliedRecordCount) ?? "?"}), checksum ${checksum(d.sourceChecksum12) ?? "?"}${signals.length ? `, signals: ${signals.join(", ")}` : ""}`;
}

/**
 * @param {unknown} summary 検出の要約（読めなければ null）
 * @param {{ conclusion: string, runId: string, runUrl: string }} run
 * @returns {{ notify: false, reason: string } | { notify: true, title: string, body: string }}
 */
export function buildDetectionNotification(summary, run) {
  const runId = /^\d{1,20}$/.test(String(run?.runId ?? "")) ? String(run.runId) : "?";
  const runUrl = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(String(run?.runUrl ?? "")) ? run.runUrl : null;
  const conclusion = token(run?.conclusion) ?? "unknown";
  const s = summary && typeof summary === "object" ? summary : null;
  const overall = token(s?.overall);

  if (conclusion === "success" && overall === "no_change") return { notify: false, reason: "no_change" };
  if (conclusion === "skipped" || conclusion === "cancelled") return { notify: false, reason: conclusion };

  const kind = conclusion !== "success" ? "failed" : overall === "update_available" ? "update_available" : overall === "attention_required" ? "attention_required" : "unknown";
  const titles = {
    update_available: "参照データの更新を検出しました / Reference data update available",
    attention_required: "参照データの検出で確認が必要です / Reference data detection needs attention",
    failed: "参照データの検出が失敗しました / Reference data detection failed",
    unknown: "参照データの検出結果を確認してください / Check the reference data detection",
  };
  const next = {
    update_available: "次: 承認つきの更新（Plan → Backup → Dry run → 本人の Approve → Apply）を `docs/production-readiness/automated-update-pipeline.md` の手順で進める。Apply 後の Evidence PR で applied-state と F-071 の分布（同じ checksum の候補）を更新する。",
    attention_required: "次: 信号の内容を確認する。自動では何も適用しない。",
    failed: "次: run のログを確認する（取得の上限・upstream の応答）。自動では何も適用しない。",
    unknown: "次: run の要約を確認する。",
  };
  const lines = [
    `検出 run: ${runId}${runUrl ? ` (${runUrl})` : ""} — conclusion: ${conclusion}, overall: ${overall ?? "unknown"}`,
    "",
    datasetLine("world_player_cards", s?.world),
    datasetLine("managers", s?.managers),
    "",
    next[kind],
    "",
    "この通知は自動作成です（非秘密の要約だけ。Production への接続・適用は行っていません）。",
  ];
  return { notify: true, title: titles[kind], body: lines.join("\n") };
}

const RUN_KEYS = ["detection", "plan", "backup", "dryRun", "apply"];
const REASON = /^[0-9A-Za-z_:.,=-]{1,120}$/;
const runIds = (runs) =>
  RUN_KEYS.filter((k) => runs && typeof runs === "object" && typeof runs[k] === "string" && /^\d{1,20}$/.test(runs[k])).map((k) => `${k} ${runs[k]}`);
const reasons = (list) => (Array.isArray(list) ? list.filter((r) => typeof r === "string" && REASON.test(r)).slice(0, 10) : []);

/** Production apply workflow の run 名（run-name）から mode と dataset を読む。 */
export function parseApplyRunTitle(title) {
  const m = /^reference-data (preflight|plan|dry-run|apply|verify)( world)?$/.exec(String(title ?? ""));
  return m ? { mode: m[1], dataset: m[2] ? "world" : "managers" } : null;
}

/**
 * 自動進行（orchestrator）と Production apply の結果の通知。
 * - orchestrator: 停止（Apply run を作らずに止まった）・Apply 承認待ち・job の失敗を通知。no_action と skip は通知しない。
 * - apply workflow: apply と verify は結果によらず通知（承認の却下・取り消しも含む）。plan・dry-run は失敗だけ。preflight は通知しない。
 *
 * @param {{ source: "orchestrator" | "apply", conclusion: string, runId: string, runUrl: string, title?: string, approval?: unknown, evidence?: unknown }} p
 */
export function buildPipelineNotification(p) {
  const runId = /^\d{1,20}$/.test(String(p?.runId ?? "")) ? String(p.runId) : "?";
  const runUrl = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(String(p?.runUrl ?? "")) ? p.runUrl : null;
  const conclusion = token(p?.conclusion) ?? "unknown";
  const head = `run: ${runId}${runUrl ? ` (${runUrl})` : ""} — conclusion: ${conclusion}`;
  const footer = "この通知は自動作成です（非秘密の要約だけ。この通知の workflow は Production へ接続しません）。";
  if (conclusion === "skipped") return { notify: false, reason: "skipped" };

  if (p?.source === "orchestrator") {
    const a = p.approval && typeof p.approval === "object" ? p.approval : null;
    if (conclusion === "cancelled") return { notify: false, reason: "cancelled" };
    if (a?.kind === "no_action" && conclusion === "success") return { notify: false, reason: "no_action" };
    if (a?.kind === "awaiting_approval") {
      const ids = runIds(a.runs);
      return {
        notify: true,
        title: "参照データの Apply が承認待ちです / Reference data Apply is waiting for approval",
        body: [
          head,
          "",
          `dataset: ${token(a.dataset) ?? "?"} — 追加 ${int(a.added) ?? "?"} 件・更新 ${int(a.updated) ?? "?"} 件・削除 ${int(a.removed) ?? "?"} 件`,
          `binding: ${ids.join(" / ") || "?"}`,
          "",
          "次: Apply run の画面で内容と Backup の期限を確認し、問題がなければ `reference-data-production-apply` Environment で Approve and deploy を押す（1 回だけ）。承認しなければ何も書き込まれない。",
          "",
          footer,
        ].join("\n"),
      };
    }
    const stopped = a?.kind === "stopped";
    return {
      notify: true,
      title: "参照データの自動更新が停止しました / Reference data pipeline stopped",
      body: [
        head,
        "",
        `段階: ${stopped ? (token(a.stage) ?? "?") : "unknown"}`,
        `理由: ${stopped ? reasons(a.reasons).join(", ") || "?" : "要約を読めなかった（job の失敗）"}`,
        `起動した run: ${stopped ? runIds(a.runs).join(" / ") || "なし" : "?"}`,
        "",
        "Apply run は作成していません。Production への書き込みはありません。次: run の要約を確認し、原因を直してから検出をやり直す。",
        "",
        footer,
      ].join("\n"),
    };
  }

  if (p?.source === "apply") {
    const t = parseApplyRunTitle(p.title);
    if (!t || t.mode === "preflight") return { notify: false, reason: "not_notified_mode" };
    if ((t.mode === "plan" || t.mode === "dry-run") && conclusion === "success") return { notify: false, reason: "success" };
    const e = p.evidence && typeof p.evidence === "object" ? p.evidence : null;
    const outcome = token(e?.outcome) ?? "unknown";
    const applied = t.mode === "apply" && conclusion === "success" && outcome === "applied_verified";
    const title = applied
      ? "参照データの Apply が完了し検証済みです / Reference data applied and verified"
      : t.mode === "apply" && outcome === "rollback_required"
        ? "参照データの Apply 後の検証に失敗しました（要対応） / Reference data apply needs rollback review"
        : `参照データの ${t.mode} が成功しませんでした / Reference data ${t.mode} did not succeed`;
    const next = applied
      ? "次: Evidence artifact の applied-state.candidate.json を確認し、Evidence PR で applied-state と F-071 の分布を更新する。"
      : outcome === "rollback_required"
        ? "次: 自動の取り消しはしません。undo plan artifact と Backup を確認し、Rollback は本人の別の判断で行う。"
        : "次: run の要約を確認する。部分的な結果を成功として扱わない。";
    return {
      notify: true,
      title,
      body: [head, "", `mode: ${t.mode} / dataset: ${t.dataset} / outcome: ${outcome} / 承認者: ${typeof e?.approvedBy === "string" && /^[0-9A-Za-z._@-]{1,64}$/.test(e.approvedBy) ? e.approvedBy : "-"}`, "", next, "", footer].join("\n"),
    };
  }
  return { notify: false, reason: "unknown_source" };
}
