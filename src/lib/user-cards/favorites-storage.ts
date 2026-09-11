import { z } from "zod";
import {
  FAVORITES_STORAGE_KEY,
  FAVORITES_STORAGE_VERSION,
  type FavoriteRecord,
  type FavoritesStore,
} from "./types";
import {
  WORLD_CARD_ID_RE,
  LOCAL_RECORD_ID_RE,
  newLocalRecordId,
  sanitizeTags,
  sanitizeNote,
  isValidWorldCardId,
} from "./validation";
import { notifyUserCards } from "./store-events";

/**
 * お気に入りのローカル保存（localStorage `efootball-team-ai:favorites:v1`）。
 *  - 外部アカウント・クラウド同期なし。SQLite へは保存しない。
 *  - SSR / localStorage 不可 / 壊れた JSON でも呼び出し側がクラッシュしないよう安全な既定値を返す。
 *  - 読み込み時に Zod で検証し、壊れたレコードは黙って捨てる（保存全体は壊さない）。
 *  - My Team とは独立。お気に入り解除は My Team / 保存ビルド / スカッド / 比較に影響しない。
 */

const favoriteRecordSchema = z.object({
  localRecordId: z.string().regex(LOCAL_RECORD_ID_RE),
  worldCardId: z.string().regex(WORLD_CARD_ID_RE),
  note: z.unknown().transform(sanitizeNote).catch(""),
  tags: z.array(z.unknown()).transform(sanitizeTags).catch([] as string[]),
  addedAt: z.string(),
  updatedAt: z.string(),
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
    const k = "__efb_fav_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isFavoritesStorageAvailable(): boolean {
  return getStorage() != null;
}

/** 生の文字列 → 検証済みストア（壊れていれば空・不明バージョンは空へフォールバック）。 */
export function parseFavoritesStorage(raw: string | null): { store: FavoritesStore; warning: string | null } {
  const empty: FavoritesStore = { storageVersion: FAVORITES_STORAGE_VERSION, updatedAt: "", records: [] };
  if (!raw) return { store: empty, warning: null };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { store: empty, warning: "お気に入りの保存データが壊れていたため空にしました。" };
  }
  const parsed = storeSchema.safeParse(json);
  if (!parsed.success) return { store: empty, warning: "お気に入りの保存データを検証できなかったため空にしました。" };
  if (parsed.data.storageVersion !== FAVORITES_STORAGE_VERSION) {
    // 既知の移行なし → v1 のみ。将来 v2 が来たら migrate をここに追加。
    if (!parsed.data.storageVersion.startsWith("favorites-storage/")) {
      return { store: empty, warning: `未知の保存バージョン（${parsed.data.storageVersion}）のため空にしました。` };
    }
  }
  // 要素ごとに検証（壊れたレコードだけ捨てる）→ worldCardId 重複を除去（最初の1件を残す）
  const seen = new Set<string>();
  const records: FavoriteRecord[] = [];
  for (const raw of parsed.data.records) {
    const rec = favoriteRecordSchema.safeParse(raw);
    if (!rec.success) continue;
    if (seen.has(rec.data.worldCardId)) continue;
    seen.add(rec.data.worldCardId);
    records.push(rec.data);
  }
  return { store: { ...parsed.data, storageVersion: FAVORITES_STORAGE_VERSION, records }, warning: null };
}

function readStore(): FavoritesStore {
  const ls = getStorage();
  if (!ls) return { storageVersion: FAVORITES_STORAGE_VERSION, updatedAt: "", records: [] };
  return parseFavoritesStorage(ls.getItem(FAVORITES_STORAGE_KEY)).store;
}

/** useSyncExternalStore 用の安定スナップショット（書き込み / cross-tab で無効化）。 */
let snapshot: FavoriteRecord[] | null = null;
function invalidate(): void {
  snapshot = null;
}

/** テスト専用: localStorage を差し替えた際にスナップショットキャッシュを捨てる。 */
export function __invalidateFavoritesSnapshotForTests(): void {
  invalidate();
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key == null || e.key === FAVORITES_STORAGE_KEY) {
      invalidate();
      notifyUserCards("favorites");
    }
  });
}

function writeStore(store: FavoritesStore): boolean {
  const ls = getStorage();
  if (!ls) return false;
  try {
    ls.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ ...store, updatedAt: new Date().toISOString() }));
    invalidate();
    notifyUserCards("favorites");
    return true;
  } catch {
    return false;
  }
}

/** 安定参照のスナップショット（同じ内容なら同じ配列を返す）。 */
export function getFavorites(): FavoriteRecord[] {
  if (snapshot == null) {
    snapshot = readStore().records.slice().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
  return snapshot;
}

export function getFavoriteIdSet(): Set<string> {
  return new Set(readStore().records.map((r) => r.worldCardId));
}

export function isFavorite(worldCardId: string): boolean {
  return readStore().records.some((r) => r.worldCardId === worldCardId);
}

export function getFavorite(worldCardId: string): FavoriteRecord | null {
  return readStore().records.find((r) => r.worldCardId === worldCardId) ?? null;
}

export type FavoriteResult = { ok: true; record: FavoriteRecord } | { ok: false; error: string };

export function addFavorite(worldCardId: string): FavoriteResult {
  if (!isValidWorldCardId(worldCardId)) return { ok: false, error: "カード ID が不正です" };
  const store = readStore();
  const existing = store.records.find((r) => r.worldCardId === worldCardId);
  if (existing) return { ok: true, record: existing };
  const now = new Date().toISOString();
  const record: FavoriteRecord = {
    localRecordId: newLocalRecordId("fav"),
    worldCardId,
    note: "",
    tags: [],
    addedAt: now,
    updatedAt: now,
    source: "local",
    syncStatus: "local_only",
  };
  if (!writeStore({ ...store, records: [...store.records, record] })) {
    return { ok: false, error: "このブラウザでは保存できません（localStorage 不可）" };
  }
  return { ok: true, record };
}

export function removeFavorite(worldCardId: string): { ok: boolean; error?: string } {
  const store = readStore();
  const next = store.records.filter((r) => r.worldCardId !== worldCardId);
  if (next.length === store.records.length) return { ok: true };
  if (!writeStore({ ...store, records: next })) return { ok: false, error: "このブラウザでは保存できません" };
  return { ok: true };
}

export function toggleFavorite(worldCardId: string): { ok: boolean; favorite: boolean; error?: string } {
  if (isFavorite(worldCardId)) {
    const r = removeFavorite(worldCardId);
    return { ok: r.ok, favorite: r.ok ? false : true, error: r.error };
  }
  const r = addFavorite(worldCardId);
  return { ok: r.ok, favorite: r.ok ? true : false, error: r.ok ? undefined : r.error };
}

export function updateFavorite(
  worldCardId: string,
  patch: { note?: string; tags?: string[] },
): { ok: boolean; error?: string } {
  const store = readStore();
  const idx = store.records.findIndex((r) => r.worldCardId === worldCardId);
  if (idx < 0) return { ok: false, error: "お気に入りに登録されていません" };
  const cur = store.records[idx];
  const next: FavoriteRecord = {
    ...cur,
    note: patch.note != null ? sanitizeNote(patch.note) : cur.note,
    tags: patch.tags != null ? sanitizeTags(patch.tags) : cur.tags,
    updatedAt: new Date().toISOString(),
  };
  const records = [...store.records];
  records[idx] = next;
  if (!writeStore({ ...store, records })) return { ok: false, error: "このブラウザでは保存できません" };
  return { ok: true };
}
