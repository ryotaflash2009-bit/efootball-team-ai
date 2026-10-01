/**
 * Stage 4 apply の承認者。
 *
 * workflow は Environment の承認記録（GitHub API の run approvals）から承認者を STAGE4_APPROVED_BY に入れる。
 * 起動した actor（自動進行では github-actions[bot]）は承認者ではないため、承認者がいればそちらを使う。
 * workflow 側は承認記録が無ければ apply を止めるので、ここでの actor への後退はローカル実行・旧 run 用。
 */
const LOGIN = /^[0-9A-Za-z._@-]{1,64}$/;

export function resolveApprovedBy(env: Readonly<Record<string, string | undefined>>): string {
  const approver = env.STAGE4_APPROVED_BY ?? "";
  if (LOGIN.test(approver)) return approver;
  const actor = env.GITHUB_ACTOR ?? "";
  return LOGIN.test(actor) ? actor : "environment-approval";
}
