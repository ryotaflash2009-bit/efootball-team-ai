import type { SavedBuild } from "./types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { PROGRESSION_GROUPS } from "./stat-groups";
import { groupLabelJa } from "@/lib/world/stat-labels";
import {
  getRuleset,
  isLegacyRulesVersion,
  isV2RulesVersion,
  normalizeRulesVersion,
} from "./progression-rules";
import type { SquadUsage } from "@/lib/squad/usage";
import {
  OWNERSHIP_STATUSES,
  USAGE_STATUSES,
  type MyTeamRecord,
  type OwnershipStatus,
  type UsageStatus,
} from "@/lib/user-cards/types";

/**
 * My Builds 画面の表示・検索・整合性ロジック（純関数のみ・localStorage / fetch を触らない）。
 *
 * - 既存 build-storage（`SavedBuild`）を単一の真実源として使う。My Builds 専用の保存形式は作らない。
 * - 配分表示は既存 `groupLabelJa` / `PROGRESSION_GROUPS`、ポイントは rulesVersion のルールセット。
 * - buildMode は SavedBuild に存在しないため扱わない（推測でラベルを作らない）。
 * - worldCardId / buildId は文字列として扱う（Number 変換しない）。
 */

// ---------------------------------------------------------------------------
// 配分表示
// ---------------------------------------------------------------------------

export interface BuildAllocationRow {
  groupId: string;
  label: string;
  level: number;
}

/** 10 育成カテゴリを PROGRESSION_GROUPS の順で。level 0 も含む（表示側で折りたたむ）。 */
export function buildAllocationRows(allocation: Record<string, number> | null | undefined): BuildAllocationRow[] {
  const a = allocation ?? {};
  return PROGRESSION_GROUPS.map((g) => {
    const v = a[g.groupId];
    return {
      groupId: g.groupId,
      label: groupLabelJa(g.groupId),
      level: typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// ポイント集計（rulesVersion のルールセットで算出）
// ---------------------------------------------------------------------------

export interface BuildPointSummary {
  usedPoints: number;
  /** maximumLevel が分からないと合計は出せない → null。0 で代用しない。 */
  totalPoints: number | null;
  remainingPoints: number | null;
  overAllocated: boolean | null;
}

export function buildPointSummary(
  build: SavedBuild,
  maximumLevel: number | null | undefined,
): BuildPointSummary {
  const ruleset = getRuleset(build.rulesVersion);
  let used = 0;
  for (const v of Object.values(build.progressionAllocation ?? {})) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      used += ruleset.cumulativeCost(Math.trunc(v));
    }
  }
  const hasLevel = typeof maximumLevel === "number" && Number.isFinite(maximumLevel);
  const total = hasLevel ? ruleset.totalPoints(maximumLevel) : null;
  return {
    usedPoints: used,
    totalPoints: total,
    remainingPoints: total == null ? null : total - used,
    overAllocated: total == null ? null : used > total,
  };
}

// ---------------------------------------------------------------------------
// 規則バージョン
// ---------------------------------------------------------------------------

export interface BuildRuleStatus {
  isV2: boolean;
  isLegacy: boolean;
  normalized: string;
  label: string;
}

export function resolveBuildRuleStatus(rulesVersion: string | null | undefined): BuildRuleStatus {
  const isV2 = isV2RulesVersion(rulesVersion);
  const isLegacy = isLegacyRulesVersion(rulesVersion);
  return {
    isV2,
    isLegacy,
    normalized: normalizeRulesVersion(rulesVersion),
    label: isV2 ? "現行規則" : isLegacy ? "旧規則" : "規則不明",
  };
}

// ---------------------------------------------------------------------------
// Power of Many ユーザー指定 / 実験的設定
// ---------------------------------------------------------------------------

const POM_TIER_LABEL: Record<string, string> = {
  league_1_13: "+1",
  league_14_19: "+2",
  league_20_plus: "+3",
};

export interface BuildPoM {
  has: boolean;
  tierLabel: string | null;
  boosterKey: string | null;
}

/** 保存ビルドに残っている Power of Many のユーザー指定段階（none / 未指定は has:false）。 */
export function describeBuildPoM(build: SavedBuild): BuildPoM {
  const sel = (build.conditionalBoosterSelections ?? []).find(
    (s) => s && typeof s.selection === "string" && s.selection !== "none",
  );
  if (!sel) return { has: false, tierLabel: null, boosterKey: null };
  return {
    has: true,
    tierLabel: POM_TIER_LABEL[sel.selection] ?? "指定あり",
    boosterKey: typeof sel.boosterKey === "string" ? sel.boosterKey : null,
  };
}

/** 実験的設定 = このカード限定の選手ブースター試算（保存ビルド仕様では selectedPlayerBooster のみ）。 */
export function buildHasExperimental(build: SavedBuild): boolean {
  return typeof build.selectedPlayerBooster === "number" && Number.isFinite(build.selectedPlayerBooster);
}

// ---------------------------------------------------------------------------
// 日時
// ---------------------------------------------------------------------------

/** 表示用の日時。不正な日時は「—」（現在時刻で代用しない）。 */
export function formatBuildTimestamp(iso: string | null | undefined): string {
  const t = buildTimeValue(iso);
  if (t == null) return "—";
  try {
    return new Date(t).toLocaleString("ja-JP", { hour12: false });
  } catch {
    return "—";
  }
}

/** 並び替え用の数値。不正なら null。 */
export function buildTimeValue(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || iso === "") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

// ---------------------------------------------------------------------------
// 名前変更 / 複製名
// ---------------------------------------------------------------------------

function stripControl(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (!(c <= 0x1f || c === 0x7f || (c >= 0x80 && c <= 0x9f))) out += ch;
  }
  return out;
}

export type RenameValidation = { ok: true; name: string } | { ok: false; error: string };

/** ビルド名の検証（trim・制御文字除去・改行拒否・1〜60文字）。 */
export function validateBuildRename(raw: unknown): RenameValidation {
  if (typeof raw !== "string") return { ok: false, error: "名前が不正です" };
  if (/[\r\n]/.test(raw)) return { ok: false, error: "改行は使えません" };
  const cleaned = stripControl(raw).replace(/\s+/g, " ").trim();
  if (!cleaned) return { ok: false, error: "ビルド名を入力してください（1〜60文字）" };
  if (cleaned.length > 60) return { ok: false, error: "ビルド名は60文字までです" };
  return { ok: true, name: cleaned };
}

/** 複製時の既定名（{元名} のコピー / のコピー 2 …）。名前は主キーではないので衝突は許容だが見やすさ優先。 */
export function nextDuplicateBuildName(sourceName: string, takenNames: Iterable<string>): string {
  const taken = new Set<string>();
  for (const n of takenNames) if (typeof n === "string") taken.add(n);
  const base = `${sourceName} のコピー`.slice(0, 60);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const n = `${base} ${i}`.slice(0, 60);
    if (!taken.has(n)) return n;
  }
  return base;
}

// ---------------------------------------------------------------------------
// 検索
// ---------------------------------------------------------------------------

/** 検索クエリの正規化（制御文字除去・trim・小文字化・空白圧縮）。正規表現としては使わない。 */
export function normalizeBuildSearchQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return stripControl(raw).replace(/\s+/g, " ").trim().toLowerCase();
}

export function buildSearchHaystack(build: SavedBuild, card: WorldPlayerListItem | null): string {
  return [
    build.buildName,
    build.buildId,
    build.worldCardId,
    card?.nameJa ?? "",
    card?.nameEn ?? "",
  ]
    .join("  ")
    .toLowerCase();
}

/** 全トークン（空白区切り）が haystack に部分一致するか。空クエリは常に true。 */
export function matchesBuildSearch(
  build: SavedBuild,
  card: WorldPlayerListItem | null,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  const hay = buildSearchHaystack(build, card);
  return normalizedQuery.split(" ").every((tok) => tok === "" || hay.includes(tok));
}

// ---------------------------------------------------------------------------
// 絞り込み・並び替え
// ---------------------------------------------------------------------------

export type BuildSortKey =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "player_asc";

export const BUILD_SORT_KEYS: BuildSortKey[] = [
  "updated_desc",
  "updated_asc",
  "created_desc",
  "created_asc",
  "name_asc",
  "player_asc",
];

export interface BuildFilterState {
  q: string;
  cardType: string | null;
  position: string | null;
  rules: "all" | "current" | "legacy";
  pom: "all" | "with";
  experimental: "all" | "with";
  usage: "all" | "used" | "unused";
}

export const DEFAULT_BUILD_FILTER: BuildFilterState = {
  q: "",
  cardType: null,
  position: null,
  rules: "all",
  pom: "all",
  experimental: "all",
  usage: "all",
};

export interface BuildFilterInput {
  cards: Map<string, WorldPlayerListItem>;
  filter: BuildFilterState;
  /** 使用中（My Team 選択 / お気に入り / スカッド参照）の buildId。usage フィルタ用。 */
  usedBuildIds: Set<string>;
}

export function filterBuilds(builds: SavedBuild[], input: BuildFilterInput): SavedBuild[] {
  const nq = normalizeBuildSearchQuery(input.filter.q);
  const f = input.filter;
  return builds.filter((b) => {
    const card = input.cards.get(b.worldCardId) ?? null;
    if (!matchesBuildSearch(b, card, nq)) return false;
    if (f.cardType && (card?.cardType ?? null) !== f.cardType) return false;
    if (f.position && (card?.registeredPosition ?? null) !== f.position) return false;
    if (f.rules === "current" && !isV2RulesVersion(b.rulesVersion)) return false;
    if (f.rules === "legacy" && !isLegacyRulesVersion(b.rulesVersion)) return false;
    if (f.pom === "with" && !describeBuildPoM(b).has) return false;
    if (f.experimental === "with" && !buildHasExperimental(b)) return false;
    if (f.usage === "used" && !input.usedBuildIds.has(b.buildId)) return false;
    if (f.usage === "unused" && input.usedBuildIds.has(b.buildId)) return false;
    return true;
  });
}

function playerNameForSort(build: SavedBuild, cards: Map<string, WorldPlayerListItem>): string {
  const c = cards.get(build.worldCardId);
  return (c?.nameJa || c?.nameEn || build.worldCardId).toLowerCase();
}

/** 並び替え（同キーは buildId で安定化。不正日時は末尾）。 */
export function sortBuilds(
  builds: SavedBuild[],
  cards: Map<string, WorldPlayerListItem>,
  key: BuildSortKey,
): SavedBuild[] {
  const arr = builds.slice();
  const byId = (a: SavedBuild, b: SavedBuild) => a.buildId.localeCompare(b.buildId);
  const cmpTime = (a: number | null, b: number | null, desc: boolean): number => {
    if (a == null && b == null) return 0;
    if (a == null) return 1; // 不正は常に末尾
    if (b == null) return -1;
    return desc ? b - a : a - b;
  };
  arr.sort((a, b) => {
    let r = 0;
    switch (key) {
      case "updated_desc":
        r = cmpTime(buildTimeValue(a.updatedAt), buildTimeValue(b.updatedAt), true);
        break;
      case "updated_asc":
        r = cmpTime(buildTimeValue(a.updatedAt), buildTimeValue(b.updatedAt), false);
        break;
      case "created_desc":
        r = cmpTime(buildTimeValue(a.createdAt), buildTimeValue(b.createdAt), true);
        break;
      case "created_asc":
        r = cmpTime(buildTimeValue(a.createdAt), buildTimeValue(b.createdAt), false);
        break;
      case "name_asc":
        r = a.buildName.localeCompare(b.buildName, "ja");
        break;
      case "player_asc":
        r = playerNameForSort(a, cards).localeCompare(playerNameForSort(b, cards), "ja");
        break;
    }
    return r !== 0 ? r : byId(a, b);
  });
  return arr;
}

/** 絞り込み UI の選択肢（今あるビルドとカードから生成・既知値だけ）。 */
export function buildFacets(
  builds: SavedBuild[],
  cards: Map<string, WorldPlayerListItem>,
): { cardTypes: string[]; positions: string[] } {
  const cardTypes = new Set<string>();
  const positions = new Set<string>();
  for (const b of builds) {
    const c = cards.get(b.worldCardId);
    if (c?.cardType) cardTypes.add(c.cardType);
    if (c?.registeredPosition) positions.add(c.registeredPosition);
  }
  return {
    cardTypes: [...cardTypes].sort(),
    positions: [...positions].sort(),
  };
}

// ---------------------------------------------------------------------------
// 使用状況（削除前の影響確認）
// ---------------------------------------------------------------------------

export interface BuildUsageSquadRef {
  squadId: string;
  squadName: string;
  areas: string[];
}

export interface BuildUsageSummary {
  myTeamSelected: boolean;
  myTeamFavorite: boolean;
  squads: BuildUsageSquadRef[];
  anyUsage: boolean;
}

export interface BuildUsageInput {
  myTeam: MyTeamRecord[];
  /** そのカードのスカッド横断使用（findSquadUsageByWorldCardId の結果）。 */
  squadUsage: SquadUsage[];
}

/** ある buildId がどこから参照されているか（既存ヘルパーの結果を渡す・新しい索引は作らない）。 */
export function buildUsageSummary(build: SavedBuild, input: BuildUsageInput): BuildUsageSummary {
  const rec = input.myTeam.find((r) => r.worldCardId === build.worldCardId) ?? null;
  const myTeamSelected = rec?.selectedBuildId === build.buildId;
  const myTeamFavorite = rec?.favoriteBuildId === build.buildId;

  const bySquad = new Map<string, BuildUsageSquadRef>();
  for (const u of input.squadUsage) {
    if (u.savedBuildId !== build.buildId) continue;
    const area = u.area === "starter" ? `先発${u.placementRole ? `（${u.placementRole}）` : ""}` : "ベンチ";
    const ref = bySquad.get(u.squadId);
    if (ref) {
      if (!ref.areas.includes(area)) ref.areas.push(area);
    } else {
      bySquad.set(u.squadId, { squadId: u.squadId, squadName: u.squadName, areas: [area] });
    }
  }
  const squads = [...bySquad.values()];
  return {
    myTeamSelected,
    myTeamFavorite,
    squads,
    anyUsage: myTeamSelected || myTeamFavorite || squads.length > 0,
  };
}

/** 使用中の buildId 一覧（usage フィルタ用・全ビルド分をまとめて計算）。 */
export function collectUsedBuildIds(
  builds: SavedBuild[],
  myTeam: MyTeamRecord[],
  squadUsageByCard: Map<string, SquadUsage[]>,
): Set<string> {
  const used = new Set<string>();
  const recByCard = new Map(myTeam.map((r) => [r.worldCardId, r]));
  for (const b of builds) {
    const rec = recByCard.get(b.worldCardId);
    if (rec && (rec.selectedBuildId === b.buildId || rec.favoriteBuildId === b.buildId)) {
      used.add(b.buildId);
      continue;
    }
    const su = squadUsageByCard.get(b.worldCardId) ?? [];
    if (su.some((u) => u.savedBuildId === b.buildId)) used.add(b.buildId);
  }
  return used;
}

// ---------------------------------------------------------------------------
// My Team「選択中ビルド」連携（My Builds → 同一 worldCardId の MyTeamRecord.selectedBuildId）
// ---------------------------------------------------------------------------

const MB_BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MB_WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;

export type MyTeamBuildSelectionState =
  | "not-in-team" // 同一 worldCardId の My Team レコードが無い
  | "selected" // この保存ビルドが selectedBuildId
  | "assignable"; // My Team 登録済み・別ビルド or 未選択

export interface MyTeamBuildSelection {
  state: MyTeamBuildSelectionState;
  /** この保存ビルドが selectedBuildId と一致するか（`state === "selected"` と同値）。 */
  isSelected: boolean;
  /** この保存ビルドが favoriteBuildId と一致するか（selectedBuildId とは独立）。 */
  isFavorite: boolean;
  /** 対象 My Team レコードの現在の selectedBuildId（無ければ null）。 */
  currentSelectedBuildId: string | null;
  /** 対象 My Team レコードの現在の favoriteBuildId（無ければ null）。 */
  currentFavoriteBuildId: string | null;
  teamCardId: string | null;
}

/** 保存ビルドと（同一 worldCardId の）My Team レコードから、選択中ビルド／お気に入りビルドの状態を判定。 */
export function resolveMyTeamBuildSelectionState(
  build: SavedBuild,
  record: MyTeamRecord | null | undefined,
): MyTeamBuildSelection {
  if (!record || record.worldCardId !== build.worldCardId) {
    return {
      state: "not-in-team",
      isSelected: false,
      isFavorite: false,
      currentSelectedBuildId: null,
      currentFavoriteBuildId: null,
      teamCardId: null,
    };
  }
  const isSelected = record.selectedBuildId === build.buildId;
  return {
    state: isSelected ? "selected" : "assignable",
    isSelected,
    isFavorite: record.favoriteBuildId === build.buildId,
    currentSelectedBuildId: record.selectedBuildId ?? null,
    currentFavoriteBuildId: record.favoriteBuildId ?? null,
    teamCardId: record.teamCardId,
  };
}

export type MyTeamAssignValidation =
  | { ok: true; teamCardId: string }
  | { ok: false; error: string };

export interface MyTeamBuildAssignmentInput {
  build: SavedBuild;
  record: MyTeamRecord | null | undefined;
  /** getBuild(build.worldCardId, build.buildId) の再取得結果。 */
  storedBuild: SavedBuild | null | undefined;
  storageAvailable: boolean;
}

/**
 * 更新直前の整合性検証の共通部分（fs 不要・呼び出し側が **再取得した** レコード / ビルドを渡す）。
 * worldCardId は文字列として完全一致（Number 変換しない）。buildId は対象カードのビルドとして存在。
 */
function validateMyTeamRecordAndBuild(input: MyTeamBuildAssignmentInput): MyTeamAssignValidation {
  const { build, record, storedBuild, storageAvailable } = input;
  if (!storageAvailable) return { ok: false, error: "このブラウザでは保存できません（localStorage 不可）" };
  if (typeof build.worldCardId !== "string" || !MB_WORLD_CARD_ID_RE.test(build.worldCardId)) {
    return { ok: false, error: "カード ID が不正です" };
  }
  if (typeof build.buildId !== "string" || !MB_BUILD_ID_RE.test(build.buildId)) {
    return { ok: false, error: "ビルド ID が不正です" };
  }
  if (!record) return { ok: false, error: "このカードは My Team に登録されていません" };
  if (record.worldCardId !== build.worldCardId || !record.teamCardId) {
    return { ok: false, error: "別のタブでデータが変更されました。再読込してください。" };
  }
  if (!storedBuild || storedBuild.buildId !== build.buildId || storedBuild.worldCardId !== build.worldCardId) {
    return { ok: false, error: "対象の保存ビルドが見つかりません（削除された可能性があります）" };
  }
  return { ok: true, teamCardId: record.teamCardId };
}

/** 選択中ビルド（selectedBuildId）設定の直前検証。 */
export function validateMyTeamBuildAssignment(input: MyTeamBuildAssignmentInput): MyTeamAssignValidation {
  return validateMyTeamRecordAndBuild(input);
}

/** お気に入りビルド（favoriteBuildId）設定の直前検証。selectedBuildId とは別フィールド。 */
export function validateMyTeamFavoriteBuildAssignment(input: MyTeamBuildAssignmentInput): MyTeamAssignValidation {
  return validateMyTeamRecordAndBuild(input);
}

/** お気に入りビルド解除の直前検証。現在 favoriteBuildId がこのビルドを指していることも確認。 */
export function validateMyTeamFavoriteBuildClear(input: MyTeamBuildAssignmentInput): MyTeamAssignValidation {
  const base = validateMyTeamRecordAndBuild(input);
  if (!base.ok) return base;
  if (!input.record || input.record.favoriteBuildId !== input.build.buildId) {
    return { ok: false, error: "お気に入りビルドの状態が変更されています。再読込してください。" };
  }
  return base;
}

export interface MyTeamBuildChangeDescription {
  worldCardId: string;
  toBuildId: string;
  toBuildName: string;
  fromBuildId: string | null;
  fromBuildName: string | null;
  /** 現在の selectedBuildId が指すビルドが見つからない（削除済み等）。 */
  fromMissing: boolean;
  alreadySelected: boolean;
}

/** 選択中ビルド変更ダイアログ用の「変更前 → 変更後」記述。 */
export function describeMyTeamBuildChange(
  build: SavedBuild,
  record: MyTeamRecord,
  currentSelectedBuild: SavedBuild | null | undefined,
): MyTeamBuildChangeDescription {
  const fromId = record.selectedBuildId ?? null;
  return {
    worldCardId: build.worldCardId,
    toBuildId: build.buildId,
    toBuildName: build.buildName,
    fromBuildId: fromId,
    fromBuildName: currentSelectedBuild?.buildName ?? null,
    fromMissing: fromId != null && (currentSelectedBuild == null || currentSelectedBuild.buildId !== fromId),
    alreadySelected: fromId === build.buildId,
  };
}

export interface MyTeamFavoriteBuildChangeDescription {
  worldCardId: string;
  toBuildId: string;
  toBuildName: string;
  /** 現在の favoriteBuildId。 */
  fromBuildId: string | null;
  fromBuildName: string | null;
  /** 現在の favoriteBuildId が指すビルドが見つからない（削除済み等）。 */
  fromMissing: boolean;
  alreadyFavorite: boolean;
  /** 現在の selectedBuildId（このダイアログでは変更しない・表示のみ）。 */
  selectedBuildId: string | null;
}

/** お気に入りビルド変更ダイアログ用の記述。selectedBuildId は変更しないので併記のみ。 */
export function describeMyTeamFavoriteBuildChange(
  build: SavedBuild,
  record: MyTeamRecord,
  currentFavoriteBuild: SavedBuild | null | undefined,
): MyTeamFavoriteBuildChangeDescription {
  const fromId = record.favoriteBuildId ?? null;
  return {
    worldCardId: build.worldCardId,
    toBuildId: build.buildId,
    toBuildName: build.buildName,
    fromBuildId: fromId,
    fromBuildName: currentFavoriteBuild?.buildName ?? null,
    fromMissing: fromId != null && (currentFavoriteBuild == null || currentFavoriteBuild.buildId !== fromId),
    alreadyFavorite: fromId === build.buildId,
    selectedBuildId: record.selectedBuildId ?? null,
  };
}

// ---------------------------------------------------------------------------
// My Team「新規登録」（My Builds → My Team 未登録カードを既存 addToMyTeam で登録）
// ---------------------------------------------------------------------------

export function isOwnershipStatus(v: unknown): v is OwnershipStatus {
  return typeof v === "string" && (OWNERSHIP_STATUSES as readonly string[]).includes(v);
}
export function isUsageStatus(v: unknown): v is UsageStatus {
  return typeof v === "string" && (USAGE_STATUSES as readonly string[]).includes(v);
}

/**
 * 所有状態の安全な初期値。既存 `addToMyTeam` / `MyTeamAddDialog` の既定と揃える（"owned"）。
 * ダイアログでユーザーが明示選択できるので固定はしない（この値は初期表示のみ）。
 */
export function resolveSafeOwnershipDefault(): OwnershipStatus {
  return "owned";
}
/**
 * 使用状態の安全な初期値。既存 `addToMyTeam` / `MyTeamAddDialog` の既定と揃える（"unknown" = 未設定）。
 * スカッド配置・比較の使用状況からは推測しない。
 */
export function resolveSafeUsageDefault(): UsageStatus {
  return "unknown";
}

export type MyTeamRegistrationErrorCode =
  | "storage"
  | "world-card-id"
  | "build-id"
  | "build-missing"
  | "duplicate"
  | "ownership"
  | "usage";

export interface MyTeamRegistrationInput {
  build: SavedBuild;
  /** getMyTeamByWorldId(build.worldCardId) の**再取得**結果（あれば重複登録）。 */
  existingRecord: MyTeamRecord | null | undefined;
  /** getBuild(build.worldCardId, build.buildId) の**再取得**結果。 */
  storedBuild: SavedBuild | null | undefined;
  storageAvailable: boolean;
  ownershipStatus: string;
  usageStatus: string;
}

export type MyTeamRegistrationValidation =
  | { ok: true; worldCardId: string; ownershipStatus: OwnershipStatus; usageStatus: UsageStatus }
  | { ok: false; error: string; code: MyTeamRegistrationErrorCode };

/**
 * My Team 新規登録の直前検証（純関数・呼び出し側が再取得したレコード/ビルドを渡す）。
 * worldCardId は文字列として完全一致で扱う（Number 変換しない）。
 */
export function validateMyTeamRegistration(input: MyTeamRegistrationInput): MyTeamRegistrationValidation {
  const { build, existingRecord, storedBuild, storageAvailable, ownershipStatus, usageStatus } = input;
  if (!storageAvailable) {
    return { ok: false, error: "このブラウザでは保存できません（localStorage 不可）", code: "storage" };
  }
  if (typeof build.worldCardId !== "string" || !MB_WORLD_CARD_ID_RE.test(build.worldCardId)) {
    return { ok: false, error: "カード ID が不正です", code: "world-card-id" };
  }
  if (typeof build.buildId !== "string" || !MB_BUILD_ID_RE.test(build.buildId)) {
    return { ok: false, error: "ビルド ID が不正です", code: "build-id" };
  }
  if (!storedBuild || storedBuild.buildId !== build.buildId || storedBuild.worldCardId !== build.worldCardId) {
    return {
      ok: false,
      error: "保存ビルドが別のタブで削除されました。再読込してください。",
      code: "build-missing",
    };
  }
  if (existingRecord && existingRecord.worldCardId === build.worldCardId) {
    return {
      ok: false,
      error: "このカードは既に My Team へ登録されています。再読込してください。",
      code: "duplicate",
    };
  }
  if (!isOwnershipStatus(ownershipStatus)) {
    return { ok: false, error: "所有状態が不正です", code: "ownership" };
  }
  if (!isUsageStatus(usageStatus)) {
    return { ok: false, error: "使用状態が不正です", code: "usage" };
  }
  return { ok: true, worldCardId: build.worldCardId, ownershipStatus, usageStatus };
}

export interface MyTeamRegistrationOptions {
  ownershipStatus: OwnershipStatus;
  usageStatus: UsageStatus;
  /** この保存ビルドを selectedBuildId に設定するか。 */
  setSelected: boolean;
  /** この保存ビルドを favoriteBuildId に設定するか（selectedBuildId とは独立）。 */
  setFavorite: boolean;
}

export interface MyTeamRegistrationPreview {
  worldCardId: string;
  buildId: string;
  buildName: string;
  ownershipStatus: OwnershipStatus;
  usageStatus: UsageStatus;
  setSelected: boolean;
  setFavorite: boolean;
  /** 登録後 selectedBuildId が指すビルド名（設定しないなら null）。 */
  selectedBuildName: string | null;
  /** 登録後 favoriteBuildId が指すビルド名（設定しないなら null）。 */
  favoriteBuildName: string | null;
  /**
   * 2 段階登録になるか。addToMyTeam は favoriteBuildId を受け取れないため、
   * favoriteBuildId を設定する場合のみ登録後に updateMyTeamRecord を追加で呼ぶ。
   */
  twoStage: boolean;
  /** 今回の登録で付与するタグ（常に空・登録後に My Team 画面で編集）。 */
  tags: string[];
  /** 今回の登録で付与するメモ（常に空）。 */
  note: string;
}

/** 登録前プレビュー（作成される My Team レコードの内容）。selectedBuildId と favoriteBuildId は独立。 */
export function buildMyTeamRegistrationPreview(
  build: SavedBuild,
  opts: MyTeamRegistrationOptions,
): MyTeamRegistrationPreview {
  return {
    worldCardId: build.worldCardId,
    buildId: build.buildId,
    buildName: build.buildName,
    ownershipStatus: opts.ownershipStatus,
    usageStatus: opts.usageStatus,
    setSelected: opts.setSelected,
    setFavorite: opts.setFavorite,
    selectedBuildName: opts.setSelected ? build.buildName : null,
    favoriteBuildName: opts.setFavorite ? build.buildName : null,
    twoStage: opts.setFavorite,
    tags: [],
    note: "",
  };
}

// ---------------------------------------------------------------------------
// My Team「ビルド選択パネル」（My Team 画面で対象カードの保存ビルドを確認しながら設定/解除）
// ---------------------------------------------------------------------------

export interface MyTeamBuildRef {
  /** 現在 record に保存されている buildId（null = 未設定）。 */
  buildId: string | null;
  /** buildId に対応する保存ビルド（見つからなければ null）。 */
  build: SavedBuild | null;
  /** buildId は設定されているが保存ビルドが見つからない（削除済み）。 */
  missing: boolean;
}

export interface MyTeamBuildRefs {
  selected: MyTeamBuildRef;
  favorite: MyTeamBuildRef;
}

/**
 * buildId が保存ビルド一覧のどれを指すか（削除済み検出込み）。
 * 参照切れを別ビルドへ自動修復しない・null へ勝手に書き換えない（表示のためだけの純関数）。
 */
export function resolveBuildRef(
  id: string | null | undefined,
  builds: SavedBuild[] | null | undefined,
): MyTeamBuildRef {
  const list = Array.isArray(builds) ? builds : [];
  const buildId = typeof id === "string" && id !== "" ? id : null;
  if (buildId == null) return { buildId: null, build: null, missing: false };
  const build = list.find((b) => b.buildId === buildId) ?? null;
  return { buildId, build, missing: build == null };
}

/**
 * record の selectedBuildId / favoriteBuildId が、そのカードの保存ビルド一覧のどれを指すか（削除済み検出込み）。
 * 参照切れを別ビルドへ自動修復しない・null へ勝手に書き換えない（表示のためだけの純関数）。
 */
export function resolveMyTeamBuildRefs(
  record: MyTeamRecord | null | undefined,
  builds: SavedBuild[],
): MyTeamBuildRefs {
  return {
    selected: resolveBuildRef(record?.selectedBuildId, builds),
    favorite: resolveBuildRef(record?.favoriteBuildId, builds),
  };
}

/**
 * ビルド選択パネルの並び順:
 *  1. 現在の選択中ビルド
 *  2. 現在のお気に入りビルド（選択中と同一なら 1 件だけ・両バッジ）
 *  3. 更新日時が新しい順
 *  4. buildId で安定化
 * 元配列は変更しない。不正日時は現在時刻扱いしない（末尾）。
 */
export function sortMyTeamBuildPanel(
  builds: SavedBuild[],
  refs: { selectedBuildId: string | null; favoriteBuildId: string | null },
): SavedBuild[] {
  const rank = (b: SavedBuild): number => {
    if (refs.selectedBuildId != null && b.buildId === refs.selectedBuildId) return 0;
    if (refs.favoriteBuildId != null && b.buildId === refs.favoriteBuildId) return 1;
    return 2;
  };
  return builds.slice().sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const ta = buildTimeValue(a.updatedAt);
    const tb = buildTimeValue(b.updatedAt);
    if (ta == null && tb != null) return 1;
    if (ta != null && tb == null) return -1;
    if (ta != null && tb != null && ta !== tb) return tb - ta;
    return a.buildId.localeCompare(b.buildId);
  });
}

export type MyTeamBuildClearField = "selectedBuildId" | "favoriteBuildId";

export interface MyTeamBuildRefClearInput {
  /** getMyTeamRecord(teamCardId) の**再取得**結果。 */
  record: MyTeamRecord | null | undefined;
  teamCardId: string;
  field: MyTeamBuildClearField;
  /** 画面が解除対象として認識している buildId（record の現在値と一致するはず）。削除済み参照でも可。 */
  currentBuildId: string | null;
  storageAvailable: boolean;
}

/**
 * selectedBuildId / favoriteBuildId の解除（null 化）の直前検証。
 * 保存ビルドの存在は要求しない（削除済み参照の明示解除にも使う）。
 * 現在値が画面の認識と一致しない場合は競合として失敗（上書きしない）。
 */
export function validateMyTeamBuildRefClear(input: MyTeamBuildRefClearInput): MyTeamAssignValidation {
  if (!input.storageAvailable) {
    return { ok: false, error: "このブラウザでは保存できません（localStorage 不可）" };
  }
  if (!input.record || input.record.teamCardId !== input.teamCardId) {
    return { ok: false, error: "別のタブでデータが変更されました。再読込してください。" };
  }
  const cur =
    input.field === "selectedBuildId"
      ? input.record.selectedBuildId ?? null
      : input.record.favoriteBuildId ?? null;
  if (cur == null) {
    return { ok: false, error: "既に解除されています。再読込してください。" };
  }
  if (cur !== (input.currentBuildId ?? null)) {
    return { ok: false, error: "設定が別のタブで変更されています。再読込してください。" };
  }
  return { ok: true, teamCardId: input.record.teamCardId };
}

// ---------------------------------------------------------------------------
// スカッド枠の保存ビルド選択（StoredSquad の slot / sub の savedBuildId・My Team とは別系統）
// ---------------------------------------------------------------------------

export type SquadBuildErrorCode =
  | "storage"
  | "slot-missing"
  | "card-mismatch"
  | "build-id"
  | "build-missing";

export type SquadBuildValidation =
  | { ok: true; changed: boolean }
  | { ok: false; error: string; code: SquadBuildErrorCode };

export interface SquadBuildAssignmentInput {
  storageAvailable: boolean;
  /** 現在の編集中スカッド state から見て、対象枠（先発 slot / ベンチ sub）が存在するか。 */
  slotExists: boolean;
  /** 対象枠に現在いるカードの worldCardId（編集中 state 由来・空なら null）。 */
  slotWorldCardId: string | null | undefined;
  /** パネルを開いた時点の対象枠のカード worldCardId。 */
  expectedWorldCardId: string;
  /** 対象枠の現在の savedBuildId（編集中 state 由来）。 */
  currentSavedBuildId: string | null | undefined;
  /** 設定したい buildId（解除は null）。 */
  targetBuildId: string | null;
  /** targetBuildId != null のときの getBuild(expectedWorldCardId, targetBuildId) 再取得結果。 */
  storedBuild: SavedBuild | null | undefined;
}

/**
 * スカッド枠の savedBuildId 設定・解除の直前検証（純関数）。
 * - 対象枠が存在し、開いた時点と同じ worldCardId のカードが今もいることを確認（別タブでカードが
 *   入れ替わっていたら card-mismatch で拒否・上書きしない）。
 * - 設定時は保存ビルドが現在も存在し worldCardId が一致することを確認。
 * - worldCardId は文字列として完全一致で扱う（Number 変換しない）。
 * - `changed` = 現在値と目標値が違うか（同じなら呼び出し側は何もしない）。
 */
export function validateSquadBuildAssignment(input: SquadBuildAssignmentInput): SquadBuildValidation {
  if (!input.storageAvailable) {
    return { ok: false, error: "このブラウザでは保存できません（localStorage 不可）", code: "storage" };
  }
  if (typeof input.expectedWorldCardId !== "string" || !MB_WORLD_CARD_ID_RE.test(input.expectedWorldCardId)) {
    return { ok: false, error: "カード ID が不正です", code: "card-mismatch" };
  }
  if (!input.slotExists) {
    return {
      ok: false,
      error: "対象の枠が見つかりません（別のタブで変更された可能性があります）。再読込してください。",
      code: "slot-missing",
    };
  }
  if (input.slotWorldCardId == null || input.slotWorldCardId !== input.expectedWorldCardId) {
    return {
      ok: false,
      error: "枠のカードが別のタブで変更されています。パネルを開き直してください。",
      code: "card-mismatch",
    };
  }
  if (input.targetBuildId != null) {
    if (!MB_BUILD_ID_RE.test(input.targetBuildId)) {
      return { ok: false, error: "ビルド ID が不正です", code: "build-id" };
    }
    const b = input.storedBuild;
    if (!b || b.buildId !== input.targetBuildId || b.worldCardId !== input.expectedWorldCardId) {
      return {
        ok: false,
        error: "対象の保存ビルドが見つかりません（削除された可能性があります）。再読込してください。",
        code: "build-missing",
      };
    }
  }
  return { ok: true, changed: (input.currentSavedBuildId ?? null) !== input.targetBuildId };
}

// ---------------------------------------------------------------------------
// スカッドのビルド使用状況サマリー（現在の 1 スカッドのみ・表示専用・保存しない）
// ---------------------------------------------------------------------------

export type SquadBuildSlotStatus = "set" | "unset" | "missing";
export type SquadBuildRuleKind = "current" | "legacy" | "unknown";

/** サマリーへ渡す 1 枠ぶんの最小情報（先発 slot / ベンチ sub 共通）。 */
export interface SquadBuildUsageRowInput {
  /** slotId（先発）または subId（ベンチ）。 */
  key: string;
  area: "starter" | "bench";
  /** 「CF」「ベンチ 2」など。 */
  slotLabel: string;
  worldCardId: string;
  playerName: string;
  savedBuildId: string | null;
}

export interface SquadBuildUsageEntry extends SquadBuildUsageRowInput {
  status: SquadBuildSlotStatus;
  /** status === "set" のときの保存ビルド。 */
  build: SavedBuild | null;
  /** status === "set" のときの規則種別（それ以外は null）。 */
  ruleKind: SquadBuildRuleKind | null;
  ruleLabel: string | null;
  pom: boolean;
  experimental: boolean;
}

export interface SquadBuildUsageSummary {
  total: number;
  starterCount: number;
  benchCount: number;
  /** savedBuildId があり、同じ worldCardId の保存ビルドが実在する。 */
  setCount: number;
  /** savedBuildId が未設定。 */
  unsetCount: number;
  /** savedBuildId はあるが保存ビルドが見つからない（削除済み等）。 */
  missingCount: number;
  currentRulesCount: number;
  legacyRulesCount: number;
  /** 規則を判定できない実在ビルド（件数をごまかさず別枠で明示）。 */
  unknownRulesCount: number;
  pomCount: number;
  experimentalCount: number;
  entries: SquadBuildUsageEntry[];
}

/**
 * 現在の 1 スカッドの各枠の savedBuildId 使用状況を集計する（純関数・保存しない・自動修復しない）。
 * - 「設定済み」= savedBuildId があり、同じ worldCardId の保存ビルドが実在。
 * - 「削除済み参照」= savedBuildId はあるが実在しない（未設定へ自動変換しない）。
 * - 規則種別 / Power of Many / 実験的試算は実在ビルドの既存ヘルパーで判定（未指定を最大値扱いしない）。
 * entries は入力順を保つ（呼び出し側で安定ソート）。
 */
export function summarizeSquadBuilds(
  rows: SquadBuildUsageRowInput[],
  buildsByCard: Map<string, SavedBuild[]> | Record<string, SavedBuild[]>,
): SquadBuildUsageSummary {
  const get = (id: string): SavedBuild[] =>
    buildsByCard instanceof Map ? buildsByCard.get(id) ?? [] : buildsByCard[id] ?? [];

  const entries: SquadBuildUsageEntry[] = rows.map((r) => {
    const ref = resolveBuildRef(r.savedBuildId, get(r.worldCardId));
    let status: SquadBuildSlotStatus;
    if (ref.buildId == null) status = "unset";
    else if (ref.missing) status = "missing";
    else status = "set";
    const build = status === "set" ? ref.build : null;
    let ruleKind: SquadBuildRuleKind | null = null;
    let ruleLabel: string | null = null;
    if (build) {
      const rs = resolveBuildRuleStatus(build.rulesVersion);
      ruleKind = rs.isV2 ? "current" : rs.isLegacy ? "legacy" : "unknown";
      ruleLabel = rs.label;
    }
    return {
      ...r,
      status,
      build,
      ruleKind,
      ruleLabel,
      pom: build ? describeBuildPoM(build).has : false,
      experimental: build ? buildHasExperimental(build) : false,
    };
  });

  return {
    total: entries.length,
    starterCount: entries.filter((e) => e.area === "starter").length,
    benchCount: entries.filter((e) => e.area === "bench").length,
    setCount: entries.filter((e) => e.status === "set").length,
    unsetCount: entries.filter((e) => e.status === "unset").length,
    missingCount: entries.filter((e) => e.status === "missing").length,
    currentRulesCount: entries.filter((e) => e.ruleKind === "current").length,
    legacyRulesCount: entries.filter((e) => e.ruleKind === "legacy").length,
    unknownRulesCount: entries.filter((e) => e.ruleKind === "unknown").length,
    pomCount: entries.filter((e) => e.pom).length,
    experimentalCount: entries.filter((e) => e.experimental).length,
    entries,
  };
}

export type SquadBuildUsageFilter = "all" | "set" | "unset" | "missing" | "starter" | "bench";

/** サマリー一覧の絞り込み + 検索（純関数・非破壊・正規表現評価なし）。 */
export function filterSquadBuildUsage(
  entries: SquadBuildUsageEntry[],
  filter: SquadBuildUsageFilter,
  query: string,
): SquadBuildUsageEntry[] {
  const nq = normalizeBuildSearchQuery(query);
  return entries.filter((e) => {
    if (filter === "set" && e.status !== "set") return false;
    if (filter === "unset" && e.status !== "unset") return false;
    if (filter === "missing" && e.status !== "missing") return false;
    if (filter === "starter" && e.area !== "starter") return false;
    if (filter === "bench" && e.area !== "bench") return false;
    if (!nq) return true;
    const hay = `${e.playerName}  ${e.slotLabel}  ${e.worldCardId}  ${e.build?.buildName ?? ""}  ${e.savedBuildId ?? ""}`.toLowerCase();
    return nq.split(" ").every((tok) => tok === "" || hay.includes(tok));
  });
}
