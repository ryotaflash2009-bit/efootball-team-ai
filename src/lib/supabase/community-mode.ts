/**
 * コミュニティ 第 1 段階（公開プロフィール・友達・ブロック・ミュート・通報・友達との比較・2026-10-14）の公開の状態。
 *
 * - 本番の関数・表は docs/production-readiness/sql/create-community-stage1-schema.sql（公開 ID の migration の後に適用）。
 *   適用と確認の後に PR で "enabled" に変える。既定は "disabled"（fail closed）: 画面は準備中の案内だけを出し、Supabase を呼ばない。
 * - ローカルの開発ホストでは `?communityPreview=1` で流れを確かめられる（black-box はテストダブルの関数で検証）。
 */
export type CommunityMode = "disabled" | "enabled";
export const COMMUNITY_MODE: CommunityMode = "disabled";

export function isCommunityAvailable(
  hostname: string,
  search: string,
  isLocalDevHostname: (h: string) => boolean,
  mode: CommunityMode = COMMUNITY_MODE,
): boolean {
  if (mode === "enabled") return true;
  if (!isLocalDevHostname(hostname)) return false;
  return new URLSearchParams(search).get("communityPreview") === "1";
}
