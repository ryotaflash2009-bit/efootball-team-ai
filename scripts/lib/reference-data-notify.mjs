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
