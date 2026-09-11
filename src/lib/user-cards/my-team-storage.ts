import { z } from "zod";
import {
  MY_TEAM_STORAGE_KEY,
  MY_TEAM_STORAGE_VERSION,
  OWNERSHIP_STATUSES,
  USAGE_STATUSES,
  type MyTeamRecord,
  type MyTeamStore,
  type OwnershipStatus,
  type UsageStatus,
} from "./types";
import {
  WORLD_CARD_ID_RE,
  LOCAL_RECORD_ID_RE,
  newLocalRecordId,
  sanitizeTags,
  sanitizeNote,
  sanitizeBuildId,
  isValidWorldCardId,
} from "./validation";
import { notifyUserCards } from "./store-events";

/**
 * My Team のローカル保存（localStorage `efootball-team-ai:my-team:v1`）。
 *  - 実際に保有しているカードの管理。SQLite へは保存しない（ログインが無くローカルユーザーを識別できないため）。
 *  - お気に入りとは独立。My Team 追加でお気に入りへ自動追加はしない。My Team 削除でお気に入り / 保存ビルド / スカッドは消さない。
 *  - 保存ビルドは **参照（buildId）のみ**。ビルド本体を複製保存しない。参照先が消えていたら安全に扱う。
 *  - 初期版は同一 worldCardId の重複登録を禁止（teamCardId は将来の複数所持に備えた器）。
 */

const myTeamRecordSchema = z.object({
  localRecordId: z.string().regex(LOCAL_RECORD_ID_RE),
  teamCardId: z.string().regex(LOCAL_RECORD_ID_RE),
  worldCardId: z.string().regex(WORLD_CARD_ID_RE),
  ownershipStatus: z.enum(["owned", "wanted", "released", "unknown"]).catch("owned"),
  usageStatus: z.enum(["main", "rotation", "reserve", "unused", "unknown"]).catch("unknown"),
  selectedBuildId: z.unknown().transform(sanitizeBuildId).catch(null),
  favoriteBuildId: z.unknown().transform(sanitizeBuildId).catch(null),
  note: z.unknown().transform(sanitizeNote).catch(""),
  tags: z.array(z.unknown()).transform(sanitizeTags).catch([] as string[]),
  addedAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().catch(null),
  source: z.literal("local").catch("local"),
  syncStatus: z.literal("local_only").catch("local_only"),
});

const storeSchema = z.object({
  storageVersion: z.string(),
  updatedAt: z.string(),
  // 壊れた 1 レコードで全体を捨てないよう、要素は個別に検証する（parse 側で実施）。
  records: z.array(z.unknown()).catch([] as unknown[]),
});

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const k = "__efb_myteam_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isMyTeamStorageAvailable(): boolean {
  return getStorage() != null;
}

export function parseMyTeamStorage(raw: string | null): { store: MyTeamStore; warning: string | null } {
  const empty: MyTeamStore = { storageVersion: MY_TEAM_STORAGE_VERSION, updatedAt: "", records: [] };
  if (!raw) return { store: empty, warning: null };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { store: empty, warning: "My Team の保存データが壊れていたため空にしました。" };
  }
  const parsed = storeSchema.safeParse(json);
  if (!parsed.success) return { store: empty, warning: "My Team の保存データを検証できなかったため空にしました。" };
  if (!parsed.data.storageVersion.startsWith("my-team-storage/")) {
    return { store: empty, warning: `未知の保存バージョン（${parsed.data.storageVersion}）のため空にしました。` };
  }
  // 要素ごとに検証（壊れたレコードだけ捨てる）→ 有効レコードのみ・worldCardId 重複を除去（deletedAt が null のもの）
  const seen = new Set<string>();
  const records: MyTeamRecord[] = [];
  for (const raw of parsed.data.records) {
    const rec = myTeamRecordSchema.safeParse(raw);
    if (!rec.success) continue;
    if (rec.data.deletedAt != null) continue;
    if (seen.has(rec.data.worldCardId)) continue;
    seen.add(rec.data.worldCardId);
    records.push(rec.data);
  }
  return { store: { ...parsed.data, storageVersion: MY_TEAM_STORAGE_VERSION, records }, warning: null };
}

function readStore(): MyTeamStore {
  const ls = getStorage();
  if (!ls) return { storageVersion: MY_TEAM_STORAGE_VERSION, updatedAt: "", records: [] };
  return parseMyTeamStorage(ls.getItem(MY_TEAM_STORAGE_KEY)).store;
}

let snapshot: MyTeamRecord[] | null = null;
function invalidate(): void {
  snapshot = null;
}

/** テスト専用: localStorage を差し替えた際にスナップショットキャッシュを捨てる。 */
export function __invalidateMyTeamSnapshotForTests(): void {
  invalidate();
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key == null || e.key === MY_TEAM_STORAGE_KEY) {
      invalidate();
      notifyUserCards("my-team");
    }
  });
}

function writeStore(store: MyTeamStore): boolean {
  const ls = getStorage();
  if (!ls) return false;
  try {
    ls.setItem(MY_TEAM_STORAGE_KEY, JSON.stringify({ ...store, updatedAt: new Date().toISOString() }));
    invalidate();
    notifyUserCards("my-team");
    return true;
  } catch {
    return false;
  }
}

/** 安定参照のスナップショット。 */
export function getMyTeam(): MyTeamRecord[] {
  if (snapshot == null) {
    snapshot = readStore().records.slice().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
  return snapshot;
}

export function getMyTeamWorldIdSet(): Set<string> {
  return new Set(readStore().records.map((r) => r.worldCardId));
}

export function getMyTeamByWorldId(worldCardId: string): MyTeamRecord | null {
  return readStore().records.find((r) => r.worldCardId === worldCardId) ?? null;
}

export function getMyTeamRecord(teamCardId: string): MyTeamRecord | null {
  return readStore().records.find((r) => r.teamCardId === teamCardId) ?? null;
}

export interface AddToMyTeamInput {
  worldCardId: string;
  ownershipStatus?: OwnershipStatus;
  usageStatus?: UsageStatus;
  note?: string;
  tags?: string[];
  selectedBuildId?: string | null;
}

export type MyTeamResult = { ok: true; record: MyTeamRecord } | { ok: false; error: string; existing?: MyTeamRecord };

export function addToMyTeam(input: AddToMyTeamInput): MyTeamResult {
  if (!isValidWorldCardId(input.worldCardId)) return { ok: false, error: "カード ID が不正です" };
  const store = readStore();
  const existing = store.records.find((r) => r.worldCardId === input.worldCardId);
  if (existing) return { ok: false, error: "このカードはすでに My Team に登録されています", existing };
  const now = new Date().toISOString();
  const record: MyTeamRecord = {
    localRecordId: newLocalRecordId("myt"),
    teamCardId: newLocalRecordId("tc"),
    worldCardId: input.worldCardId,
    ownershipStatus:
      input.ownershipStatus && OWNERSHIP_STATUSES.includes(input.ownershipStatus) ? input.ownershipStatus : "owned",
    usageStatus:
      input.usageStatus && USAGE_STATUSES.includes(input.usageStatus) ? input.usageStatus : "unknown",
    selectedBuildId: sanitizeBuildId(input.selectedBuildId),
    favoriteBuildId: null,
    note: sanitizeNote(input.note ?? ""),
    tags: sanitizeTags(input.tags ?? []),
    addedAt: now,
    updatedAt: now,
    deletedAt: null,
    source: "local",
    syncStatus: "local_only",
  };
  if (!writeStore({ ...store, records: [...store.records, record] })) {
    return { ok: false, error: "このブラウザでは保存できません（localStorage 不可）" };
  }
  return { ok: true, record };
}

export function updateMyTeamRecord(
  teamCardId: string,
  patch: Partial<Pick<MyTeamRecord, "ownershipStatus" | "usageStatus" | "selectedBuildId" | "favoriteBuildId" | "note" | "tags">>,
): { ok: boolean; error?: string } {
  const store = readStore();
  const idx = store.records.findIndex((r) => r.teamCardId === teamCardId);
  if (idx < 0) return { ok: false, error: "My Team の記録が見つかりません" };
  const cur = store.records[idx];
  const next: MyTeamRecord = {
    ...cur,
    ownershipStatus:
      patch.ownershipStatus && OWNERSHIP_STATUSES.includes(patch.ownershipStatus)
        ? patch.ownershipStatus
        : cur.ownershipStatus,
    usageStatus:
      patch.usageStatus && USAGE_STATUSES.includes(patch.usageStatus) ? patch.usageStatus : cur.usageStatus,
    selectedBuildId:
      patch.selectedBuildId !== undefined ? sanitizeBuildId(patch.selectedBuildId) : cur.selectedBuildId,
    favoriteBuildId:
      patch.favoriteBuildId !== undefined ? sanitizeBuildId(patch.favoriteBuildId) : cur.favoriteBuildId,
    note: patch.note != null ? sanitizeNote(patch.note) : cur.note,
    tags: patch.tags != null ? sanitizeTags(patch.tags) : cur.tags,
    updatedAt: new Date().toISOString(),
  };
  const records = [...store.records];
  records[idx] = next;
  if (!writeStore({ ...store, records })) return { ok: false, error: "このブラウザでは保存できません" };
  return { ok: true };
}

/** My Team からのみ削除。お気に入り / 保存ビルド / スカッド / 比較には触れない。 */
export function removeFromMyTeam(teamCardId: string): { ok: boolean; error?: string } {
  const store = readStore();
  const next = store.records.filter((r) => r.teamCardId !== teamCardId);
  if (next.length === store.records.length) return { ok: true };
  if (!writeStore({ ...store, records: next })) return { ok: false, error: "このブラウザでは保存できません" };
  return { ok: true };
}
