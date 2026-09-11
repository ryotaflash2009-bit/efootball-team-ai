import type { PlayerBoosterInfo, SavedBuild } from "@/lib/progression/types";
import type { ManagerDetail } from "@/lib/managers/types";
import type { SquadPlayerDisplay, StoredSquad, SquadBuildMode, CompatibilityStatus } from "./types";
import type { SquadComputed } from "./types";
import { getFormation } from "./formations";
import { hasCustomPositioning } from "./squad-storage";
import { evaluateCompatibility } from "./position";
import { diffValue, diffSide, roundTo } from "./compare-format";

/**
 * 2 つの保存済み通常スカッドの差分（純関数）。
 *
 *  - 入力は StoredSquad ＋ 既存 buildSquad の結果 ＋ 解決済み選手詳細のまとめ。
 *    比較専用の育成 / 監督 / ブースター計算は作らない（buildSquad の結果を消費するだけ）。
 *  - 共通カードの照合は **worldCardId（文字列）一致のみ**。名前一致では共通扱いしない。
 *  - 読み取り専用。ここでスカッドを書き換えない。
 *  - ポジション別 OVR は推測しない。数値差は「A の値 / B の値 / 差」で並べるだけ（自動の優劣判定なし）。
 *  - 座標差は正規化座標（0–100・ピッチ幅比）であり、メートル / cm ではない。
 */

// ---- 入力 ----

/** 解決できた 1 カードぶんの表示・計算結果（先発 / ベンチ共通）。 */
export interface ResolvedCompareCard {
  display: SquadPlayerDisplay;
  baseOvr: number | null;
  displayedOvr: number | null;
  playerSkills: string[];
  boosters: PlayerBoosterInfo[];
  hasConditionalSelection: boolean;
  conditionalSelections: {
    boosterKey: string;
    nameEn: string;
    nameJa: string | null;
    selection: string;
    level: number;
    description: string;
  }[];
  staleBuild: boolean;
  savedBuildName: string | null;
}

export interface CompareSideInput {
  squad: StoredSquad;
  computed: SquadComputed;
  managerDetail: ManagerDetail | null;
  /** worldCardId → 解決済みカード。無い ID は「未解決（取得失敗 / 読み込み中）」。 */
  resolved: Map<string, ResolvedCompareCard>;
  /** スカッドに含まれるが解決できなかった worldCardId。 */
  failedCardIds: string[];
  /** worldCardId → 保存ビルド一覧（参照ビルドの rulesVersion / 配分の解決用）。 */
  savedBuildsByCard: Map<string, SavedBuild[]>;
}

// ---- 出力 ----

export type DiffState = "same" | "different" | "onlyA" | "onlyB" | "neither";
export type ConfirmState = "confirmed" | "provisional" | "unresolved" | "unavailable";

export interface CompareCardUnit {
  worldCardId: string;
  area: "starter" | "bench";
  slotId: string | null;
  benchIndex: number | null;
  x: number | null;
  y: number | null;
  /** 配置ロール（effectiveRole・先発のみ）。 */
  placementRole: string | null;
  roleOverridden: boolean;
  isCaptain: boolean;
  setPieceRoles: string[];
  buildMode: SquadBuildMode;
  savedBuildId: string | null;
  resolved: boolean;
  nameJa: string | null;
  nameEn: string | null;
  cardType: string | null;
  registeredPosition: string | null;
  baseOvr: number | null;
  displayedOvr: number | null;
  playerSkills: string[];
  efhubCardId: string | null;
  hasEfhubLink: boolean;
  imageUrlCandidate: string | null;
  mobileImageUrlCandidate: string | null;
  suitability: { status: CompatibilityStatus; label: string; note: string | null } | null;
  boosters: PlayerBoosterInfo[];
  hasConditionalSelection: boolean;
  savedBuildName: string | null;
  staleBuild: boolean;
}

export interface CompareSquadSummary {
  squadId: string;
  squadName: string;
  formationId: string;
  formationName: string;
  hasCustomPositioning: boolean;
  startingCount: number;
  benchCount: number;
  managerName: string | null;
  hasManager: boolean;
  captainName: string | null;
  captainRole: string | null;
  updatedAt: string;
  warningCount: number;
}

export interface PlacementChange {
  worldCardId: string;
  name: string;
  aRole: string | null;
  bRole: string | null;
  aX: number | null;
  aY: number | null;
  bX: number | null;
  bY: number | null;
  dx: number | null;
  dy: number | null;
  roleChanged: boolean;
  moved: boolean;
}

export interface AreaChange {
  worldCardId: string;
  name: string;
  aArea: "starter" | "bench" | null;
  bArea: "starter" | "bench" | null;
  aLabel: string;
  bLabel: string;
  changed: boolean;
}

export interface CommonPlayerPair {
  worldCardId: string;
  name: string;
  a: CompareCardUnit;
  b: CompareCardUnit;
  areaChanged: boolean;
  roleChanged: boolean;
  buildModeChanged: boolean;
  savedBuildChanged: boolean;
  captainChanged: boolean;
  setPieceChanged: boolean;
  pomChanged: boolean;
  anyChange: boolean;
}

export interface SameNamePair {
  name: string;
  a: CompareCardUnit;
  b: CompareCardUnit;
  /** 確認済み識別子が無いため常に "同名の別カード"。 */
  label: "同名の別カード";
}

export interface MetricRow {
  key: string;
  label: string;
  a: number | null;
  b: number | null;
  diff: number | null;
  higher: "a" | "b" | "equal" | "na";
  /** 高い方が良いとは限らない指標か（警告数・未確認数など）。 */
  lowerIsCalmer?: boolean;
}

export interface CategoryRow {
  id: string;
  label: string;
  a: number | null;
  b: number | null;
  diff: number | null;
  higher: "a" | "b" | "equal" | "na";
}

export interface SkillRow {
  name: string;
  aHolders: number;
  bHolders: number;
  aAllStarters: boolean;
  bAllStarters: boolean;
  state: DiffState;
}

export interface ManagerComparison {
  aName: string | null;
  bName: string | null;
  aHasManager: boolean;
  bHasManager: boolean;
  state: DiffState;
  sameManager: boolean;
  aBoosterDelta: number;
  bBoosterDelta: number;
  aConfirmedBoosters: { statNameEn: string; delta: number }[];
  bConfirmedBoosters: { statNameEn: string; delta: number }[];
  aProficiencies: Record<string, number | null> | null;
  bProficiencies: Record<string, number | null> | null;
  /** 監督補正の適用順序（育成前 / 育成後）は未確認、の注記。 */
  orderNote: string;
}

export interface CaptainComparison {
  aCardId: string | null;
  bCardId: string | null;
  aName: string | null;
  bName: string | null;
  aRole: string | null;
  bRole: string | null;
  state: DiffState;
  sameCard: boolean;
}

export interface SetPieceRow {
  key: "corners" | "freeKicks" | "penalties";
  label: "CK" | "FK" | "PK";
  aCardId: string | null;
  bCardId: string | null;
  aName: string | null;
  bName: string | null;
  state: DiffState;
  sameCard: boolean;
}

export interface LinkUpComparison {
  aHasSelection: boolean;
  bHasSelection: boolean;
  aPlays: { name: string; status: string; confirmationStatus: string }[];
  bPlays: { name: string; status: string; confirmationStatus: string }[];
  state: DiffState;
  notice: string;
}

export interface BuildDiffRow {
  worldCardId: string;
  name: string;
  aBuildMode: SquadBuildMode;
  bBuildMode: SquadBuildMode;
  aBuildName: string | null;
  bBuildName: string | null;
  aBuildId: string | null;
  bBuildId: string | null;
  aRulesVersion: string | null;
  bRulesVersion: string | null;
  aAllocation: Record<string, number> | null;
  bAllocation: Record<string, number> | null;
  aDeletedRef: boolean;
  bDeletedRef: boolean;
  aStale: boolean;
  bStale: boolean;
  aHasConditional: boolean;
  bHasConditional: boolean;
  aDisplayedOvr: number | null;
  bDisplayedOvr: number | null;
  changed: boolean;
}

export interface BoosterSlotView {
  slot: 1 | 2;
  boosterId: number;
  boosterKey: string | null;
  nameEn: string | null;
  nameJa: string | null;
  level: number | null;
  /** fixed / fixed-推定 / power_of_many / conditional / unresolved / other */
  kind: "fixed" | "fixed_provisional" | "power_of_many" | "conditional" | "unresolved" | "other";
  autoApplied: boolean;
  /** Power of Many / Total Package のユーザー指定段階（"none" 含む）。 */
  userSelection: string | null;
  userLevel: number | null;
  evidenceLevel: string;
}

export interface BoosterDiffRow {
  worldCardId: string;
  name: string;
  a: BoosterSlotView[];
  b: BoosterSlotView[];
  /** ユーザー指定（PoM / 条件段階）が A/B で異なる。カード付属の効果自体は同一カードなら同じ。 */
  userSelectionChanged: boolean;
}

export interface SuitabilityCardRow {
  worldCardId: string;
  name: string;
  aRole: string | null;
  bRole: string | null;
  aStatus: CompatibilityStatus | null;
  bStatus: CompatibilityStatus | null;
  aLabel: string | null;
  bLabel: string | null;
  changed: boolean;
}

export interface FailedCardRef {
  worldCardId: string;
  area: "starter" | "bench";
  slotId: string | null;
  benchIndex: number | null;
  placementRole: string | null;
}

export interface SquadComparisonResult {
  sameSquad: boolean;
  summary: { a: CompareSquadSummary; b: CompareSquadSummary; commonCardCount: number; onlyACardCount: number; onlyBCardCount: number };
  units: { a: CompareCardUnit[]; b: CompareCardUnit[] };
  formationComparison: {
    aId: string;
    bId: string;
    aName: string;
    bName: string;
    same: boolean;
    aHasCustomPositioning: boolean;
    bHasCustomPositioning: boolean;
    aRoleBreakdown: { role: string; count: number }[];
    bRoleBreakdown: { role: string; count: number }[];
    roleBreakdownSame: boolean;
    aZones: { left: number; center: number; right: number };
    bZones: { left: number; center: number; right: number };
  };
  shapeComparison: { placementChanges: PlacementChange[] };
  playerComparison: {
    common: CommonPlayerPair[];
    onlyA: CompareCardUnit[];
    onlyB: CompareCardUnit[];
    sameNameDifferentCard: SameNamePair[];
    areaChanges: AreaChange[];
    starterOnlyA: CompareCardUnit[];
    starterOnlyB: CompareCardUnit[];
    starterBoth: CommonPlayerPair[];
  };
  benchComparison: {
    both: CommonPlayerPair[];
    onlyA: CompareCardUnit[];
    onlyB: CompareCardUnit[];
    aCount: number;
    bCount: number;
    orderChanged: boolean;
    starterToBench: AreaChange[];
    benchToStarter: AreaChange[];
  };
  managerComparison: ManagerComparison;
  captainComparison: CaptainComparison;
  setPieceComparison: SetPieceRow[];
  linkUpComparison: LinkUpComparison;
  buildComparison: BuildDiffRow[];
  boosterComparison: BoosterDiffRow[];
  metricComparison: MetricRow[];
  categoryComparison: CategoryRow[];
  skillComparison: { both: string[]; onlyA: SkillRow[]; onlyB: SkillRow[]; rows: SkillRow[] };
  suitabilityComparison: {
    aExact: number;
    bExact: number;
    aUnresolved: number;
    bUnresolved: number;
    aGkMismatch: number;
    bGkMismatch: number;
    cards: SuitabilityCardRow[];
  };
  warningComparison: { both: string[]; onlyA: string[]; onlyB: string[]; aCount: number; bCount: number };
  dataAvailability: { aFailed: FailedCardRef[]; bFailed: FailedCardRef[] };
  metricsNotes: string[];
}

// ---- ヘルパー ----

const ZONE_LEFT_MAX = 22;
const ZONE_RIGHT_MIN = 78;

function nameOf(u: { nameJa: string | null; nameEn: string | null; worldCardId: string }): string {
  return u.nameJa || u.nameEn || `カード ${u.worldCardId}`;
}

export function findCommonWorldCardIds(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of a) {
    if (setB.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function findExclusiveWorldCardIds(
  a: string[],
  b: string[],
): { onlyA: string[]; onlyB: string[] } {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    onlyA: [...new Set(a)].filter((id) => !setB.has(id)),
    onlyB: [...new Set(b)].filter((id) => !setA.has(id)),
  };
}

/** 1 スカッドを配置単位（先発 → ベンチ）へ正規化。 */
export function toCompareUnits(side: CompareSideInput): CompareCardUnit[] {
  const { squad, computed } = side;
  const compBySlot = new Map(computed.slots.map((s) => [s.slotId, s]));
  const setPieces = squad.setPieces ?? { corners: null, freeKicks: null, penalties: null };
  const units: CompareCardUnit[] = [];

  for (const sl of squad.slots) {
    if (!sl.worldCardId) continue;
    const cs = compBySlot.get(sl.slotId);
    const res = side.resolved.get(sl.worldCardId);
    const spRoles: string[] = [];
    if (setPieces.freeKicks === sl.slotId) spRoles.push("FK");
    if (setPieces.corners === sl.slotId) spRoles.push("CK");
    if (setPieces.penalties === sl.slotId) spRoles.push("PK");
    units.push({
      worldCardId: sl.worldCardId,
      area: "starter",
      slotId: sl.slotId,
      benchIndex: null,
      x: cs ? roundTo(cs.x, 1) : null,
      y: cs ? roundTo(cs.y, 1) : null,
      placementRole: cs?.position ?? null,
      roleOverridden: !!sl.roleOverride,
      isCaptain: squad.captainSlotId === sl.slotId,
      setPieceRoles: spRoles,
      buildMode: sl.buildMode,
      savedBuildId: sl.savedBuildId ?? null,
      resolved: !!res,
      nameJa: res?.display.nameJa ?? null,
      nameEn: res?.display.nameEn ?? null,
      cardType: res?.display.cardType ?? null,
      registeredPosition: res?.display.registeredPosition ?? null,
      baseOvr: res?.baseOvr ?? null,
      displayedOvr: res?.displayedOvr ?? null,
      playerSkills: res?.playerSkills ?? [],
      efhubCardId: res?.display.efhubCardId ?? null,
      hasEfhubLink: res?.display.hasEfhubLink ?? false,
      imageUrlCandidate: res?.display.imageUrlCandidate ?? null,
      mobileImageUrlCandidate: res?.display.mobileImageUrlCandidate ?? null,
      suitability: cs
        ? { status: cs.compatibility.status, label: cs.compatibility.label, note: cs.compatibility.note }
        : null,
      boosters: res?.boosters ?? [],
      hasConditionalSelection: res?.hasConditionalSelection ?? false,
      savedBuildName: res?.savedBuildName ?? null,
      staleBuild: res?.staleBuild ?? false,
    });
  }

  squad.substitutes.forEach((sub, index) => {
    const res = side.resolved.get(sub.worldCardId);
    units.push({
      worldCardId: sub.worldCardId,
      area: "bench",
      slotId: null,
      benchIndex: index,
      x: null,
      y: null,
      placementRole: null,
      roleOverridden: false,
      isCaptain: false,
      setPieceRoles: [],
      buildMode: sub.buildMode,
      savedBuildId: sub.savedBuildId ?? null,
      resolved: !!res,
      nameJa: res?.display.nameJa ?? null,
      nameEn: res?.display.nameEn ?? null,
      cardType: res?.display.cardType ?? null,
      registeredPosition: res?.display.registeredPosition ?? null,
      baseOvr: res?.baseOvr ?? null,
      displayedOvr: res?.displayedOvr ?? null,
      playerSkills: res?.playerSkills ?? [],
      efhubCardId: res?.display.efhubCardId ?? null,
      hasEfhubLink: res?.display.hasEfhubLink ?? false,
      imageUrlCandidate: res?.display.imageUrlCandidate ?? null,
      mobileImageUrlCandidate: res?.display.mobileImageUrlCandidate ?? null,
      suitability: null,
      boosters: res?.boosters ?? [],
      hasConditionalSelection: res?.hasConditionalSelection ?? false,
      savedBuildName: res?.savedBuildName ?? null,
      staleBuild: res?.staleBuild ?? false,
    });
  });

  return units;
}

function summaryOf(side: CompareSideInput, units: CompareCardUnit[]): CompareSquadSummary {
  const { squad, computed } = side;
  const captainUnit = units.find((u) => u.isCaptain) ?? null;
  return {
    squadId: squad.squadId,
    squadName: squad.squadName,
    formationId: squad.formationId,
    formationName: getFormation(squad.formationId).name,
    hasCustomPositioning: hasCustomPositioning(squad),
    startingCount: computed.teamSummary.startingCount,
    benchCount: computed.teamSummary.benchCount,
    managerName: side.managerDetail?.nameEn ?? null,
    hasManager: squad.managerId != null,
    captainName: captainUnit ? nameOf(captainUnit) : null,
    captainRole: captainUnit?.placementRole ?? null,
    updatedAt: squad.updatedAt,
    warningCount: computed.warnings.length,
  };
}

function zonesOf(units: CompareCardUnit[]): { left: number; center: number; right: number } {
  let left = 0,
    center = 0,
    right = 0;
  for (const u of units) {
    if (u.area !== "starter" || u.x == null) continue;
    if (u.x < ZONE_LEFT_MAX) left += 1;
    else if (u.x > ZONE_RIGHT_MIN) right += 1;
    else center += 1;
  }
  return { left, center, right };
}

function boosterKind(b: PlayerBoosterInfo): BoosterSlotView["kind"] {
  if (b.boosterKey == null) return "unresolved";
  if (b.manualConditional || b.activationType === "power_of_many") return "power_of_many";
  if (b.activationType === "live_update") return "other";
  if (b.evidenceLevel === "conditional_unverified") return "conditional";
  if (b.activationType === "fixed" || b.activationType == null) {
    return b.activationConfirmed ? "fixed" : "fixed_provisional";
  }
  return "other";
}

function boosterViews(u: CompareCardUnit): BoosterSlotView[] {
  return u.boosters.map((b) => ({
    slot: b.slot,
    boosterId: b.boosterId,
    boosterKey: b.boosterKey,
    nameEn: b.boosterNameEn,
    nameJa: b.boosterNameJa,
    level: b.level,
    kind: boosterKind(b),
    autoApplied: b.autoApplied,
    userSelection: b.conditionSelection ?? null,
    userLevel: b.conditionLevel ?? null,
    evidenceLevel: b.evidenceLevel,
  }));
}

function boosterUserKey(views: BoosterSlotView[]): string {
  return views
    .map((v) => `${v.slot}:${v.userSelection ?? "none"}`)
    .sort()
    .join("|");
}

const CONFIRMED_MGR_STAT = (b: ManagerDetail["boosters"][number]) =>
  b.confirmationStatus === "confirmed" && b.statKey != null;

// ---- メイン ----

export function compareSquads(a: CompareSideInput, b: CompareSideInput): SquadComparisonResult {
  const sameSquad = a.squad.squadId === b.squad.squadId;

  const unitsA = toCompareUnits(a);
  const unitsB = toCompareUnits(b);
  const byIdA = new Map(unitsA.map((u) => [u.worldCardId, u]));
  const byIdB = new Map(unitsB.map((u) => [u.worldCardId, u]));

  const idsA = unitsA.map((u) => u.worldCardId);
  const idsB = unitsB.map((u) => u.worldCardId);
  const commonIds = findCommonWorldCardIds(idsA, idsB);
  const { onlyA: onlyAIds, onlyB: onlyBIds } = findExclusiveWorldCardIds(idsA, idsB);

  const summaryA = summaryOf(a, unitsA);
  const summaryB = summaryOf(b, unitsB);

  // --- 共通選手ペア ---
  const common: CommonPlayerPair[] = commonIds.map((id) => {
    const ua = byIdA.get(id)!;
    const ub = byIdB.get(id)!;
    const areaChanged = ua.area !== ub.area;
    const roleChanged = (ua.placementRole ?? null) !== (ub.placementRole ?? null);
    const buildModeChanged = ua.buildMode !== ub.buildMode;
    const savedBuildChanged = (ua.savedBuildId ?? null) !== (ub.savedBuildId ?? null);
    const captainChanged = ua.isCaptain !== ub.isCaptain;
    const setPieceChanged =
      ua.setPieceRoles.slice().sort().join(",") !== ub.setPieceRoles.slice().sort().join(",");
    const pomChanged = boosterUserKey(boosterViews(ua)) !== boosterUserKey(boosterViews(ub));
    return {
      worldCardId: id,
      name: nameOf(ua.resolved ? ua : ub),
      a: ua,
      b: ub,
      areaChanged,
      roleChanged,
      buildModeChanged,
      savedBuildChanged,
      captainChanged,
      setPieceChanged,
      pomChanged,
      anyChange:
        areaChanged ||
        roleChanged ||
        buildModeChanged ||
        savedBuildChanged ||
        captainChanged ||
        setPieceChanged ||
        pomChanged ||
        diffValue(ua.x, ub.x, 1) !== 0 ||
        diffValue(ua.y, ub.y, 1) !== 0,
    };
  });

  const onlyAUnits = onlyAIds.map((id) => byIdA.get(id)!);
  const onlyBUnits = onlyBIds.map((id) => byIdB.get(id)!);

  // --- 同名別カード（worldCardId 違い） ---
  const sameNameDifferentCard: SameNamePair[] = [];
  for (const ua of onlyAUnits) {
    const an = (ua.nameJa || ua.nameEn || "").trim().toLowerCase();
    if (!an) continue;
    for (const ub of onlyBUnits) {
      const bn = (ub.nameJa || ub.nameEn || "").trim().toLowerCase();
      if (an && an === bn && ua.worldCardId !== ub.worldCardId) {
        sameNameDifferentCard.push({ name: nameOf(ua), a: ua, b: ub, label: "同名の別カード" });
      }
    }
  }

  // --- 配置形状（両方 starter の共通カード） ---
  const placementChanges: PlacementChange[] = common
    .filter((p) => p.a.area === "starter" && p.b.area === "starter")
    .map((p) => {
      const dx = diffValue(p.a.x, p.b.x, 1);
      const dy = diffValue(p.a.y, p.b.y, 1);
      const roleChanged = (p.a.placementRole ?? null) !== (p.b.placementRole ?? null);
      return {
        worldCardId: p.worldCardId,
        name: p.name,
        aRole: p.a.placementRole,
        bRole: p.b.placementRole,
        aX: p.a.x,
        aY: p.a.y,
        bX: p.b.x,
        bY: p.b.y,
        dx,
        dy,
        roleChanged,
        moved: (dx != null && dx !== 0) || (dy != null && dy !== 0) || roleChanged,
      };
    });

  // --- 先発 / ベンチ状態の変化 ---
  const areaLabel = (u: CompareCardUnit | undefined): string => {
    if (!u) return "なし";
    if (u.area === "starter") return `先発 ${u.placementRole ?? "?"}`;
    return `ベンチ ${((u.benchIndex ?? 0) + 1)}番`;
  };
  const areaChanges: AreaChange[] = commonIds.map((id) => {
    const ua = byIdA.get(id);
    const ub = byIdB.get(id);
    return {
      worldCardId: id,
      name: nameOf((ua?.resolved ? ua : ub) ?? ua ?? ub!),
      aArea: ua?.area ?? null,
      bArea: ub?.area ?? null,
      aLabel: areaLabel(ua),
      bLabel: areaLabel(ub),
      changed: (ua?.area ?? null) !== (ub?.area ?? null),
    };
  });

  // --- ベンチ比較 ---
  const benchA = unitsA.filter((u) => u.area === "bench");
  const benchB = unitsB.filter((u) => u.area === "bench");
  const benchCommon = common.filter((p) => p.a.area === "bench" && p.b.area === "bench");
  const benchOrderA = benchA.map((u) => u.worldCardId).join(",");
  const benchOrderB = benchB.map((u) => u.worldCardId).join(",");
  const starterToBench = areaChanges.filter((c) => c.aArea === "starter" && c.bArea === "bench");
  const benchToStarter = areaChanges.filter((c) => c.aArea === "bench" && c.bArea === "starter");

  // --- フォーメーション ---
  const roleKey = (r: { role: string; count: number }[]) =>
    r.map((x) => `${x.role}:${x.count}`).sort().join("|");
  const rbA = a.computed.teamSummary.roleBreakdown.map((r) => ({ role: r.role as string, count: r.count }));
  const rbB = b.computed.teamSummary.roleBreakdown.map((r) => ({ role: r.role as string, count: r.count }));

  // --- 監督 ---
  const mgrDeltaA = a.computed.slots.reduce((s, sl) => s + (sl.entry?.managerBoosterDelta ?? 0), 0);
  const mgrDeltaB = b.computed.slots.reduce((s, sl) => s + (sl.entry?.managerBoosterDelta ?? 0), 0);
  const managerComparison: ManagerComparison = {
    aName: summaryA.managerName,
    bName: summaryB.managerName,
    aHasManager: summaryA.hasManager,
    bHasManager: summaryB.hasManager,
    state:
      !summaryA.hasManager && !summaryB.hasManager
        ? "neither"
        : summaryA.hasManager && !summaryB.hasManager
          ? "onlyA"
          : !summaryA.hasManager && summaryB.hasManager
            ? "onlyB"
            : a.squad.managerId === b.squad.managerId
              ? "same"
              : "different",
    sameManager: a.squad.managerId != null && a.squad.managerId === b.squad.managerId,
    aBoosterDelta: mgrDeltaA,
    bBoosterDelta: mgrDeltaB,
    aConfirmedBoosters: (a.managerDetail?.boosters ?? [])
      .filter(CONFIRMED_MGR_STAT)
      .map((x) => ({ statNameEn: x.statNameEn, delta: x.delta })),
    bConfirmedBoosters: (b.managerDetail?.boosters ?? [])
      .filter(CONFIRMED_MGR_STAT)
      .map((x) => ({ statNameEn: x.statNameEn, delta: x.delta })),
    aProficiencies: a.managerDetail
      ? (a.managerDetail.proficiencies as unknown as Record<string, number | null>)
      : null,
    bProficiencies: b.managerDetail
      ? (b.managerDetail.proficiencies as unknown as Record<string, number | null>)
      : null,
    orderNote: "監督ブースターの適用順序（育成前 / 育成後）は未確認です。",
  };

  // --- キャプテン ---
  const capA = unitsA.find((u) => u.isCaptain) ?? null;
  const capB = unitsB.find((u) => u.isCaptain) ?? null;
  const captainComparison: CaptainComparison = {
    aCardId: capA?.worldCardId ?? null,
    bCardId: capB?.worldCardId ?? null,
    aName: capA ? nameOf(capA) : null,
    bName: capB ? nameOf(capB) : null,
    aRole: capA?.placementRole ?? null,
    bRole: capB?.placementRole ?? null,
    state:
      !capA && !capB
        ? "neither"
        : capA && !capB
          ? "onlyA"
          : !capA && capB
            ? "onlyB"
            : capA!.worldCardId === capB!.worldCardId
              ? "same"
              : "different",
    sameCard: !!capA && !!capB && capA.worldCardId === capB.worldCardId,
  };

  // --- セットプレー ---
  const spName = (side: CompareSideInput, key: "corners" | "freeKicks" | "penalties"): { id: string | null; name: string | null } => {
    const slotId = side.squad.setPieces?.[key] ?? null;
    if (!slotId) return { id: null, name: null };
    const sl = side.squad.slots.find((s) => s.slotId === slotId);
    const id = sl?.worldCardId ?? null;
    if (!id) return { id: null, name: null };
    const res = side.resolved.get(id);
    return { id, name: res ? nameOf({ nameJa: res.display.nameJa, nameEn: res.display.nameEn, worldCardId: id }) : `カード ${id}` };
  };
  const setPieceComparison: SetPieceRow[] = (
    [
      ["corners", "CK"],
      ["freeKicks", "FK"],
      ["penalties", "PK"],
    ] as const
  ).map(([key, label]) => {
    const av = spName(a, key);
    const bv = spName(b, key);
    const state: DiffState =
      !av.id && !bv.id
        ? "neither"
        : av.id && !bv.id
          ? "onlyA"
          : !av.id && bv.id
            ? "onlyB"
            : av.id === bv.id
              ? "same"
              : "different";
    return {
      key,
      label,
      aCardId: av.id,
      bCardId: bv.id,
      aName: av.name,
      bName: bv.name,
      state,
      sameCard: !!av.id && av.id === bv.id,
    };
  });

  // --- Link-Up ---
  const luSel = (s: StoredSquad) =>
    !!(s.linkUp && (s.linkUp.centerPieceSlotId || s.linkUp.keyManSlotId));
  const luPlays = (c: SquadComputed) =>
    c.linkUps.map((p) => ({ name: p.name, status: p.status, confirmationStatus: p.confirmationStatus }));
  const luKey = (plays: { name: string; status: string }[]) =>
    plays.map((p) => `${p.name}:${p.status}`).sort().join("|");
  const linkUpComparison: LinkUpComparison = {
    aHasSelection: luSel(a.squad),
    bHasSelection: luSel(b.squad),
    aPlays: luPlays(a.computed),
    bPlays: luPlays(b.computed),
    state:
      !luSel(a.squad) && !luSel(b.squad)
        ? "neither"
        : luSel(a.squad) && !luSel(b.squad)
          ? "onlyA"
          : !luSel(a.squad) && luSel(b.squad)
            ? "onlyB"
            : luKey(luPlays(a.computed)) === luKey(luPlays(b.computed))
              ? "same"
              : "different",
    notice: a.computed.linkUpNotice,
  };

  // --- 保存ビルド（共通の解決済みカード） ---
  const buildComparison: BuildDiffRow[] = common
    .filter((p) => p.a.resolved && p.b.resolved)
    .map((p) => {
      const aBuild = p.a.savedBuildId
        ? (a.savedBuildsByCard.get(p.worldCardId) ?? []).find((x) => x.buildId === p.a.savedBuildId) ?? null
        : null;
      const bBuild = p.b.savedBuildId
        ? (b.savedBuildsByCard.get(p.worldCardId) ?? []).find((x) => x.buildId === p.b.savedBuildId) ?? null
        : null;
      const aDeletedRef = !!p.a.savedBuildId && !aBuild;
      const bDeletedRef = !!p.b.savedBuildId && !bBuild;
      return {
        worldCardId: p.worldCardId,
        name: p.name,
        aBuildMode: p.a.buildMode,
        bBuildMode: p.b.buildMode,
        aBuildName: p.a.savedBuildName,
        bBuildName: p.b.savedBuildName,
        aBuildId: p.a.savedBuildId,
        bBuildId: p.b.savedBuildId,
        aRulesVersion: aBuild?.rulesVersion ?? null,
        bRulesVersion: bBuild?.rulesVersion ?? null,
        aAllocation: aBuild?.progressionAllocation ?? null,
        bAllocation: bBuild?.progressionAllocation ?? null,
        aDeletedRef,
        bDeletedRef,
        aStale: p.a.staleBuild,
        bStale: p.b.staleBuild,
        aHasConditional: p.a.hasConditionalSelection,
        bHasConditional: p.b.hasConditionalSelection,
        aDisplayedOvr: p.a.displayedOvr,
        bDisplayedOvr: p.b.displayedOvr,
        changed:
          p.a.buildMode !== p.b.buildMode ||
          (p.a.savedBuildId ?? null) !== (p.b.savedBuildId ?? null) ||
          p.a.hasConditionalSelection !== p.b.hasConditionalSelection,
      };
    });

  // --- ブースター（共通の解決済みカード） ---
  const boosterComparison: BoosterDiffRow[] = common
    .filter((p) => p.a.resolved && p.b.resolved && (p.a.boosters.length > 0 || p.b.boosters.length > 0))
    .map((p) => {
      const av = boosterViews(p.a);
      const bv = boosterViews(p.b);
      return {
        worldCardId: p.worldCardId,
        name: p.name,
        a: av,
        b: bv,
        userSelectionChanged: boosterUserKey(av) !== boosterUserKey(bv),
      };
    });

  // --- 平均・指標 ---
  const tsA = a.computed.teamSummary;
  const tsB = b.computed.teamSummary;
  const mrow = (
    key: string,
    label: string,
    va: number | null,
    vb: number | null,
    lowerIsCalmer = false,
  ): MetricRow => ({
    key,
    label,
    a: roundTo(va, 1),
    b: roundTo(vb, 1),
    diff: diffValue(va, vb, 1),
    higher: diffSide(va, vb),
    lowerIsCalmer,
  });
  const metricComparison: MetricRow[] = [
    mrow("startingCount", "先発人数", tsA.startingCount, tsB.startingCount),
    mrow("benchCount", "ベンチ人数", tsA.benchCount, tsB.benchCount),
    mrow("avgBaseOvr", "平均基礎OVR", tsA.avgBaseOvr, tsB.avgBaseOvr),
    mrow("avgDisplayedOvr", "平均表示OVR", tsA.avgDisplayedOvr, tsB.avgDisplayedOvr),
    mrow("sharedSkillCount", "共通スキル数", tsA.sharedSkillCount, tsB.sharedSkillCount),
    mrow("managerBoostedCount", "監督補正が乗る先発数", tsA.managerBoostedCount, tsB.managerBoostedCount),
    mrow("unresolvedCompat", "適性未確認の先発数", tsA.unresolvedCompatibilityCount, tsB.unresolvedCompatibilityCount, true),
    mrow("gkMismatch", "不適性の可能性がある先発数", tsA.gkMismatchCount, tsB.gkMismatchCount, true),
    mrow("warningCount", "警告数", tsA.warningCount, tsB.warningCount, true),
  ];

  // --- カテゴリ平均 ---
  const catB = new Map(tsB.categoryAverages.map((c) => [c.category, c.avg]));
  const categoryComparison: CategoryRow[] = tsA.categoryAverages.map((c) => {
    const bv = catB.get(c.category) ?? null;
    return {
      id: c.category,
      label: c.category,
      a: roundTo(c.avg, 1),
      b: roundTo(bv, 1),
      diff: diffValue(c.avg, bv, 1),
      higher: diffSide(c.avg, bv),
    };
  });

  // --- スキル ---
  const starterSkillHolders = (units: CompareCardUnit[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const u of units) {
      if (u.area !== "starter") continue;
      for (const sk of new Set(u.playerSkills)) m.set(sk, (m.get(sk) ?? 0) + 1);
    }
    return m;
  };
  const holdersA = starterSkillHolders(unitsA);
  const holdersB = starterSkillHolders(unitsB);
  const sharedA = new Set(tsA.sharedSkills);
  const sharedB = new Set(tsB.sharedSkills);
  const allSkillNames = [...new Set([...holdersA.keys(), ...holdersB.keys()])].sort();
  const skillRows: SkillRow[] = allSkillNames.map((name) => {
    const ha = holdersA.get(name) ?? 0;
    const hb = holdersB.get(name) ?? 0;
    const state: DiffState = ha > 0 && hb > 0 ? "same" : ha > 0 ? "onlyA" : "onlyB";
    return {
      name,
      aHolders: ha,
      bHolders: hb,
      aAllStarters: sharedA.has(name),
      bAllStarters: sharedB.has(name),
      state,
    };
  });
  const skillComparison = {
    both: [...sharedA].filter((s) => sharedB.has(s)).sort(),
    onlyA: skillRows.filter((r) => r.aAllStarters && !r.bAllStarters),
    onlyB: skillRows.filter((r) => r.bAllStarters && !r.aAllStarters),
    rows: skillRows,
  };

  // --- 適性 ---
  const suitCards: SuitabilityCardRow[] = commonIds
    .map((id) => {
      const ua = byIdA.get(id);
      const ub = byIdB.get(id);
      const aS = ua?.suitability ?? null;
      const bS = ub?.suitability ?? null;
      if (!aS && !bS) return null;
      return {
        worldCardId: id,
        name: nameOf((ua?.resolved ? ua : ub) ?? ua ?? ub!),
        aRole: ua?.placementRole ?? null,
        bRole: ub?.placementRole ?? null,
        aStatus: aS?.status ?? null,
        bStatus: bS?.status ?? null,
        aLabel: aS?.label ?? null,
        bLabel: bS?.label ?? null,
        changed: (aS?.status ?? null) !== (bS?.status ?? null),
      } as SuitabilityCardRow;
    })
    .filter((x): x is SuitabilityCardRow => x != null);
  const suitCount = (side: CompareSideInput, status: CompatibilityStatus): number =>
    side.computed.slots.filter((s) => s.entry != null && s.compatibility.status === status).length;
  const suitabilityComparison = {
    aExact: suitCount(a, "exact"),
    bExact: suitCount(b, "exact"),
    aUnresolved: tsA.unresolvedCompatibilityCount,
    bUnresolved: tsB.unresolvedCompatibilityCount,
    aGkMismatch: tsA.gkMismatchCount,
    bGkMismatch: tsB.gkMismatchCount,
    cards: suitCards,
  };

  // --- 警告 ---
  const wA = a.computed.warnings;
  const wB = b.computed.warnings;
  const wSetB = new Set(wB);
  const wSetA = new Set(wA);
  const warningComparison = {
    both: wA.filter((w) => wSetB.has(w)),
    onlyA: wA.filter((w) => !wSetB.has(w)),
    onlyB: wB.filter((w) => !wSetA.has(w)),
    aCount: wA.length,
    bCount: wB.length,
  };

  // --- 取得失敗 ---
  const failedRefs = (side: CompareSideInput): FailedCardRef[] => {
    const set = new Set(side.failedCardIds);
    const out: FailedCardRef[] = [];
    for (const sl of side.squad.slots) {
      if (sl.worldCardId && set.has(sl.worldCardId)) {
        const cs = side.computed.slots.find((s) => s.slotId === sl.slotId);
        out.push({
          worldCardId: sl.worldCardId,
          area: "starter",
          slotId: sl.slotId,
          benchIndex: null,
          placementRole: cs?.position ?? null,
        });
      }
    }
    side.squad.substitutes.forEach((sub, index) => {
      if (set.has(sub.worldCardId)) {
        out.push({ worldCardId: sub.worldCardId, area: "bench", slotId: null, benchIndex: index, placementRole: null });
      }
    });
    return out;
  };

  const starterBoth = common.filter((p) => p.a.area === "starter" && p.b.area === "starter");
  const starterOnlyA = unitsA.filter(
    (u) => u.area === "starter" && !byIdB.has(u.worldCardId),
  );
  const starterOnlyB = unitsB.filter(
    (u) => u.area === "starter" && !byIdA.has(u.worldCardId),
  );

  return {
    sameSquad,
    summary: {
      a: summaryA,
      b: summaryB,
      commonCardCount: commonIds.length,
      onlyACardCount: onlyAIds.length,
      onlyBCardCount: onlyBIds.length,
    },
    units: { a: unitsA, b: unitsB },
    formationComparison: {
      aId: a.squad.formationId,
      bId: b.squad.formationId,
      aName: summaryA.formationName,
      bName: summaryB.formationName,
      same: a.squad.formationId === b.squad.formationId,
      aHasCustomPositioning: summaryA.hasCustomPositioning,
      bHasCustomPositioning: summaryB.hasCustomPositioning,
      aRoleBreakdown: rbA,
      bRoleBreakdown: rbB,
      roleBreakdownSame: roleKey(rbA) === roleKey(rbB),
      aZones: zonesOf(unitsA),
      bZones: zonesOf(unitsB),
    },
    shapeComparison: { placementChanges },
    playerComparison: {
      common,
      onlyA: onlyAUnits,
      onlyB: onlyBUnits,
      sameNameDifferentCard,
      areaChanges: areaChanges.filter((c) => c.changed),
      starterOnlyA,
      starterOnlyB,
      starterBoth,
    },
    benchComparison: {
      both: benchCommon,
      onlyA: benchA.filter((u) => !byIdB.has(u.worldCardId) || byIdB.get(u.worldCardId)!.area !== "bench"),
      onlyB: benchB.filter((u) => !byIdA.has(u.worldCardId) || byIdA.get(u.worldCardId)!.area !== "bench"),
      aCount: benchA.length,
      bCount: benchB.length,
      orderChanged: benchOrderA !== benchOrderB,
      starterToBench,
      benchToStarter,
    },
    managerComparison,
    captainComparison,
    setPieceComparison,
    linkUpComparison,
    buildComparison,
    boosterComparison,
    metricComparison,
    categoryComparison,
    skillComparison,
    suitabilityComparison,
    warningComparison,
    dataAvailability: { aFailed: failedRefs(a), bFailed: failedRefs(b) },
    metricsNotes: [
      "カテゴリ平均・平均OVR は単純平均です（加重平均ではありません）。",
      "eFootball の公式チームパワー・カテゴリ重みとは異なります。",
      "ポジション別 OVR ではありません（配置ロールを変えても表示OVRは変わりません）。",
      "Power of Many（金色）のユーザー指定値は標準平均に含めていません（別枠表示のみ）。",
      "外部照合済み・固定型推定のブースターは「固定型と推定して」標準値へ暫定適用しています（確認済み固定型ではありません）。",
      "監督ブースターの適用順序（育成前 / 育成後）は未確認です。",
      "未解決ブースター（対応表に無い ID）は能力値へ加算していません。",
      "選手情報を取得できなかったカードは平均・スキル集計から除外されます。",
    ],
  };
}
