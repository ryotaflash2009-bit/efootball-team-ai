import { z } from "zod";
import { BUILD_SCHEMA_VERSION } from "./constants";
import { validateConditionalBoosterSelection } from "./conditional-boosters";
import type { SavedBuild, SelectedConditionalBooster } from "./types";
import type { SavedBuildIntent } from "./build-intent-persistence";
import { getCurrentScope } from "@/lib/local-storage-scope/current-scope-store";
import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";

/**
 * 育成ビルドのローカル保存（localStorage）。
 * - 外部アカウント・クラウド同期なし。
 * - localStorage が使えなくても呼び出し側がクラッシュしないよう、すべて安全なフォールバックを返す。
 * - 読み込み時に Zod で検証し、壊れたデータは黙って捨てる。
 * - 保存形式は将来のアカウントDB移行を意識してフラット。
 * - アカウント別localStorage領域対応(feat/account-scoped-builds-favorites)により、実際の
 *   読み書き先は現在解決済みのスコープ(guest/account)に応じて動的に決まる。スコープが
 *   未解決(認証確認中)の間は、読み取りは安全な空、書き込みは拒否する。
 */

/** 現在のスコープにおけるMy Buildsの実際のlocalStorageキー。スコープ未解決ならnull。 */
export function getActiveBuildsStorageKey(): string | null {
  const scope = getCurrentScope();
  if (!scope) return null;
  return buildScopedStorageKey(scope, "myBuilds");
}

const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;
const BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const conditionalBoosterSelectionSchema = z
  .array(
    z.object({
      boosterKey: z.string().regex(/^[a-z0-9-]{1,48}$/),
      selection: z.enum(["none", "league_1_13", "league_14_19", "league_20_plus"]),
    }),
  )
  .max(4)
  .optional()
  .catch(undefined);

const GROUP_ID_RE = /^[a-zA-Z][a-zA-Z0-9]{0,40}$/;
/** 育成目的の主目的ID（build-intent-analysis.ts の PrimaryGoalId と同じ値集合。ここでは形だけを検証し、
 *  現在の定義との厳密な照合は復元時に normalizeSavedBuildIntent/restoreBuildIntentFromSaved が行う）。 */
const PRIMARY_GOAL_ID_VALUES = [
  "unspecified",
  "scoring",
  "dribbling",
  "passing",
  "speed",
  "possession",
  "physical",
  "aerial",
  "defense",
  "press",
  "counter",
  "balance",
  "other",
] as const;

/**
 * 保存済み育成目的（BuildIntent）の検証スキーマ。
 * - ここでは構造（型・妥当な範囲）だけを検証する。プリセットID・groupIdの現在の定義との照合、
 *   比較対象の実在確認は `build-intent-persistence.ts` の純関数（保存時/復元時）が行う（責務分離）。
 * - `.catch(undefined)` により、壊れた/不正な `buildIntent` は「未設定」へ安全に丸め、
 *   ビルド全体を読み込み不能にしない（`conditionalBoosterSelections` と同じ既存方針）。
 * - 表示文章・自由記述は含めない（フィールド自体が存在しない）。
 */
const buildIntentSchema = z
  .object({
    intentSchemaVersion: z.number().int(),
    mainPresetId: z.string().max(64).nullable(),
    subPresetIds: z.array(z.string().max(64)).max(2),
    primaryGoal: z.enum(PRIMARY_GOAL_ID_VALUES),
    intendedPositions: z.array(z.string().max(16)).max(8),
    groupPriorities: z.record(z.string().regex(GROUP_ID_RE), z.enum(["priority", "secondary", "low"])),
    avoidOverinvestmentGroups: z.array(z.string().regex(GROUP_ID_RE)).max(20),
    intentionallyIgnoredGroups: z.array(z.string().regex(GROUP_ID_RE)).max(20),
    strengthsToPreserve: z.array(z.string().regex(GROUP_ID_RE)).max(20),
    comparisonTargetBuildId: z.string().regex(BUILD_ID_RE).nullable(),
    comparisonFocusGroups: z.array(z.string().regex(GROUP_ID_RE)).max(20),
    source: z.enum(["preset", "manual"]),
    userModified: z.boolean(),
    updatedAt: z.string(),
  })
  .optional()
  .catch(undefined);

/**
 * 保存ビルド1件の検証スキーマ（読み込み時の検証・エクスポート直前の再検証で共有）。
 * `.strip()`（既定）で未知キーは除去される。スキーマ自体は変更しない。
 */
export const savedBuildSchema = z.object({
  buildId: z.string().regex(BUILD_ID_RE),
  worldCardId: z.string().regex(WORLD_CARD_ID_RE),
  buildName: z.string().min(1).max(60),
  progressionAllocation: z.record(z.string(), z.number().int().min(0).max(999)),
  selectedPlayerBooster: z.number().int().nullable(),
  conditionalBoosterSelections: conditionalBoosterSelectionSchema,
  calculatedStats: z.record(z.string(), z.number().int()),
  calculatedOvr: z.number().int().nullable(),
  calculationMode: z.enum(["confirmed", "provisional", "unsupported"]),
  rulesVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().int(),
  buildIntent: buildIntentSchema,
});

/** { [worldCardId]: SavedBuild[] } */
const storeSchema = z.record(z.string().regex(WORLD_CARD_ID_RE), z.array(savedBuildSchema));

type Store = z.infer<typeof storeSchema>;

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    // アクセス自体が例外になる環境（プライベートモード等）に備える
    const k = "__efb_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStore(): Store {
  const ls = getStorage();
  if (!ls) return {};
  const key = getActiveBuildsStorageKey();
  if (!key) return {};
  try {
    const raw = ls.getItem(key);
    if (!raw) return {};
    const parsed = storeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): boolean {
  const ls = getStorage();
  if (!ls) return false;
  const key = getActiveBuildsStorageKey();
  if (!key) return false;
  try {
    ls.setItem(key, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function isBuildStorageAvailable(): boolean {
  return getStorage() != null;
}

export function listBuilds(worldCardId: string): SavedBuild[] {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return [];
  const store = readStore();
  return (store[worldCardId] ?? []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getBuild(worldCardId: string, buildId: string): SavedBuild | null {
  return listBuilds(worldCardId).find((b) => b.buildId === buildId) ?? null;
}

/**
 * 全カードの保存ビルドを平坦化して返す（My Builds 一覧用）。
 * 並び: updatedAt 降順 → buildId（安定）。保存済み worldCardId は変更しない。
 */
export function listAllBuilds(): SavedBuild[] {
  const store = readStore();
  const out: SavedBuild[] = [];
  for (const list of Object.values(store)) {
    for (const b of list) out.push(b);
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.buildId.localeCompare(b.buildId));
}

function newBuildId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return `b_${rnd}`;
}

export interface SaveBuildInput {
  worldCardId: string;
  buildName: string;
  progressionAllocation: Record<string, number>;
  selectedPlayerBooster: number | null;
  conditionalBoosterSelections?: SelectedConditionalBooster[];
  calculatedStats: Record<string, number>;
  calculatedOvr: number | null;
  calculationMode: SavedBuild["calculationMode"];
  rulesVersion: string;
  /** 指定すると上書き（rename / 更新） */
  buildId?: string;
}

export type SaveResult =
  | { ok: true; build: SavedBuild }
  | { ok: false; error: string };

export function saveBuild(input: SaveBuildInput): SaveResult {
  if (!WORLD_CARD_ID_RE.test(input.worldCardId)) return { ok: false, error: "worldCardId が不正です" };
  const name = String(input.buildName ?? "").trim().slice(0, 60);
  if (!name) return { ok: false, error: "ビルド名を入力してください" };

  const now = new Date().toISOString();
  const store = readStore();
  const list = store[input.worldCardId] ?? [];

  const conditionalBoosterSelections = sanitizeConditional(input.conditionalBoosterSelections);

  let build: SavedBuild;
  if (input.buildId) {
    const existing = list.find((b) => b.buildId === input.buildId);
    if (!existing) return { ok: false, error: "対象のビルドが見つかりません" };
    build = {
      ...existing,
      buildName: name,
      progressionAllocation: sanitizeAlloc(input.progressionAllocation),
      selectedPlayerBooster: intOrNull(input.selectedPlayerBooster),
      conditionalBoosterSelections,
      calculatedStats: sanitizeStats(input.calculatedStats),
      calculatedOvr: intOrNull(input.calculatedOvr),
      calculationMode: input.calculationMode,
      rulesVersion: input.rulesVersion,
      updatedAt: now,
    };
  } else {
    build = {
      buildId: newBuildId(),
      worldCardId: input.worldCardId,
      buildName: name,
      progressionAllocation: sanitizeAlloc(input.progressionAllocation),
      selectedPlayerBooster: intOrNull(input.selectedPlayerBooster),
      conditionalBoosterSelections,
      calculatedStats: sanitizeStats(input.calculatedStats),
      calculatedOvr: intOrNull(input.calculatedOvr),
      calculationMode: input.calculationMode,
      rulesVersion: input.rulesVersion,
      createdAt: now,
      updatedAt: now,
      schemaVersion: BUILD_SCHEMA_VERSION,
    };
  }
  if (build.conditionalBoosterSelections && build.conditionalBoosterSelections.length === 0) {
    delete build.conditionalBoosterSelections;
  }

  const parsed = savedBuildSchema.safeParse(build);
  if (!parsed.success) return { ok: false, error: "保存データの形式が不正です" };

  const nextList = input.buildId
    ? list.map((b) => (b.buildId === build.buildId ? build : b))
    : [...list, build];
  // 同一 ID の重複を防止
  const dedup = Array.from(new Map(nextList.map((b) => [b.buildId, b])).values());
  store[input.worldCardId] = dedup;

  if (!writeStore(store)) return { ok: false, error: "この環境ではビルドを保存できません（localStorage 不可）" };
  return { ok: true, build };
}

export function renameBuild(worldCardId: string, buildId: string, name: string): SaveResult {
  const existing = getBuild(worldCardId, buildId);
  if (!existing) return { ok: false, error: "対象のビルドが見つかりません" };
  return saveBuild({
    worldCardId,
    buildId,
    buildName: name,
    progressionAllocation: existing.progressionAllocation,
    selectedPlayerBooster: existing.selectedPlayerBooster,
    conditionalBoosterSelections: existing.conditionalBoosterSelections,
    calculatedStats: existing.calculatedStats,
    calculatedOvr: existing.calculatedOvr,
    calculationMode: existing.calculationMode,
    rulesVersion: existing.rulesVersion,
  });
}

/**
 * 既存ビルドを **同一カードへ** 複製する。
 * - 新しい buildId、createdAt / updatedAt = 現在時刻。
 * - 配分 / rulesVersion / Power of Many 指定 / 選手ブースター試算は複製元と同じ。
 * - 複製元は変更しない。別カードへは複製しない。
 * - `name` 省略時は「{元名} のコピー」。名前は主キーではないので衝突は許容。
 */
export function duplicateBuild(worldCardId: string, buildId: string, name?: string): SaveResult {
  const src = getBuild(worldCardId, buildId);
  if (!src) return { ok: false, error: "対象のビルドが見つかりません" };
  const desired = String(name ?? "").trim().slice(0, 60) || `${src.buildName} のコピー`.slice(0, 60);
  return saveBuild({
    worldCardId,
    buildName: desired,
    progressionAllocation: src.progressionAllocation,
    selectedPlayerBooster: src.selectedPlayerBooster,
    conditionalBoosterSelections: src.conditionalBoosterSelections,
    calculatedStats: src.calculatedStats,
    calculatedOvr: src.calculatedOvr,
    calculationMode: src.calculationMode,
    rulesVersion: src.rulesVersion,
    // buildId 未指定 → 新規（新しい buildId・createdAt/updatedAt = now）
  });
}

/** ブラウザ内のユーザー作成ビルドのみ削除する（Windows 上のファイルは触らない）。 */
export function deleteBuild(worldCardId: string, buildId: string): { ok: boolean; error?: string } {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return { ok: false, error: "worldCardId が不正です" };
  if (!getStorage()) return { ok: false, error: "この環境ではビルドを更新できません（localStorage 不可）" };
  const store = readStore();
  const list = store[worldCardId];
  if (!list) return { ok: true };
  const next = list.filter((b) => b.buildId !== buildId);
  if (next.length === 0) delete store[worldCardId];
  else store[worldCardId] = next;
  if (!writeStore(store)) return { ok: false, error: "この環境ではビルドを更新できません" };
  return { ok: true };
}

export type BuildIntentSaveResult = { ok: true; buildIntent: SavedBuildIntent } | { ok: false; error: string };

/**
 * 対象ビルドの `buildIntent` だけを新規保存/更新する（育成配分・ブースター・ビルド名等は一切変更しない）。
 * - `buildIntent` は呼び出し側で `normalizeSavedBuildIntent` により正規化済みのものを渡すこと
 *   （ここでは既存 `savedBuildSchema` による構造検証だけを行う）。
 * - 対象ビルドが見つからない場合は変更しない。
 */
export function saveBuildIntent(worldCardId: string, buildId: string, buildIntent: SavedBuildIntent): BuildIntentSaveResult {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return { ok: false, error: "worldCardId が不正です" };
  if (!getStorage()) return { ok: false, error: "この環境では保存できません（localStorage 不可）" };
  const store = readStore();
  const list = store[worldCardId];
  const idx = list?.findIndex((b) => b.buildId === buildId) ?? -1;
  if (!list || idx < 0) return { ok: false, error: "対象のビルドが見つかりません" };

  const updated: SavedBuild = { ...list[idx], buildIntent };
  const parsed = savedBuildSchema.safeParse(updated);
  // buildIntentスキーマは(JSONインポート等の壊れたデータを安全に無視するため).catch(undefined)で緩いが、
  // このAPIは呼び出し側が既にnormalizeSavedBuildIntentで正規化した値を渡す契約のため、
  // 検証によって静かにbuildIntentが失われた場合は「保存できた」と偽って返さず、明示的に失敗させる。
  if (!parsed.success || (parsed.data as SavedBuild).buildIntent === undefined) {
    return { ok: false, error: "保存データの形式が不正です" };
  }

  const nextList = list.slice();
  nextList[idx] = parsed.data as SavedBuild;
  store[worldCardId] = nextList;
  if (!writeStore(store)) return { ok: false, error: "この環境では保存できません（localStorage 不可）" };
  return { ok: true, buildIntent: (parsed.data as SavedBuild).buildIntent as SavedBuildIntent };
}

/**
 * 対象ビルドの `buildIntent` だけを削除する（保存ビルド本体・育成配分・ビルド名等は維持する）。
 * 対象ビルドが見つからない場合は成功扱い（既に無いので何もしない）。
 */
export function deleteBuildIntent(worldCardId: string, buildId: string): { ok: boolean; error?: string } {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return { ok: false, error: "worldCardId が不正です" };
  if (!getStorage()) return { ok: false, error: "この環境では更新できません（localStorage 不可）" };
  const store = readStore();
  const list = store[worldCardId];
  if (!list) return { ok: true };
  const idx = list.findIndex((b) => b.buildId === buildId);
  if (idx < 0) return { ok: true };
  if (list[idx].buildIntent === undefined) return { ok: true };
  const nextBuild = { ...list[idx] };
  delete nextBuild.buildIntent;
  const nextList = list.slice();
  nextList[idx] = nextBuild;
  store[worldCardId] = nextList;
  if (!writeStore(store)) return { ok: false, error: "この環境では更新できません" };
  return { ok: true };
}

/**
 * 既存 + 「今回の処理中に発行済み」の buildId を避けて、新しい buildId を発行する。
 * 既存の `newBuildId`（crypto ベース）を再利用し、衝突したら生成し直す。
 * @param taken 避けたい buildId の集合（既存ビルド ＋ 同一処理で発行済みの新 ID）
 */
export function generateUniqueBuildId(taken: ReadonlySet<string>): string {
  for (let i = 0; i < 64; i++) {
    const id = newBuildId();
    if (!taken.has(id)) return id;
  }
  // 128bit 乱数なので実質到達不能。最後の保険。
  const fallback = `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return taken.has(fallback) ? `${fallback}x` : fallback;
}

export type ImportBuildsResult =
  | { ok: true; saved: number }
  | { ok: false; error: string; code: "storage" | "invalid" | "conflict" | "quota" };

/**
 * 複数の完成済み `SavedBuild` を **全件単位で 1 回だけ** 追加保存する（インポート専用）。
 *
 * - 既存ビルドは読み取って**そのまま維持**する（上書き・削除・改名・並び替えをしない）。
 * - 追加分の `buildId` が既存または追加分どうしで衝突していたら **`conflict` で拒否**（呼び出し側で解決済みが前提）。
 * - `createdAt` / `updatedAt` は渡された値をそのまま保存する（インポート時刻で上書きしない）。
 * - マージ結果の**ストア全体を既存 `storeSchema` で検証**してから、既存 `writeStore` で **1 回だけ**書き込む。
 * - `BUILD_STORAGE_KEY` 以外の localStorage キーには触れない。新しいキー・`storageVersion` を作らない。
 * - 途中失敗による部分保存は発生しない（検証 → 単一 `setItem`）。
 *
 * @param builds 追加する `SavedBuild`（`buildId` は衝突解決済み・`schemaVersion` は `BUILD_SCHEMA_VERSION`）
 * @param opts.expectedExistingBuildIds 確認開始時の既存 `buildId` 集合（保存直前の競合検出用）
 */
export function importBuilds(
  builds: SavedBuild[],
  opts?: { expectedExistingBuildIds?: readonly string[] },
): ImportBuildsResult {
  if (!getStorage()) {
    return { ok: false, error: "この環境では保存できません（localStorage 不可）", code: "storage" };
  }
  if (!Array.isArray(builds) || builds.length === 0) {
    return { ok: false, error: "追加するビルドがありません", code: "invalid" };
  }

  const store = readStore();
  const existingIds = new Set<string>();
  for (const list of Object.values(store)) for (const b of list) existingIds.add(b.buildId);

  if (opts?.expectedExistingBuildIds) {
    const expected = new Set(opts.expectedExistingBuildIds);
    const sameSize = expected.size === existingIds.size;
    const sameMembers = sameSize && [...expected].every((id) => existingIds.has(id));
    if (!sameMembers) {
      return {
        ok: false,
        error: "既存の保存ビルドが変更されています。再読込してください。",
        code: "conflict",
      };
    }
  }

  const cleaned: SavedBuild[] = [];
  const seen = new Set<string>();
  for (const raw of builds) {
    const parsed = savedBuildSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "インポートデータの形式が不正です", code: "invalid" };
    const b = parsed.data as SavedBuild;
    if (b.schemaVersion !== BUILD_SCHEMA_VERSION) {
      return { ok: false, error: "未対応のスキーマバージョンです", code: "invalid" };
    }
    if (existingIds.has(b.buildId) || seen.has(b.buildId)) {
      return { ok: false, error: "buildId が衝突しています", code: "conflict" };
    }
    seen.add(b.buildId);
    if (b.conditionalBoosterSelections && b.conditionalBoosterSelections.length === 0) {
      delete b.conditionalBoosterSelections;
    }
    cleaned.push(b);
  }

  // マージ: 既存はそのまま・追加分を各 worldCardId 配列の末尾へ
  const next: Store = {};
  for (const [wid, list] of Object.entries(store)) next[wid] = list.slice();
  for (const b of cleaned) (next[b.worldCardId] ??= []).push(b);

  const validated = storeSchema.safeParse(next);
  if (!validated.success) return { ok: false, error: "保存データの形式が不正です", code: "invalid" };

  if (!writeStore(validated.data)) {
    return {
      ok: false,
      error: "保存できませんでした（保存容量が不足している可能性があります）",
      code: "quota",
    };
  }
  return { ok: true, saved: cleaned.length };
}

function sanitizeAlloc(a: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(a ?? {})) {
    if (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 999) out[k] = v;
  }
  return out;
}
function sanitizeStats(a: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(a ?? {})) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.trunc(v);
  }
  return out;
}
/** 条件付きブースター段階の検証（不正・非対象・none は捨てる）。共通の検証関数を通す。 */
function sanitizeConditional(
  raw: SelectedConditionalBooster[] | undefined,
): SelectedConditionalBooster[] {
  return validateConditionalBoosterSelection(raw);
}
function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}
