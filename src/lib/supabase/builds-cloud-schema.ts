import { savedBuildSchema } from "@/lib/progression/build-storage";
import type { SavedBuild } from "@/lib/progression/types";

/**
 * 保存ビルドのクラウド保存（手動・任意・F-052 第 2 段階・2026-10-11）のペイロードの形・上限・検証（Supabase に接続しない純粋な関数）。
 *
 * - 中身は端末の保存ビルド（`SavedBuild`）をそのまま並べたもの。検証は端末の保存と同じ `savedBuildSchema`（未知のキーは除く）。
 * - 1 件でも壊れていれば、保存も取得も拒否する（黙って捨てない）。buildId の重複も拒否。
 * - 上限は SQL（create-builds-cloud-schema.sql）と同じ: 2000 件・約 900KB。
 */
export const BUILDS_CLOUD_SCHEMA_VERSION = "builds-cloud/2026-10-11.v1";
export const KNOWN_BUILDS_CLOUD_SCHEMA_VERSIONS: readonly string[] = [BUILDS_CLOUD_SCHEMA_VERSION];
export const BUILDS_CLOUD_MAX_ITEMS = 2000;
export const BUILDS_CLOUD_MAX_PAYLOAD_BYTES = 900_000;

export interface CloudBuildsPayload {
  items: SavedBuild[];
}

export type BuildsPayloadValidation = { ok: true; payload: CloudBuildsPayload } | { ok: false; reason: "invalid_item" | "duplicate_id" | "too_many" | "too_large" | "unknown_version" | "not_object" };

function validateItems(raw: unknown[]): BuildsPayloadValidation {
  if (raw.length > BUILDS_CLOUD_MAX_ITEMS) return { ok: false, reason: "too_many" };
  const items: SavedBuild[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const parsed = savedBuildSchema.safeParse(r);
    if (!parsed.success) return { ok: false, reason: "invalid_item" };
    const b = parsed.data as SavedBuild;
    if (seen.has(b.buildId)) return { ok: false, reason: "duplicate_id" };
    seen.add(b.buildId);
    items.push(b);
  }
  // 並びを決める（同じ内容なら同じハッシュ）
  items.sort((a, b) => a.buildId.localeCompare(b.buildId));
  const payload = { items };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > BUILDS_CLOUD_MAX_PAYLOAD_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true, payload };
}

/** 保存する前の検証（端末の保存ビルドの一覧から）。 */
export function validateBuildsForSave(builds: readonly SavedBuild[]): BuildsPayloadValidation {
  return validateItems([...builds]);
}

/** 取得した行の検証（知らない版・形の違い・壊れた要素は拒否）。 */
export function validateFetchedBuildsPayload(data: unknown, schemaVersion: string): BuildsPayloadValidation {
  if (!KNOWN_BUILDS_CLOUD_SCHEMA_VERSIONS.includes(schemaVersion)) return { ok: false, reason: "unknown_version" };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: "not_object" };
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return { ok: false, reason: "not_object" };
  return validateItems(items);
}

/** キーの順を決めた JSON（ハッシュ用）。 */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

export async function computeBuildsPayloadHash(payload: CloudBuildsPayload): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(payload)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 復元の計画: クラウドのビルドのうち、端末に無い buildId だけを追加の候補にする（上書き・削除はしない）。
 * 同じ buildId が端末にあれば、内容が違っても端末を優先する（`sameIdDifferent` に数える）。
 */
export function planBuildsRestore(local: readonly SavedBuild[], cloud: readonly SavedBuild[]): { toAdd: SavedBuild[]; alreadyLocal: number; sameIdDifferent: number } {
  const localById = new Map(local.map((b) => [b.buildId, b]));
  const toAdd: SavedBuild[] = [];
  let alreadyLocal = 0;
  let sameIdDifferent = 0;
  for (const c of cloud) {
    const l = localById.get(c.buildId);
    if (!l) toAdd.push(c);
    else if (canonicalJson(l) === canonicalJson(c)) alreadyLocal += 1;
    else sameIdDifferent += 1;
  }
  return { toAdd, alreadyLocal, sameIdDifferent };
}
