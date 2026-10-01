import { describe, it, expect } from "vitest";
import {
  backupSectionKey,
  deleteCurrentScopeData,
  exportLocalBackup,
  importLocalBackup,
  parseLocalBackup,
  summarizeCurrentScope,
  LOCAL_BACKUP_MAX_BYTES,
} from "./local-backup";
import type { StorageScope } from "@/lib/local-storage-scope/types";

function memoryStorage(failOnSetKey?: string): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failOnSetKey && k === failOnSetKey) throw new Error("quota");
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage & { map: Map<string, string> };
}

const GUEST: StorageScope = { kind: "guest" };
const ACCOUNT: StorageScope = { kind: "account", scopeId: "a".repeat(64) };
const T = "2026-10-01T00:00:00.000Z";
const myTeam = {
  storageVersion: "my-team-storage/v1",
  updatedAt: T,
  records: [{ localRecordId: "mt_abcd1234", teamCardId: "tc_abcd1234", worldCardId: "89138556575063", ownershipStatus: "owned", usageStatus: "main", selectedBuildId: null, favoriteBuildId: null, note: "", tags: [], addedAt: T, updatedAt: T, deletedAt: null, source: "local", syncStatus: "local_only" }],
};
const favorites = { storageVersion: "favorites-storage/v1", updatedAt: T, records: [{ localRecordId: "fav_abcd1234", worldCardId: "89138556575063", note: "", tags: [], addedAt: T, updatedAt: T, source: "local", syncStatus: "local_only" }] };
const history = {
  schema: "efb-diagnosis-history/v1",
  entries: [{ id: "dh_abcd12345678", savedAt: T, squadId: "sq_1", squadLabel: "A", payload: { v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d: "2026-10-01", o: [70, "A"], c: { attack: [40, "C"], defense: [47, "C"], aerial: [54, "C"], speed: [61, "B"], passBuildUp: [68, "B"], dribblePossession: [75, "A"], pressResistance: [82, "A"], counterAttack: [89, "S"] }, s: null, w: null } }],
};

function seed(ls: Storage, scope: StorageScope) {
  ls.setItem(backupSectionKey(scope, "myTeam"), JSON.stringify(myTeam));
  ls.setItem(backupSectionKey(scope, "favorites"), JSON.stringify(favorites));
  ls.setItem(backupSectionKey(scope, "diagnosisHistory"), JSON.stringify(history));
}

describe("F-023b 全データの書き出し・読み込み・削除", () => {
  it("書き出しは現在の領域だけ・件数つき・領域の識別子やユーザー情報を含まない", () => {
    const ls = memoryStorage();
    seed(ls, ACCOUNT);
    ls.setItem(backupSectionKey(GUEST, "myTeam"), JSON.stringify(myTeam)); // 別の領域
    const { file, counts, skipped } = exportLocalBackup(ls, ACCOUNT, new Date(T));
    expect(counts).toEqual({ myTeam: 1, favorites: 1, diagnosisHistory: 1 });
    expect(skipped).toEqual([]);
    const text = JSON.stringify(file);
    expect(text).not.toContain("a".repeat(64));
    expect(text).not.toMatch(/scopeId|userId|email|@/);
  });

  it("壊れた項目は書き出さない（件数に含めない）", () => {
    const ls = memoryStorage();
    seed(ls, GUEST);
    ls.setItem(backupSectionKey(GUEST, "squads"), "{not json");
    const r = exportLocalBackup(ls, GUEST, new Date(T));
    expect(r.skipped).toEqual(["squads"]);
    expect(r.file.sections.squads).toBeUndefined();
  });

  it("読み込みは往復できる（別の領域へも）。ファイルに無い項目は変えない", () => {
    const src = memoryStorage();
    seed(src, GUEST);
    const text = JSON.stringify(exportLocalBackup(src, GUEST, new Date(T)).file);
    const parsed = parseLocalBackup(text);
    expect(parsed).toMatchObject({ ok: true, counts: { myTeam: 1, favorites: 1, diagnosisHistory: 1 } });
    if (!parsed.ok) return;
    const dst = memoryStorage();
    dst.setItem(backupSectionKey(ACCOUNT, "squads"), "[]");
    expect(importLocalBackup(dst, ACCOUNT, parsed.file)).toEqual({ ok: true, written: ["myTeam", "favorites", "diagnosisHistory"] });
    expect(JSON.parse(dst.getItem(backupSectionKey(ACCOUNT, "myTeam"))!)).toEqual(myTeam);
    expect(dst.getItem(backupSectionKey(ACCOUNT, "squads"))).toBe("[]");
  });

  it("不正なファイルは何も書かない（形式・未知の項目・1件でも壊れた項目・大きすぎる・空）", () => {
    const ok = JSON.parse(JSON.stringify({ schema: "efb-local-backup/v1", app: "efootball-team-ai", exportedAt: T, sections: { myTeam } }));
    expect(parseLocalBackup("{")).toMatchObject({ ok: false, reason: "not_json" });
    expect(parseLocalBackup(JSON.stringify({ ...ok, schema: "x" }))).toMatchObject({ ok: false, reason: "not_backup" });
    expect(parseLocalBackup(JSON.stringify({ ...ok, sections: { evil: 1 } }))).toMatchObject({ ok: false, reason: "unknown_section" });
    const broken = { ...myTeam, records: [...myTeam.records, { worldCardId: "<script>" }] };
    expect(parseLocalBackup(JSON.stringify({ ...ok, sections: { myTeam: broken } }))).toMatchObject({ ok: false, reason: "invalid_section", section: "myTeam" });
    expect(parseLocalBackup(JSON.stringify({ ...ok, sections: { squads: [{ squadId: 1 }] } }))).toMatchObject({ ok: false, reason: "invalid_section" });
    expect(parseLocalBackup(JSON.stringify({ ...ok, sections: { myBuilds: { "not-an-id": [] } } }))).toMatchObject({ ok: false, reason: "invalid_section" });
    expect(parseLocalBackup(JSON.stringify({ ...ok, sections: {} }))).toMatchObject({ ok: false, reason: "empty" });
    expect(parseLocalBackup("x".repeat(LOCAL_BACKUP_MAX_BYTES + 1))).toMatchObject({ ok: false, reason: "too_large" });
    expect(parseLocalBackup(JSON.stringify(ok))).toMatchObject({ ok: true });
    // 想定外の項目・__proto__ の項目名（JSON.parse では自分の項目になる）を拒否する。
    expect(parseLocalBackup(JSON.stringify({ ...ok, extra: 1 }))).toMatchObject({ ok: false, reason: "not_backup" });
    expect(parseLocalBackup(`{"schema":"efb-local-backup/v1","app":"efootball-team-ai","exportedAt":"${T}","sections":{"__proto__":{"polluted":true}}}`)).toMatchObject({ ok: false, reason: "unknown_section" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // 診断履歴は通常の保存と同じ上限（50 件）を超えると拒否する。
    const many = { ...history, entries: Array.from({ length: 51 }, (_, i) => ({ ...history.entries[0], id: `dh_abcd${String(i).padStart(8, "0")}` })) };
    expect(parseLocalBackup(JSON.stringify({ ...ok, sections: { diagnosisHistory: many } }))).toMatchObject({ ok: false, reason: "invalid_section" });
  });

  it("書き込み中に失敗したら、書き込む前の値へ戻す", () => {
    const ls = memoryStorage(backupSectionKey(GUEST, "favorites"));
    ls.map.set(backupSectionKey(GUEST, "myTeam"), "OLD");
    const file = { schema: "efb-local-backup/v1" as const, app: "efootball-team-ai" as const, exportedAt: T, sections: { myTeam, favorites } };
    expect(importLocalBackup(ls, GUEST, file)).toEqual({ ok: false, rolledBack: true });
    expect(ls.getItem(backupSectionKey(GUEST, "myTeam"))).toBe("OLD");
    expect(ls.getItem(backupSectionKey(GUEST, "favorites"))).toBeNull();
  });

  it("削除は現在の領域だけ（他の領域・表示設定・レガシー領域は残る）", () => {
    const ls = memoryStorage();
    seed(ls, GUEST);
    seed(ls, ACCOUNT);
    ls.setItem("efootball-team-ai:locale:v1", "ja");
    ls.setItem("efootball-team-ai:my-team:v1", "legacy");
    expect(summarizeCurrentScope(ls, GUEST)).toEqual({ myTeam: 1, favorites: 1, diagnosisHistory: 1 });
    const r = deleteCurrentScopeData(ls, GUEST);
    expect(r).toEqual({ ok: true, removed: ["myTeam", "favorites", "diagnosisHistory"], failed: [] });
    expect(summarizeCurrentScope(ls, GUEST)).toEqual({});
    expect(summarizeCurrentScope(ls, ACCOUNT)).toEqual({ myTeam: 1, favorites: 1, diagnosisHistory: 1 });
    expect(ls.getItem("efootball-team-ai:locale:v1")).toBe("ja");
    expect(ls.getItem("efootball-team-ai:my-team:v1")).toBe("legacy");
  });
});
