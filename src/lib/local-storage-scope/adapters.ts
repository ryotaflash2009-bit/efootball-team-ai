import { MY_TEAM_STORAGE_VERSION, FAVORITES_STORAGE_VERSION } from "@/lib/user-cards/types";
import { SQUAD_TEMPLATE_STORAGE_VERSION, MAX_SQUAD_TEMPLATES, MAX_SQUADS } from "@/lib/squad/types";
import type { DataKind } from "./types";

/**
 * 各データ種別の実際の保存形式(ラッパー付き/プレーン配列/マップ)の違いを吸収し、
 * 移行プレビュー・バックアップ・移行実行が共通のロジックだけで動作できるようにする層。
 *
 * この層は各機能の詳細スキーマ(Zod)を再実装しない。要素ごとの深い検証は既存の
 * 各ストレージモジュール(my-team-storage.ts等)の責務のままとし、ここでは
 * 「壊れていないか」ではなく「移行のために安全に識別・再構成できるか」だけを見る。
 * 壊れた/型が合わない要素は移行対象から静かに除外する(全体を巻き込んで失敗させない)。
 */

/** 移行・プレビューが扱う最小限の要素表現。 */
export interface ScopedItem {
  /** 重複判定に使う主キー(worldCardId・buildId・squadId・templateId等)。 */
  id: string;
  /** 競合判定の参考情報。信頼できる時計ではないため、自動解決の根拠にはしない。 */
  updatedAt: string | null;
  /** 元の要素そのもの(再構成・内容比較に使う)。 */
  raw: unknown;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function stringField(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function extractFromWrappedArray(raw: unknown, arrayField: string, idField: string): ScopedItem[] {
  const root = asRecord(raw);
  const arr = root ? root[arrayField] : null;
  if (!Array.isArray(arr)) return [];
  const out: ScopedItem[] = [];
  for (const item of arr) {
    const obj = asRecord(item);
    if (!obj) continue;
    const id = stringField(obj, idField);
    if (!id) continue;
    out.push({ id, updatedAt: stringField(obj, "updatedAt"), raw: item });
  }
  return out;
}

function extractFromPlainArray(raw: unknown, idField: string): ScopedItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopedItem[] = [];
  for (const item of raw) {
    const obj = asRecord(item);
    if (!obj) continue;
    const id = stringField(obj, idField);
    if (!id) continue;
    out.push({ id, updatedAt: stringField(obj, "updatedAt"), raw: item });
  }
  return out;
}

function extractFromBuildsMap(raw: unknown): ScopedItem[] {
  const root = asRecord(raw);
  if (!root) return [];
  const out: ScopedItem[] = [];
  for (const value of Object.values(root)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const obj = asRecord(item);
      if (!obj) continue;
      const id = stringField(obj, "buildId");
      if (!id) continue;
      out.push({ id, updatedAt: stringField(obj, "updatedAt"), raw: item });
    }
  }
  return out;
}

/** 生JSON値から、移行対象となる要素一覧を安全に取り出す(壊れた要素は除外・件数に含めない)。 */
export function extractScopedItems(kind: DataKind, raw: unknown): ScopedItem[] {
  switch (kind) {
    case "myTeam":
      return extractFromWrappedArray(raw, "records", "worldCardId");
    case "favorites":
      return extractFromWrappedArray(raw, "records", "worldCardId");
    case "squadTemplates":
      return extractFromWrappedArray(raw, "templates", "templateId");
    case "squads":
      return extractFromPlainArray(raw, "squadId");
    case "myBuilds":
      return extractFromBuildsMap(raw);
    default:
      return [];
  }
}

/** 指定データ種別における、書き込み時の最大件数(既存の各機能の上限との整合)。 */
export function maxItemsForKind(kind: DataKind): number | null {
  switch (kind) {
    case "squads":
      return MAX_SQUADS;
    case "squadTemplates":
      return MAX_SQUAD_TEMPLATES;
    default:
      return null;
  }
}

/**
 * 要素一覧を、そのデータ種別の実際の保存形式(JSON文字列)へ再構成する。
 * `items`の`raw`をそのまま使う(内容を書き換えない)。
 */
export function encodeScopedItems(kind: DataKind, items: readonly ScopedItem[], nowIso: string): string {
  const limit = maxItemsForKind(kind);
  const rawList = (limit != null ? items.slice(0, limit) : items).map((i) => i.raw);
  switch (kind) {
    case "myTeam":
      return JSON.stringify({ storageVersion: MY_TEAM_STORAGE_VERSION, updatedAt: nowIso, records: rawList });
    case "favorites":
      return JSON.stringify({ storageVersion: FAVORITES_STORAGE_VERSION, updatedAt: nowIso, records: rawList });
    case "squadTemplates":
      return JSON.stringify({ storageVersion: SQUAD_TEMPLATE_STORAGE_VERSION, updatedAt: nowIso, templates: rawList });
    case "squads":
      return JSON.stringify(rawList);
    case "myBuilds": {
      const grouped: Record<string, unknown[]> = {};
      for (const item of rawList) {
        const obj = asRecord(item);
        const worldCardId = obj ? stringField(obj, "worldCardId") : null;
        if (!worldCardId) continue;
        (grouped[worldCardId] ??= []).push(item);
      }
      return JSON.stringify(grouped);
    }
    default:
      return JSON.stringify(rawList);
  }
}

function countRawWrappedArray(raw: unknown, arrayField: string): number {
  const root = asRecord(raw);
  const arr = root ? root[arrayField] : null;
  return Array.isArray(arr) ? arr.length : 0;
}
function countRawPlainArray(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}
function countRawBuildsMap(raw: unknown): number {
  const root = asRecord(raw);
  if (!root) return 0;
  let total = 0;
  for (const value of Object.values(root)) {
    if (Array.isArray(value)) total += value.length;
  }
  return total;
}

/**
 * 生JSON内の構造上の要素数(idが取り出せない壊れた要素も含む)。
 * `extractScopedItems(...).length`との差分が「不正データ件数」になる。
 */
export function countRawEntries(kind: DataKind, raw: unknown): number {
  switch (kind) {
    case "myTeam":
    case "favorites":
      return countRawWrappedArray(raw, "records");
    case "squadTemplates":
      return countRawWrappedArray(raw, "templates");
    case "squads":
      return countRawPlainArray(raw);
    case "myBuilds":
      return countRawBuildsMap(raw);
    default:
      return 0;
  }
}

/** 2つの要素が内容まで完全に一致するか(JSON構造としての深い比較)。 */
export function scopedItemsContentEqual(a: ScopedItem, b: ScopedItem): boolean {
  try {
    return JSON.stringify(a.raw) === JSON.stringify(b.raw);
  } catch {
    return false;
  }
}
