import { REAL_NETWORK_ACCESS_ENABLED } from "./source-transport";
import { CONCURRENCY_GROUPS } from "./update-contract";

/**
 * 自動更新: 定期実行の枠組み(既定で無効)。
 *
 * - 定期実行してよいのは検出(detection・dry run相当、Secretなし・Environmentなし)だけ。
 *   Backup・apply・rollback・Restoreは常に手動(workflow_dispatch + Environment承認)で、scheduleしない。
 * - 現在はworkflowに`schedule:`トリガーを置かない(cronの実発火をしない)。trigger追加は本人承認事項。
 * - 手動実行されても、repository variableで明示的に有効化されていなければjobごとskipし、CLIも取得前に停止する。
 * - 検出の実transport(update-detection-cli.ts)は検出専用の承認token・上限(World全件1回 + managers.json 1件)で動き、
 *   Secret・Environment・Productionを使わない。既定(realNetworkApproved未指定)は従来どおり未承認として止まる。
 */

export const DETECTION_WORKFLOW_FILE = "reference-data-update-detection.yml";
export const DETECTION_ENABLE_VARIABLE = "REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED";

/**
 * scheduleを追加する場合の候補: 週1回(日曜 UTC 18:17 = 月曜 JST 03:17)。World全件はincremental取得が使えない
 * (sortBy UPDATED_ATはHTTP 400)ため1回あたり約443 requestになり、上流の負荷を抑えて低頻度にする。
 */
export const PROPOSED_DETECTION_CRON = "17 18 * * 0";

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
