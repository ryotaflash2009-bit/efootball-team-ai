import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  emptySquad,
  saveSquad,
  getSquad,
  listSquads,
  cloneSquadData,
  duplicateSquad,
} from "./squad-storage";
import {
  saveTemplateFromSquad,
  createEmptyTemplate,
  createSquadFromTemplate,
  listTemplates,
  listTemplateSummaries,
  renameTemplate,
  deleteTemplate,
  parseTemplatesStorage,
} from "./templates";
import { findSquadUsageByWorldCardId } from "./usage";
import { assignWorldCardToSlot, addWorldCardToBench } from "./assign";
import { SQUAD_TEMPLATE_STORAGE_KEY } from "./types";
import type { StoredSquad } from "./types";

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
  });
  return map;
}

const MESSI = "89138556575063";
const CANNA = "88041460996837";
function must(r: { ok: boolean; squad?: StoredSquad }): StoredSquad {
  if (!r.ok || !r.squad) throw new Error(JSON.stringify(r));
  return r.squad;
}

describe("cloneSquadData（深いコピー）", () => {
  it("配列・入れ子オブジェクトを共有しない", () => {
    const sq = emptySquad("x", "4-3-3");
    const c = cloneSquadData(sq);
    expect(c.slots).not.toBe(sq.slots);
    expect(c.setPieces).not.toBe(sq.setPieces);
    c.slots[0].worldCardId = "111";
    expect(sq.slots[0].worldCardId).toBeNull();
  });
});

describe("スカッド複製（自由配置・独立性）", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("複製は新 ID・「のコピー」・座標と設定を保持・複製元に影響しない", () => {
    let sq = emptySquad("原本", "4-3-3");
    sq = must(assignWorldCardToSlot(sq, "cf", MESSI));
    sq = {
      ...sq,
      slots: sq.slots.map((s) => (s.slotId === "cf" ? { ...s, x: 42, y: 19, roleOverride: "SS" } : s)),
      managerId: 5,
      captainSlotId: "cf",
    };
    const saved = must(saveSquad(sq));
    const dup = duplicateSquad(saved.squadId);
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    expect(dup.squad.squadId).not.toBe(saved.squadId);
    expect(dup.squad.squadName).toContain("コピー");
    const cf = dup.squad.slots.find((s) => s.slotId === "cf")!;
    expect(cf.x).toBe(42);
    expect(cf.y).toBe(19);
    expect(cf.roleOverride).toBe("SS");
    expect(dup.squad.managerId).toBe(5);
    expect(dup.squad.captainSlotId).toBe("cf");

    // 複製先を変更 → 複製元は不変
    const dup2 = must(
      saveSquad({
        ...dup.squad,
        slots: dup.squad.slots.map((s) => (s.slotId === "cf" ? { ...s, x: 10, y: 10 } : s)),
      }),
    );
    expect(dup2.slots.find((s) => s.slotId === "cf")!.x).toBe(10);
    expect(getSquad(saved.squadId)!.slots.find((s) => s.slotId === "cf")!.x).toBe(42);
  });
});

describe("テンプレート", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("スカッド → 完全テンプレート → 新規スカッド（座標・設定を保持・独立）", () => {
    let sq = emptySquad("元スカッド", "4-2-3-1");
    sq = must(assignWorldCardToSlot(sq, "cf", MESSI));
    sq = { ...sq, slots: sq.slots.map((s) => (s.slotId === "cf" ? { ...s, x: 30, y: 12 } : s)), managerId: 9 };
    const saved = must(saveSquad(sq));

    const t = saveTemplateFromSquad(getSquad(saved.squadId)!, "攻撃的4231", "説明文");
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.template.templateType).toBe("full");
    expect(t.template.squad.slots.find((s) => s.slotId === "cf")!.x).toBe(30);

    const created = createSquadFromTemplate(t.template.templateId, "テンプレ由来");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.squad.squadId).not.toBe(saved.squadId);
    expect(created.squad.formationId).toBe("4-2-3-1");
    expect(created.squad.slots.find((s) => s.slotId === "cf")!.x).toBe(30);
    expect(created.squad.slots.find((s) => s.slotId === "cf")!.worldCardId).toBe(MESSI);
    expect(created.squad.managerId).toBe(9);

    // 作成済みスカッドを変更 → テンプレートは不変
    saveSquad({ ...created.squad, slots: created.squad.slots.map((s) => (s.slotId === "cf" ? { ...s, x: 99 } : s)) });
    expect(listTemplates()[0].squad.slots.find((s) => s.slotId === "cf")!.x).toBe(30);
  });

  it("空テンプレート（フォーメーションだけ）", () => {
    const t = createEmptyTemplate("空3412", "3-4-2-1");
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.template.templateType).toBe("empty");
    const created = createSquadFromTemplate(t.template.templateId);
    expect(created.ok && created.squad.formationId).toBe("3-4-2-1");
    if (created.ok) expect(created.squad.slots.every((s) => !s.worldCardId)).toBe(true);
  });

  it("rename / delete は 1 件だけ（localStorage 全消去しない）", () => {
    const a = saveTemplateFromSquad(emptySquad("a"), "A");
    const b = saveTemplateFromSquad(emptySquad("b"), "B");
    if (!a.ok || !b.ok) throw new Error();
    renameTemplate(a.template.templateId, "A2");
    expect(listTemplates().find((t) => t.templateId === a.template.templateId)!.templateName).toBe("A2");
    deleteTemplate(a.template.templateId);
    expect(listTemplates()).toHaveLength(1);
    expect(listTemplates()[0].templateId).toBe(b.template.templateId);
  });

  it("parseTemplatesStorage: 壊れた 1 件を捨てて他は残す・未知バージョンは空", () => {
    const g2 = saveTemplateFromSquad(emptySquad("g2"), "G2");
    if (!g2.ok) throw new Error();
    const parsed = parseTemplatesStorage(
      JSON.stringify({
        storageVersion: SQUAD_TEMPLATE_STORAGE_KEY.includes("v1")
          ? "squad-templates-storage/2026-08-30.v1"
          : "squad-templates-storage/2026-08-30.v1",
        templates: [{ templateId: "bad" }, g2.template],
      }),
    );
    expect(parsed.templates).toHaveLength(1);
    expect(parsed.templates[0].templateId).toBe(g2.template.templateId);

    const unknown = parseTemplatesStorage(JSON.stringify({ storageVersion: "other/9.9", templates: [] }));
    expect(unknown.warning).toMatch(/未知/);
  });

  it("listTemplateSummaries: カスタム配置の有無を出す", () => {
    let sq = emptySquad("c", "4-3-3");
    sq = must(assignWorldCardToSlot(sq, "cf", MESSI));
    sq = { ...sq, slots: sq.slots.map((s) => (s.slotId === "cf" ? { ...s, x: 20, y: 8 } : s)) };
    saveTemplateFromSquad(sq, "カスタムあり");
    expect(listTemplateSummaries()[0].hasCustomPositioning).toBe(true);
  });
});

describe("findSquadUsageByWorldCardId", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installMemoryStorage();
  });

  it("複数スカッドでの使用（先発・ベンチ・配置ロール・キャプテン）を返す", () => {
    let a = emptySquad("A", "4-3-3");
    a = must(assignWorldCardToSlot(a, "cf", MESSI));
    a = { ...a, slots: a.slots.map((s) => (s.slotId === "cf" ? { ...s, x: 85, y: 12 } : s)), captainSlotId: "cf" };
    saveSquad(a);

    let b = emptySquad("B", "4-2-3-1");
    b = must(assignWorldCardToSlot(b, "lb", CANNA));
    b = must(addWorldCardToBench(b, MESSI, () => "sub_00000001"));
    saveSquad(b);

    const usage = findSquadUsageByWorldCardId(listSquads(), MESSI);
    expect(usage).toHaveLength(2);
    const starter = usage.find((u) => u.area === "starter")!;
    expect(starter.placementRole).toBe("RWF"); // x=85,y=12 → RWF
    expect(starter.isCaptain).toBe(true);
    const bench = usage.find((u) => u.area === "bench")!;
    expect(bench.benchIndex).toBe(0);
  });

  it("worldCardId は文字列として比較（number は空）", () => {
    let a = emptySquad("A");
    a = must(assignWorldCardToSlot(a, "cf", MESSI));
    saveSquad(a);
    expect(findSquadUsageByWorldCardId(listSquads(), 89138556575063 as unknown as string)).toEqual([]);
  });
});
