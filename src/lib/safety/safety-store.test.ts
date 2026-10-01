import { describe, it, expect } from "vitest";
import { readSafety, setRelation, submitReport, withdrawReport, safetyStorageKey } from "./safety-store";

function mem(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
}
const NOW = new Date("2026-10-02T00:00:00Z");
let n = 0;
const id = () => `rep_${String(++n).padStart(4, "0")}`;
const base = { reporter: "me_local", targetKind: "post" as const, targetId: "sample_post_1", targetOwner: "sample_a", reason: "spam" as const, note: " 宣伝が続いています " };

describe("F-056 安全機能のローカル保存", () => {
  it("通報を保存し、同じ対象への重複は拒否、取り下げ後は再び通報できる", () => {
    const ls = mem();
    expect(submitReport(ls, "guest", base, NOW, id)).toEqual({ ok: true });
    expect(readSafety(ls, "guest").reports[0]).toMatchObject({ status: "open", note: "宣伝が続いています" });
    expect(submitReport(ls, "guest", base, NOW, id)).toEqual({ ok: false, reason: "duplicate" });
    expect(withdrawReport(ls, "guest", readSafety(ls, "guest").reports[0].id, NOW)).toBe(true);
    expect(submitReport(ls, "guest", base, NOW, id)).toEqual({ ok: true });
  });

  it("ブロック・ミュートの切り替え（自分自身は不可）。領域ごとに分かれる", () => {
    const ls = mem();
    expect(setRelation(ls, "guest", "me_local", "block", "sample_a", true, NOW)).toEqual({ ok: true });
    expect(setRelation(ls, "guest", "me_local", "mute", "sample_b", true, NOW)).toEqual({ ok: true });
    expect(setRelation(ls, "guest", "me_local", "block", "me_local", true, NOW)).toEqual({ ok: false, reason: "self" });
    expect(readSafety(ls, "guest")).toMatchObject({ blocked: ["sample_a"], muted: ["sample_b"] });
    expect(setRelation(ls, "guest", "me_local", "block", "sample_a", false, NOW)).toEqual({ ok: true });
    expect(readSafety(ls, "guest").blocked).toEqual([]);
    expect(readSafety(ls, `account:${"c".repeat(64)}`)).toMatchObject({ blocked: [], muted: [], reports: [] });
    expect(safetyStorageKey("guest")).not.toBe(safetyStorageKey(`account:${"c".repeat(64)}`));
  });

  it("壊れた保存データは空として扱う（不正な項目は捨てる）", () => {
    const ls = mem();
    ls.setItem(safetyStorageKey("guest"), "{broken");
    expect(readSafety(ls, "guest")).toEqual({ reports: [], blocked: [], muted: [], blockLog: [] });
    ls.setItem(safetyStorageKey("guest"), JSON.stringify({ blocked: ["ok_user", "<x>"], reports: [{ id: 1 }] }));
    expect(readSafety(ls, "guest")).toMatchObject({ blocked: ["ok_user"], reports: [] });
  });
});
