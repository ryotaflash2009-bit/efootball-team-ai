import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listSquads,
  listSquadEntries,
  getSquad,
  emptySquad,
  saveSquad,
  renameSquad,
  duplicateSquad,
  deleteSquad,
  isSquadStorageAvailable,
  getActiveSquadsStorageKey,
} from "./squad-storage";
import { setCurrentScope } from "@/lib/local-storage-scope/current-scope-store";

/** テスト内で実際に読み書きされているキー(常にguestスコープ)。 */
const SQUAD_STORAGE_KEY = () => getActiveSquadsStorageKey()!;

function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal("window", { localStorage: storage });
  setCurrentScope({ kind: "guest" });
  return { map, storage };
}

describe("squad-storage（メモリ localStorage）", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("新規作成 → 保存 → 一覧 → 読込", () => {
    const sq = emptySquad("マイスカッド", "4-3-3");
    const r = saveSquad(sq);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(listSquads()).toHaveLength(1);
    expect(getSquad(r.squad.squadId)?.squadName).toBe("マイスカッド");
    expect(r.squad.slots).toHaveLength(11);
  });

  it("複数スカッドを保存できる・更新順で並ぶ", async () => {
    const a = saveSquad(emptySquad("A"));
    await new Promise((r) => setTimeout(r, 5));
    const b = saveSquad(emptySquad("B"));
    expect(listSquads()).toHaveLength(2);
    if (a.ok && b.ok) expect(listSquads()[0].squadId).toBe(b.squad.squadId);
  });

  it("同一 squadId は重複しない（更新扱い）", () => {
    const sq = emptySquad("X");
    saveSquad(sq);
    saveSquad({ ...sq, squadName: "X2" });
    expect(listSquads()).toHaveLength(1);
    expect(listSquads()[0].squadName).toBe("X2");
  });

  it("名前変更", () => {
    const r = saveSquad(emptySquad("旧"));
    if (!r.ok) throw new Error();
    expect(renameSquad(r.squad.squadId, "新").ok).toBe(true);
    expect(getSquad(r.squad.squadId)?.squadName).toBe("新");
    expect(renameSquad(r.squad.squadId, "  ").ok).toBe(false);
  });

  it("複製 → 別IDで「のコピー」・元は残る", () => {
    const r = saveSquad(emptySquad("原本", "4-4-2"));
    if (!r.ok) throw new Error();
    const dup = duplicateSquad(r.squad.squadId);
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    expect(dup.squad.squadId).not.toBe(r.squad.squadId);
    expect(dup.squad.squadName).toContain("コピー");
    expect(dup.squad.formationId).toBe("4-4-2");
    expect(listSquads()).toHaveLength(2);
  });

  it("削除はブラウザ内のユーザー作成スカッドのみ", () => {
    const r = saveSquad(emptySquad("消す"));
    if (!r.ok) throw new Error();
    expect(deleteSquad(r.squad.squadId).ok).toBe(true);
    expect(listSquads()).toHaveLength(0);
  });

  it("スカッド名の長さ制限（1〜50）", () => {
    expect(saveSquad({ ...emptySquad("x"), squadName: "" }).ok).toBe(false);
    const long = saveSquad({ ...emptySquad("x"), squadName: "あ".repeat(80) });
    expect(long.ok).toBe(true);
    if (long.ok) expect(long.squad.squadName.length).toBe(50);
  });

  it("HTML/スクリプト文字列はそのまま文字列として保存（実行されない）", () => {
    const r = saveSquad({ ...emptySquad("x"), squadName: "<script>alert(1)</script>" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.squad.squadName).toBe("<script>alert(1)</script>".slice(0, 50));
  });

  it("重複カード配置を保存時に除去する", () => {
    const sq = emptySquad("dup", "4-3-3");
    sq.slots[1].worldCardId = "12345";
    sq.slots[2].worldCardId = "12345"; // 重複
    const r = saveSquad(sq);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const withCard = r.squad.slots.filter((s) => s.worldCardId === "12345");
    expect(withCard).toHaveLength(1);
  });

  it("選手ブースター（slot/boosterKey/level）を保存・復元し、カード無しスロットでは捨てる", () => {
    const sq = emptySquad("boost", "4-3-3");
    sq.slots[1].worldCardId = "555";
    sq.slots[1].boosters = [{ slot: 1, boosterKey: "ball-carrying", level: 3 }];
    sq.slots[2].boosters = [{ slot: 1, boosterKey: "fantasista", level: 2 }]; // カード無し → 破棄
    const r = saveSquad(sq);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const reload = getSquad(r.squad.squadId)!;
    expect(reload.slots[1].boosters).toEqual([{ slot: 1, boosterKey: "ball-carrying", level: 3 }]);
    expect(reload.slots[2].boosters).toBeUndefined();
  });

  it("不正な boosterKey / level を含む選手ブースターは丸ごと捨てる（既存保存を壊さない）", () => {
    const mem = installMemoryStorage();
    const sq = emptySquad("bad-boost", "4-3-3");
    sq.slots[1].worldCardId = "777";
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    const raw = JSON.parse(mem.storage.getItem(SQUAD_STORAGE_KEY())!);
    raw[0].slots[1].boosters = [{ slot: 9, boosterKey: "NOPE!!", level: 99 }];
    mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify(raw));
    const reload = getSquad(r.squad.squadId)!;
    expect(reload.slots[1].worldCardId).toBe("777");
    expect(reload.slots[1].boosters).toBeUndefined();
  });

  it("Total Package の条件段階（conditionalBoosters）を保存・復元し、カード無しスロットでは捨てる", () => {
    const sq = emptySquad("tp", "4-3-3");
    sq.slots[1].worldCardId = "888";
    sq.slots[1].conditionalBoosters = [{ boosterKey: "total-package", selection: "league_20_plus" }];
    sq.slots[2].conditionalBoosters = [{ boosterKey: "total-package", selection: "league_1_13" }]; // カード無し → 破棄
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    const reload = getSquad(r.squad.squadId)!;
    expect(reload.slots[1].conditionalBoosters).toEqual([{ boosterKey: "total-package", selection: "league_20_plus" }]);
    expect(reload.slots[2].conditionalBoosters).toBeUndefined();
  });

  it("不正な conditionalBoosters は丸ごと捨てる（既存保存を壊さない）", () => {
    const mem = installMemoryStorage();
    const sq = emptySquad("bad-tp", "4-3-3");
    sq.slots[1].worldCardId = "999";
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    const raw = JSON.parse(mem.storage.getItem(SQUAD_STORAGE_KEY())!);
    raw[0].slots[1].conditionalBoosters = [{ boosterKey: "total-package", selection: "garbage" }];
    mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify(raw));
    const reload = getSquad(r.squad.squadId)!;
    expect(reload.slots[1].worldCardId).toBe("999");
    expect(reload.slots[1].conditionalBoosters).toBeUndefined();
  });

  it("conditionalBoosters / conditionalSettings 欄が無い旧保存形式もそのまま読める（後方互換）", () => {
    const mem = installMemoryStorage();
    const sq = emptySquad("legacy-tp", "4-3-3");
    sq.slots[1].worldCardId = "222";
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    const raw = JSON.parse(mem.storage.getItem(SQUAD_STORAGE_KEY())!);
    for (const s of raw[0].slots) delete s.conditionalBoosters;
    delete raw[0].conditionalSettings;
    mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify(raw));
    const reload = getSquad(r.squad.squadId)!;
    expect(reload.slots[1].worldCardId).toBe("222");
    expect(reload.slots[1].conditionalBoosters).toBeUndefined();
    expect(reload.conditionalSettings).toBeUndefined();
  });

  it("conditionalSettings（スカッド全体設定）を保存・復元できる（evaluationMode は manual）", () => {
    const sq = emptySquad("settings", "4-3-3");
    sq.conditionalSettings = {
      targetLeague: "MEIJI YASUDA J1 LEAGUE",
      registeredPlayerCount: 18,
      conditionTier: "league_14_19",
      evaluationMode: "manual",
    };
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    expect(getSquad(r.squad.squadId)?.conditionalSettings).toEqual({
      targetLeague: "MEIJI YASUDA J1 LEAGUE",
      registeredPlayerCount: 18,
      conditionTier: "league_14_19",
      evaluationMode: "manual",
    });
  });

  it("boosters 欄が無い旧保存形式もそのまま読める（後方互換）", () => {
    const mem = installMemoryStorage();
    const sq = emptySquad("legacy", "4-3-3");
    sq.slots[1].worldCardId = "111";
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    const raw = JSON.parse(mem.storage.getItem(SQUAD_STORAGE_KEY())!);
    for (const s of raw[0].slots) delete s.boosters;
    mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify(raw));
    const reload = getSquad(r.squad.squadId)!;
    expect(reload.slots[1].worldCardId).toBe("111");
    expect(reload.slots[1].boosters).toBeUndefined();
  });

  it("壊れた JSON を安全に無視", () => {
    const mem = installMemoryStorage();
    mem.storage.setItem(SQUAD_STORAGE_KEY(), "{ broken");
    expect(listSquads()).toEqual([]);
  });

  it("不正な形（配列でない / 必須欠落）を無視", () => {
    const mem = installMemoryStorage();
    mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify({ not: "an array" }));
    expect(listSquads()).toEqual([]);
    mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify([{ squadId: "bad" }]));
    expect(listSquads()).toEqual([]);
  });

  it("未知の formationId は既定へ正規化", () => {
    const sq = emptySquad("f");
    const r = saveSquad({ ...sq, formationId: "99-99-99" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.squad.formationId).toBe("4-3-3");
  });

  it("listSquadEntries が要約を返す", () => {
    const r = saveSquad(emptySquad("summary", "3-5-2"));
    if (!r.ok) throw new Error();
    const e = listSquadEntries()[0];
    expect(e.formationName).toBe("3-5-2");
    expect(e.startingCount).toBe(0);
    expect(e.benchCount).toBe(0);
  });

  it("選手をスロットへ配置 → 保存 → 再読込しても残る（0/0 に戻らない）", () => {
    const r0 = saveSquad(emptySquad("add-flow", "4-3-3"));
    if (!r0.ok) throw new Error();
    const loaded = getSquad(r0.squad.squadId)!;
    const withPlayer = {
      ...loaded,
      slots: loaded.slots.map((s) => (s.slotId === "cf" ? { ...s, worldCardId: "89138556575063" } : s)),
    };
    const r1 = saveSquad(withPlayer);
    expect(r1.ok).toBe(true);
    const reload = getSquad(r0.squad.squadId)!;
    expect(reload.slots.find((s) => s.slotId === "cf")!.worldCardId).toBe("89138556575063");
    expect(reload.slots.filter((s) => s.worldCardId)).toHaveLength(1);
  });

  it("20 桁の worldCardId が保存・再読込で精度欠落しない", () => {
    const big = "12345678901234567890";
    const sq = emptySquad("big-id", "4-3-3");
    sq.slots[1].worldCardId = big;
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    expect(getSquad(r.squad.squadId)!.slots[1].worldCardId).toBe(big);
  });

  it("1 つのスロットが壊れていても他スロットの選手は保持する", () => {
    const mem = installMemoryStorage();
    const sq = emptySquad("partial", "4-3-3");
    sq.slots[1].worldCardId = "111";
    sq.slots[2].worldCardId = "222";
    const r = saveSquad(sq);
    if (!r.ok) throw new Error();
    const raw = JSON.parse(mem.storage.getItem(SQUAD_STORAGE_KEY())!);
    raw[0].slots[1].worldCardId = "not-a-valid-id"; // 壊す
    mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify(raw));
    const reload = getSquad(r.squad.squadId);
    expect(reload).not.toBeNull();
    expect(reload!.slots[1].worldCardId).toBeNull(); // 壊れたスロットだけ空
    expect(reload!.slots[2].worldCardId).toBe("222"); // 正常スロットは維持
  });

  it("localStorage 不可でもクラッシュしない", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(isSquadStorageAvailable()).toBe(false);
    expect(listSquads()).toEqual([]);
    expect(saveSquad(emptySquad("x")).ok).toBe(false);
    expect(deleteSquad("sq_abcdef123456").ok).toBe(false);
  });

  it("SSR（window なし）でもクラッシュしない", () => {
    vi.unstubAllGlobals();
    expect(isSquadStorageAvailable()).toBe(false);
    expect(listSquads()).toEqual([]);
    expect(getSquad("sq_abcdef123456")).toBeNull();
  });

  // --- スカッド枠の savedBuildId 設定/解除（「保存ビルドを選ぶ」パネル相当・対象枠だけ変更） ---
  describe("枠の savedBuildId は対象枠だけ変更する（saveSquad 経由）", () => {
    /** 先発 2 枠 + ベンチ 1 に別カード・既存 savedBuildId・座標・キャプテンを設定した種スカッド。 */
    function seed() {
      const sq = emptySquad("build-target", "4-3-3");
      const a = sq.slots[1].slotId;
      const b = sq.slots[2].slotId;
      sq.slots[1] = { ...sq.slots[1], worldCardId: "89138556575063", savedBuildId: "b_a000000001", x: 40, y: 12 };
      sq.slots[2] = { ...sq.slots[2], worldCardId: "88041460996837", savedBuildId: "b_b000000001" };
      sq.captainSlotId = a;
      sq.substitutes = [
        { subId: "sub_bench0001", worldCardId: "70000000000001", buildMode: "none", savedBuildId: "b_n000000001" },
      ];
      const r = saveSquad(sq);
      if (!r.ok) throw new Error("seed failed");
      return { id: r.squad.squadId, a, b };
    }

    it("先発枠の savedBuildId 変更 → その枠だけ・他枠/座標/キャプテン/ベンチは不変", () => {
      const { id, a, b } = seed();
      const before = getSquad(id)!;
      const bBefore = before.slots.find((s) => s.slotId === b)!;
      const next = {
        ...before,
        slots: before.slots.map((s) => (s.slotId === a ? { ...s, savedBuildId: "b_a000000002" } : s)),
      };
      expect(saveSquad(next).ok).toBe(true);
      const after = getSquad(id)!;
      const slA = after.slots.find((s) => s.slotId === a)!;
      expect(slA.savedBuildId).toBe("b_a000000002");
      expect(slA.worldCardId).toBe("89138556575063");
      expect(slA.x).toBe(40);
      expect(slA.y).toBe(12);
      expect(after.slots.find((s) => s.slotId === b)).toEqual(bBefore);
      expect(after.captainSlotId).toBe(a);
      expect(after.substitutes).toEqual(before.substitutes);
    });

    it("先発枠の savedBuildId 解除（null）→ その枠だけ・ベンチ/他枠の savedBuildId は不変", () => {
      const { id, a, b } = seed();
      const before = getSquad(id)!;
      const next = {
        ...before,
        slots: before.slots.map((s) => (s.slotId === a ? { ...s, savedBuildId: null } : s)),
      };
      expect(saveSquad(next).ok).toBe(true);
      const after = getSquad(id)!;
      expect(after.slots.find((s) => s.slotId === a)!.savedBuildId).toBeNull();
      expect(after.slots.find((s) => s.slotId === b)!.savedBuildId).toBe("b_b000000001");
      expect(after.substitutes[0].savedBuildId).toBe("b_n000000001");
    });

    it("ベンチ枠の savedBuildId 変更 → subId で特定・そのベンチ枠だけ・先発は不変", () => {
      const { id, a, b } = seed();
      const before = getSquad(id)!;
      const next = {
        ...before,
        substitutes: before.substitutes.map((s) =>
          s.subId === "sub_bench0001" ? { ...s, savedBuildId: "b_n000000002" } : s,
        ),
      };
      expect(saveSquad(next).ok).toBe(true);
      const after = getSquad(id)!;
      expect(after.substitutes[0].savedBuildId).toBe("b_n000000002");
      expect(after.substitutes[0].worldCardId).toBe("70000000000001");
      expect(after.slots.find((s) => s.slotId === a)!.savedBuildId).toBe("b_a000000001");
      expect(after.slots.find((s) => s.slotId === b)!.savedBuildId).toBe("b_b000000001");
    });

    it("別スカッドは一切変更されない", () => {
      const { id, a } = seed();
      const other = saveSquad(emptySquad("other-squad", "4-4-2"));
      if (!other.ok) throw new Error();
      const otherBefore = getSquad(other.squad.squadId)!;
      const s = getSquad(id)!;
      saveSquad({ ...s, slots: s.slots.map((x) => (x.slotId === a ? { ...x, savedBuildId: "b_new0000001" } : x)) });
      expect(getSquad(other.squad.squadId)).toEqual(otherBefore);
    });

    it("不正な buildId は Zod で null に落ちる（別カードへ漏れない）", () => {
      const mem = installMemoryStorage();
      const { id, a } = seed();
      const raw = JSON.parse(mem.storage.getItem(SQUAD_STORAGE_KEY())!);
      const slot = raw[0].slots.find((s: { slotId: string }) => s.slotId === a);
      slot.savedBuildId = "bad id!";
      mem.storage.setItem(SQUAD_STORAGE_KEY(), JSON.stringify(raw));
      const reload = getSquad(id)!;
      expect(reload.slots.find((s) => s.slotId === a)!.savedBuildId).toBeNull();
      expect(reload.slots.find((s) => s.slotId === a)!.worldCardId).toBe("89138556575063");
    });
  });
});
