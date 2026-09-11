import { BUILD_SCHEMA_VERSION } from "./constants";
import { savedBuildSchema } from "./build-storage";
import {
  SAVED_BUILD_EXPORT_APP,
  SAVED_BUILD_EXPORT_FORMAT,
  SAVED_BUILD_EXPORT_FORMAT_VERSION,
  canonicalizeExportBuild,
} from "./build-export";
import { resolveBuildRuleStatus, describeBuildPoM, buildHasExperimental } from "./my-builds";
import type { SavedBuild } from "./types";

/**
 * 保存ビルドの「ローカル JSON インポート」用の純ロジック（localStorage / DOM / fetch を触らない）。
 *
 * - 対応するのは **前回このアプリが出力した正式なエクスポート JSON のみ**（`build-export.ts` の形式）。
 * - `format` / `formatVersion` / `savedBuildSchema` はエクスポートと**同じ定数・同じスキーマ**を再利用する。
 * - 既存ビルドを上書きしない。`buildId` 衝突時は新しい `buildId` を発行（生成関数は呼び出し側から注入）。
 * - My Team / スカッド / カードお気に入り / `selectedBuildId` / `favoriteBuildId` / `savedBuildId` には一切触れない。
 * - `createdAt` / `updatedAt` はファイルの値をそのまま維持する（インポート時刻で上書きしない）。
 * - `eval` / `Function` / 動的 import を使わない。JSON.parse の結果を無検証でマージしない。
 */

/** 現在対応する `formatVersion`（完全一致のみ・将来バージョンは拒否）。 */
export const SUPPORTED_IMPORT_FORMAT_VERSIONS = ["1"] as const;

/**
 * ファイルサイズ上限（バイト）。
 * 1 ビルド ≈ 1KB（インデント付き JSON）。localStorage の実効クォータは概ね 5MB 前後で、
 * ビルドストアがそれに迫る規模なら保存側で容量エラーになる。4MB あれば通常のバックアップ
 * （数十〜数千件）を拒否せず、かつ FileReader での一括読込がブラウザーをフリーズさせない範囲。
 */
export const MAX_IMPORT_FILE_BYTES = 4_000_000;

/**
 * `itemCount` / `builds.length` の上限。
 * 通常のユーザーの保存ビルドは数十〜数百件。3000 は現実的なバックアップを拒否せず、
 * プレビュー描画と全件検証の計算量を安全に抑えられる上限。
 */
export const MAX_IMPORT_ITEM_COUNT = 3000;

/** エクスポートファイルのトップレベルで許可するキー（`build-export.ts` の出力と一致）。 */
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "format",
  "formatVersion",
  "app",
  "exportedAt",
  "itemCount",
  "builds",
]);

/** プロトタイプ汚染につながり得るキー名。 */
const RISKY_KEYS = ["__proto__", "prototype", "constructor"];

const BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

// ---------------------------------------------------------------------------
// トップレベル形式の検証
// ---------------------------------------------------------------------------

export type ImportParseErrorCode =
  | "empty"
  | "too-large"
  | "not-json"
  | "not-object"
  | "risky-keys"
  | "unknown-top-key"
  | "format-mismatch"
  | "format-version-type"
  | "unsupported-version"
  | "exported-at"
  | "item-count"
  | "item-count-too-large"
  | "builds-not-array"
  | "item-count-mismatch";

export interface ImportFileMeta {
  format: string;
  formatVersion: string;
  exportedAt: string;
  itemCount: number;
}

export type ParseImportResult =
  | { ok: true; meta: ImportFileMeta; rawBuilds: unknown[] }
  | { ok: false; code: ImportParseErrorCode; message: string };

function utf8Bytes(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    // TextEncoder 不在（極端に古い環境）: 文字数の 3 倍を保守的な上限見積もりに使う
    return text.length * 3;
  }
}

/** 生テキストを解析し、トップレベル形式・`format` / `formatVersion` / `itemCount` 整合性を厳格に検証する。 */
export function parseImportText(text: unknown): ParseImportResult {
  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, code: "empty", message: "ファイルが空です。" };
  }
  if (utf8Bytes(text) > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      code: "too-large",
      message: `ファイルが大きすぎます（上限 ${(MAX_IMPORT_FILE_BYTES / 1_000_000).toFixed(0)}MB）。`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, code: "not-json", message: "JSON として読み取れません。正式なエクスポートファイルを選んでください。" };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      code: "not-object",
      message: "エクスポートファイルの形式ではありません（トップレベルがオブジェクトではありません）。",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const ownKeys = Object.keys(obj);
  if (RISKY_KEYS.some((k) => Object.prototype.hasOwnProperty.call(obj, k) || ownKeys.includes(k))) {
    return { ok: false, code: "risky-keys", message: "安全でないキーを含むため読み込めません。" };
  }
  const unknownKey = ownKeys.find((k) => !ALLOWED_TOP_LEVEL_KEYS.has(k));
  if (unknownKey) {
    return {
      ok: false,
      code: "unknown-top-key",
      message: "未知の項目を含むため読み込めません。正式なエクスポートファイルを選んでください。",
    };
  }

  if (obj.format !== SAVED_BUILD_EXPORT_FORMAT) {
    return { ok: false, code: "format-mismatch", message: "このアプリの保存ビルドエクスポートファイルではありません。" };
  }
  if (typeof obj.formatVersion !== "string") {
    return { ok: false, code: "format-version-type", message: "formatVersion の形式が不正です。" };
  }
  if (!(SUPPORTED_IMPORT_FORMAT_VERSIONS as readonly string[]).includes(obj.formatVersion)) {
    return {
      ok: false,
      code: "unsupported-version",
      message: `未対応の formatVersion（${obj.formatVersion}）です。アプリの更新が必要です。将来の形式を現在の形式として読み込むことはしません。`,
    };
  }
  if (typeof obj.exportedAt !== "string" || !ISO_8601_RE.test(obj.exportedAt) || !Number.isFinite(Date.parse(obj.exportedAt))) {
    return { ok: false, code: "exported-at", message: "exportedAt が妥当な ISO 8601 日時ではありません。" };
  }
  if (typeof obj.itemCount !== "number" || !Number.isInteger(obj.itemCount) || obj.itemCount < 0) {
    return { ok: false, code: "item-count", message: "itemCount が非負整数ではありません。" };
  }
  if (obj.itemCount > MAX_IMPORT_ITEM_COUNT) {
    return {
      ok: false,
      code: "item-count-too-large",
      message: `ビルド件数が多すぎます（上限 ${MAX_IMPORT_ITEM_COUNT} 件）。`,
    };
  }
  if (!Array.isArray(obj.builds)) {
    return { ok: false, code: "builds-not-array", message: "builds が配列ではありません。" };
  }
  if (obj.builds.length > MAX_IMPORT_ITEM_COUNT) {
    return {
      ok: false,
      code: "item-count-too-large",
      message: `ビルド件数が多すぎます（上限 ${MAX_IMPORT_ITEM_COUNT} 件）。`,
    };
  }
  if (obj.itemCount !== obj.builds.length) {
    return { ok: false, code: "item-count-mismatch", message: "itemCount と builds の件数が一致しません。" };
  }

  return {
    ok: true,
    meta: {
      format: obj.format as string,
      formatVersion: obj.formatVersion,
      exportedAt: obj.exportedAt,
      itemCount: obj.itemCount,
    },
    rawBuilds: obj.builds,
  };
}

// ---------------------------------------------------------------------------
// 各 SavedBuild の検証（インポートは export より厳格: 未知キーを拒否）
// ---------------------------------------------------------------------------

/** インポート用の厳格スキーマ: `savedBuildSchema` ＋ トップレベルの未知キーを拒否。 */
const strictSavedBuildSchema = savedBuildSchema.strict();

export interface ImportBuildIssue {
  index: number;
  buildId: string | null;
  worldCardId: string | null;
}

export interface ImportValidateResult {
  valid: SavedBuild[];
  invalid: ImportBuildIssue[];
}

function safeIds(raw: unknown): { buildId: string | null; worldCardId: string | null } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    buildId: typeof o.buildId === "string" && BUILD_ID_RE.test(o.buildId) ? o.buildId : null,
    worldCardId: typeof o.worldCardId === "string" && WORLD_CARD_ID_RE.test(o.worldCardId) ? o.worldCardId : null,
  };
}

/**
 * 各要素を厳格スキーマで検証する。未知キー・`schemaVersion` 不一致は無効扱い。
 * 無効は修復も削除もせず、安全な ID だけを積む（内容全文は返さない）。
 * 有効分は `canonicalizeExportBuild` で決定的な形へ整える（値は変えない）。
 */
export function validateImportBuilds(rawBuilds: readonly unknown[]): ImportValidateResult {
  const valid: SavedBuild[] = [];
  const invalid: ImportBuildIssue[] = [];
  rawBuilds.forEach((raw, index) => {
    const parsed = strictSavedBuildSchema.safeParse(raw);
    if (!parsed.success || (parsed.data as SavedBuild).schemaVersion !== BUILD_SCHEMA_VERSION) {
      invalid.push({ index, ...safeIds(raw) });
      return;
    }
    valid.push(canonicalizeExportBuild(parsed.data as SavedBuild));
  });
  return { valid, invalid };
}

/** ファイル内で重複している `buildId` の一覧（昇順・重複が 1 つでもあればファイル全体を拒否する用）。 */
export function findInFileDuplicateBuildIds(builds: readonly SavedBuild[]): string[] {
  const count = new Map<string, number>();
  for (const b of builds) count.set(b.buildId, (count.get(b.buildId) ?? 0) + 1);
  return [...count.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort();
}

// ---------------------------------------------------------------------------
// プレビュー用プラン（buildId 衝突解決・新 ID 割当）
// ---------------------------------------------------------------------------

export interface ImportPlanItem {
  worldCardId: string;
  originalBuildId: string;
  finalBuildId: string;
  /** 既存 buildId と衝突したため新しい ID を割り当てた。 */
  collision: boolean;
  buildName: string;
  rulesVersion: string;
  ruleLabel: string;
  pom: boolean;
  experimental: boolean;
  createdAt: string;
  updatedAt: string;
  /** 保存する最終 `SavedBuild`（`finalBuildId` 以外はファイルの値のまま）。 */
  build: SavedBuild;
}

export interface ExistingSnapshotEntry {
  buildId: string;
  updatedAt: string;
}

export interface ImportPlan {
  meta: ImportFileMeta;
  items: ImportPlanItem[];
  /** = items.length（全件保存対象）。 */
  saveCount: number;
  /** 既存 buildId と衝突し新 ID を割り当てた件数。 */
  collisionCount: number;
  /** 新しい buildId を発行した件数（= collisionCount）。 */
  newIdCount: number;
  /** 確認開始時の既存ビルドのスナップショット（保存直前の競合検出用）。 */
  existingSnapshot: ExistingSnapshotEntry[];
}

export type ImportAnalysis =
  | { ok: true; plan: ImportPlan }
  | { ok: false; stage: "parse"; code: ImportParseErrorCode; message: string }
  | { ok: false; stage: "validate"; invalidCount: number; validCount: number; issues: ImportBuildIssue[] }
  | { ok: false; stage: "duplicate"; duplicateBuildIds: string[] };

/** `genId(taken)` は `taken` に含まれない buildId を返す契約（既存の正式な ID 生成処理を注入する）。 */
export type BuildIdGenerator = (taken: ReadonlySet<string>) => string;

function buildPlanItems(
  validBuilds: readonly SavedBuild[],
  currentBuilds: readonly SavedBuild[],
  genId: BuildIdGenerator,
): ImportPlanItem[] {
  const existingIds = new Set(currentBuilds.map((b) => b.buildId));
  const taken = new Set(existingIds);
  return validBuilds.map((b) => {
    const collision = taken.has(b.buildId);
    const finalBuildId = collision ? genId(taken) : b.buildId;
    taken.add(finalBuildId);
    const rs = resolveBuildRuleStatus(b.rulesVersion);
    return {
      worldCardId: b.worldCardId,
      originalBuildId: b.buildId,
      finalBuildId,
      collision,
      buildName: b.buildName,
      rulesVersion: b.rulesVersion,
      ruleLabel: rs.label,
      pom: describeBuildPoM(b).has,
      experimental: buildHasExperimental(b),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      build: canonicalizeExportBuild({ ...b, buildId: finalBuildId }),
    };
  });
}

/**
 * ファイルテキストと現在の保存ビルド一覧から、インポートのプレビュー用プランを組み立てる。
 * - parse 失敗 → `stage:"parse"`
 * - SavedBuild が 1 件でも無効 → `stage:"validate"`（**全体拒否**・部分保存しない）
 * - ファイル内 `buildId` 重複が 1 件でもある → `stage:"duplicate"`（**全体拒否**）
 * - それ以外は衝突解決済みのプランを返す。
 */
export function analyzeImport(
  text: unknown,
  currentBuilds: readonly SavedBuild[],
  genId: BuildIdGenerator,
): ImportAnalysis {
  const parsed = parseImportText(text);
  if (!parsed.ok) return { ok: false, stage: "parse", code: parsed.code, message: parsed.message };

  const { valid, invalid } = validateImportBuilds(parsed.rawBuilds);
  if (invalid.length > 0) {
    return { ok: false, stage: "validate", invalidCount: invalid.length, validCount: valid.length, issues: invalid };
  }

  const duplicateBuildIds = findInFileDuplicateBuildIds(valid);
  if (duplicateBuildIds.length > 0) {
    return { ok: false, stage: "duplicate", duplicateBuildIds };
  }

  const items = buildPlanItems(valid, currentBuilds, genId);
  const collisionCount = items.filter((i) => i.collision).length;
  return {
    ok: true,
    plan: {
      meta: parsed.meta,
      items,
      saveCount: items.length,
      collisionCount,
      newIdCount: collisionCount,
      existingSnapshot: currentBuilds.map((b) => ({ buildId: b.buildId, updatedAt: b.updatedAt })),
    },
  };
}

// ---------------------------------------------------------------------------
// 保存直前の再検証（最終確認後・現在の一覧と突き合わせて新 ID を再計算）
// ---------------------------------------------------------------------------

export type ImportReconcile =
  | { ok: true; builds: SavedBuild[]; expectedExistingBuildIds: string[]; collisionCount: number; reassigned: boolean }
  | { ok: false; reason: "conflict"; addedExisting: string[]; removedExisting: string[]; changedExisting: string[] };

/**
 * 最終確認後、`analyzeImport` 時のスナップショットと**再取得した現在の一覧**を突き合わせる。
 * - 既存 `buildId` 集合の増減・差し替え、または既存ビルドの `updatedAt` 変化があれば `conflict`（保存しない）。
 * - 問題なければ、現在の一覧に対して `buildId` 衝突と新 ID を**再計算**して最終的な `SavedBuild[]` を返す。
 *   （プレビュー時から状況が変わっていなければ `reassigned` は false）
 */
export function reconcileImport(
  plan: ImportPlan,
  freshCurrentBuilds: readonly SavedBuild[],
  genId: BuildIdGenerator,
): ImportReconcile {
  const before = new Map(plan.existingSnapshot.map((e) => [e.buildId, e.updatedAt]));
  const after = new Map(freshCurrentBuilds.map((b) => [b.buildId, b.updatedAt]));

  const addedExisting = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removedExisting = [...before.keys()].filter((id) => !after.has(id)).sort();
  const changedExisting = [...before.entries()]
    .filter(([id, ts]) => after.has(id) && after.get(id) !== ts)
    .map(([id]) => id)
    .sort();

  if (addedExisting.length || removedExisting.length || changedExisting.length) {
    return { ok: false, reason: "conflict", addedExisting, removedExisting, changedExisting };
  }

  // 元の buildId（衝突していなければそのまま）で再計算する
  const originalBuilds = plan.items.map((i) => ({ ...i.build, buildId: i.originalBuildId }));
  const items = buildPlanItems(originalBuilds, freshCurrentBuilds, genId);
  const finalBuilds = items.map((i) => i.build);
  const reassigned = items.some((i, idx) => i.finalBuildId !== plan.items[idx].finalBuildId);
  return {
    ok: true,
    builds: finalBuilds,
    expectedExistingBuildIds: freshCurrentBuilds.map((b) => b.buildId),
    collisionCount: items.filter((i) => i.collision).length,
    reassigned,
  };
}

// ---------------------------------------------------------------------------
// 表示用の補助
// ---------------------------------------------------------------------------

export const IMPORT_APP_LABEL = SAVED_BUILD_EXPORT_APP;
export const IMPORT_FORMAT_LABEL = SAVED_BUILD_EXPORT_FORMAT;
export const IMPORT_FORMAT_VERSION_LABEL = SAVED_BUILD_EXPORT_FORMAT_VERSION;

/** parse エラーコード → ユーザー向けの安全な短い説明（内容全文・スタックは出さない）。 */
export function describeParseError(code: ImportParseErrorCode): string {
  switch (code) {
    case "empty":
      return "ファイルが空です。";
    case "too-large":
    case "item-count-too-large":
      return "ファイルまたはビルド件数が大きすぎます。";
    case "not-json":
      return "JSON として読み取れません。";
    case "not-object":
    case "builds-not-array":
      return "エクスポートファイルの構造ではありません。";
    case "risky-keys":
    case "unknown-top-key":
      return "未知または安全でない項目を含むため読み込めません。";
    case "format-mismatch":
      return "このアプリの保存ビルドエクスポートファイルではありません。";
    case "format-version-type":
    case "unsupported-version":
      return "未対応の formatVersion です。アプリの更新が必要です。";
    case "exported-at":
      return "exportedAt の日時が不正です。";
    case "item-count":
      return "itemCount が不正です。";
    case "item-count-mismatch":
      return "itemCount と実際の件数が一致しません。";
    default:
      return "ファイルを読み込めません。";
  }
}
