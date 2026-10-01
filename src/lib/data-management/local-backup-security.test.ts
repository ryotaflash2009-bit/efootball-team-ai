import { describe, it, expect } from "vitest";
import { importLocalBackup, parseLocalBackup, LOCAL_BACKUP_MAX_BYTES, backupSectionKey } from "./local-backup";

/** F-023b ローカル Backup の追加のセキュリティ確認（2026-10-02）。 */
const T = "2026-10-01T00:00:00.000Z";
const rec = { localRecordId: "fav_abcd1234", worldCardId: "89138556575063", note: "", tags: [], addedAt: T, updatedAt: T, source: "local", syncStatus: "local_only" };
const favorites = { storageVersion: "favorites-storage/v1", updatedAt: T, records: [rec] };
const file = (sections: Record<string, unknown>, extra: Record<string, unknown> = {}) => JSON.stringify({ schema: "efb-local-backup/v1", app: "efootball-team-ai", exportedAt: T, sections, ...extra });

describe("ローカル Backup の読み込み（悪意のあるファイル）", () => {
  it("上限はバイト数で数える（多バイト文字で上限を超えるものを拒否）", () => {
    expect(parseLocalBackup("あ".repeat(Math.floor(LOCAL_BACKUP_MAX_BYTES / 3) + 1))).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("最上位が object 以外・日時が読めないものは Backup ではない", () => {
    for (const t of ["null", "[]", "1", '"x"', "true"]) expect(parseLocalBackup(t)).toMatchObject({ ok: false });
    expect(parseLocalBackup(file({ favorites }, { exportedAt: "not a date" }))).toMatchObject({ ok: false, reason: "not_backup" });
    expect(parseLocalBackup(JSON.stringify({ schema: "efb-local-backup/v1", app: "other", exportedAt: T, sections: { favorites } }))).toMatchObject({ ok: false, reason: "not_backup" });
    expect(parseLocalBackup(file([] as unknown as Record<string, unknown>))).toMatchObject({ ok: false, reason: "not_backup" });
  });

  it("Object の組み込みの名前（constructor・toString・hasOwnProperty）を項目名として受け付けない", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "prototype"]) {
      expect(parseLocalBackup(file({ [name]: favorites }))).toMatchObject({ ok: false, reason: "unknown_section" });
    }
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false);
  });

  it("深い入れ子・巨大な配列でも例外で落ちずに拒否する", () => {
    const deep = "[".repeat(5000) + "]".repeat(5000);
    expect(parseLocalBackup(`{"schema":"efb-local-backup/v1","app":"efootball-team-ai","exportedAt":"${T}","sections":{"favorites":${deep}}}`)).toMatchObject({ ok: false, reason: "invalid_section" });
    const many = { ...favorites, records: Array.from({ length: 20000 }, () => 1) };
    expect(parseLocalBackup(file({ favorites: many }))).toMatchObject({ ok: false, reason: "invalid_section" });
  });

  it("項目の中の未知のフィールド: 受け付けた場合も、読み込み後の保存値はファイルと同じ文字列だけ（スクリプトとして評価されない）", () => {
    const withExtra = { ...favorites, records: [{ ...rec, injected: "<img src=x onerror=alert(1)>" }] };
    const r = parseLocalBackup(file({ favorites: withExtra }));
    if (!r.ok) {
      expect(r.reason).toBe("invalid_section");
      return;
    }
    const map = new Map<string, string>();
    const ls = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) } as unknown as Storage;
    expect(importLocalBackup(ls, { kind: "guest" }, r.file)).toMatchObject({ ok: true });
    // 書き込まれるのは JSON の文字列（React は文字列として表示し、HTML として解釈しない）。
    expect(JSON.parse(map.get(backupSectionKey({ kind: "guest" }, "favorites"))!)).toEqual(withExtra);
  });
});
