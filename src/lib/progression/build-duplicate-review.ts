import type { SavedBuild, SelectedConditionalBooster } from "./types";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { savedBuildSchema } from "./build-storage";
import type { BuildInventory, BuildInventoryItem, BuildRuleKind, InventorySquadRef } from "./build-inventory";
import { groupLabelJa } from "@/lib/world/stat-labels";
import { normalizeBuildSearchQuery, matchesBuildSearch, buildTimeValue, describeBuildPoM } from "./my-builds";

/**
 * 保存ビルドの「重複候補」確認（読み取り専用）。純関数のみ・localStorage / fetch / SQLite を触らない。
 *
 * - **既存 `buildInventory()` の結果（`BuildInventoryItem[]`）を入力として再利用**する。
 *   使用状況（My Team 参照・スカッド参照）・カード情報・規則判定は棚卸しの計算をそのまま使う（再計算しない）。
 * - 完全一致候補は、正規化した正式設定フィールドから作った**決定的なフィンガープリント**で判定する
 *   （表示文字列に依存しない）。`buildId` / `buildName` / `createdAt` / `updatedAt` は同一性判定から除外。
 * - 類似候補は「同じ worldCardId・同じ rulesVersion」の中で、**安全に説明できる 2 パターンだけ**を扱う
 *   （配分 1 カテゴリのみ差分 / 選手ブースター試算・Power of Many 指定のみ差分）。それ以外は対象外（別ビルド）。
 * - 規則不明（空 `rulesVersion`）・スキーマ検証に失敗するビルドは「判定不能」として比較対象から除外する
 *   （重複候補なしへ含めない・自動修復しない）。
 * - この画面から保存ビルドを削除・統合・上書き・付け替えしない（表示専用）。
 */

// ---------------------------------------------------------------------------
// 判定不能
// ---------------------------------------------------------------------------

export type DuplicateUnresolvedReason = "invalid-schema" | "unknown-rules";

export interface DuplicateUnresolvedItem {
  buildId: string | null;
  worldCardId: string | null;
  card: WorldPlayerListItem | null;
  reason: DuplicateUnresolvedReason;
  reasonLabel: string;
}

const UNRESOLVED_REASON_LABEL: Record<DuplicateUnresolvedReason, string> = {
  "invalid-schema": "保存データの検証に失敗（スキーマ不一致）",
  "unknown-rules": "規則バージョンが不明（rulesVersion が空）で同一性を安全に判定できません",
};

// ---------------------------------------------------------------------------
// フィンガープリント（決定的・正規化・非破壊）
// ---------------------------------------------------------------------------

/** progressionAllocation を正規化（キー昇順・値 0/不在は同義として除外・保存済みデータの意味を維持）。 */
function canonicalAllocation(a: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  const src = a ?? {};
  for (const k of Object.keys(src).sort()) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v) && v !== 0) out[k] = v;
  }
  return out;
}

/**
 * conditionalBoosterSelections を正規化する。
 * このフィールドは「boosterKey ごとの選択状態」の集合であり、配列内の並び順自体に意味はない
 * （`validateConditionalBoosterSelection` も boosterKey で重複除去する）。そのため boosterKey 昇順へ
 * 揃えて比較する（挿入順の違いだけで「別内容」と誤判定しないため）。boosterKey の重複は後勝ちを避け、
 * 最初に現れた有効な指定を採用する。
 */
function canonicalConditional(
  sel: SelectedConditionalBooster[] | null | undefined,
): Array<{ boosterKey: string; selection: string }> {
  const map = new Map<string, string>();
  for (const s of Array.isArray(sel) ? sel : []) {
    if (s && typeof s.boosterKey === "string" && typeof s.selection === "string" && !map.has(s.boosterKey)) {
      map.set(s.boosterKey, s.selection);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([boosterKey, selection]) => ({ boosterKey, selection }));
}

export interface FingerprintFields {
  worldCardId: string;
  rulesVersion: string;
  progressionAllocation: Record<string, number>;
  selectedPlayerBooster: number | null;
  conditionalBoosterSelections: Array<{ boosterKey: string; selection: string }>;
}

/**
 * 育成内容の同一性へ含める正式フィールドだけを正規化して返す（表示や参照には使わない中間形）。
 * 含める: worldCardId・rulesVersion・progressionAllocation・selectedPlayerBooster・conditionalBoosterSelections。
 * 除外: buildId・buildName・createdAt・updatedAt・calculatedStats・calculatedOvr・calculationMode・schemaVersion
 * （除外理由は詳細報告を参照。いずれも「保存結果のスナップショット」または「保存管理上の識別情報」であり、
 * 　育成の設定内容そのものではないため）。
 */
export function extractFingerprintFields(build: SavedBuild): FingerprintFields {
  return {
    worldCardId: build.worldCardId,
    rulesVersion: build.rulesVersion,
    progressionAllocation: canonicalAllocation(build.progressionAllocation),
    selectedPlayerBooster:
      typeof build.selectedPlayerBooster === "number" && Number.isFinite(build.selectedPlayerBooster)
        ? build.selectedPlayerBooster
        : null,
    conditionalBoosterSelections: canonicalConditional(build.conditionalBoosterSelections),
  };
}

/**
 * 決定的なフィンガープリント（正規化済みフィールドの JSON 文字列）。
 * - オブジェクトキー順序に依存しない（`progressionAllocation` はキー昇順）。
 * - 配列は意味上の順序（boosterKey 昇順）へ正規化。
 * - 同じ内容なら常に同じ文字列。暗号学的ハッシュは使わない（外部依存を増やさないため）。
 * - localStorage へは保存しない（呼び出しのたびに計算する表示専用の値）。
 */
export function computeBuildFingerprint(build: SavedBuild): string {
  return JSON.stringify(extractFingerprintFields(build));
}

function fieldsEqual(a: FingerprintFields, b: FingerprintFields): boolean {
  return computeFingerprintFromFields(a) === computeFingerprintFromFields(b);
}
function computeFingerprintFromFields(f: FingerprintFields): string {
  return JSON.stringify(f);
}

// ---------------------------------------------------------------------------
// 表示用のビルド1件ぶん（BuildInventoryItem から必要な情報だけ写す）
// ---------------------------------------------------------------------------

export interface DuplicateCandidateBuild {
  build: SavedBuild;
  card: WorldPlayerListItem | null;
  ruleKind: BuildRuleKind;
  ruleLabel: string;
  pom: boolean;
  experimental: boolean;
  used: boolean;
  refCount: number;
  myTeamSelectedCount: number;
  myTeamFavoriteCount: number;
  squadRefCount: number;
  squads: InventorySquadRef[];
  multiUse: boolean;
}

function toCandidateBuild(item: BuildInventoryItem): DuplicateCandidateBuild {
  return {
    build: item.build,
    card: item.card,
    ruleKind: item.ruleKind,
    ruleLabel: item.ruleLabel,
    pom: item.pom,
    experimental: item.experimental,
    used: item.used,
    refCount: item.refCount,
    myTeamSelectedCount: item.myTeamSelectedCount,
    myTeamFavoriteCount: item.myTeamFavoriteCount,
    squadRefCount: item.squadRefCount,
    squads: item.squads,
    multiUse: item.multiUse,
  };
}

// ---------------------------------------------------------------------------
// 候補グループ（完全一致 / 類似を同じ形へ揃えて検索・絞り込み・並び替えを共通化）
// ---------------------------------------------------------------------------

export type DuplicateGroupKind = "exact" | "similar";
export type SimilarReason = "allocation-one-category" | "booster-or-pom-only";

const SIMILAR_REASON_LABEL: Record<SimilarReason, string> = {
  "allocation-one-category": "配分が 1 カテゴリだけ異なる",
  "booster-or-pom-only": "選手ブースター試算 / Power of Many 指定だけが異なる",
};

const EXACT_SAME_FIELD_LABELS = ["World ID", "rulesVersion", "育成配分", "選手ブースター試算", "Power of Many 指定"];

export interface DuplicateGroup {
  /** 安定した一意 ID（フィルター・並び替えの再現性用）。 */
  id: string;
  kind: DuplicateGroupKind;
  worldCardId: string;
  card: WorldPlayerListItem | null;
  ruleKind: BuildRuleKind;
  ruleLabel: string;
  builds: DuplicateCandidateBuild[];
  buildCount: number;
  /** 完全一致: 常に同一と確認できた項目。類似: 一致が確認できた項目のみ（差分項目は含めない）。 */
  sameFields: string[];
  /** 完全一致: buildId/名前/日時など、内容が同じでも異なり得る付随項目のうち実際に異なるもの。
   * 類似: 差分の原因となった設定項目 ＋ 付随項目の差分。 */
  diffFields: string[];
  reason: SimilarReason | null;
  reasonLabel: string | null;
  /** 類似候補のときだけ: 差分の具体内容（人が読める説明）。 */
  detail: string | null;
  anyUsed: boolean;
  allUsed: boolean;
  anyMyTeamRef: boolean;
  anySquadRef: boolean;
  anyMultiUse: boolean;
  updatedAtMax: string;
  createdAtMax: string;
  /** 並び替え安定化用（メンバー buildId の昇順先頭）。 */
  primaryBuildId: string;
}

function maxTime(builds: DuplicateCandidateBuild[], pick: (b: SavedBuild) => string): string {
  let best: { raw: string; t: number } | null = null;
  for (const b of builds) {
    const raw = pick(b.build);
    const t = buildTimeValue(raw) ?? -Infinity;
    if (!best || t > best.t) best = { raw, t };
  }
  return best?.raw ?? "";
}

function finishGroup(
  kind: DuplicateGroupKind,
  worldCardId: string,
  builds: DuplicateCandidateBuild[],
  sameFields: string[],
  diffFields: string[],
  reason: SimilarReason | null,
  detail: string | null,
): DuplicateGroup {
  const sortedIds = builds.map((b) => b.build.buildId).sort();
  const anyUsed = builds.some((b) => b.used);
  return {
    id: `${kind}:${sortedIds.join(",")}`,
    kind,
    worldCardId,
    card: builds[0]?.card ?? null,
    ruleKind: builds[0]?.ruleKind ?? "unknown",
    ruleLabel: builds[0]?.ruleLabel ?? "規則不明",
    builds,
    buildCount: builds.length,
    sameFields,
    diffFields,
    reason,
    reasonLabel: reason ? SIMILAR_REASON_LABEL[reason] : null,
    detail,
    anyUsed,
    allUsed: builds.every((b) => b.used),
    anyMyTeamRef: builds.some((b) => b.myTeamSelectedCount > 0 || b.myTeamFavoriteCount > 0),
    anySquadRef: builds.some((b) => b.squadRefCount > 0),
    anyMultiUse: builds.some((b) => b.multiUse),
    updatedAtMax: maxTime(builds, (b) => b.updatedAt),
    createdAtMax: maxTime(builds, (b) => b.createdAt),
    primaryBuildId: sortedIds[0] ?? "",
  };
}

function exactDiffFields(builds: DuplicateCandidateBuild[]): string[] {
  const diffs: string[] = [];
  const distinct = (pick: (b: SavedBuild) => unknown) => new Set(builds.map((b) => JSON.stringify(pick(b.build)))).size > 1;
  if (distinct((b) => b.buildName)) diffs.push("ビルド名");
  if (distinct((b) => b.buildId)) diffs.push("buildId");
  if (distinct((b) => b.createdAt)) diffs.push("作成日時");
  if (distinct((b) => b.updatedAt)) diffs.push("更新日時");
  if (distinct((b) => b.calculatedOvr)) diffs.push("保存時の推定OVR");
  if (distinct((b) => b.calculationMode)) diffs.push("計算モード");
  if (distinct((b) => b.schemaVersion)) diffs.push("schemaVersion");
  return diffs;
}

/** Power of Many の段階を人が読める短いラベルへ（describeBuildPoM を各ビルドへ適用した結果を整形）。 */
function pomLabel(build: SavedBuild): string {
  const d = describeBuildPoM(build);
  return d.has ? `指定あり（${d.tierLabel}）` : "未指定";
}

function boosterLabel(v: number | null): string {
  return v == null ? "未指定" : `ID ${v}`;
}

/**
 * 「配分が 1 カテゴリだけ異なる」か判定し、そのカテゴリの差分説明を返す。
 * 前提: rulesVersion 一致・selectedPlayerBooster 一致・conditionalBoosterSelections 一致。
 */
function diffOneAllocationCategory(a: FingerprintFields, b: FingerprintFields): string | null {
  const keys = new Set([...Object.keys(a.progressionAllocation), ...Object.keys(b.progressionAllocation)]);
  const diffKeys: string[] = [];
  for (const k of keys) {
    if ((a.progressionAllocation[k] ?? 0) !== (b.progressionAllocation[k] ?? 0)) diffKeys.push(k);
  }
  if (diffKeys.length !== 1) return null;
  const k = diffKeys[0];
  const av = a.progressionAllocation[k] ?? 0;
  const bv = b.progressionAllocation[k] ?? 0;
  const label = groupLabelJa(k);
  const fmt = (v: number) => (v > 0 ? `Lv${v}` : "未配分");
  return `配分: ${label}（${fmt(av)} → ${fmt(bv)}）`;
}

/** 「選手ブースター試算 / Power of Many 指定だけが異なる」ときの差分説明。前提: rulesVersion・配分一致。 */
function diffBoosterOrPom(a: SavedBuild, b: SavedBuild, af: FingerprintFields, bf: FingerprintFields): string | null {
  const parts: string[] = [];
  if (af.selectedPlayerBooster !== bf.selectedPlayerBooster) {
    parts.push(`選手ブースター試算: ${boosterLabel(af.selectedPlayerBooster)} → ${boosterLabel(bf.selectedPlayerBooster)}`);
  }
  const aPom = JSON.stringify(af.conditionalBoosterSelections);
  const bPom = JSON.stringify(bf.conditionalBoosterSelections);
  if (aPom !== bPom) {
    parts.push(`Power of Many: ${pomLabel(a)} → ${pomLabel(b)}`);
  }
  if (parts.length === 0) return null;
  return parts.join(" / ");
}

// ---------------------------------------------------------------------------
// 構築
// ---------------------------------------------------------------------------

export interface DuplicateReviewSummary {
  totalBuilds: number;
  exactGroupCount: number;
  exactBuildCount: number;
  /** 類似候補を安全に定義できたか（false の場合、similar 系の件数は常に 0 で「未対応」表示にする）。 */
  similarSupported: boolean;
  similarGroupCount: number;
  similarBuildCount: number;
  noCandidateBuilds: number;
  unresolvedBuilds: number;
  usedCandidateBuilds: number;
  unusedCandidateBuilds: number;
  myTeamRefCandidateBuilds: number;
  squadRefCandidateBuilds: number;
}

export interface DuplicateReview {
  groups: DuplicateGroup[];
  unresolved: DuplicateUnresolvedItem[];
  summary: DuplicateReviewSummary;
  cardTypes: string[];
  positions: string[];
}

const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;

function safeIdFromBuild(build: unknown): { buildId: string | null; worldCardId: string | null } {
  const o = build && typeof build === "object" ? (build as Record<string, unknown>) : {};
  const BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  return {
    buildId: typeof o.buildId === "string" && BUILD_ID_RE.test(o.buildId) ? o.buildId : null,
    worldCardId: typeof o.worldCardId === "string" && WORLD_CARD_ID_RE.test(o.worldCardId) ? o.worldCardId : null,
  };
}

/**
 * 保存ビルド棚卸し（`buildInventory()` の結果）から重複候補レビューを構築する（純関数・非破壊）。
 * - `SIMILAR_ENABLED = true` で類似候補（2 パターンのみ）を計算する。安全に説明できない類似は実装しない。
 */
export function buildDuplicateReview(inventory: BuildInventory): DuplicateReview {
  const unresolved: DuplicateUnresolvedItem[] = [];
  const eligible: BuildInventoryItem[] = [];

  for (const item of inventory.items) {
    const parsed = savedBuildSchema.safeParse(item.build);
    if (!parsed.success) {
      const ids = safeIdFromBuild(item.build);
      unresolved.push({ ...ids, card: item.card, reason: "invalid-schema", reasonLabel: UNRESOLVED_REASON_LABEL["invalid-schema"] });
      continue;
    }
    if (item.ruleKind === "unknown") {
      unresolved.push({
        buildId: item.build.buildId,
        worldCardId: item.build.worldCardId,
        card: item.card,
        reason: "unknown-rules",
        reasonLabel: UNRESOLVED_REASON_LABEL["unknown-rules"],
      });
      continue;
    }
    eligible.push(item);
  }

  // worldCardId ごとにグループ化（総当たりを worldCardId 内だけへ限定）
  const byCard = new Map<string, BuildInventoryItem[]>();
  for (const item of eligible) {
    const list = byCard.get(item.build.worldCardId) ?? [];
    list.push(item);
    byCard.set(item.build.worldCardId, list);
  }

  const groups: DuplicateGroup[] = [];
  const candidateBuildIds = new Set<string>();
  const candidateInfoById = new Map<string, DuplicateCandidateBuild>();

  for (const [worldCardId, items] of byCard) {
    if (items.length < 2) continue; // 単独ビルドは重複候補になり得ない

    // フィンガープリント単位でグループ化（同一 worldCardId 内・全ビルド無条件総当たりはしない）
    const byFingerprint = new Map<string, { fields: FingerprintFields; items: BuildInventoryItem[] }[]>();
    const fieldsByBuildId = new Map<string, FingerprintFields>();
    for (const item of items) {
      const fields = extractFingerprintFields(item.build);
      fieldsByBuildId.set(item.build.buildId, fields);
      const fp = computeFingerprintFromFields(fields);
      const bucket = byFingerprint.get(fp) ?? [];
      const existing = bucket.find((b) => fieldsEqual(b.fields, fields));
      if (existing) existing.items.push(item);
      else bucket.push({ fields, items: [item] });
      byFingerprint.set(fp, bucket);
    }

    const exactFingerprints = new Set<string>();
    for (const [fp, buckets] of byFingerprint) {
      for (const bucket of buckets) {
        if (bucket.items.length < 2) continue;
        exactFingerprints.add(fp);
        const candidates = bucket.items.map(toCandidateBuild);
        for (const c of candidates) {
          candidateBuildIds.add(c.build.buildId);
          candidateInfoById.set(c.build.buildId, c);
        }
        groups.push(
          finishGroup(
            "exact",
            worldCardId,
            candidates.sort((a, b) => a.build.buildId.localeCompare(b.build.buildId)),
            [...EXACT_SAME_FIELD_LABELS],
            exactDiffFields(candidates),
            null,
            null,
          ),
        );
      }
    }

    // 類似候補（安全に説明できる 2 パターンのみ）: 同じ worldCardId 内、フィンガープリントが異なる組だけ
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.build.rulesVersion !== b.build.rulesVersion) continue; // 別ビルド扱い（類似にまとめない）
        const af = fieldsByBuildId.get(a.build.buildId)!;
        const bf = fieldsByBuildId.get(b.build.buildId)!;
        if (fieldsEqual(af, bf)) continue; // 完全一致は別枠（類似ではない）

        const sameBoosterAndPom =
          af.selectedPlayerBooster === bf.selectedPlayerBooster &&
          JSON.stringify(af.conditionalBoosterSelections) === JSON.stringify(bf.conditionalBoosterSelections);
        const sameAllocation = JSON.stringify(af.progressionAllocation) === JSON.stringify(bf.progressionAllocation);

        let reason: SimilarReason | null = null;
        let detail: string | null = null;
        if (sameBoosterAndPom) {
          const d = diffOneAllocationCategory(af, bf);
          if (d) {
            reason = "allocation-one-category";
            detail = d;
          }
        } else if (sameAllocation) {
          const d = diffBoosterOrPom(a.build, b.build, af, bf);
          if (d) {
            reason = "booster-or-pom-only";
            detail = d;
          }
        }
        if (!reason || !detail) continue; // 複合差分など、安全に説明できない場合は別ビルド扱い

        const candidates = [toCandidateBuild(a), toCandidateBuild(b)];
        for (const c of candidates) {
          candidateBuildIds.add(c.build.buildId);
          candidateInfoById.set(c.build.buildId, c);
        }
        const same = ["World ID", "rulesVersion"];
        if (sameBoosterAndPom) same.push("選手ブースター試算", "Power of Many 指定");
        if (sameAllocation) same.push("育成配分");
        groups.push(
          finishGroup(
            "similar",
            worldCardId,
            candidates.sort((x, y) => x.build.buildId.localeCompare(y.build.buildId)),
            same,
            [detail],
            reason,
            detail,
          ),
        );
      }
    }
  }

  groups.sort((a, b) => a.id.localeCompare(b.id)); // 構築順に依存しない安定初期順

  const cardTypes = new Set<string>();
  const positions = new Set<string>();
  for (const item of inventory.items) {
    if (item.card?.cardType) cardTypes.add(item.card.cardType);
    if (item.card?.registeredPosition) positions.add(item.card.registeredPosition);
  }

  const exactBuilds = new Set<string>();
  for (const g of groups) if (g.kind === "exact") for (const b of g.builds) exactBuilds.add(b.build.buildId);
  const similarBuilds = new Set<string>();
  for (const g of groups) if (g.kind === "similar") for (const b of g.builds) similarBuilds.add(b.build.buildId);

  const candidateList = [...candidateInfoById.values()];
  const summary: DuplicateReviewSummary = {
    totalBuilds: inventory.items.length,
    exactGroupCount: groups.filter((g) => g.kind === "exact").length,
    exactBuildCount: exactBuilds.size,
    similarSupported: true,
    similarGroupCount: groups.filter((g) => g.kind === "similar").length,
    similarBuildCount: similarBuilds.size,
    noCandidateBuilds: eligible.length - candidateBuildIds.size,
    unresolvedBuilds: unresolved.length,
    usedCandidateBuilds: candidateList.filter((c) => c.used).length,
    unusedCandidateBuilds: candidateList.filter((c) => !c.used).length,
    myTeamRefCandidateBuilds: candidateList.filter((c) => c.myTeamSelectedCount > 0 || c.myTeamFavoriteCount > 0).length,
    squadRefCandidateBuilds: candidateList.filter((c) => c.squadRefCount > 0).length,
  };

  return { groups, unresolved, summary, cardTypes: [...cardTypes].sort(), positions: [...positions].sort() };
}

// ---------------------------------------------------------------------------
// 検索・絞り込み・並び替え
// ---------------------------------------------------------------------------

export interface DuplicateReviewFilter {
  q: string;
  kind: "all" | "exact" | "similar";
  usage: "all" | "used" | "unused";
  myTeamRef: boolean;
  squadRef: boolean;
  multiUse: boolean;
  rules: "all" | "current" | "legacy";
  pom: boolean;
  experimental: boolean;
  cardType: string | null;
  position: string | null;
}

export const DEFAULT_DUPLICATE_REVIEW_FILTER: DuplicateReviewFilter = {
  q: "",
  kind: "all",
  usage: "all",
  myTeamRef: false,
  squadRef: false,
  multiUse: false,
  rules: "all",
  pom: false,
  experimental: false,
  cardType: null,
  position: null,
};

export function normalizeDuplicateReviewSearch(raw: unknown): string {
  return normalizeBuildSearchQuery(raw);
}

function groupHaystack(g: DuplicateGroup): string {
  const squadNames = g.builds.flatMap((b) => b.squads.map((s) => s.squadName)).join(" ");
  const names = g.builds.map((b) => b.build.buildName).join("  ");
  const ids = g.builds.map((b) => b.build.buildId).join("  ");
  return [names, ids, g.worldCardId, g.card?.nameJa ?? "", g.card?.nameEn ?? "", g.builds[0]?.build.rulesVersion ?? "", squadNames]
    .join("  ")
    .toLowerCase();
}

export function filterDuplicateReviewGroups(
  groups: DuplicateGroup[],
  filter: DuplicateReviewFilter,
): DuplicateGroup[] {
  const nq = normalizeDuplicateReviewSearch(filter.q);
  return groups.filter((g) => {
    if (nq) {
      const hay = groupHaystack(g);
      if (!nq.split(" ").every((tok) => tok === "" || hay.includes(tok))) return false;
    }
    if (filter.kind !== "all" && g.kind !== filter.kind) return false;
    if (filter.usage === "used" && !g.anyUsed) return false;
    if (filter.usage === "unused" && g.anyUsed) return false;
    if (filter.myTeamRef && !g.anyMyTeamRef) return false;
    if (filter.squadRef && !g.anySquadRef) return false;
    if (filter.multiUse && !g.anyMultiUse) return false;
    if (filter.rules !== "all" && g.ruleKind !== filter.rules) return false;
    if (filter.pom && !g.builds.some((b) => b.pom)) return false;
    if (filter.experimental && !g.builds.some((b) => b.experimental)) return false;
    if (filter.cardType && (g.card?.cardType ?? null) !== filter.cardType) return false;
    if (filter.position && (g.card?.registeredPosition ?? null) !== filter.position) return false;
    return true;
  });
}

function groupPlayerName(g: DuplicateGroup): string {
  return (g.card?.nameJa || g.card?.nameEn || g.worldCardId).toLowerCase();
}
function groupPrimaryName(g: DuplicateGroup): string {
  const names = g.builds.map((b) => b.build.buildName).sort((a, b) => a.localeCompare(b, "ja"));
  return names[0] ?? "";
}
function groupRefTotal(g: DuplicateGroup): number {
  return g.builds.reduce((s, b) => s + b.refCount, 0);
}

export type DuplicateReviewSortKey =
  | "updated_desc"
  | "created_desc"
  | "size_desc"
  | "refs_desc"
  | "unused_first"
  | "used_first"
  | "player_asc"
  | "name_asc"
  | "id_stable";

export const DUPLICATE_REVIEW_SORT_KEYS: DuplicateReviewSortKey[] = [
  "updated_desc",
  "created_desc",
  "size_desc",
  "refs_desc",
  "unused_first",
  "used_first",
  "player_asc",
  "name_asc",
  "id_stable",
];

/** 並び替え（同キーは id で安定化・不正日時は末尾・非破壊）。 */
export function sortDuplicateReviewGroups(
  groups: DuplicateGroup[],
  key: DuplicateReviewSortKey,
): DuplicateGroup[] {
  const arr = groups.slice();
  const byId = (a: DuplicateGroup, b: DuplicateGroup) => a.id.localeCompare(b.id);
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
        r = cmpTime(buildTimeValue(a.updatedAtMax), buildTimeValue(b.updatedAtMax), true);
        break;
      case "created_desc":
        r = cmpTime(buildTimeValue(a.createdAtMax), buildTimeValue(b.createdAtMax), true);
        break;
      case "size_desc":
        r = b.buildCount - a.buildCount;
        break;
      case "refs_desc":
        r = groupRefTotal(b) - groupRefTotal(a);
        break;
      case "unused_first":
        r = (a.anyUsed ? 1 : 0) - (b.anyUsed ? 1 : 0);
        break;
      case "used_first":
        r = (a.anyUsed ? 0 : 1) - (b.anyUsed ? 0 : 1);
        break;
      case "player_asc":
        r = groupPlayerName(a).localeCompare(groupPlayerName(b), "ja");
        break;
      case "name_asc":
        r = groupPrimaryName(a).localeCompare(groupPrimaryName(b), "ja");
        break;
      case "id_stable":
        r = 0;
        break;
    }
    return r !== 0 ? r : byId(a, b);
  });
  return arr;
}
