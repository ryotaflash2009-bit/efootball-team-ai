import { z } from "zod";
import {
  WORLD_CARD_ID_RE,
  BUILD_ID_RE,
  TAG_MAX_LEN,
  MAX_TAGS,
  NOTE_MAX_LEN,
  isIsoDate,
} from "@/lib/user-cards/validation";
import {
  OWNERSHIP_STATUSES,
  USAGE_STATUSES,
  type MyTeamRecord,
  type OwnershipStatus,
  type UsageStatus,
} from "@/lib/user-cards/types";

/**
 * My Teamクラウド保存(手動・任意PoC)のペイロード形式・上限・検証。
 *
 * - localStorageの`MyTeamStore`(`my-team-storage.ts`)とは別のスキーマバージョンを持つ
 *   (クラウド側は復元に不要な内部ID(localRecordId/teamCardId)やsource/syncStatusを
 *   含まない、より狭い形式のため)。
 * - ここでの検証は常に「strict」(未知フィールドを許容せず即座に拒否する)。
 *   localStorage側の寛容なパーサー(壊れたレコードだけを捨てて残りを救済する設計)とは
 *   意図的に異なる。クラウド保存/取得の境界では、未知のフィールド・型の混入を
 *   一切許容しない(Prototype Pollutionキーは`z.object(...).strict()`のホワイトリスト
 *   方式により、`__proto__`等の未知キーとして自動的に拒否される)。
 * - この関数群はSupabaseへ一切接続しない純粋な検証ロジックであり、Unit Testだけで
 *   完全に検証できる。
 */

/** 現行のクラウド保存スキーマバージョン。未知のバージョンは復元前に安全に拒否する。 */
export const MY_TEAM_CLOUD_SCHEMA_VERSION = "my-team-cloud/2026-09-12.v1";
/** クライアントが認識できる既知バージョンの一覧(将来バージョンを増やす場合はここへ追加)。 */
export const KNOWN_MY_TEAM_CLOUD_SCHEMA_VERSIONS: readonly string[] = [MY_TEAM_CLOUD_SCHEMA_VERSION];

/**
 * 1ユーザーあたりの最大カード件数。
 * 現行のMy Team実装には件数上限が無いが、World選手カードの総数(数万件規模)を
 * そのまま上限にすると異常に巨大なペイロードを許してしまう。実際に1人のプレイヤーが
 * 保有しうる現実的な件数を大きく上回りつつ、安全側に倒した値として1000件とする。
 * 通常利用を妨げず、かつ異常なペイロードは明確に拒否する(黙って切り詰めない)。
 */
export const MY_TEAM_CLOUD_MAX_ITEMS = 1000;

/** team_data(JSONB)のシリアライズ後の最大バイト数(UTF-8)。約900KB。 */
export const MY_TEAM_CLOUD_MAX_PAYLOAD_BYTES = 900_000;

export interface CloudMyTeamItem {
  worldCardId: string;
  ownershipStatus: MyTeamRecord["ownershipStatus"];
  usageStatus: MyTeamRecord["usageStatus"];
  selectedBuildId: string | null;
  favoriteBuildId: string | null;
  note: string;
  tags: string[];
  addedAt: string;
  updatedAt: string;
}

export interface CloudMyTeamPayload {
  items: CloudMyTeamItem[];
}

/** strict: ホワイトリストに無いキーは即座に検証失敗にする(未知フィールド・Prototype Pollutionキー対策)。 */
const cloudItemSchema = z
  .object({
    worldCardId: z.string().regex(WORLD_CARD_ID_RE),
    ownershipStatus: z
      .string()
      .refine((v): v is OwnershipStatus => (OWNERSHIP_STATUSES as readonly string[]).includes(v)),
    usageStatus: z
      .string()
      .refine((v): v is UsageStatus => (USAGE_STATUSES as readonly string[]).includes(v)),
    selectedBuildId: z.union([z.string().regex(BUILD_ID_RE), z.null()]),
    favoriteBuildId: z.union([z.string().regex(BUILD_ID_RE), z.null()]),
    note: z.string().max(NOTE_MAX_LEN),
    tags: z.array(z.string().max(TAG_MAX_LEN)).max(MAX_TAGS),
    addedAt: z.string().refine(isIsoDate),
    updatedAt: z.string().refine(isIsoDate),
  })
  .strict();

const cloudPayloadSchema = z
  .object({
    items: z.array(cloudItemSchema).max(MY_TEAM_CLOUD_MAX_ITEMS),
  })
  .strict();

export type CloudValidationErrorReason =
  | "INVALID_JSON"
  | "TOO_LARGE"
  | "TOO_MANY_ITEMS"
  | "DUPLICATE_WORLD_CARD_ID"
  | "INVALID_STRUCTURE"
  | "UNKNOWN_SCHEMA_VERSION";

export type CloudValidationResult =
  | { ok: true; payload: CloudMyTeamPayload }
  | { ok: false; error: CloudValidationErrorReason };

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function findDuplicateWorldCardId(items: { worldCardId: string }[]): boolean {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.worldCardId)) return true;
    seen.add(item.worldCardId);
  }
  return false;
}

/**
 * ローカルの`MyTeamRecord`配列から、クラウド保存に必要な最小フィールドだけを取り出す。
 * localRecordId/teamCardId/deletedAt/source/syncStatusは復元に不要なため含めない
 * (teamCardIdはローカル内でのみ意味を持つ内部識別子であり、他機能はworldCardIdで
 * My Teamを参照するため、クラウド復元時に新規生成しても支障が無い)。
 */
export function toCloudItems(records: readonly MyTeamRecord[]): CloudMyTeamItem[] {
  return records.map((r) => ({
    worldCardId: r.worldCardId,
    ownershipStatus: r.ownershipStatus,
    usageStatus: r.usageStatus,
    selectedBuildId: r.selectedBuildId,
    favoriteBuildId: r.favoriteBuildId,
    note: r.note,
    tags: r.tags,
    addedAt: r.addedAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * クラウド保存直前の検証(Section 9/10)。
 * オーバーサイズ・件数超過・重複worldCardId・構造不正のいずれも、黙って切り詰めず
 * 安全に保存を中止できるよう理由コードで返す。
 */
export function validateCloudPayloadForSave(items: CloudMyTeamItem[]): CloudValidationResult {
  if (items.length > MY_TEAM_CLOUD_MAX_ITEMS) return { ok: false, error: "TOO_MANY_ITEMS" };
  if (findDuplicateWorldCardId(items)) return { ok: false, error: "DUPLICATE_WORLD_CARD_ID" };

  const payload: CloudMyTeamPayload = { items };
  let json: string;
  try {
    json = JSON.stringify(payload);
  } catch {
    return { ok: false, error: "INVALID_STRUCTURE" };
  }
  if (utf8ByteLength(json) > MY_TEAM_CLOUD_MAX_PAYLOAD_BYTES) return { ok: false, error: "TOO_LARGE" };

  const parsed = cloudPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "INVALID_STRUCTURE" };
  return { ok: true, payload: parsed.data };
}

/**
 * クラウドから取得したJSON(DBのteam_data列の値)を、ローカルへ適用する前に検証する
 * (Section 19)。不正なJSONは絶対にローカルへ反映しない。
 */
export function validateFetchedCloudPayload(raw: unknown, schemaVersion: string): CloudValidationResult {
  if (!KNOWN_MY_TEAM_CLOUD_SCHEMA_VERSIONS.includes(schemaVersion)) {
    return { ok: false, error: "UNKNOWN_SCHEMA_VERSION" };
  }
  let json: string;
  try {
    json = JSON.stringify(raw);
  } catch {
    return { ok: false, error: "INVALID_JSON" };
  }
  if (utf8ByteLength(json) > MY_TEAM_CLOUD_MAX_PAYLOAD_BYTES) return { ok: false, error: "TOO_LARGE" };

  const parsed = cloudPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "INVALID_STRUCTURE" };
  if (parsed.data.items.length > MY_TEAM_CLOUD_MAX_ITEMS) return { ok: false, error: "TOO_MANY_ITEMS" };
  if (findDuplicateWorldCardId(parsed.data.items)) return { ok: false, error: "DUPLICATE_WORLD_CARD_ID" };
  return { ok: true, payload: parsed.data };
}

/** ハッシュ計算用に、キー順を固定した配列へ正規化する(JSON.stringifyの出力を決定的にするため)。 */
function canonicalizeForHash(payload: CloudMyTeamPayload): string {
  const canonicalItems = payload.items.map((it) => ({
    worldCardId: it.worldCardId,
    ownershipStatus: it.ownershipStatus,
    usageStatus: it.usageStatus,
    selectedBuildId: it.selectedBuildId,
    favoriteBuildId: it.favoriteBuildId,
    note: it.note,
    tags: it.tags,
    addedAt: it.addedAt,
    updatedAt: it.updatedAt,
  }));
  return JSON.stringify({ items: canonicalItems });
}

/**
 * 保存前/取得後の一致確認(Section 12・18)に使うSHA-256(16進64桁)ハッシュ。
 * Web Crypto API(`crypto.subtle`)を使用する(ブラウザー・Node 20+の両方で利用可能)。
 */
export async function computeCloudPayloadHash(payload: CloudMyTeamPayload): Promise<string> {
  const canonical = canonicalizeForHash(payload);
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
