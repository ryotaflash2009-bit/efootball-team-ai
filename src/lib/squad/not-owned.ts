import type { StoredSquad } from "./types";

/**
 * スカッドのカード（先発・控え）のうち、My Team で「所持」になっていないものの数（純関数・2026-10-31）。
 * ゲームでは持っているカードしか編成できないため、スカッドの一覧で知らせる。同じカードは 1 回だけ数える。
 */
export function countNotOwnedInSquad(squad: Pick<StoredSquad, "slots" | "substitutes">, ownedIds: ReadonlySet<string>): number {
  const ids = new Set([...squad.slots.map((s) => s.worldCardId), ...squad.substitutes.map((s) => s.worldCardId)].filter((x): x is string => !!x));
  let n = 0;
  for (const id of ids) if (!ownedIds.has(id)) n++;
  return n;
}
