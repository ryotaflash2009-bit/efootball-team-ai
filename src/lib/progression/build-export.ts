import { savedBuildSchema } from "./build-storage";
import type { SavedBuild } from "./types";
import type { SavedBuildIntent } from "./build-intent-persistence";

/**
 * 保存ビルドの「ローカル JSON エクスポート」用の純ロジック（localStorage / fetch / DOM を触らない）。
 *
 * - 出力するのは既存 `SavedBuild`（`savedBuildSchema`）の正式な保存フィールドだけ。
 *   My Team / スカッド / カードお気に入り / SQLite / 環境情報は一切含めない。
 * - エクスポートしても保存ビルドや他データを変更しない（この module は読み取り専用の変換のみ）。
 * - `formatVersion` は **エクスポートファイル形式**のバージョン。`SavedBuild.rulesVersion` /
 *   `schemaVersion`（保存スキーマ）とは無関係。
 * - インポートは実装しない。将来のインポートで厳格に検証できるよう、決定的で明示的な形式にする。
 * - `worldCardId` / `buildId` は文字列のまま（Number 変換しない）。
 */

/** エクスポートファイルの固定識別子。 */
export const SAVED_BUILD_EXPORT_FORMAT = "efootball-team-ai-saved-builds";
/** エクスポートファイル形式のバージョン（保存スキーマ・rulesVersion とは別軸の固定値）。 */
export const SAVED_BUILD_EXPORT_FORMAT_VERSION = "1";
/** 生成元アプリ名（固定文字列・環境情報やパスは含めない）。 */
export const SAVED_BUILD_EXPORT_APP = "eFootball Team AI";

/** 出力する `SavedBuild` のキー（`savedBuildSchema` と一致・決定的な出力用の順序）。 */
export const EXPORTED_SAVED_BUILD_KEYS = [
  "buildId",
  "worldCardId",
  "buildName",
  "progressionAllocation",
  "selectedPlayerBooster",
  "conditionalBoosterSelections",
  "calculatedStats",
  "calculatedOvr",
  "calculationMode",
  "rulesVersion",
  "createdAt",
  "updatedAt",
  "schemaVersion",
  "buildIntent",
] as const;

export interface SavedBuildExportFile {
  format: typeof SAVED_BUILD_EXPORT_FORMAT;
  formatVersion: typeof SAVED_BUILD_EXPORT_FORMAT_VERSION;
  app: typeof SAVED_BUILD_EXPORT_APP;
  /** 生成時刻（ISO 8601・UTC・`new Date().toISOString()` と同形式）。 */
  exportedAt: string;
  /** `builds.length` と必ず一致。 */
  itemCount: number;
  builds: SavedBuild[];
}

const BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;
/** 既定ファイル名で許可する文字（英数字・ハイフン・ドットのみ）。これ以外があれば安全な固定名へ。 */
const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+$/;

// ---------------------------------------------------------------------------
// 安全な識別子の抽出（無効ビルドのエラー表示用・内容全文は出さない）
// ---------------------------------------------------------------------------

export interface SafeBuildRef {
  buildId: string | null;
  worldCardId: string | null;
}

/** 壊れている可能性のあるオブジェクトから、正規表現に合う ID だけを取り出す（他のフィールドは読まない）。 */
export function safeBuildRef(raw: unknown): SafeBuildRef {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const buildId = typeof o.buildId === "string" && BUILD_ID_RE.test(o.buildId) ? o.buildId : null;
  const worldCardId =
    typeof o.worldCardId === "string" && WORLD_CARD_ID_RE.test(o.worldCardId) ? o.worldCardId : null;
  return { buildId, worldCardId };
}

// ---------------------------------------------------------------------------
// 正規化（決定的な JSON 出力のためにフィールド順・レコードキー順を固定）
// ---------------------------------------------------------------------------

function sortedRecord(rec: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(rec ?? {}).sort()) {
    const v = (rec as Record<string, number>)[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * 1 件の `SavedBuild` を決定的な形へ整える（フィールド順固定・レコードキーをソート）。
 * 値そのものは変えない（配分・rulesVersion・OVR 欠損・null/undefined の保存仕様は維持）。
 * `conditionalBoosterSelections` が未指定なら**キーを出さない**（既存保存仕様と同じ）。
 */
export function canonicalizeExportBuild(b: SavedBuild): SavedBuild {
  const out: SavedBuild = {
    buildId: b.buildId,
    worldCardId: b.worldCardId,
    buildName: b.buildName,
    progressionAllocation: sortedRecord(b.progressionAllocation),
    selectedPlayerBooster: b.selectedPlayerBooster ?? null,
    calculatedStats: sortedRecord(b.calculatedStats),
    calculatedOvr: b.calculatedOvr ?? null,
    calculationMode: b.calculationMode,
    rulesVersion: b.rulesVersion,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    schemaVersion: b.schemaVersion,
  };
  if (Array.isArray(b.conditionalBoosterSelections) && b.conditionalBoosterSelections.length > 0) {
    out.conditionalBoosterSelections = b.conditionalBoosterSelections.map((s) => ({
      boosterKey: s.boosterKey,
      selection: s.selection,
    }));
  }
  if (b.buildIntent) out.buildIntent = canonicalizeBuildIntent(b.buildIntent);
  return out;
}

/** `SavedBuildIntent` を決定的な形へ整える(配列をソート・フィールド順固定)。値そのものは変えない。 */
function canonicalizeBuildIntent(intent: SavedBuildIntent): SavedBuildIntent {
  const sorted = (a: readonly string[]) => [...a].sort();
  const groupPriorities: SavedBuildIntent["groupPriorities"] = {};
  for (const k of Object.keys(intent.groupPriorities).sort()) groupPriorities[k] = intent.groupPriorities[k];
  return {
    intentSchemaVersion: intent.intentSchemaVersion,
    mainPresetId: intent.mainPresetId,
    subPresetIds: sorted(intent.subPresetIds),
    primaryGoal: intent.primaryGoal,
    intendedPositions: sorted(intent.intendedPositions),
    groupPriorities,
    avoidOverinvestmentGroups: sorted(intent.avoidOverinvestmentGroups),
    intentionallyIgnoredGroups: sorted(intent.intentionallyIgnoredGroups),
    strengthsToPreserve: sorted(intent.strengthsToPreserve),
    comparisonTargetBuildId: intent.comparisonTargetBuildId,
    comparisonFocusGroups: sorted(intent.comparisonFocusGroups),
    source: intent.source,
    userModified: intent.userModified,
    updatedAt: intent.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// スキーマ検証（既存 savedBuildSchema をそのまま使う）
// ---------------------------------------------------------------------------

export interface ExportValidationResult {
  valid: SavedBuild[];
  invalid: Array<{ index: number } & SafeBuildRef>;
}

/**
 * 各要素を既存 `savedBuildSchema` で検証する。`.strip()` により未知キーは除去される。
 * 無効な要素は修復も削除もせず、安全な識別情報だけを `invalid` に積む。
 */
export function validateExportBuilds(rawBuilds: readonly unknown[]): ExportValidationResult {
  const valid: SavedBuild[] = [];
  const invalid: Array<{ index: number } & SafeBuildRef> = [];
  rawBuilds.forEach((raw, index) => {
    const parsed = savedBuildSchema.safeParse(raw);
    if (parsed.success) valid.push(parsed.data as SavedBuild);
    else invalid.push({ index, ...safeBuildRef(raw) });
  });
  return { valid, invalid };
}

// ---------------------------------------------------------------------------
// 重複除去・決定的な並び順
// ---------------------------------------------------------------------------

/** 同一 buildId は最初の 1 件だけ残す（順序は保持）。 */
export function dedupeExportBuilds(builds: readonly SavedBuild[]): SavedBuild[] {
  const seen = new Set<string>();
  const out: SavedBuild[] = [];
  for (const b of builds) {
    if (seen.has(b.buildId)) continue;
    seen.add(b.buildId);
    out.push(b);
  }
  return out;
}

/** updatedAt 降順 → buildId 昇順（`listAllBuilds` と同じ規則）。非破壊。 */
export function sortExportBuilds(builds: readonly SavedBuild[]): SavedBuild[] {
  return builds
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.buildId.localeCompare(b.buildId));
}

// ---------------------------------------------------------------------------
// エクスポートファイルの構築とシリアライズ
// ---------------------------------------------------------------------------

/** 検証済みの `SavedBuild[]` から決定的なエクスポートファイルを作る（重複除去 → ソート → 正規化）。 */
export function buildSavedBuildExportFile(
  validBuilds: readonly SavedBuild[],
  exportedAt: string,
): SavedBuildExportFile {
  const builds = sortExportBuilds(dedupeExportBuilds(validBuilds)).map(canonicalizeExportBuild);
  return {
    format: SAVED_BUILD_EXPORT_FORMAT,
    formatVersion: SAVED_BUILD_EXPORT_FORMAT_VERSION,
    app: SAVED_BUILD_EXPORT_APP,
    exportedAt,
    itemCount: builds.length,
    builds,
  };
}

/** UTF-8 JSON（BOM なし・2 スペースインデント）。JavaScript/HTML/CSV へは変換しない。 */
export function serializeSavedBuildExport(file: SavedBuildExportFile): string {
  return JSON.stringify(file, null, 2);
}

export type BuildExportResult =
  | { ok: true; file: SavedBuildExportFile; json: string; itemCount: number }
  | { ok: false; reason: "empty" }
  | {
      ok: false;
      reason: "invalid";
      validCount: number;
      invalidCount: number;
      invalidRefs: SafeBuildRef[];
    };

/**
 * 生の配列（再取得直後の保存ビルド）を検証し、無効が 1 件でもあれば**全体を停止**する。
 * 有効分だけの部分書き出しはしない（ユーザーが明示選択できる既存仕様がないため）。
 */
export function buildExport(input: {
  rawBuilds: readonly unknown[];
  exportedAt: string;
}): BuildExportResult {
  const { valid, invalid } = validateExportBuilds(input.rawBuilds);
  if (invalid.length > 0) {
    return {
      ok: false,
      reason: "invalid",
      validCount: valid.length,
      invalidCount: invalid.length,
      invalidRefs: invalid.map((i) => ({ buildId: i.buildId, worldCardId: i.worldCardId })),
    };
  }
  const deduped = dedupeExportBuilds(valid);
  if (deduped.length === 0) return { ok: false, reason: "empty" };
  const file = buildSavedBuildExportFile(deduped, input.exportedAt);
  return { ok: true, file, json: serializeSavedBuildExport(file), itemCount: file.itemCount };
}

// ---------------------------------------------------------------------------
// 出力直前の再検証（確認開始時のスナップショットと現在の一覧を突き合わせる）
// ---------------------------------------------------------------------------

export type AllExportReconcile =
  | { ok: true }
  | { ok: false; reason: "conflict"; added: string[]; removed: string[] };

/**
 * 全件エクスポート: 確認開始時の buildId 集合と、現在の一覧の buildId 集合を比較する。
 * 件数だけでなく集合を比較し、増減・差し替えがあれば停止（ダウンロードしない）。
 */
export function reconcileAllExport(
  snapshotBuildIds: readonly string[],
  currentBuilds: readonly SavedBuild[],
): AllExportReconcile {
  const before = new Set(snapshotBuildIds);
  const after = new Set(currentBuilds.map((b) => b.buildId));
  const added = [...after].filter((id) => !before.has(id)).sort();
  const removed = [...before].filter((id) => !after.has(id)).sort();
  if (added.length > 0 || removed.length > 0) return { ok: false, reason: "conflict", added, removed };
  return { ok: true };
}

/** 選択エクスポートで確認開始時に控える対象（buildId + worldCardId + updatedAt）。 */
export interface SelectionExportTarget {
  buildId: string;
  worldCardId: string;
  updatedAt: string;
}

export type SelectionExportReconcile =
  | { ok: true; builds: SavedBuild[] }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "conflict"; removed: string[]; changed: string[] };

/**
 * 選択エクスポート: 控えた各対象を現在の一覧で再取得し、
 * buildId・worldCardId（文字列完全一致）・updatedAt が確認開始時から変化していないことを確認する。
 * - 対象が消えていれば `removed`、内容が変わっていれば `changed`。どちらかがあれば停止。
 * - 同一 buildId の重複指定は 1 件に畳む。
 * - 0 件なら `empty`（ダウンロードを開始しない）。
 */
export function reconcileSelectionExport(
  targets: readonly SelectionExportTarget[],
  currentBuilds: readonly SavedBuild[],
): SelectionExportReconcile {
  const byId = new Map<string, SavedBuild>();
  for (const b of currentBuilds) if (!byId.has(b.buildId)) byId.set(b.buildId, b);

  const seen = new Set<string>();
  const uniqueTargets: SelectionExportTarget[] = [];
  for (const t of targets) {
    if (typeof t.buildId !== "string" || seen.has(t.buildId)) continue;
    seen.add(t.buildId);
    uniqueTargets.push(t);
  }
  if (uniqueTargets.length === 0) return { ok: false, reason: "empty" };

  const removed: string[] = [];
  const changed: string[] = [];
  const builds: SavedBuild[] = [];
  for (const t of uniqueTargets) {
    const cur = byId.get(t.buildId);
    if (!cur) {
      removed.push(t.buildId);
      continue;
    }
    if (cur.worldCardId !== t.worldCardId || cur.updatedAt !== t.updatedAt) {
      changed.push(t.buildId);
      continue;
    }
    builds.push(cur);
  }
  if (removed.length > 0 || changed.length > 0) {
    return { ok: false, reason: "conflict", removed: removed.sort(), changed: changed.sort() };
  }
  return { ok: true, builds };
}

// ---------------------------------------------------------------------------
// ファイル名（識別しやすく安全・UTC・秒＋ミリ秒で同一秒の再実行も区別）
// ---------------------------------------------------------------------------

const p2 = (n: number) => String(n).padStart(2, "0");
const p3 = (n: number) => String(n).padStart(3, "0");

/**
 * 既定ファイル名 `efootball-team-ai-builds-YYYY-MM-DD-HHMMSS-mmmZ.json`（UTC）。
 * - 選手名・ビルド名などのユーザー入力は入れない。
 * - Windows 禁止文字・パス区切り・制御文字・空白を含まない（英数字・ハイフン・ドットのみ）。
 * - `exportedAt`（同じ Date から生成）と同じ UTC 時刻。
 * - 不正な Date のときは固定名にフォールバック。
 */
export function buildExportFilename(d: Date): string {
  const t = d instanceof Date ? d.getTime() : NaN;
  let name: string;
  if (!Number.isFinite(t)) {
    name = "efootball-team-ai-builds-export.json";
  } else {
    name =
      "efootball-team-ai-builds-" +
      `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}-` +
      `${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}-` +
      `${p3(d.getUTCMilliseconds())}Z.json`;
  }
  return SAFE_FILENAME_RE.test(name) ? name : "efootball-team-ai-builds-export.json";
}
