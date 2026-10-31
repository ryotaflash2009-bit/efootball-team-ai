import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  sanitizeTag,
  sanitizeTags,
  sanitizeNote,
  isValidWorldCardId,
  isIsoDate,
  sanitizeBuildId,
  TAG_MAX_LEN,
  MAX_TAGS,
  NOTE_MAX_LEN,
} from "./validation";
import * as fav from "./favorites-storage";
import * as team from "./my-team-storage";
import { __invalidateFavoritesSnapshotForTests } from "./favorites-storage";
import { __invalidateMyTeamSnapshotForTests } from "./my-team-storage";
import { FAVORITES_STORAGE_VERSION, MY_TEAM_STORAGE_VERSION } from "./types";
import { filterAndSortUserCards, facetsFromRows, type UserCardRow } from "./filter";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { setCurrentScope, __resetCurrentScopeForTests } from "@/lib/local-storage-scope/current-scope-store";

function installMemoryStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  __invalidateFavoritesSnapshotForTests();
  __invalidateMyTeamSnapshotForTests();
  // My Teamはアカウント別スコープ対応のため、書き込みには解決済みスコープが必要
  // (このファイルの既存テストは「アカウント分離とは無関係な、guestスコープでの
  // 従来どおりの動作」を検証する想定のため、guestスコープを明示的に設定する)。
  __resetCurrentScopeForTests();
  setCurrentScope({ kind: "guest" });
  return map;
}

const MESSI = "89138556575063";
const CANNA = "88041460996837";

// -------------------- 検証 --------------------

describe("validation（純関数）", () => {
  it("worldCardId は数字 1〜20 桁のみ", () => {
    expect(isValidWorldCardId(MESSI)).toBe(true);
    expect(isValidWorldCardId("abc")).toBe(false);
    expect(isValidWorldCardId("")).toBe(false);
    expect(isValidWorldCardId("123456789012345678901")).toBe(false); // 21 桁
    expect(isValidWorldCardId(123 as unknown)).toBe(false);
    expect(isValidWorldCardId(null)).toBe(false);
  });

  it("sanitizeTag: 前後空白除去・制御文字除去・空/長すぎ", () => {
    expect(sanitizeTag("  主力  ")).toBe("主力");
    expect(sanitizeTag("a\u0000b\u0007c")).toBe("abc");
    expect(sanitizeTag("")).toBeNull();
    expect(sanitizeTag("   ")).toBeNull();
    expect(sanitizeTag("x".repeat(TAG_MAX_LEN + 10))).toHaveLength(TAG_MAX_LEN);
    expect(sanitizeTag(42 as unknown)).toBeNull();
    // HTML はプレーン文字列のまま（解釈しない）
    expect(sanitizeTag("<script>alert(1)</script>")).toBe("<script>alert(1)</script>".slice(0, TAG_MAX_LEN));
  });

  it("sanitizeTags: 重複除去・最大数", () => {
    expect(sanitizeTags(["a", "a", "b", " b ", ""])).toEqual(["a", "b"]);
    expect(sanitizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(MAX_TAGS);
    expect(sanitizeTags("not array" as unknown)).toEqual([]);
    expect(sanitizeTags(null)).toEqual([]);
  });

  it("sanitizeNote: 改行維持・制御文字除去・最大長", () => {
    expect(sanitizeNote("line1\nline2")).toBe("line1\nline2");
    expect(sanitizeNote("a\u0000\u0008b")).toBe("ab");
    expect(sanitizeNote("x".repeat(NOTE_MAX_LEN + 50))).toHaveLength(NOTE_MAX_LEN);
    expect(sanitizeNote(123 as unknown)).toBe("");
    expect(sanitizeNote("<b>bold</b>")).toBe("<b>bold</b>"); // HTML 解釈しない
  });

  it("isIsoDate / sanitizeBuildId", () => {
    expect(isIsoDate(new Date().toISOString())).toBe(true);
    expect(isIsoDate("not a date")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(NaN as unknown)).toBe(false);
    expect(sanitizeBuildId("b_abc123")).toBe("b_abc123");
    expect(sanitizeBuildId("has space")).toBeNull();
    expect(sanitizeBuildId(null)).toBeNull();
  });
});

// -------------------- お気に入り --------------------

describe("favorites-storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("追加 → isFavorite → 一覧 → 解除", () => {
    expect(fav.getFavoriteIdSet().size).toBe(0);
    const r = fav.addFavorite(MESSI);
    expect(r.ok).toBe(true);
    expect(fav.isFavorite(MESSI)).toBe(true);
    expect(fav.getFavorites().map((x) => x.worldCardId)).toEqual([MESSI]);
    fav.removeFavorite(MESSI);
    expect(fav.isFavorite(MESSI)).toBe(false);
  });

  it("重複追加は 1 件だけ・同じレコードを返す", () => {
    const a = fav.addFavorite(MESSI);
    const b = fav.addFavorite(MESSI);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.record.localRecordId).toBe(b.record.localRecordId);
    expect(fav.getFavorites()).toHaveLength(1);
  });

  it("不正 worldCardId は追加しない", () => {
    expect(fav.addFavorite("abc").ok).toBe(false);
    expect(fav.addFavorite("").ok).toBe(false);
    expect(fav.getFavoriteIdSet().size).toBe(0);
  });

  it("再読込（同じ localStorage）で維持される", () => {
    fav.addFavorite(MESSI);
    fav.addFavorite(CANNA);
    // 別モジュール参照は不可なので getFavorites を再取得
    expect(new Set(fav.getFavorites().map((x) => x.worldCardId))).toEqual(new Set([MESSI, CANNA]));
  });

  it("note / tags の更新（検証を通す）", () => {
    fav.addFavorite(MESSI);
    fav.updateFavorite(MESSI, { note: "ST 起用\u0000予定", tags: ["主力", "主力", "x".repeat(40)] });
    const rec = fav.getFavorite(MESSI)!;
    expect(rec.note).toBe("ST 起用予定");
    expect(rec.tags).toEqual(["主力", "x".repeat(TAG_MAX_LEN)]);
  });

  it("壊れた JSON は空へフォールバック（保存全体を壊さない）", () => {
    const map = installMemoryStorage();
    map.set("efootball-team-ai:favorites:v1", "{ broken json");
    const { store, warning } = fav.parseFavoritesStorage("{ broken json");
    expect(store.records).toEqual([]);
    expect(warning).toBeTruthy();
  });

  it("未知バージョンは空へフォールバック", () => {
    const raw = JSON.stringify({ storageVersion: "something-else/9.9", updatedAt: "", records: [] });
    const { store, warning } = fav.parseFavoritesStorage(raw);
    expect(store.records).toEqual([]);
    expect(warning).toMatch(/未知の保存バージョン/);
  });

  it("v1 の正しいデータは読める・不正レコードだけ捨てる", () => {
    const raw = JSON.stringify({
      storageVersion: FAVORITES_STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      records: [
        { localRecordId: "fav_abcd1234", worldCardId: MESSI, note: "ok", tags: [], addedAt: "x", updatedAt: "x", source: "local", syncStatus: "local_only" },
        { localRecordId: "bad", worldCardId: "not-a-id", note: "", tags: [], addedAt: "x", updatedAt: "x", source: "local", syncStatus: "local_only" },
      ],
    });
    const { store } = fav.parseFavoritesStorage(raw);
    expect(store.records.map((r) => r.worldCardId)).toEqual([MESSI]);
  });
});

// -------------------- My Team --------------------

describe("my-team-storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("追加 → 既定値（owned / unknown）→ 更新 → 削除", () => {
    const r = team.addToMyTeam({ worldCardId: MESSI });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.ownershipStatus).toBe("owned");
    expect(r.record.usageStatus).toBe("unknown");
    expect(r.record.deletedAt).toBeNull();

    team.updateMyTeamRecord(r.record.teamCardId, { usageStatus: "main", tags: ["主力"], note: "強い" });
    const rec = team.getMyTeamByWorldId(MESSI)!;
    expect(rec.usageStatus).toBe("main");
    expect(rec.tags).toEqual(["主力"]);

    team.removeFromMyTeam(r.record.teamCardId);
    expect(team.getMyTeamByWorldId(MESSI)).toBeNull();
  });

  it("同一 worldCardId の重複登録を防ぐ（既存レコードを返す）", () => {
    team.addToMyTeam({ worldCardId: MESSI });
    const b = team.addToMyTeam({ worldCardId: MESSI });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.existing?.worldCardId).toBe(MESSI);
    expect(team.getMyTeam()).toHaveLength(1);
  });

  it("teamCardId は worldCardId と別（将来の複数所持の器）", () => {
    const r = team.addToMyTeam({ worldCardId: MESSI });
    if (r.ok) {
      expect(r.record.teamCardId).not.toBe(MESSI);
      expect(r.record.teamCardId).toMatch(/^tc_/);
      expect(r.record.localRecordId).toMatch(/^myt_/);
    }
  });

  it("不正 buildId / status は既定へ丸める", () => {
    const r = team.addToMyTeam({
      worldCardId: MESSI,
      ownershipStatus: "invalid" as never,
      usageStatus: "invalid" as never,
      selectedBuildId: "has space",
    });
    if (r.ok) {
      expect(r.record.ownershipStatus).toBe("owned");
      expect(r.record.usageStatus).toBe("unknown");
      expect(r.record.selectedBuildId).toBeNull();
    }
  });

  it("ビルド関連付け: 参照のみ・連結/解除・不正参照は無視", () => {
    const r = team.addToMyTeam({ worldCardId: MESSI });
    if (!r.ok) return;
    const tc = r.record.teamCardId;

    team.updateMyTeamRecord(tc, { selectedBuildId: "b_realbuild01" });
    expect(team.getMyTeamRecord(tc)!.selectedBuildId).toBe("b_realbuild01");

    // 解除
    team.updateMyTeamRecord(tc, { selectedBuildId: null });
    expect(team.getMyTeamRecord(tc)!.selectedBuildId).toBeNull();

    // 不正な buildId は null に丸める（ビルド本体は保持しない = 参照だけ）
    team.updateMyTeamRecord(tc, { selectedBuildId: "<script>" });
    expect(team.getMyTeamRecord(tc)!.selectedBuildId).toBeNull();

    // レコードにビルド本体を複製していない
    expect(Object.keys(team.getMyTeamRecord(tc)!)).not.toContain("calculatedStats");
  });

  it("parseMyTeamStorage: deletedAt があるレコードは除外・重複除去", () => {
    const raw = JSON.stringify({
      storageVersion: MY_TEAM_STORAGE_VERSION,
      updatedAt: "x",
      records: [
        { localRecordId: "myt_a1b2c3d4", teamCardId: "tc_a1b2c3d4", worldCardId: MESSI, ownershipStatus: "owned", usageStatus: "unknown", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: "x", updatedAt: "x", deletedAt: null, source: "local", syncStatus: "local_only" },
        { localRecordId: "myt_e5f6g7h8", teamCardId: "tc_e5f6g7h8", worldCardId: MESSI, ownershipStatus: "owned", usageStatus: "unknown", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: "x", updatedAt: "x", deletedAt: "2026-08-30T00:00:00Z", source: "local", syncStatus: "local_only" },
      ],
    });
    const { store } = team.parseMyTeamStorage(raw);
    expect(store.records).toHaveLength(1);
    expect(store.records[0].teamCardId).toBe("tc_a1b2c3d4");
  });
});

// -------------------- お気に入りと My Team は独立 --------------------

describe("お気に入り / My Team の独立性", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("My Team 追加でお気に入りへ自動追加しない", () => {
    team.addToMyTeam({ worldCardId: MESSI });
    expect(fav.isFavorite(MESSI)).toBe(false);
  });

  it("お気に入り解除で My Team 記録は残る", () => {
    fav.addFavorite(MESSI);
    team.addToMyTeam({ worldCardId: MESSI });
    fav.removeFavorite(MESSI);
    expect(team.getMyTeamByWorldId(MESSI)).not.toBeNull();
  });

  it("My Team 削除でお気に入りは残る", () => {
    fav.addFavorite(MESSI);
    const r = team.addToMyTeam({ worldCardId: MESSI });
    if (r.ok) team.removeFromMyTeam(r.record.teamCardId);
    expect(fav.isFavorite(MESSI)).toBe(true);
  });
});

// -------------------- フィルター / 並び替え --------------------

function fakeCard(over: Partial<WorldPlayerListItem>): WorldPlayerListItem {
  return {
    worldCardId: "1", nameEn: "A", nameJa: "あ", cardType: "STANDARD", registeredPosition: "CF",
    ovrBase: 80, ovrMax: 90, maximumLevel: 30, cardRating: null, playingStyle: null, playingStyleDefensive: null,
    nationality: "Japan", region: null, league: null, team: "Team A", preferredFoot: null, age: 25, height: 180, weight: 75,
    boost1: 0, boost2: 0, appearanceUpdatedAt: null, imageUrlCandidate: null, mobileImageUrlCandidate: null,
    hasEfhubLink: false, efhubCardId: null, ...over,
  };
}

describe("filterAndSortUserCards（純関数）", () => {
  const rows: UserCardRow[] = [
    { worldCardId: "1", addedAt: "2026-08-01", card: fakeCard({ worldCardId: "1", nameEn: "Messi", nameJa: "メッシ", registeredPosition: "SS", ovrMax: 97, team: "Argentina", boost1: 90 }) },
    { worldCardId: "2", addedAt: "2026-08-03", card: fakeCard({ worldCardId: "2", nameEn: "Neuer", nameJa: "ノイアー", registeredPosition: "GK", ovrMax: 90, team: "Germany" }) },
    { worldCardId: "3", addedAt: "2026-08-02", card: null }, // 未解決
  ];
  const base = { q: "", position: "", cardType: "", ownership: "", booster: "" as const, sort: "added_desc" as const };

  it("検索: 名前 / チーム / ID", () => {
    expect(filterAndSortUserCards(rows, { ...base, q: "messi" }).map((r) => r.worldCardId)).toEqual(["1"]);
    expect(filterAndSortUserCards(rows, { ...base, q: "germany" }).map((r) => r.worldCardId)).toEqual(["2"]);
    expect(filterAndSortUserCards(rows, { ...base, q: "3" }).map((r) => r.worldCardId)).toEqual(["3"]);
  });

  it("ポジション絞り込み（未解決カードは除外）", () => {
    expect(filterAndSortUserCards(rows, { ...base, position: "GK" }).map((r) => r.worldCardId)).toEqual(["2"]);
  });

  it("ブースターあり絞り込み", () => {
    expect(filterAndSortUserCards(rows, { ...base, booster: "has" }).map((r) => r.worldCardId)).toEqual(["1"]);
  });

  it("並び替え: OVR / 登録日 / 名前", () => {
    expect(filterAndSortUserCards(rows, { ...base, sort: "ovr_desc" }).map((r) => r.worldCardId)).toEqual(["1", "2", "3"]);
    expect(filterAndSortUserCards(rows, { ...base, sort: "added_asc" }).map((r) => r.worldCardId)).toEqual(["1", "3", "2"]);
    const byName = filterAndSortUserCards(rows, { ...base, sort: "name" }).map((r) => r.worldCardId);
    expect(byName.indexOf("1")).toBeLessThan(byName.indexOf("2")); // Messi < Neuer
  });

  it("並び替え: 名前順は表示言語の名前で並べる（ja は日本語名）", () => {
    const named: UserCardRow[] = [
      { worldCardId: "a", addedAt: "2026-08-01", card: fakeCard({ worldCardId: "a", nameEn: "Alisson", nameJa: "アリソン" }) },
      { worldCardId: "b", addedAt: "2026-08-02", card: fakeCard({ worldCardId: "b", nameEn: "Zidane", nameJa: "ジダン" }) },
      { worldCardId: "c", addedAt: "2026-08-03", card: fakeCard({ worldCardId: "c", nameEn: "Kaka", nameJa: "カカ" }) },
    ];
    const ids = (locale?: "ja" | "en") =>
      filterAndSortUserCards(named, { ...base, sort: "name" }, locale).map((r) => r.worldCardId);
    expect(ids("ja")).toEqual(["a", "c", "b"]); // アリソン < カカ < ジダン
    expect(ids("en")).toEqual(["a", "c", "b"]); // Alisson < Kaka < Zidane
    expect(ids()).toEqual(["a", "c", "b"]);
    const swapped = named.map((r) => (r.worldCardId === "b" ? { ...r, card: fakeCard({ worldCardId: "b", nameEn: "Zidane", nameJa: "イニエスタ" }) } : r));
    expect(filterAndSortUserCards(swapped, { ...base, sort: "name" }, "ja").map((r) => r.worldCardId)).toEqual(["a", "b", "c"]);
    expect(filterAndSortUserCards(swapped, { ...base, sort: "name" }, "en").map((r) => r.worldCardId)).toEqual(["a", "c", "b"]);
  });

  it("スカッドでの使用で絞り込む（My Team）", () => {
    const used: UserCardRow[] = rows.map((r, i) => ({ ...r, squadUsed: i === 0 }));
    expect(filterAndSortUserCards(used, { ...base, squadUse: "used" }).map((r) => r.worldCardId)).toEqual(["1"]);
    expect(filterAndSortUserCards(used, { ...base, squadUse: "unused" }).map((r) => r.worldCardId).sort()).toEqual(["2", "3"]);
    expect(filterAndSortUserCards(used, { ...base, squadUse: "" }).length).toBe(3);
  });

  it("facetsFromRows: 解決済みカードから選択肢", () => {
    const f = facetsFromRows(rows);
    expect(f.positions).toEqual(["GK", "SS"]);
    expect(f.cardTypes).toEqual(["STANDARD"]);
  });

  it("空配列でもクラッシュしない", () => {
    expect(filterAndSortUserCards([], base)).toEqual([]);
    expect(facetsFromRows([])).toEqual({ positions: [], cardTypes: [] });
  });
});
