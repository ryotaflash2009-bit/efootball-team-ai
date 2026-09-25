import { REAL_NETWORK_ACCESS_ENABLED } from "./source-transport";
import { CONCURRENCY_GROUPS } from "./update-contract";

/**
 * 自動更新: 定期実行の枠組み(既定で無効)。
 *
 * - 定期実行してよいのは検出(detection・dry run相当、Secretなし・Environmentなし)だけ。
 *   Backup・apply・rollback・Restoreは常に手動(workflow_dispatch + Environment承認)で、scheduleしない。
 * - `schedule:`トリガーは検出workflowだけに置く(週1回、初回手動検出の成功後に本人承認で追加。2026-09-25)。
 * - scheduleでも手動でも、repository variableが正確に"true"でなければjobごとskipし、CLIも取得前に停止する。
 *   手動実行は確認入力"detect"が必須、scheduleは確認入力なし(workflowの`if:`とCLIの両方で判定する)。
 * - 検出の実transport(update-detection-cli.ts)は検出専用の承認token・上限(World全件1回 + managers.json 1件)で動き、
 *   Secret・Environment・Productionを使わない。既定(realNetworkApproved未指定)は従来どおり未承認として止まる。
 */

export const DETECTION_WORKFLOW_FILE = "reference-data-update-detection.yml";
export const DETECTION_ENABLE_VARIABLE = "REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED";

/**
 * 検出のschedule: 週1回(日曜 UTC 18:17 = 月曜 JST 03:17)。World全件はincremental取得が使えない
 * (sortBy UPDATED_ATはHTTP 400)ため1回あたり約443 requestになり、上流の負荷を抑えて低頻度にする。
 */
export const DETECTION_CRON = "17 18 * * 0";

export type ScheduledStage = "detection";
export type NeverScheduledStage = "backup" | "production_apply" | "rollback" | "restore";

export const SCHEDULE_POLICY = Object.freeze({
  /** scheduleトリガーを持つのは検出workflowだけ(DETECTION_CRON)。 */
  scheduleTriggerPresent: true,
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

export const DETECTION_CONFIRM_WORD = "detect";

export type DetectionTriggerDecision = { readonly run: false; readonly reason: "trigger_not_allowed" | "confirmation_missing" } | { readonly run: true };

/**
 * GitHub Actions上での起動元の判定(workflowの`if:`と同じ条件をCLIでも確認する)。
 * schedule → 確認入力なしで可。workflow_dispatch → 確認入力が正確に"detect"の場合だけ可。その他のeventは不可。
 */
export function decideDetectionTrigger(input: { eventName: string | undefined; confirm: string | undefined }): DetectionTriggerDecision {
  if (input.eventName === "schedule") return { run: true };
  if (input.eventName === "workflow_dispatch") return input.confirm === DETECTION_CONFIRM_WORD ? { run: true } : { run: false, reason: "confirmation_missing" };
  return { run: false, reason: "trigger_not_allowed" };
}
