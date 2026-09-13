import { extractScopedItems } from "./adapters";

/**
 * My Team(`selectedBuildId`/`favoriteBuildId`)がMy Buildsの`buildId`を参照している場合の
 * 参照整合性チェック。
 *
 * - 純粋な読み取り専用の集計だけを行う。My Team・My Buildsのどちらも自動修正・自動削除・
 *   自動置き換えはしない(呼び出し側は件数の表示だけに使うこと)。
 * - レガシー共通My Teamが移行済みで、My Buildsがまだ移行前の場合など、参照切れは
 *   データ破損ではなく正常にあり得る状態として扱う(件数として可視化するだけ)。
 */
export interface BuildReferenceCheckResult {
  /** selectedBuildId/favoriteBuildIdとして参照されている、重複を除いたbuildIdの総数。 */
  totalReferencedCount: number;
  /** 参照先がMy Builds側に存在しない(=参照切れの)buildIdの数。 */
  brokenCount: number;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** My Teamレコード1件からselectedBuildId/favoriteBuildIdを安全に取り出す(不正値はnull扱い)。 */
function referencedBuildIdsOf(raw: unknown): string[] {
  const obj = asRecord(raw);
  if (!obj) return [];
  const out: string[] = [];
  for (const key of ["selectedBuildId", "favoriteBuildId"]) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) out.push(v);
  }
  return out;
}

/**
 * 指定スコープ(通常は現在ログイン中のアカウント領域)における、My TeamからMy Buildsへの
 * 参照整合性を確認する。`myTeamRaw`/`myBuildsRaw`は`readRawJson()`等が返す、パース済みの
 * 生JSON値(取得できない場合はnull)を渡す。
 */
export function checkMyTeamBuildReferences(myTeamRaw: unknown, myBuildsRaw: unknown): BuildReferenceCheckResult {
  const myTeamItems = extractScopedItems("myTeam", myTeamRaw);
  const buildIds = new Set(extractScopedItems("myBuilds", myBuildsRaw).map((i) => i.id));

  const referenced = new Set<string>();
  for (const item of myTeamItems) {
    for (const buildId of referencedBuildIdsOf(item.raw)) referenced.add(buildId);
  }

  let brokenCount = 0;
  for (const buildId of referenced) {
    if (!buildIds.has(buildId)) brokenCount += 1;
  }

  return { totalReferencedCount: referenced.size, brokenCount };
}
