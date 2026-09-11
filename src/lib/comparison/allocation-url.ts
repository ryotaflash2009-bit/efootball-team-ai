import { PROGRESSION_GROUP_IDS } from "@/lib/progression/stat-groups";

/**
 * 比較画面の手動育成配分の URL 表現（`al` パラメーター）。
 *
 *  - 形式: プレイヤーごとの区分を `_` で連結。各区分は `groupId~level` を `.` で連結。空区分 = 配分なし（方針に従う）。
 *    例: `al=shooting~5.passing~3_defending~2__`（1人目=手動 / 2人目=手動 / 3人目=なし / 4人目=なし）
 *  - `ids` と同順（位置対応）。
 *  - eval / Function / 無検証 JSON / Base64 は使わない。groupId は許可リスト、level は 1..200 の整数のみ。
 *  - 極端に長くなる場合は `null` を返し、呼び出し側は URL へ書かない（保存ビルド / ページ内操作で代替）。
 *  - 復元後も `normalizeGroupAllocation`（engine）で各カードに対して再検証・再クランプする。
 */

const GROUP_SET = new Set<string>(PROGRESSION_GROUP_IDS);

/** `al` パラメーターの許容最大長（これを超えたら URL へ入れない）。 */
export const ALLOCATION_URL_MAX_LEN = 1800;
const MAX_SANE_LEVEL = 200;

/** allocations（ids と同順・null = 配分なし）→ `al` 文字列。全て空なら `""`、長すぎるなら `null`。 */
export function serializeAllocations(allocations: (Record<string, number> | null | undefined)[]): string | null {
  if (!allocations.some((a) => a && Object.keys(a).length > 0)) return "";
  const segs = allocations.map((a) => {
    if (!a) return "";
    return Object.entries(a)
      .filter(
        ([k, v]) =>
          GROUP_SET.has(k) && typeof v === "number" && Number.isInteger(v) && v > 0 && v <= MAX_SANE_LEVEL,
      )
      .sort(([ka], [kb]) => ka.localeCompare(kb))
      .map(([k, v]) => `${k}~${v}`)
      .join(".");
  });
  // 末尾の空区分は落とす（先頭・中間の空区分は位置対応のため残す）
  while (segs.length > 0 && segs[segs.length - 1] === "") segs.pop();
  const s = segs.join("_");
  if (s.length > ALLOCATION_URL_MAX_LEN) return null;
  return s;
}

/** `al` 文字列 → allocations（`count` 件・不正な区分は null）。 */
export function parseAllocations(
  raw: string | null | undefined,
  count: number,
): (Record<string, number> | null)[] {
  const segs = (raw ?? "").split("_");
  const out: (Record<string, number> | null)[] = [];
  for (let i = 0; i < count; i++) {
    const seg = (segs[i] ?? "").trim();
    if (!seg) {
      out.push(null);
      continue;
    }
    const alloc: Record<string, number> = {};
    for (const pair of seg.split(".")) {
      const idx = pair.indexOf("~");
      if (idx <= 0) continue;
      const k = pair.slice(0, idx);
      if (!GROUP_SET.has(k)) continue;
      const v = Number(pair.slice(idx + 1));
      if (!Number.isInteger(v) || v <= 0 || v > MAX_SANE_LEVEL) continue;
      alloc[k] = v;
    }
    out.push(Object.keys(alloc).length > 0 ? alloc : null);
  }
  return out;
}
