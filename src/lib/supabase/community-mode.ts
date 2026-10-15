/**
 * コミュニティ 第 1 段階（公開プロフィール・友達・ブロック・ミュート・通報・友達との比較・2026-10-14）の公開の状態。
 *
 * - 本番の関数・表は docs/production-readiness/sql/create-community-stage1-schema.sql（公開 ID の migration の後に適用）。
 *   2026-10-14 に本番へ適用し、確認 SQL（verify-community-stage1.sql）がすべて true・関数 28 個を確かめて "enabled" にした。既定は "disabled"（fail closed）: 画面は準備中の案内だけを出し、Supabase を呼ばない。
 * - ローカルの開発ホストでは `?communityPreview=1` で流れを確かめられる（black-box はテストダブルの関数で検証）。
 */
export type CommunityMode = "disabled" | "enabled";
export const COMMUNITY_MODE: CommunityMode = "enabled";

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

/**
 * ライバル（F-062・第 2 段階の SQL `create-community-stage2-rivals.sql`）の公開の状態（2026-10-15）。
 * 2026-10-15 に本人が本番へ第 2 段階を適用し、確認（verify-community-stage2.sql）がすべて true・関数 35 個で "enabled" にした。無効の間はライバルの欄・ボタンを出さず、関数を呼ばない。
 * ローカルの開発ホストでは `?communityPreview=1` のときだけ出す（black-box はテストダブルで検証）。
 */
export const RIVALS_MODE: CommunityMode = "enabled";

export function isRivalsAvailable(hostname: string, search: string, isLocalDevHostname: (h: string) => boolean, mode: CommunityMode = RIVALS_MODE): boolean {
  if (mode === "enabled") return true;
  if (!isLocalDevHostname(hostname)) return false;
  return new URLSearchParams(search).get("communityPreview") === "1";
}
