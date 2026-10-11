/**
 * 保存ビルドのクラウド保存の公開の状態（2026-10-11）。
 *
 * - 本番の表 `saved_builds_snapshots` は未作成（docs/production-readiness/sql/create-builds-cloud-schema.sql・本人の承認で適用）。
 *   適用と確認の後に PR で "enabled" に変える。既定は "disabled"（fail closed）: 画面は準備中の案内だけを出し、Supabase を呼ばない。
 * - ローカルの開発ホストでは `?buildsCloudPreview=1` で流れを確かめられる（black-box はテストダブルの DB で検証）。
 */
export type BuildsCloudMode = "disabled" | "enabled";
export const BUILDS_CLOUD_MODE: BuildsCloudMode = "disabled";

export function isBuildsCloudAvailable(
  hostname: string,
  search: string,
  isLocalDevHostname: (h: string) => boolean,
  mode: BuildsCloudMode = BUILDS_CLOUD_MODE,
): boolean {
  if (mode === "enabled") return true;
  if (!isLocalDevHostname(hostname)) return false;
  return new URLSearchParams(search).get("buildsCloudPreview") === "1";
}
