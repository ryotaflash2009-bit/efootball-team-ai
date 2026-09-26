import { describe, it, expect } from "vitest";
import {
  DIAGNOSIS_HISTORY_MAX_BYTES,
  DIAGNOSIS_HISTORY_MAX_ENTRIES,
  DIAGNOSIS_HISTORY_SCHEMA,
  addDiagnosisHistory,
  clearDiagnosisHistory,
  diagnosisHistoryKey,
  diagnosisHistoryQuarantineKey,
  exportDiagnosisHistoryJson,
  readDiagnosisHistory,
  removeDiagnosisHistoryEntry,
  type HistoryEnv,
} from "./diagnosis-history";
import type { SquadDiagnosisSharePayloadV1 } from "./squad-diagnosis-share-url";
import type { StorageScope } from "@/lib/local-storage-scope/types";

class MemStorage implements Storage {
  map = new Map<string, string>();
  failWrites = false;
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { if (this.failWrites) throw new Error("quota"); this.map.delete(k); }
  setItem(k: string, v: string) { if (this.failWrites) throw new Error("quota"); this.map.set(k, v); }
}

const P = (score = 71): SquadDiagnosisSharePayloadV1 => ({
  v: 1, k: "sd", r: "squad-diagnosis/2026-09-06.v1", d: "2026-09-27", f: "4-3-3",
  o: [score, score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D"],
  c: { attack: [40, "C"], defense: [47, "C"], aerial: [54, "C"], speed: [61, "B"], passBuildUp: [68, "B"], dribblePossession: [75, "A"], pressResistance: [82, "A"], counterAttack: [89, "S"] },
  s: ["ability", "counterAttack"], w: ["compatibility", null],
});

function env(over: Partial<HistoryEnv> = {}, storage = new MemStorage(), scope: StorageScope | null = { kind: "guest" }) {
  let t = Date.parse("2026-09-27T00:00:00Z");
  let n = 0;
  return {
    storage,
    env: { storage: () => storage, scope: () => scope, now: () => new Date((t += 1000)), randomId: () => `id${String(++n).padStart(10, "0")}`, ...over } as HistoryEnv,
  };
}

describe("診断履歴（ブラウザー内のみ）", () => {
  it("保存・一覧（新しい順）・1件削除・全削除。読み戻して確認する", () => {
    const { env: e } = env();
    expect(addDiagnosisHistory({ payload: P(60), squadId: "sq_a", squadLabel: "Team A" }, e)).toMatchObject({ ok: true, duplicate: false });
    const second = addDiagnosisHistory({ payload: P(80), squadId: "sq_a", squadLabel: "Team A" }, e);
    expect(second.ok).toBe(true);
    const list = readDiagnosisHistory(e);
    expect(list.status).toBe("ok");
    expect(list.entries.map((x) => x.payload.o[0])).toEqual([80, 60]);
    if (!second.ok) return;
    expect(removeDiagnosisHistoryEntry(second.entry.id, e)).toEqual({ ok: true, removed: true });
    expect(readDiagnosisHistory(e).entries).toHaveLength(1);
    expect(clearDiagnosisHistory(e)).toEqual({ ok: true });
    expect(readDiagnosisHistory(e).entries).toHaveLength(0);
  });

  it("同じスカッドで直前と同じ結果は重複として追加しない（日付だけ違っても同じ）", () => {
    const { env: e } = env();
    addDiagnosisHistory({ payload: P(60), squadId: "sq_a", squadLabel: "A" }, e);
    const dup = addDiagnosisHistory({ payload: { ...P(60), d: "2026-09-28" }, squadId: "sq_a", squadLabel: "A" }, e);
    expect(dup).toMatchObject({ ok: true, duplicate: true });
    expect(readDiagnosisHistory(e).entries).toHaveLength(1);
    expect(addDiagnosisHistory({ payload: P(60), squadId: "sq_b", squadLabel: "B" }, e)).toMatchObject({ ok: true, duplicate: false });
  });

  it("上限50件：古いものから削除し、削除件数を返す", () => {
    const { env: e } = env();
    for (let i = 0; i < DIAGNOSIS_HISTORY_MAX_ENTRIES; i++) addDiagnosisHistory({ payload: P(i), squadId: `sq_${i}`, squadLabel: "x" }, e);
    const r = addDiagnosisHistory({ payload: P(99), squadId: "sq_new", squadLabel: "x" }, e);
    expect(r).toMatchObject({ ok: true, trimmed: 1 });
    const list = readDiagnosisHistory(e).entries;
    expect(list).toHaveLength(DIAGNOSIS_HISTORY_MAX_ENTRIES);
    expect(list[0].squadId).toBe("sq_new");
    expect(list.some((x) => x.squadId === "sq_0")).toBe(false);
  });

  it("容量上限を超える場合も古いものから削って収める", () => {
    const { env: e, storage } = env();
    for (let i = 0; i < DIAGNOSIS_HISTORY_MAX_ENTRIES; i++) addDiagnosisHistory({ payload: P(i), squadId: `sq_${i}`, squadLabel: "あ".repeat(60) }, e);
    const raw = storage.getItem(diagnosisHistoryKey({ kind: "guest" }))!;
    expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(DIAGNOSIS_HISTORY_MAX_BYTES);
  });

  it("壊れた項目は個別に除外し、残りは使う", () => {
    const { env: e, storage } = env();
    addDiagnosisHistory({ payload: P(60), squadId: "sq_a", squadLabel: "A" }, e);
    const key = diagnosisHistoryKey({ kind: "guest" });
    const d = JSON.parse(storage.getItem(key)!);
    d.entries.push({ id: "dh_bad", savedAt: "x", squadId: "sq_b", squadLabel: "B", payload: { v: 9 } }, { junk: true });
    storage.setItem(key, JSON.stringify(d));
    const r = readDiagnosisHistory(e);
    expect(r.entries).toHaveLength(1);
    expect(r.corrupted).toBe(2);
  });

  it("全体が読めない場合は空として扱い、次の保存前に隔離キーへ退避する（黙って消さない）", () => {
    const { env: e, storage } = env();
    const key = diagnosisHistoryKey({ kind: "guest" });
    storage.setItem(key, "{not json");
    expect(readDiagnosisHistory(e)).toMatchObject({ status: "ok", entries: [], corrupted: 1 });
    expect(addDiagnosisHistory({ payload: P(60), squadId: "sq_a", squadLabel: "A" }, e).ok).toBe(true);
    expect(storage.getItem(diagnosisHistoryQuarantineKey({ kind: "guest" }))).toBe("{not json");
    expect(JSON.parse(storage.getItem(key)!).schema).toBe(DIAGNOSIS_HISTORY_SCHEMA);
  });

  it("保存できない環境（プライベートブラウズ・容量超過）・スコープ未解決では失敗を返し、成功と誤表示しない", () => {
    const unavailable = env({ storage: () => null }).env;
    expect(readDiagnosisHistory(unavailable).status).toBe("unavailable");
    expect(addDiagnosisHistory({ payload: P(), squadId: "sq_a", squadLabel: "A" }, unavailable)).toEqual({ ok: false, reason: "unavailable" });
    const pending = env({}, new MemStorage(), null).env;
    expect(readDiagnosisHistory(pending).status).toBe("scope_pending");
    expect(clearDiagnosisHistory(pending)).toEqual({ ok: false, reason: "scope_pending" });
    const { env: e, storage } = env();
    storage.failWrites = true;
    expect(addDiagnosisHistory({ payload: P(), squadId: "sq_a", squadLabel: "A" }, e)).toEqual({ ok: false, reason: "write_failed" });
  });

  it("不正な診断データ・スカッドIDは保存しない。ラベルの制御文字は取り除く", () => {
    const { env: e } = env();
    expect(addDiagnosisHistory({ payload: { ...P(), o: [99, "D"] }, squadId: "sq_a", squadLabel: "A" }, e)).toEqual({ ok: false, reason: "invalid" });
    expect(addDiagnosisHistory({ payload: P(), squadId: "../x", squadLabel: "A" }, e)).toEqual({ ok: false, reason: "invalid" });
    const r = addDiagnosisHistory({ payload: P(), squadId: "sq_a", squadLabel: `A${String.fromCharCode(0)}B${String.fromCharCode(0x202e)}C` }, e);
    expect(r.ok && r.entry.squadLabel).toBe("ABC");
  });

  it("スコープごとに別の保存領域（guestとアカウントで混ざらない）", () => {
    const storage = new MemStorage();
    const guest = env({}, storage, { kind: "guest" }).env;
    const account = env({}, storage, { kind: "account", scopeId: "a".repeat(64) }).env;
    addDiagnosisHistory({ payload: P(), squadId: "sq_a", squadLabel: "A" }, guest);
    expect(readDiagnosisHistory(account).entries).toHaveLength(0);
    expect(readDiagnosisHistory(guest).entries).toHaveLength(1);
  });

  it("エクスポートJSONはスカッドID・内部IDを含まない", () => {
    const { env: e } = env();
    addDiagnosisHistory({ payload: P(), squadId: "sq_secretid", squadLabel: "Team" }, e);
    const json = exportDiagnosisHistoryJson(readDiagnosisHistory(e).entries, new Date("2026-09-27T00:00:00Z"));
    expect(json).not.toMatch(/sq_secretid|"id"|dh_/);
    expect(JSON.parse(json)).toMatchObject({ schema: "efb-diagnosis-history-export/v1", entries: [{ squadLabel: "Team" }] });
  });
});
