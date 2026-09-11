import { PROGRESSION_RULES_VERSION, PROGRESSION_RULES_VERSION_MISDATED } from "./constants";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import { PROGRESSION_GROUPS, PROGRESSION_GROUP_IDS } from "./stat-groups";
import { normalizeGroupAllocation, summarizeGroupPoints, adjustGroupLevel } from "./group-allocation";
import { isLegacyRulesVersion } from "./progression-rules";
import type { BuildMigration, ProgressionCard, SavedBuild } from "./types";

const STAT_KEY_SET = new Set(WORLD_STAT_KEYS);
const GROUP_ID_SET = new Set(PROGRESSION_GROUP_IDS);

/** 配分レコードのキーが groupId（v2）か statKey（v1）かを推定 */
export function detectAllocationUnit(allocation: Record<string, number>): "group" | "stat" | "empty" {
  const keys = Object.keys(allocation ?? {});
  if (keys.length === 0) return "empty";
  if (keys.every((k) => GROUP_ID_SET.has(k))) return "group";
  if (keys.some((k) => STAT_KEY_SET.has(k))) return "stat";
  return "group";
}

/** v1（per-stat）配分 → v2（per-group カテゴリレベル）。各グループはそのグループ能力の最大投入値。 */
export function statAllocationToGroupLevels(statAllocation: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of PROGRESSION_GROUPS) {
    let level = 0;
    for (const s of g.affectedStats) {
      const v = statAllocation[s];
      if (typeof v === "number" && Number.isFinite(v) && v > level) level = Math.trunc(v);
    }
    if (level > 0) out[g.groupId] = level;
  }
  return out;
}

/**
 * 保存済みビルドを現行規則（v2）へ移行する。
 * - ユーザーの元配分は破壊しない（返り値のみ・呼び出し側が明示保存するまで localStorage は変えない）。
 * - v2 のコストは段階制で高いため、予算超過分はグループレベルを下げてクランプする。
 */
export function migrateBuild(build: SavedBuild, card: ProgressionCard): BuildMigration {
  const fromVersion = build.rulesVersion || "unknown";
  const notes: string[] = [];
  const unit = detectAllocationUnit(build.progressionAllocation);

  const isMisdatedV2 = fromVersion === PROGRESSION_RULES_VERSION_MISDATED;
  if (isMisdatedV2) {
    notes.push(`規則バージョン名を修正しました（${PROGRESSION_RULES_VERSION_MISDATED} は未来日付の誤り → ${PROGRESSION_RULES_VERSION}）。配分は変更していません。`);
  }

  let groupAlloc: Record<string, number>;
  if (unit === "group") {
    groupAlloc = normalizeGroupAllocation(build.progressionAllocation, card).allocation;
  } else if (unit === "stat") {
    groupAlloc = statAllocationToGroupLevels(build.progressionAllocation);
    notes.push("旧規則(v1)の能力値ごとの配分を、グループのカテゴリレベルへ変換しました（各グループはそのグループ能力への最大投入値）。");
  } else {
    groupAlloc = {};
  }

  // v2 予算に収める（段階コストで超過しがち）
  const norm = normalizeGroupAllocation(groupAlloc, card);
  groupAlloc = norm.allocation;
  for (const r of norm.rejected) notes.push(`配分の補正: ${r}`);

  let summary = summarizeGroupPoints(groupAlloc, card, PROGRESSION_RULES_VERSION);
  if (summary.overAllocated) {
    notes.push(
      `v2 の段階コストにより育成ポイントを超過（${summary.usedPoints} / ${summary.totalPoints}）。超過しないようグループレベルを段階的に下げました。`,
    );
    // 大きいレベルのグループから 1 ずつ下げる
    let guard = 0;
    while (summary.overAllocated && guard++ < 500) {
      const entries = Object.entries(groupAlloc).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) break;
      const [gid] = entries[0];
      groupAlloc = adjustGroupLevel(groupAlloc, card, gid, -1, PROGRESSION_RULES_VERSION);
      summary = summarizeGroupPoints(groupAlloc, card, PROGRESSION_RULES_VERSION);
    }
  }

  // 名前だけの修正（誤日付 v2 で配分そのまま）は「再計算が必要な変更」ではない
  const allocChanged = JSON.stringify(groupAlloc) !== JSON.stringify(build.progressionAllocation);
  const changed = isMisdatedV2
    ? allocChanged
    : isLegacyRulesVersion(fromVersion) || unit === "stat" || allocChanged;

  return {
    fromVersion,
    toVersion: PROGRESSION_RULES_VERSION,
    nameOnlyChange: isMisdatedV2 && !allocChanged && unit !== "stat",
    migratedAllocation: groupAlloc,
    changed,
    notes,
  };
}
