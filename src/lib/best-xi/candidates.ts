import { calculateBuild } from "@/lib/progression/engine";
import { emptyAllocation } from "@/lib/progression/engine";
import { resolveBuildRuleStatus } from "@/lib/progression/my-builds";
import type { ProgressionCard, SavedBuild } from "@/lib/progression/types";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import type { BuildRuleKind } from "@/lib/progression/build-inventory";
import type { BestXiCandidate, BestXiUnavailableCard } from "./types";

/**
 * My Team + 保存ビルドから、AIベスト11の候補一覧を構築する純関数。
 *
 * - 候補にするのは「所有中(ownershipStatus === "owned")」のMy Teamカードだけ。
 *   「欲しい」「手放した」「不明」は実際に保有していないため候補にしない。
 * - 保存ビルドがあるカードは、各保存ビルドを個別の候補として評価する(同一カードでも複数候補)。
 * - 保存ビルドが1件も無いカードは、育成配分ゼロ(現在確認できる能力値のみ)の候補を1件だけ作る。
 *   架空の育成を行わない・保存ビルドをでっち上げない。
 * - 能力値の計算は既存の `calculateBuild`(標準モード)をそのまま使う。ここでは一切再実装しない。
 * - 選手ブースター試算(B2)は SavedBuild に配列として保存されていないため常に空配列で計算する
 *   (SavedBuild.selectedPlayerBooster は表示・重複検出専用の単一IDであり、計算への再投入経路が
 *   このプロジェクトに存在しない)。条件付き付属ブースター(Total Package等)は
 *   `conditionalBoosterSelections` をそのまま使う。監督補正は今回未対応のため常に null。
 */
export function buildBestXiCandidates(params: {
  myTeam: MyTeamRecord[];
  progressionCards: Map<string, ProgressionCard>;
  buildsByWorldCardId: Map<string, SavedBuild[]>;
}): { candidates: BestXiCandidate[]; unavailableCards: BestXiUnavailableCard[] } {
  const { myTeam, progressionCards, buildsByWorldCardId } = params;
  const candidates: BestXiCandidate[] = [];
  const unavailableCards: BestXiUnavailableCard[] = [];

  const ownedIds = new Set<string>();
  for (const rec of myTeam) {
    if (rec.ownershipStatus !== "owned") continue;
    if (ownedIds.has(rec.worldCardId)) continue; // My Teamは worldCardId ごとに最大1レコード
    ownedIds.add(rec.worldCardId);

    const card = progressionCards.get(rec.worldCardId);
    if (!card) {
      unavailableCards.push({ worldCardId: rec.worldCardId, reason: "noWorldCardData" });
      continue;
    }

    const builds = buildsByWorldCardId.get(rec.worldCardId) ?? [];

    if (builds.length === 0) {
      candidates.push(makeCandidate({ card, build: null, ownershipStatus: rec.ownershipStatus }));
      continue;
    }

    let anyAvailable = false;
    for (const build of builds) {
      const candidate = makeCandidate({ card, build, ownershipStatus: rec.ownershipStatus });
      candidates.push(candidate);
      if (candidate.abilityStatus === "available") anyAvailable = true;
    }
    if (!anyAvailable) {
      unavailableCards.push({ worldCardId: rec.worldCardId, reason: "noAbilityData" });
    }
  }

  return { candidates, unavailableCards };
}

function makeCandidate(params: {
  card: ProgressionCard;
  build: SavedBuild | null;
  ownershipStatus: string;
}): BestXiCandidate {
  const { card, build, ownershipStatus } = params;
  const candidateKey = `${card.worldCardId}:${build?.buildId ?? "base"}`;
  const intendedPositions = build?.buildIntent?.intendedPositions ?? null;

  let ruleKind: BuildRuleKind = "current";
  if (build) {
    const status = resolveBuildRuleStatus(build.rulesVersion);
    ruleKind = status.isV2 ? "current" : status.isLegacy ? "legacy" : "unknown";
  }

  try {
    const result = calculateBuild({
      card,
      allocation: build ? build.progressionAllocation : emptyAllocation(),
      selectedPlayerBoosters: [],
      selectedConditionalBoosters: build?.conditionalBoosterSelections ?? [],
      manager: null,
    });
    return {
      candidateKey,
      worldCardId: card.worldCardId,
      buildId: build?.buildId ?? null,
      buildName: build?.buildName ?? null,
      source: build ? "build" : "base",
      nameJa: card.nameJa,
      nameEn: card.nameEn,
      registeredPosition: card.registeredPosition,
      ruleKind,
      abilityStatus: "available",
      stats: result.stats,
      ownershipStatus,
      intendedPositions,
    };
  } catch {
    return {
      candidateKey,
      worldCardId: card.worldCardId,
      buildId: build?.buildId ?? null,
      buildName: build?.buildName ?? null,
      source: build ? "build" : "base",
      nameJa: card.nameJa,
      nameEn: card.nameEn,
      registeredPosition: card.registeredPosition,
      ruleKind,
      abilityStatus: "unavailable",
      stats: null,
      ownershipStatus,
      intendedPositions,
    };
  }
}
