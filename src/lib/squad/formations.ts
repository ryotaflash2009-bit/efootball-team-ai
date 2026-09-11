import type { FormationDef, FormationSlot, SlotRole } from "./types";

/**
 * フォーメーション定義（データ駆動）。
 * - 座標: x = 0(左)〜100(右)、y = 0(相手ゴール/攻撃方向)〜100(自ゴール)。
 * - ピッチコンポーネントはこの x/y をそのまま % 配置に使う（コンポーネントへ座標をハードコードしない）。
 * - 監督データの formation が NULL でも、監督の正式布陣とは推測しない。これはユーザーが選ぶ設定。
 * - eFootball のポジション表記: GK CB LB RB DMF CMF LMF RMF AMF LWF RWF SS CF。
 */

function slot(
  slotId: string,
  position: string,
  x: number,
  y: number,
  role: SlotRole,
  line: number,
  displayOrder: number,
): FormationSlot {
  return { slotId, position, x, y, role, line, displayOrder };
}

const GK = (order: number) => slot("gk", "GK", 50, 93, "GK", 0, order);

// 各フォーメーション: GK を先頭に、後ろ(守備)→前(攻撃)の順で並べる。
const DEFS: FormationDef[] = [
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: [
      GK(1),
      slot("lb", "LB", 15, 72, "DF", 1, 2),
      slot("lcb", "CB", 38, 77, "DF", 1, 3),
      slot("rcb", "CB", 62, 77, "DF", 1, 4),
      slot("rb", "RB", 85, 72, "DF", 1, 5),
      slot("dmf", "DMF", 50, 58, "MF", 2, 6),
      slot("lcmf", "CMF", 33, 44, "MF", 3, 7),
      slot("rcmf", "CMF", 67, 44, "MF", 3, 8),
      slot("lwf", "LWF", 16, 22, "FW", 4, 9),
      slot("cf", "CF", 50, 15, "FW", 4, 10),
      slot("rwf", "RWF", 84, 22, "FW", 4, 11),
    ],
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: [
      GK(1),
      slot("lb", "LB", 15, 73, "DF", 1, 2),
      slot("lcb", "CB", 38, 78, "DF", 1, 3),
      slot("rcb", "CB", 62, 78, "DF", 1, 4),
      slot("rb", "RB", 85, 73, "DF", 1, 5),
      slot("ldmf", "DMF", 36, 57, "MF", 2, 6),
      slot("rdmf", "DMF", 64, 57, "MF", 2, 7),
      slot("lmf", "LMF", 16, 38, "MF", 3, 8),
      slot("amf", "AMF", 50, 36, "MF", 3, 9),
      slot("rmf", "RMF", 84, 38, "MF", 3, 10),
      slot("cf", "CF", 50, 15, "FW", 4, 11),
    ],
  },
  {
    id: "4-2-1-3",
    name: "4-2-1-3",
    slots: [
      GK(1),
      slot("lb", "LB", 15, 73, "DF", 1, 2),
      slot("lcb", "CB", 38, 78, "DF", 1, 3),
      slot("rcb", "CB", 62, 78, "DF", 1, 4),
      slot("rb", "RB", 85, 73, "DF", 1, 5),
      slot("ldmf", "DMF", 35, 58, "MF", 2, 6),
      slot("rdmf", "DMF", 65, 58, "MF", 2, 7),
      slot("amf", "AMF", 50, 40, "MF", 3, 8),
      slot("lwf", "LWF", 17, 20, "FW", 4, 9),
      slot("cf", "CF", 50, 14, "FW", 4, 10),
      slot("rwf", "RWF", 83, 20, "FW", 4, 11),
    ],
  },
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: [
      GK(1),
      slot("lb", "LB", 14, 73, "DF", 1, 2),
      slot("lcb", "CB", 37, 78, "DF", 1, 3),
      slot("rcb", "CB", 63, 78, "DF", 1, 4),
      slot("rb", "RB", 86, 73, "DF", 1, 5),
      slot("lmf", "LMF", 13, 48, "MF", 2, 6),
      slot("lcmf", "CMF", 38, 50, "MF", 2, 7),
      slot("rcmf", "CMF", 62, 50, "MF", 2, 8),
      slot("rmf", "RMF", 87, 48, "MF", 2, 9),
      slot("lcf", "CF", 38, 17, "FW", 3, 10),
      slot("rcf", "CF", 62, 17, "FW", 3, 11),
    ],
  },
  {
    id: "4-2-2-2",
    name: "4-2-2-2",
    slots: [
      GK(1),
      slot("lb", "LB", 14, 73, "DF", 1, 2),
      slot("lcb", "CB", 37, 78, "DF", 1, 3),
      slot("rcb", "CB", 63, 78, "DF", 1, 4),
      slot("rb", "RB", 86, 73, "DF", 1, 5),
      slot("ldmf", "DMF", 34, 57, "MF", 2, 6),
      slot("rdmf", "DMF", 66, 57, "MF", 2, 7),
      slot("lamf", "AMF", 31, 37, "MF", 3, 8),
      slot("ramf", "AMF", 69, 37, "MF", 3, 9),
      slot("lcf", "CF", 38, 16, "FW", 4, 10),
      slot("rcf", "CF", 62, 16, "FW", 4, 11),
    ],
  },
  {
    id: "4-1-2-3",
    name: "4-1-2-3",
    slots: [
      GK(1),
      slot("lb", "LB", 15, 72, "DF", 1, 2),
      slot("lcb", "CB", 38, 77, "DF", 1, 3),
      slot("rcb", "CB", 62, 77, "DF", 1, 4),
      slot("rb", "RB", 85, 72, "DF", 1, 5),
      slot("dmf", "DMF", 50, 60, "MF", 2, 6),
      slot("lcmf", "CMF", 34, 45, "MF", 3, 7),
      slot("rcmf", "CMF", 66, 45, "MF", 3, 8),
      slot("lwf", "LWF", 16, 21, "FW", 4, 9),
      slot("cf", "CF", 50, 14, "FW", 4, 10),
      slot("rwf", "RWF", 84, 21, "FW", 4, 11),
    ],
  },
  {
    id: "3-4-3",
    name: "3-4-3",
    slots: [
      GK(1),
      slot("lcb", "CB", 28, 76, "DF", 1, 2),
      slot("ccb", "CB", 50, 79, "DF", 1, 3),
      slot("rcb", "CB", 72, 76, "DF", 1, 4),
      slot("lmf", "LMF", 12, 52, "MF", 2, 5),
      slot("lcmf", "CMF", 38, 54, "MF", 2, 6),
      slot("rcmf", "CMF", 62, 54, "MF", 2, 7),
      slot("rmf", "RMF", 88, 52, "MF", 2, 8),
      slot("lwf", "LWF", 18, 20, "FW", 3, 9),
      slot("cf", "CF", 50, 14, "FW", 3, 10),
      slot("rwf", "RWF", 82, 20, "FW", 3, 11),
    ],
  },
  {
    id: "3-4-2-1",
    name: "3-4-2-1",
    slots: [
      GK(1),
      slot("lcb", "CB", 28, 76, "DF", 1, 2),
      slot("ccb", "CB", 50, 79, "DF", 1, 3),
      slot("rcb", "CB", 72, 76, "DF", 1, 4),
      slot("lmf", "LMF", 12, 54, "MF", 2, 5),
      slot("lcmf", "CMF", 38, 56, "MF", 2, 6),
      slot("rcmf", "CMF", 62, 56, "MF", 2, 7),
      slot("rmf", "RMF", 88, 54, "MF", 2, 8),
      slot("lamf", "AMF", 35, 34, "MF", 3, 9),
      slot("ramf", "AMF", 65, 34, "MF", 3, 10),
      slot("cf", "CF", 50, 14, "FW", 4, 11),
    ],
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    slots: [
      GK(1),
      slot("lcb", "CB", 28, 77, "DF", 1, 2),
      slot("ccb", "CB", 50, 80, "DF", 1, 3),
      slot("rcb", "CB", 72, 77, "DF", 1, 4),
      slot("dmf", "DMF", 50, 60, "MF", 2, 5),
      slot("lmf", "LMF", 12, 52, "MF", 3, 6),
      slot("lcmf", "CMF", 34, 46, "MF", 3, 7),
      slot("rcmf", "CMF", 66, 46, "MF", 3, 8),
      slot("rmf", "RMF", 88, 52, "MF", 3, 9),
      slot("lcf", "CF", 40, 16, "FW", 4, 10),
      slot("rcf", "CF", 60, 16, "FW", 4, 11),
    ],
  },
  {
    id: "5-3-2",
    name: "5-3-2",
    slots: [
      GK(1),
      slot("lb", "LB", 10, 66, "DF", 1, 2),
      slot("lcb", "CB", 30, 78, "DF", 1, 3),
      slot("ccb", "CB", 50, 80, "DF", 1, 4),
      slot("rcb", "CB", 70, 78, "DF", 1, 5),
      slot("rb", "RB", 90, 66, "DF", 1, 6),
      slot("dmf", "DMF", 50, 55, "MF", 2, 7),
      slot("lcmf", "CMF", 32, 43, "MF", 3, 8),
      slot("rcmf", "CMF", 68, 43, "MF", 3, 9),
      slot("lcf", "CF", 40, 17, "FW", 4, 10),
      slot("rcf", "CF", 60, 17, "FW", 4, 11),
    ],
  },
];

export const FORMATIONS: FormationDef[] = DEFS;
export const FORMATION_IDS: string[] = DEFS.map((f) => f.id);
export const DEFAULT_FORMATION_ID = "4-3-3";

const BY_ID = new Map(DEFS.map((f) => [f.id, f]));

export function getFormation(id: string | null | undefined): FormationDef {
  return (id != null && BY_ID.get(id)) || BY_ID.get(DEFAULT_FORMATION_ID)!;
}

export function isFormationId(id: string | null | undefined): boolean {
  return id != null && BY_ID.has(id);
}
