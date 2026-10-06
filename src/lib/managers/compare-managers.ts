import type { ManagerDetail, TacticalProficiencies } from "./types";

/**
 * 監督の比較（NEW-23・2026-10-07）。2〜4 人の事実を並べるだけ（推測・総合点は作らない）。
 * - 戦術の適性: 6 項目の値と、各項目で最も高い監督（同点は全員）。
 * - ブースター: 対象の能力ごとに、各監督の上昇量と確認の状態（未確認は「確認済み」と区別して表示する）。
 * - そのほか: フォーメーション・登場日・Link-Up Play の数。
 */
export const MANAGER_COMPARE_VERSION = "manager-compare/2026-10-07.v1";
export const MAX_COMPARED_MANAGERS = 4;
export const TACTIC_KEYS: readonly (keyof TacticalProficiencies)[] = ["possessionGame", "quickCounter", "longBallCounter", "outWide", "longBall", "overload"];

export interface TacticRow {
  key: keyof TacticalProficiencies;
  values: (number | null)[];
  /** 最も高い監督の位置（同点は全員・値が無ければ空）。 */
  best: number[];
}

export interface BoosterRow {
  /** World の能力のキー（変換できない効果は statNameEn をそのまま key にする）。 */
  key: string;
  mapped: boolean;
  /** 監督ごとの上昇量（無ければ null）と確認の状態。 */
  cells: ({ delta: number; confirmed: boolean } | null)[];
}

export interface ManagerComparison {
  version: string;
  managerIds: number[];
  tactics: TacticRow[];
  boosters: BoosterRow[];
  formation: (string | null)[];
  releasedAt: (string | null)[];
  linkUpPlays: number[];
}

export function compareManagers(managers: readonly ManagerDetail[]): ManagerComparison {
  const ms = managers.slice(0, MAX_COMPARED_MANAGERS);
  const tactics = TACTIC_KEYS.map((key) => {
    const values = ms.map((m) => m.proficiencies[key] ?? null);
    const nums = values.filter((v): v is number => typeof v === "number");
    const max = nums.length ? Math.max(...nums) : null;
    return { key, values, best: max === null ? [] : values.flatMap((v, i) => (v === max ? [i] : [])) };
  });
  const keys = new Map<string, boolean>();
  for (const m of ms) for (const b of m.boosters) keys.set(b.statKey ?? b.statNameEn, b.statKey !== null);
  const boosters = [...keys.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, mapped]) => ({
      key,
      mapped,
      cells: ms.map((m) => {
        const effects = m.boosters.filter((b) => (b.statKey ?? b.statNameEn) === key);
        if (!effects.length) return null;
        return { delta: effects.reduce((a, b) => a + b.delta, 0), confirmed: effects.every((b) => b.confirmationStatus === "confirmed") };
      }),
    }));
  return {
    version: MANAGER_COMPARE_VERSION,
    managerIds: ms.map((m) => m.internalManagerId),
    tactics,
    boosters,
    formation: ms.map((m) => m.formation ?? null),
    releasedAt: ms.map((m) => m.releasedAt ?? null),
    linkUpPlays: ms.map((m) => m.linkUpPlays.length),
  };
}

/** URL の ?ids= を読む（数値の ID・重複なし・最大 4 件）。 */
export function parseManagerIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0 && n < 1_000_000 && !out.includes(n)) out.push(n);
    if (out.length >= MAX_COMPARED_MANAGERS) break;
  }
  return out;
}
