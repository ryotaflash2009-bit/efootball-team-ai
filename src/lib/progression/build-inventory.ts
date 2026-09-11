import type { SavedBuild } from "./types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import type { MyTeamRecord } from "@/lib/user-cards/types";
import type { StoredSquad } from "@/lib/squad/types";
import { getFormation } from "@/lib/squad/formations";
import {
  buildHasExperimental,
  buildTimeValue,
  describeBuildPoM,
  normalizeBuildSearchQuery,
  resolveBuildRuleStatus,
} from "./my-builds";

/**
 * 保存ビルド棚卸し（/build-inventory）の横断ロジック（純関数のみ・localStorage / fetch / SQLite を触らない）。
 *
 * - 入力は既存の `SavedBuild[]` / `MyTeamRecord[]` / `StoredSquad[]` と解決済みカード Map。
 * - 参照（My Team selectedBuildId / favoriteBuildId・スカッド先発/ベンチ savedBuildId）を分類し、
 *   正常参照だけを「使用中」に数える。削除済み・worldCardId 不一致・不正 buildId・不明は別枠。
 * - 表示専用: **何も保存しない・自動修復しない・別ビルドへフォールバックしない**。
 * - worldCardId / buildId は文字列として扱う（Number 変換しない）。
 */

const BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;

// ---------------------------------------------------------------------------
// 参照
// ---------------------------------------------------------------------------

export type BuildReferenceSource =
  | { kind: "my-team-selected"; teamCardId: string; worldCardId: string }
  | { kind: "my-team-favorite"; teamCardId: string; worldCardId: string }
  | { kind: "squad-starter"; squadId: string; squadName: string; slotId: string; slotLabel: string; worldCardId: string }
  | { kind: "squad-bench"; squadId: string; squadName: string; subId: string; slotLabel: string; worldCardId: string };

export type BuildReferenceKind = BuildReferenceSource["kind"];

export type BuildReferenceStatus =
  | "ok"
  | "missing" // buildId は保存されているが対応する保存ビルドが存在しない
  | "world-card-mismatch" // 保存ビルドは存在するが worldCardId が参照元と一致しない
  | "invalid-build-id" // 既存の buildId 形式を満たさない
  | "unknown"; // 安全に分類できない（参照元 worldCardId が不正など）

export interface RawBuildReference {
  buildId: string;
  source: BuildReferenceSource;
  /** 参照元カードの worldCardId。 */
  refWorldCardId: string;
}

export type BuildReference =
  | (RawBuildReference & { status: "ok"; build: SavedBuild })
  | (RawBuildReference & { status: Exclude<BuildReferenceStatus, "ok">; build: null });

/** My Team レコードとスカッドから、null でない savedBuildId 参照をすべて集める（分類前）。 */
export function collectBuildReferences(
  myTeam: MyTeamRecord[],
  squads: StoredSquad[],
): RawBuildReference[] {
  const out: RawBuildReference[] = [];
  for (const rec of myTeam) {
    if (typeof rec.selectedBuildId === "string" && rec.selectedBuildId) {
      out.push({
        buildId: rec.selectedBuildId,
        source: { kind: "my-team-selected", teamCardId: rec.teamCardId, worldCardId: rec.worldCardId },
        refWorldCardId: rec.worldCardId,
      });
    }
    if (typeof rec.favoriteBuildId === "string" && rec.favoriteBuildId) {
      out.push({
        buildId: rec.favoriteBuildId,
        source: { kind: "my-team-favorite", teamCardId: rec.teamCardId, worldCardId: rec.worldCardId },
        refWorldCardId: rec.worldCardId,
      });
    }
  }
  for (const sq of squads) {
    const posBySlot = new Map(getFormation(sq.formationId).slots.map((s) => [s.slotId, s.position]));
    for (const sl of sq.slots) {
      if (!sl.worldCardId || !sl.savedBuildId) continue;
      out.push({
        buildId: sl.savedBuildId,
        source: {
          kind: "squad-starter",
          squadId: sq.squadId,
          squadName: sq.squadName,
          slotId: sl.slotId,
          slotLabel: posBySlot.get(sl.slotId) ?? "先発",
          worldCardId: sl.worldCardId,
        },
        refWorldCardId: sl.worldCardId,
      });
    }
    sq.substitutes.forEach((sub, i) => {
      if (!sub.worldCardId || !sub.savedBuildId) return;
      out.push({
        buildId: sub.savedBuildId,
        source: {
          kind: "squad-bench",
          squadId: sq.squadId,
          squadName: sq.squadName,
          subId: sub.subId,
          slotLabel: `ベンチ ${i + 1}`,
          worldCardId: sub.worldCardId,
        },
        refWorldCardId: sub.worldCardId,
      });
    });
  }
  return out;
}

/** 1 参照を分類する（純関数）。未設定は呼び出し側で除外済み。 */
export function classifyBuildReference(
  raw: RawBuildReference,
  buildsById: Map<string, SavedBuild>,
): BuildReference {
  if (typeof raw.buildId !== "string" || !BUILD_ID_RE.test(raw.buildId)) {
    return { ...raw, status: "invalid-build-id", build: null };
  }
  const build = buildsById.get(raw.buildId) ?? null;
  if (!build) return { ...raw, status: "missing", build: null };
  if (typeof raw.refWorldCardId !== "string" || !WORLD_CARD_ID_RE.test(raw.refWorldCardId)) {
    return { ...raw, status: "unknown", build: null };
  }
  if (build.worldCardId !== raw.refWorldCardId) {
    return { ...raw, status: "world-card-mismatch", build: null };
  }
  return { ...raw, status: "ok", build };
}

// ---------------------------------------------------------------------------
// 棚卸しモデル
// ---------------------------------------------------------------------------

export type BuildRuleKind = "current" | "legacy" | "unknown";

export interface InventorySquadRef {
  squadId: string;
  squadName: string;
  starterSlots: number;
  benchSlots: number;
}

export interface BuildInventoryItem {
  build: SavedBuild;
  card: WorldPlayerListItem | null;
  ruleKind: BuildRuleKind;
  ruleLabel: string;
  pom: boolean;
  experimental: boolean;
  /** この保存ビルドを正常参照している参照。 */
  references: BuildReference[];
  /** references.length（各参照を 1 件と数える）。 */
  refCount: number;
  used: boolean;
  myTeamSelectedCount: number;
  myTeamFavoriteCount: number;
  /** スカッドの枠参照数（枠単位）。 */
  squadRefCount: number;
  /** 参照しているスカッド（squadId 単位で重複除去・先発/ベンチ枠数）。 */
  squads: InventorySquadRef[];
  /** 参照が 2 件以上。 */
  multiUse: boolean;
  /** この保存ビルドを worldCardId 不一致で参照している件数。 */
  mismatchRefCount: number;
}

export interface BuildInventoryIssue {
  kind: Exclude<BuildReferenceStatus, "ok">;
  source: BuildReferenceSource;
  /** 参照元が保持している buildId（invalid でも保持）。 */
  buildId: string;
  /** 参照元カードの worldCardId。 */
  refWorldCardId: string;
  /** world-card-mismatch のとき、実在する保存ビルドの worldCardId。 */
  buildWorldCardId: string | null;
  description: string;
}

export interface BuildInventorySummary {
  /** ビルド単位。 */
  totalBuilds: number;
  usedBuilds: number;
  unusedBuilds: number;
  multiUseBuilds: number;
  currentRulesBuilds: number;
  legacyRulesBuilds: number;
  unknownRulesBuilds: number;
  pomBuilds: number;
  experimentalBuilds: number;
  /** 参照件数（正常参照）。 */
  myTeamSelectedRefs: number;
  myTeamFavoriteRefs: number;
  squadRefs: number;
  /** 問題参照件数。 */
  missingMyTeamRefs: number;
  missingSquadRefs: number;
  worldCardMismatchRefs: number;
  invalidBuildIdRefs: number;
  unknownRefs: number;
}

export interface BuildInventory {
  items: BuildInventoryItem[];
  issues: BuildInventoryIssue[];
  summary: BuildInventorySummary;
  cardTypes: string[];
  positions: string[];
}

const KIND_LABEL: Record<BuildReferenceKind, string> = {
  "my-team-selected": "My Team の選択中ビルド",
  "my-team-favorite": "My Team のお気に入りビルド",
  "squad-starter": "スカッド（先発）",
  "squad-bench": "スカッド（ベンチ）",
};

function describeIssue(issue: BuildInventoryIssue): string {
  const where = KIND_LABEL[issue.source.kind];
  switch (issue.kind) {
    case "missing":
      return `${where} が、存在しない保存ビルド（buildId ${issue.buildId}）を参照しています。`;
    case "world-card-mismatch":
      return `${where} が参照する保存ビルドの worldCardId（${issue.buildWorldCardId}）が、参照元カード（${issue.refWorldCardId}）と一致しません。`;
    case "invalid-build-id":
      return `${where} が保持する保存ビルド ID（${issue.buildId}）が不正な形式です。`;
    case "unknown":
      return `${where} の参照を安全に分類できません（参照元 worldCardId ${issue.refWorldCardId}）。`;
  }
}

/**
 * 保存ビルド棚卸しの全体モデルを構築する（純関数）。
 * @param builds  build-storage の全保存ビルド（listAllBuilds）
 * @param myTeam  My Team レコード一覧
 * @param squads  スカッド一覧（normalize 済み）
 * @param cards   worldCardId → カード要約（解決できたもののみ）
 */
export function buildInventory(
  builds: SavedBuild[],
  myTeam: MyTeamRecord[],
  squads: StoredSquad[],
  cards: Map<string, WorldPlayerListItem>,
): BuildInventory {
  const buildsById = new Map(builds.map((b) => [b.buildId, b]));
  const classified = collectBuildReferences(myTeam, squads).map((r) => classifyBuildReference(r, buildsById));

  const okRefsByBuild = new Map<string, BuildReference[]>();
  const mismatchCountByBuild = new Map<string, number>();
  const issues: BuildInventoryIssue[] = [];
  for (const ref of classified) {
    if (ref.status === "ok") {
      const list = okRefsByBuild.get(ref.build.buildId) ?? [];
      list.push(ref);
      okRefsByBuild.set(ref.build.buildId, list);
      continue;
    }
    const resolved = buildsById.get(ref.buildId) ?? null;
    if (ref.status === "world-card-mismatch" && resolved) {
      mismatchCountByBuild.set(resolved.buildId, (mismatchCountByBuild.get(resolved.buildId) ?? 0) + 1);
    }
    const issue: BuildInventoryIssue = {
      kind: ref.status,
      source: ref.source,
      buildId: ref.buildId,
      refWorldCardId: ref.refWorldCardId,
      buildWorldCardId: resolved?.worldCardId ?? null,
      description: "",
    };
    issue.description = describeIssue(issue);
    issues.push(issue);
  }

  const items: BuildInventoryItem[] = builds.map((build) => {
    const refs = okRefsByBuild.get(build.buildId) ?? [];
    const rs = resolveBuildRuleStatus(build.rulesVersion);
    const ruleKind: BuildRuleKind = rs.isV2 ? "current" : rs.isLegacy ? "legacy" : "unknown";

    const bySquad = new Map<string, InventorySquadRef>();
    for (const r of refs) {
      if (r.source.kind !== "squad-starter" && r.source.kind !== "squad-bench") continue;
      const e =
        bySquad.get(r.source.squadId) ??
        { squadId: r.source.squadId, squadName: r.source.squadName, starterSlots: 0, benchSlots: 0 };
      if (r.source.kind === "squad-starter") e.starterSlots += 1;
      else e.benchSlots += 1;
      bySquad.set(r.source.squadId, e);
    }

    return {
      build,
      card: cards.get(build.worldCardId) ?? null,
      ruleKind,
      ruleLabel: rs.label,
      pom: describeBuildPoM(build).has,
      experimental: buildHasExperimental(build),
      references: refs,
      refCount: refs.length,
      used: refs.length > 0,
      myTeamSelectedCount: refs.filter((r) => r.source.kind === "my-team-selected").length,
      myTeamFavoriteCount: refs.filter((r) => r.source.kind === "my-team-favorite").length,
      squadRefCount: refs.filter((r) => r.source.kind === "squad-starter" || r.source.kind === "squad-bench").length,
      squads: [...bySquad.values()],
      multiUse: refs.length >= 2,
      mismatchRefCount: mismatchCountByBuild.get(build.buildId) ?? 0,
    };
  });

  const cardTypes = new Set<string>();
  const positions = new Set<string>();
  for (const it of items) {
    if (it.card?.cardType) cardTypes.add(it.card.cardType);
    if (it.card?.registeredPosition) positions.add(it.card.registeredPosition);
  }

  const okKind = (k: BuildReferenceKind) => classified.filter((c) => c.status === "ok" && c.source.kind === k).length;

  const summary: BuildInventorySummary = {
    totalBuilds: builds.length,
    usedBuilds: items.filter((i) => i.used).length,
    unusedBuilds: items.filter((i) => !i.used).length,
    multiUseBuilds: items.filter((i) => i.multiUse).length,
    currentRulesBuilds: items.filter((i) => i.ruleKind === "current").length,
    legacyRulesBuilds: items.filter((i) => i.ruleKind === "legacy").length,
    unknownRulesBuilds: items.filter((i) => i.ruleKind === "unknown").length,
    pomBuilds: items.filter((i) => i.pom).length,
    experimentalBuilds: items.filter((i) => i.experimental).length,
    myTeamSelectedRefs: okKind("my-team-selected"),
    myTeamFavoriteRefs: okKind("my-team-favorite"),
    squadRefs: okKind("squad-starter") + okKind("squad-bench"),
    missingMyTeamRefs: issues.filter(
      (x) => x.kind === "missing" && (x.source.kind === "my-team-selected" || x.source.kind === "my-team-favorite"),
    ).length,
    missingSquadRefs: issues.filter(
      (x) => x.kind === "missing" && (x.source.kind === "squad-starter" || x.source.kind === "squad-bench"),
    ).length,
    worldCardMismatchRefs: issues.filter((x) => x.kind === "world-card-mismatch").length,
    invalidBuildIdRefs: issues.filter((x) => x.kind === "invalid-build-id").length,
    unknownRefs: issues.filter((x) => x.kind === "unknown").length,
  };

  return { items, issues, summary, cardTypes: [...cardTypes].sort(), positions: [...positions].sort() };
}

// ---------------------------------------------------------------------------
// 検索・絞り込み・並び替え
// ---------------------------------------------------------------------------

export interface BuildInventoryFilter {
  q: string;
  usage: "all" | "used" | "unused";
  myTeamSelected: boolean;
  myTeamFavorite: boolean;
  squad: boolean;
  multiUse: boolean;
  rules: "all" | "current" | "legacy" | "unknown";
  pom: boolean;
  experimental: boolean;
  problemRef: boolean;
  cardType: string | null;
  position: string | null;
}

export const DEFAULT_BUILD_INVENTORY_FILTER: BuildInventoryFilter = {
  q: "",
  usage: "all",
  myTeamSelected: false,
  myTeamFavorite: false,
  squad: false,
  multiUse: false,
  rules: "all",
  pom: false,
  experimental: false,
  problemRef: false,
  cardType: null,
  position: null,
};

export type BuildInventorySortKey =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "player_asc"
  | "name_asc"
  | "refs_desc"
  | "refs_asc"
  | "problem_first"
  | "unused_first";

export const BUILD_INVENTORY_SORT_KEYS: BuildInventorySortKey[] = [
  "updated_desc",
  "updated_asc",
  "created_desc",
  "player_asc",
  "name_asc",
  "refs_desc",
  "refs_asc",
  "problem_first",
  "unused_first",
];

/** 検索クエリの正規化（既存 `normalizeBuildSearchQuery` を再利用・正規表現評価しない）。 */
export function normalizeInventorySearch(raw: unknown): string {
  return normalizeBuildSearchQuery(raw);
}

function inventoryHaystack(item: BuildInventoryItem): string {
  const squadNames = item.squads.map((s) => s.squadName).join(" ");
  return [
    item.build.buildName,
    item.build.buildId,
    item.build.worldCardId,
    item.card?.nameJa ?? "",
    item.card?.nameEn ?? "",
    squadNames,
  ]
    .join("  ")
    .toLowerCase();
}

export function filterBuildInventory(
  items: BuildInventoryItem[],
  filter: BuildInventoryFilter,
): BuildInventoryItem[] {
  const nq = normalizeInventorySearch(filter.q);
  return items.filter((it) => {
    if (nq) {
      const hay = inventoryHaystack(it);
      if (!nq.split(" ").every((tok) => tok === "" || hay.includes(tok))) return false;
    }
    if (filter.usage === "used" && !it.used) return false;
    if (filter.usage === "unused" && it.used) return false;
    if (filter.myTeamSelected && it.myTeamSelectedCount === 0) return false;
    if (filter.myTeamFavorite && it.myTeamFavoriteCount === 0) return false;
    if (filter.squad && it.squadRefCount === 0) return false;
    if (filter.multiUse && !it.multiUse) return false;
    if (filter.rules !== "all" && it.ruleKind !== filter.rules) return false;
    if (filter.pom && !it.pom) return false;
    if (filter.experimental && !it.experimental) return false;
    if (filter.problemRef && it.mismatchRefCount === 0) return false;
    if (filter.cardType && (it.card?.cardType ?? null) !== filter.cardType) return false;
    if (filter.position && (it.card?.registeredPosition ?? null) !== filter.position) return false;
    return true;
  });
}

function playerName(item: BuildInventoryItem): string {
  return (item.card?.nameJa || item.card?.nameEn || item.build.worldCardId).toLowerCase();
}

/** 並び替え（同キーは buildId で安定化・不正日時は末尾・非破壊）。 */
export function sortBuildInventory(
  items: BuildInventoryItem[],
  key: BuildInventorySortKey,
): BuildInventoryItem[] {
  const arr = items.slice();
  const byId = (a: BuildInventoryItem, b: BuildInventoryItem) => a.build.buildId.localeCompare(b.build.buildId);
  const cmpTime = (a: number | null, b: number | null, desc: boolean): number => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return desc ? b - a : a - b;
  };
  arr.sort((a, b) => {
    let r = 0;
    switch (key) {
      case "updated_desc":
        r = cmpTime(buildTimeValue(a.build.updatedAt), buildTimeValue(b.build.updatedAt), true);
        break;
      case "updated_asc":
        r = cmpTime(buildTimeValue(a.build.updatedAt), buildTimeValue(b.build.updatedAt), false);
        break;
      case "created_desc":
        r = cmpTime(buildTimeValue(a.build.createdAt), buildTimeValue(b.build.createdAt), true);
        break;
      case "player_asc":
        r = playerName(a).localeCompare(playerName(b), "ja");
        break;
      case "name_asc":
        r = a.build.buildName.localeCompare(b.build.buildName, "ja");
        break;
      case "refs_desc":
        r = b.refCount - a.refCount;
        break;
      case "refs_asc":
        r = a.refCount - b.refCount;
        break;
      case "problem_first":
        r = (b.mismatchRefCount > 0 ? 1 : 0) - (a.mismatchRefCount > 0 ? 1 : 0);
        if (r === 0) r = cmpTime(buildTimeValue(a.build.updatedAt), buildTimeValue(b.build.updatedAt), true);
        break;
      case "unused_first":
        r = (a.used ? 1 : 0) - (b.used ? 1 : 0);
        if (r === 0) r = cmpTime(buildTimeValue(a.build.updatedAt), buildTimeValue(b.build.updatedAt), true);
        break;
    }
    return r !== 0 ? r : byId(a, b);
  });
  return arr;
}

/** 問題参照一覧のフィルター（種類）。 */
export type IssueFilterKind = "all" | Exclude<BuildReferenceStatus, "ok">;

export function filterBuildInventoryIssues(
  issues: BuildInventoryIssue[],
  kind: IssueFilterKind,
  query: string,
): BuildInventoryIssue[] {
  const nq = normalizeInventorySearch(query);
  return issues.filter((x) => {
    if (kind !== "all" && x.kind !== kind) return false;
    if (!nq) return true;
    const parts = [x.buildId, x.refWorldCardId, x.buildWorldCardId ?? "", x.description];
    if (x.source.kind === "squad-starter" || x.source.kind === "squad-bench") {
      parts.push(x.source.squadName, x.source.squadId);
    }
    const hay = parts.join("  ").toLowerCase();
    return nq.split(" ").every((tok) => tok === "" || hay.includes(tok));
  });
}

// ---------------------------------------------------------------------------
// 旧規則ビルド確認ガイド（既存 buildInventory 結果から旧規則のみ抽出・表示専用）
// ---------------------------------------------------------------------------

export interface LegacyBuildSummary {
  /** 旧規則（isLegacy）と判定された保存ビルド数（ビルド単位）。 */
  total: number;
  /** うち正常参照が 1 件以上あるもの（ビルド単位）。 */
  used: number;
  /** うち正常参照が 0 件のもの（ビルド単位）。 */
  unused: number;
  /** My Team の selectedBuildId から旧規則ビルドを指している正常参照件数（件）。 */
  myTeamSelectedRefs: number;
  /** My Team の favoriteBuildId から旧規則ビルドを指している正常参照件数（件）。 */
  myTeamFavoriteRefs: number;
  /** スカッドの savedBuildId（先発+ベンチ）から旧規則ビルドを指している正常参照件数（枠）。 */
  squadRefs: number;
  /** 複数箇所（正常参照 2 件以上）で使われている旧規則ビルド数（ビルド単位）。 */
  multiUse: number;
  /** Power of Many 指定がある旧規則ビルド数（ビルド単位）。 */
  pom: number;
  /** 実験的試算がある旧規則ビルド数（ビルド単位）。 */
  experimental: number;
  /** worldCardId 不一致で参照されている旧規則ビルド数（ビルド単位）。 */
  withProblemRef: number;
}

/**
 * 既に構築済みの `BuildInventoryItem[]` から**旧規則（`ruleKind === "legacy"`）のみ**を抽出して集計する。
 * - 規則不明（`"unknown"`）・現行規則（`"current"`）は含めない。
 * - `ruleKind` は `resolveBuildRuleStatus` / `isLegacyRulesVersion` の判定に従う（見た目や保存日時で判定しない）。
 * - `rulesVersion` や保存データを一切変更しない（純関数・非破壊）。
 */
export function summarizeLegacyBuilds(items: BuildInventoryItem[]): LegacyBuildSummary {
  const legacy = (Array.isArray(items) ? items : []).filter((i) => i.ruleKind === "legacy");
  return {
    total: legacy.length,
    used: legacy.filter((i) => i.used).length,
    unused: legacy.filter((i) => !i.used).length,
    myTeamSelectedRefs: legacy.reduce((s, i) => s + i.myTeamSelectedCount, 0),
    myTeamFavoriteRefs: legacy.reduce((s, i) => s + i.myTeamFavoriteCount, 0),
    squadRefs: legacy.reduce((s, i) => s + i.squadRefCount, 0),
    multiUse: legacy.filter((i) => i.multiUse).length,
    pom: legacy.filter((i) => i.pom).length,
    experimental: legacy.filter((i) => i.experimental).length,
    withProblemRef: legacy.filter((i) => i.mismatchRefCount > 0).length,
  };
}

/** 「旧規則ビルドだけを表示」用のフィルター（既存フィルター状態は破棄して rules=legacy のみ）。 */
export function legacyOnlyFilter(): BuildInventoryFilter {
  return { ...DEFAULT_BUILD_INVENTORY_FILTER, rules: "legacy" };
}

// ---------------------------------------------------------------------------
// 個別ビルド分析（「このビルドを分析」）の選択状態
// ---------------------------------------------------------------------------

/**
 * 検索・絞り込みで分析対象のビルドが現在の一覧結果から外れた場合、
 * 見えないまま分析対象を保持し続けず、選択を解除する（純関数）。
 * `visibleItems` に `analyzingBuildId` が含まれていれば維持し、含まれなければ `null` を返す。
 */
export function resolveAnalyzingBuildId(
  analyzingBuildId: string | null,
  visibleItems: BuildInventoryItem[],
): string | null {
  if (analyzingBuildId == null) return null;
  const stillVisible = visibleItems.some((i) => i.build.buildId === analyzingBuildId);
  return stillVisible ? analyzingBuildId : null;
}
