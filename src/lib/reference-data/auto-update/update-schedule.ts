import { REAL_NETWORK_ACCESS_ENABLED } from "./source-transport";
import { CONCURRENCY_GROUPS } from "./update-contract";

/**
 * 自動更新 Phase I: 定期実行の枠組み(既定で無効・安全なno-op)。
 *
 * - 定期実行してよいのは検出(detection・dry run相当、Secretなし・Environmentなし)だけ。
 *   Backup・apply・rollback・Restoreは常に手動(workflow_dispatch + Environment承認)で、scheduleしない。
 * - 現在はworkflowに`schedule:`トリガーを置かない(cronの実発火をしない)。有効化は、upstreamへの
 *   初回実通信(Stage 1)と定期実行の開始を本人が別途承認した後に、trigger追加として行う。
 * - 手動実行されても、repository variableで明示的に有効化されていなければjobごとskipし、
 *   有効化されていても実transportが未承認(REAL_NETWORK_ACCESS_ENABLED=false)なら取得前に停止する。
 */

export const DETECTION_WORKFLOW_FILE = "reference-data-update-detection.yml";
export const DETECTION_ENABLE_VARIABLE = "REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED";

/** 将来scheduleを追加する場合の候補(1日1回・UTC 18:17 = JST 03:17、既存syncの負荷方針に合わせ低頻度)。 */
export const PROPOSED_DETECTION_CRON = "17 18 * * *";

export type ScheduledStage = "detection";
export type NeverScheduledStage = "backup" | "production_apply" | "rollback" | "restore";

export const SCHEDULE_POLICY = Object.freeze({
  scheduleTriggerPresent: false,
  schedulableStages: Object.freeze(["detection"] as const),
  neverScheduledStages: Object.freeze(["backup", "production_apply", "rollback", "restore"] as const),
  concurrencyGroup: CONCURRENCY_GROUPS.detection,
});

export type DetectionRunDecision =
  | { readonly run: false; readonly reason: "not_enabled" | "real_network_not_approved" | "stage_not_schedulable" }
  | { readonly run: true };

/** 検出jobを進めてよいかを決める(fail-closed: 明示の"true"と承認済み実transportの両方が必要)。 */
export function decideDetectionRun(input: { stage: string; enableVariable: string | undefined; realNetworkApproved?: boolean }): DetectionRunDecision {
  if (!(SCHEDULE_POLICY.schedulableStages as readonly string[]).includes(input.stage)) return { run: false, reason: "stage_not_schedulable" };
  if (input.enableVariable !== "true") return { run: false, reason: "not_enabled" };
  if (!(input.realNetworkApproved ?? REAL_NETWORK_ACCESS_ENABLED)) return { run: false, reason: "real_network_not_approved" };
  return { run: true };
}
