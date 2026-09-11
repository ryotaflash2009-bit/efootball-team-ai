import { COMPARISON_MAX } from "./types";
import type { CompareBuildMode, ComparisonState } from "./types";
import { serializeAllocations, parseAllocations } from "./allocation-url";

/**
 * 比較状態の URL クエリ表現（短く保つ）:
 *   ?ids=<worldCardId,...>&b=<mode,...>&m=<managerId,...>&tp=<tier,...>&al=<配分,...>
 * - ids: World カード ID（数字 1〜20桁）。重複除去・最大4。
 * - b:   育成方針（none|attack|defense|balance|gk）。ids と同順・不足は none。
 * - m:   監督 internal_manager_id（正整数 or 空）。ids と同順。
 * - tp:  Total Package の条件段階。"" / "1" / "2" / "3"（ユーザー指定・自動判定ではない）。
 *        列挙外・4以上・不正はすべて "none"。ids と同順。
 * - al:  手動育成配分（`groupId~level` を `.` 連結・プレイヤー区分は `_` 連結・空区分=方針に従う）。
 *        ids と同順。列挙外 groupId / 非整数 / 範囲外は無視。極端に長い場合は URL へ入れない。
 *        復元時にカードごとに再検証・再クランプする。
 */

const WORLD_ID_RE = /^[0-9]{1,20}$/;
const MODES: CompareBuildMode[] = ["none", "attack", "defense", "balance", "gk"];
const TP_TIER_BY_DIGIT: Record<string, NonNullable<ComparisonState["conditionalTiers"]>[number]> = {
  "1": "league_1_13",
  "2": "league_14_19",
  "3": "league_20_plus",
};
const TP_DIGIT_BY_TIER: Record<string, string> = {
  league_1_13: "1",
  league_14_19: "2",
  league_20_plus: "3",
};

function csv(v: string | null | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseComparisonState(input: {
  ids?: string | null;
  b?: string | null;
  m?: string | null;
  tp?: string | null;
  al?: string | null;
}): ComparisonState {
  const rawIds = csv(input.ids).filter((s) => WORLD_ID_RE.test(s));
  const ids: string[] = [];
  for (const id of rawIds) {
    if (!ids.includes(id) && ids.length < COMPARISON_MAX) ids.push(id);
  }

  const rawModes = csv(input.b);
  const rawMgrs = csv(input.m);

  const buildModes: CompareBuildMode[] = ids.map((_, i) => {
    const m = rawModes[i];
    return (MODES as string[]).includes(m) ? (m as CompareBuildMode) : "none";
  });
  const managerIds: (number | null)[] = ids.map((_, i) => {
    const m = rawMgrs[i];
    const n = Number(m);
    return m && Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
  });

  const rawTiers = csv(input.tp);
  const conditionalTiers: ComparisonState["conditionalTiers"] = ids.map((_, i) => {
    const t = rawTiers[i];
    return (t && TP_TIER_BY_DIGIT[t]) || "none";
  });

  const allocations = parseAllocations(input.al ?? null, ids.length);

  return { ids, buildModes, managerIds, conditionalTiers, allocations };
}

/** ComparisonState → URL クエリ文字列（?なし） */
export function serializeComparisonState(state: ComparisonState): string {
  const sp = new URLSearchParams();
  if (state.ids.length === 0) return "";
  sp.set("ids", state.ids.join(","));
  if (state.buildModes.some((m) => m !== "none")) {
    sp.set("b", state.buildModes.map((m) => (m === "none" ? "" : m)).join(","));
  }
  if (state.managerIds.some((m) => m != null)) {
    sp.set("m", state.managerIds.map((m) => (m == null ? "" : String(m))).join(","));
  }
  if (state.conditionalTiers?.some((t) => t !== "none")) {
    sp.set("tp", state.conditionalTiers.map((t) => TP_DIGIT_BY_TIER[t] ?? "").join(","));
  }
  if (state.allocations && state.allocations.some((a) => a && Object.keys(a).length > 0)) {
    const al = serializeAllocations(state.allocations);
    if (al) sp.set("al", al); // 長すぎる場合（null）は URL へ入れない
  }
  return sp.toString();
}

export function comparisonHref(state: ComparisonState): string {
  const q = serializeComparisonState(state);
  return q ? `/compare?${q}` : "/compare";
}
