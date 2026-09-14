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

/**
 * スカッド(または、スカッドテンプレートに埋め込まれたスカッド本体)1件から、先発(slots)・
 * ベンチ(substitutes)双方のsavedBuildIdを安全に取り出す(重複除去はしない・呼び出し側で行う)。
 */
function referencedSquadBuildIdsOf(squadRaw: unknown): string[] {
  const obj = asRecord(squadRaw);
  if (!obj) return [];
  const out: string[] = [];
  const collect = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const entry = asRecord(item);
      const v = entry?.savedBuildId;
      if (typeof v === "string" && v.length > 0) out.push(v);
    }
  };
  collect(obj.slots);
  collect(obj.substitutes);
  return out;
}

export interface SquadBuildReferenceCheckResult {
  /** 重複を除いた、参照されているsavedBuildIdの総数(先発+ベンチ)。 */
  totalReferencedCount: number;
  /** 現在の対象領域(移行先、または現在表示中のアカウント領域)のMy Buildsに存在しない参照の数。 */
  brokenCount: number;
  /**
   * 対象領域では解決できないが、レガシー(ブラウザー共通)My Buildsには存在する参照の数。
   * legacyMyBuildsRawを渡さなかった場合はnull(「レガシー側は調べていない」ことを明示するため0にはしない)。
   * 他アカウントのMy Builds領域は絶対に検索しない(呼び出し側もレガシーと対象領域の生データしか渡さないこと)。
   */
  resolvableOnlyInLegacyCount: number | null;
}

function summarizeReferences(
  referenced: Set<string>,
  targetBuildIds: Set<string>,
  legacyBuildIds: Set<string> | null,
): SquadBuildReferenceCheckResult {
  let brokenCount = 0;
  let resolvableOnlyInLegacyCount = legacyBuildIds ? 0 : null;
  for (const buildId of referenced) {
    if (targetBuildIds.has(buildId)) continue;
    brokenCount += 1;
    if (legacyBuildIds?.has(buildId)) resolvableOnlyInLegacyCount = (resolvableOnlyInLegacyCount ?? 0) + 1;
  }
  return { totalReferencedCount: referenced.size, brokenCount, resolvableOnlyInLegacyCount };
}

/**
 * 保存スカッドからMy Buildsへの参照整合性を確認する(先発+ベンチのsavedBuildId)。
 * `squadsRaw`/`targetMyBuildsRaw`は同一スコープ(現在ログイン中のアカウント領域、または
 * 移行先として想定している領域)の生JSON値。`legacyMyBuildsRaw`を渡すと、対象領域では
 * 解決できない参照のうち、レガシー共通My Buildsになら存在するものの数も併せて報告する
 * (移行プレビューが「レガシーMy Buildsにしか存在しない参照」件数を示すために使う)。
 * 他アカウントのMy Builds領域は検索しない・引数として受け取らない。
 */
export function checkSquadBuildReferences(
  squadsRaw: unknown,
  targetMyBuildsRaw: unknown,
  legacyMyBuildsRaw?: unknown,
): SquadBuildReferenceCheckResult {
  const squadItems = extractScopedItems("squads", squadsRaw);
  const targetBuildIds = new Set(extractScopedItems("myBuilds", targetMyBuildsRaw).map((i) => i.id));
  const legacyBuildIds =
    legacyMyBuildsRaw !== undefined ? new Set(extractScopedItems("myBuilds", legacyMyBuildsRaw).map((i) => i.id)) : null;

  const referenced = new Set<string>();
  for (const item of squadItems) {
    for (const buildId of referencedSquadBuildIdsOf(item.raw)) referenced.add(buildId);
  }
  return summarizeReferences(referenced, targetBuildIds, legacyBuildIds);
}

/**
 * スカッドテンプレート(埋め込まれたスカッド本体)からMy Buildsへの参照整合性を確認する。
 * 引数・戻り値の意味は`checkSquadBuildReferences`と同じ。
 */
export function checkSquadTemplateBuildReferences(
  templatesRaw: unknown,
  targetMyBuildsRaw: unknown,
  legacyMyBuildsRaw?: unknown,
): SquadBuildReferenceCheckResult {
  const templateItems = extractScopedItems("squadTemplates", templatesRaw);
  const targetBuildIds = new Set(extractScopedItems("myBuilds", targetMyBuildsRaw).map((i) => i.id));
  const legacyBuildIds =
    legacyMyBuildsRaw !== undefined ? new Set(extractScopedItems("myBuilds", legacyMyBuildsRaw).map((i) => i.id)) : null;

  const referenced = new Set<string>();
  for (const item of templateItems) {
    const squad = asRecord(item.raw)?.squad;
    for (const buildId of referencedSquadBuildIdsOf(squad)) referenced.add(buildId);
  }
  return summarizeReferences(referenced, targetBuildIds, legacyBuildIds);
}
