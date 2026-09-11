/**
 * 自由フォーメーション: ピッチ座標 → 配置ロール（placementRole）の推定（純関数）。
 *
 *  - 座標は「ピッチ幅・高さに対する百分率」= x∈[0,100] / y∈[0,100]。CSS ピクセルは保存しない。
 *  - y は formations.ts と同じ向き: y=0 が攻撃方向（相手ゴール）、y=100 が自ゴール。
 *  - 出力ロールはアプリ内部コード（RWF/LWF/SS/AMF … formations.ts / position.ts と同じ体系）。
 *  - 「配置ロール」と「選手のポジション適性」は別物。ここでは座標だけからロールを決める。
 *    適性は evaluateCompatibility（カード本来の登録ポジション）で別途評価する。
 *  - 境界のちらつき防止: previousRole が与えられ、その領域を HYSTERESIS_MARGIN だけ広げた範囲に
 *    まだ入っているなら previousRole を維持する（十分に超えたときだけ切り替える）。
 *  - 閾値はすべてこのファイルの定数に集約する（UI 側に散在させない）。
 */

export const ROLE_INFERENCE_VERSION = "squad-role-inference/2026-08-30.v1";

/** 内部ポジションコード（position.ts と同一体系）。 */
export const PLACEMENT_ROLES = [
  "GK",
  "LB",
  "CB",
  "RB",
  "LMF",
  "DMF",
  "CMF",
  "RMF",
  "AMF",
  "LWF",
  "SS",
  "RWF",
  "CF",
] as const;
export type PlacementRole = (typeof PLACEMENT_ROLES)[number];

export function isPlacementRole(v: unknown): v is PlacementRole {
  return typeof v === "string" && (PLACEMENT_ROLES as readonly string[]).includes(v);
}

/** 横方向 3 グループの境界（x）。左端 / 中央（ハーフスペース含む）/ 右端。 */
export const X_LEFT_MAX = 22;
export const X_RIGHT_MIN = 78;

/**
 * 縦方向バンドの境界（y・0=前線）。CF < SS < AMF < CMF < DMF < DF(LB/CB/RB) < GK。
 * formations.ts の各ロールの y 値の中間を採った Team AI 配置 UI 規則。
 */
export const Y_FW_MAX = 18; // これ未満 = 最前線
export const Y_SS_MAX = 28;
export const Y_AMF_MAX = 39;
export const Y_CMF_MAX = 51;
export const Y_DMF_MAX = 62;
export const Y_DF_MAX = 86; // これ以上 = GK ゾーン

/** ヒステリシス幅（百分率）。この距離を超えて境界を割ったときだけロールを変える。 */
export const HYSTERESIS_MARGIN = 5;

type Rect = { xMin: number; xMax: number; yMin: number; yMax: number };

/** 各ロールの座標領域（矩形・タイル状に隙間なく全面を覆う）。 */
export function roleZone(role: PlacementRole): Rect {
  const L = { xMin: 0, xMax: X_LEFT_MAX };
  const C = { xMin: X_LEFT_MAX, xMax: X_RIGHT_MIN };
  const R = { xMin: X_RIGHT_MIN, xMax: 100 };
  switch (role) {
    case "GK":
      return { xMin: 0, xMax: 100, yMin: Y_DF_MAX, yMax: 100 };
    case "LB":
      return { ...L, yMin: Y_DMF_MAX, yMax: Y_DF_MAX };
    case "CB":
      return { ...C, yMin: Y_DMF_MAX, yMax: Y_DF_MAX };
    case "RB":
      return { ...R, yMin: Y_DMF_MAX, yMax: Y_DF_MAX };
    case "LMF":
      return { ...L, yMin: Y_SS_MAX, yMax: Y_DF_MAX };
    case "RMF":
      return { ...R, yMin: Y_SS_MAX, yMax: Y_DF_MAX };
    case "DMF":
      return { ...C, yMin: Y_CMF_MAX, yMax: Y_DMF_MAX };
    case "CMF":
      return { ...C, yMin: Y_AMF_MAX, yMax: Y_CMF_MAX };
    case "AMF":
      return { ...C, yMin: Y_SS_MAX, yMax: Y_AMF_MAX };
    case "LWF":
      return { ...L, yMin: 0, yMax: Y_SS_MAX };
    case "RWF":
      return { ...R, yMin: 0, yMax: Y_SS_MAX };
    case "SS":
      return { ...C, yMin: Y_FW_MAX, yMax: Y_SS_MAX };
    case "CF":
      return { ...C, yMin: 0, yMax: Y_FW_MAX };
  }
}

function inRect(x: number, y: number, r: Rect, margin = 0): boolean {
  return (
    x >= r.xMin - margin &&
    x <= r.xMax + margin &&
    y >= r.yMin - margin &&
    y <= r.yMax + margin
  );
}
function centerDist(x: number, y: number, r: Rect): number {
  const cx = (r.xMin + r.xMax) / 2;
  const cy = (r.yMin + r.yMax) / 2;
  return Math.hypot(x - cx, y - cy);
}

export function clampCoord(v: unknown): number {
  if (v == null || v === "") return 50;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

/** 座標だけからロールを判定（ヒステリシスなし）。 */
export function inferFreshRole(x: number, y: number): PlacementRole {
  const cx = clampCoord(x);
  const cy = clampCoord(y);
  // GK ゾーンは x を問わない
  if (cy >= Y_DF_MAX) return "GK";
  let best: PlacementRole = "CMF";
  let bestScore = Infinity;
  for (const role of PLACEMENT_ROLES) {
    if (role === "GK") continue;
    const z = roleZone(role);
    const inside = inRect(cx, cy, z);
    const score = (inside ? 0 : 1000) + centerDist(cx, cy, z);
    if (score < bestScore) {
      bestScore = score;
      best = role;
    }
  }
  return best;
}

export interface InferPlacementResult {
  role: PlacementRole;
  /** ヒステリシスにより previousRole を維持したか。 */
  keptPrevious: boolean;
  /** ヒステリシスなしで判定したロール（プレビュー・上書き判定用）。 */
  fresh: PlacementRole;
}

/**
 * 座標 + 直前ロールから配置ロールを決める。
 * previousRole の領域を HYSTERESIS_MARGIN 広げた範囲に入っていれば previousRole を維持。
 */
export function inferPlacementRole(
  x: number,
  y: number,
  previousRole?: string | null,
): InferPlacementResult {
  const cx = clampCoord(x);
  const cy = clampCoord(y);
  const fresh = inferFreshRole(cx, cy);
  if (previousRole && isPlacementRole(previousRole) && previousRole !== fresh) {
    if (inRect(cx, cy, roleZone(previousRole), HYSTERESIS_MARGIN)) {
      return { role: previousRole, keptPrevious: true, fresh };
    }
  }
  return { role: fresh, keptPrevious: false, fresh };
}

/** FW / MF / DF / GK 分類（team-summary と共有する position.ts の roleOfPosition を使う）。 */
export { roleOfPosition } from "./position";
