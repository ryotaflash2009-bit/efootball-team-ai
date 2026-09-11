import { clampCoord } from "./role-inference";

/**
 * フォーメーション配置補助（純関数・UI 非依存）。
 *
 *  - スナップは「弱い補助」。近くに意味のあるライン・対称位置がある場合だけ控えめに補正する。
 *  - 強制固定しない・スナップなしで配置できる・修飾キー / 設定で無効化できる。
 *  - 座標は role-inference.ts と同じ 0–100 正規化（y=0 が前線）。
 *  - すべての閾値はこのファイルの定数に集約する。
 *  - ロール判定はスナップ後の最終座標に対して行う（呼び出し側の責務）。
 */

/** スナップ距離（正規化座標）。この距離を超えていたらスナップしない。 */
export const SNAP_DIST_Y = 3.5; // 水平ライン揃え / 対称の y 一致
export const SNAP_DIST_X = 3.5; // 中央線 / 対称の x 一致
/** 水平ライン揃えの相手選手が横に近すぎる場合は対象にしない（重なり防止）。 */
export const SNAP_MIN_X_SEPARATION = 6;
/** ガイド表示だけを出す「近い」距離（スナップ閾値より少し広い）。 */
export const GUIDE_NEAR_DIST = 6;

export interface SnapSettings {
  enabled: boolean;
  snapToLines: boolean;
  snapToCenter: boolean;
  snapToSymmetry: boolean;
}
export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,
  snapToLines: true,
  snapToCenter: true,
  snapToSymmetry: true,
};

export interface PlacementRef {
  slotId: string;
  x: number;
  y: number;
}

export type AlignGuideKind = "horizontal" | "center" | "symmetry";
export interface AlignGuide {
  kind: AlignGuideKind;
  /** horizontal: y 値 / center・symmetry: x 値（いずれも 0–100） */
  at: number;
  refSlotIds: string[];
  label: string;
}

export interface SnapResult {
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  snapApplied: boolean;
  snapTypes: AlignGuideKind[];
  guides: AlignGuide[];
}

function isFiniteCoord(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * 提案座標に対してスナップ候補とガイドを計算する。
 *  - settings.enabled === false / disableSnap === true のときはスナップしない（生座標）。
 *  - ガイド（近くのライン・中央・対称位置）は showGuides 判定用に常に返す。呼び出し側が表示可否を決める。
 */
export function calculateSnapCandidate(input: {
  movingSlotId: string;
  proposedX: number;
  proposedY: number;
  existingPlacements: PlacementRef[];
  settings?: SnapSettings;
  disableSnap?: boolean;
}): SnapResult {
  const settings = input.settings ?? DEFAULT_SNAP_SETTINGS;
  const rawX = clampCoord(input.proposedX);
  const rawY = clampCoord(input.proposedY);

  const others = input.existingPlacements.filter(
    (p) => p.slotId !== input.movingSlotId && isFiniteCoord(p.x) && isFiniteCoord(p.y),
  );

  const snapDisabled = !settings.enabled || input.disableSnap === true;

  // --- 候補を集める（適用は最後に距離で選ぶ） ---
  // 1. 中央線 (x=50)
  const centerDx = Math.abs(rawX - 50);
  const centerHit = settings.snapToCenter && centerDx <= SNAP_DIST_X;

  // 2. 水平ライン: 同じ y 帯にいて横に十分離れた選手
  let lineY: number | null = null;
  let lineRefs: string[] = [];
  if (settings.snapToLines) {
    const near = others
      .filter((p) => Math.abs(p.y - rawY) <= SNAP_DIST_Y && Math.abs(p.x - rawX) >= SNAP_MIN_X_SEPARATION)
      .sort((a, b) => Math.abs(a.y - rawY) - Math.abs(b.y - rawY));
    if (near.length > 0) {
      // 最も近い y にクラスタリング（±1 以内を同一ラインとみなす）
      const targetY = near[0].y;
      const cluster = near.filter((p) => Math.abs(p.y - targetY) <= 1);
      lineY = cluster.reduce((s, p) => s + p.y, 0) / cluster.length;
      lineRefs = cluster.map((p) => p.slotId).sort();
    }
  }

  // 3. 左右対称: ある選手の鏡像 (100-x, y) の近くにいる
  let symX: number | null = null;
  let symY: number | null = null;
  let symRef: string | null = null;
  if (settings.snapToSymmetry) {
    const cand = others
      .filter((p) => Math.abs(p.x - 50) > 1) // 中央線上の選手は対称候補にしない
      .map((p) => ({ p, dist: Math.hypot(100 - p.x - rawX, p.y - rawY) }))
      .filter(({ p }) => Math.abs(100 - p.x - rawX) <= SNAP_DIST_X && Math.abs(p.y - rawY) <= SNAP_DIST_Y)
      .sort((a, b) => a.dist - b.dist);
    if (cand.length > 0) {
      symX = 100 - cand[0].p.x;
      symY = cand[0].p.y;
      symRef = cand[0].p.slotId;
    }
  }

  // --- 適用 ---
  let x = rawX;
  let y = rawY;
  const snapTypes: AlignGuideKind[] = [];
  const guides: AlignGuide[] = [];

  if (!snapDisabled) {
    // 左右対称（両軸）は「鏡像へ合わせる」明示的な意図なので優先。閾値内でのみ発火する。
    if (symX != null && symY != null) {
      x = symX;
      y = symY;
      snapTypes.push("symmetry");
    } else {
      // 中央線（x）とラインy は直交するので独立に適用してよい
      if (centerHit) {
        x = 50;
        snapTypes.push("center");
      }
      if (lineY != null) {
        y = lineY;
        snapTypes.push("horizontal");
      }
    }
  }

  // --- ガイド（表示用・スナップ有無に関わらず「近い」ものを返す） ---
  if (settings.snapToCenter && Math.abs(rawX - 50) <= GUIDE_NEAR_DIST) {
    guides.push({ kind: "center", at: 50, refSlotIds: [], label: "ピッチ中央" });
  }
  if (settings.snapToLines && lineY != null) {
    guides.push({ kind: "horizontal", at: lineY, refSlotIds: lineRefs, label: "同じライン" });
  } else if (settings.snapToLines) {
    const nearLine = others
      .filter((p) => Math.abs(p.y - rawY) <= GUIDE_NEAR_DIST && Math.abs(p.x - rawX) >= SNAP_MIN_X_SEPARATION)
      .sort((a, b) => Math.abs(a.y - rawY) - Math.abs(b.y - rawY))[0];
    if (nearLine) {
      guides.push({ kind: "horizontal", at: nearLine.y, refSlotIds: [nearLine.slotId], label: "近いライン" });
    }
  }
  if (settings.snapToSymmetry && symX != null && symRef) {
    guides.push({ kind: "symmetry", at: symX, refSlotIds: [symRef], label: "左右対称位置" });
  }

  return {
    x: clampCoord(x),
    y: clampCoord(y),
    rawX,
    rawY,
    snapApplied: snapTypes.length > 0,
    snapTypes,
    guides,
  };
}

/** 左右対称のロール対応（内部コード）。中央ロールは変換しない。 */
export const MIRROR_ROLE: Record<string, string> = {
  LWF: "RWF",
  RWF: "LWF",
  LMF: "RMF",
  RMF: "LMF",
  LB: "RB",
  RB: "LB",
  LSB: "RSB",
  RSB: "LSB",
};

export function mirrorRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return MIRROR_ROLE[role] ?? role;
}
