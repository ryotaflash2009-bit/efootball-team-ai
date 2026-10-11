import { squadSchema } from "@/lib/squad/squad-storage";
import { MAX_SQUADS, type StoredSquad } from "@/lib/squad/types";
import { canonicalJson } from "./builds-cloud-schema";

/**
 * 保存スカッドのクラウド保存（手動・任意・F-052 第 3 段階・2026-10-11）のペイロードの形・上限・検証（Supabase に接続しない純粋な関数）。
 * 方針は保存ビルド（builds-cloud-schema.ts）と同じ: 検証は端末の保存と同じ `squadSchema`・1 件でも壊れていれば拒否・squadId の重複は拒否。
 * 上限は端末の上限（MAX_SQUADS = 50）。SQL 側の上限（200 件・1MB）はそれより広い安全の柵。
 */
export const SQUADS_CLOUD_SCHEMA_VERSION = "squads-cloud/2026-10-11.v1";
export const KNOWN_SQUADS_CLOUD_SCHEMA_VERSIONS: readonly string[] = [SQUADS_CLOUD_SCHEMA_VERSION];
export const SQUADS_CLOUD_MAX_ITEMS = MAX_SQUADS;
export const SQUADS_CLOUD_MAX_PAYLOAD_BYTES = 900_000;

export interface CloudSquadsPayload {
  items: StoredSquad[];
}

export type SquadsPayloadValidation = { ok: true; payload: CloudSquadsPayload } | { ok: false; reason: "invalid_item" | "duplicate_id" | "too_many" | "too_large" | "unknown_version" | "not_object" };

function validateItems(raw: unknown[]): SquadsPayloadValidation {
  if (raw.length > SQUADS_CLOUD_MAX_ITEMS) return { ok: false, reason: "too_many" };
  const items: StoredSquad[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const parsed = squadSchema.safeParse(r);
    if (!parsed.success) return { ok: false, reason: "invalid_item" };
    const sq = parsed.data as StoredSquad;
    if (seen.has(sq.squadId)) return { ok: false, reason: "duplicate_id" };
    seen.add(sq.squadId);
    items.push(sq);
  }
  items.sort((a, b) => a.squadId.localeCompare(b.squadId));
  const payload = { items };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > SQUADS_CLOUD_MAX_PAYLOAD_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true, payload };
}

export function validateSquadsForSave(squads: readonly StoredSquad[]): SquadsPayloadValidation {
  return validateItems([...squads]);
}

export function validateFetchedSquadsPayload(data: unknown, schemaVersion: string): SquadsPayloadValidation {
  if (!KNOWN_SQUADS_CLOUD_SCHEMA_VERSIONS.includes(schemaVersion)) return { ok: false, reason: "unknown_version" };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: "not_object" };
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return { ok: false, reason: "not_object" };
  return validateItems(items);
}

export async function computeSquadsPayloadHash(payload: CloudSquadsPayload): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(payload)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 復元の計画: 端末に無い squadId だけを追加の候補にする（上書き・削除はしない・同じ ID で内容が違えば端末を優先）。 */
export function planSquadsRestore(local: readonly StoredSquad[], cloud: readonly StoredSquad[]): { toAdd: StoredSquad[]; alreadyLocal: number; sameIdDifferent: number } {
  const byId = new Map(local.map((s) => [s.squadId, s]));
  const toAdd: StoredSquad[] = [];
  let alreadyLocal = 0;
  let sameIdDifferent = 0;
  for (const c of cloud) {
    const l = byId.get(c.squadId);
    if (!l) toAdd.push(c);
    else if (canonicalJson(l) === canonicalJson(c)) alreadyLocal += 1;
    else sameIdDifferent += 1;
  }
  return { toAdd, alreadyLocal, sameIdDifferent };
}
