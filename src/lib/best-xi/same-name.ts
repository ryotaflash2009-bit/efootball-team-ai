import type { BestXiCandidate } from "./types";

/**
 * 同じ名前のカード（NEW-25・2026-10-09）。同じ実在の選手の別のカードの可能性があるものを「事実（名前が同じ）」として示す。
 * - 選考の規則は変えない（ゲームで同じ選手を 2 枚使えるかの公式の根拠が無いため、自動で外さない）。
 * - 名前は英語名（小文字・空白をまとめる）で比べ、英語名が無ければ日本語名。名前が無いカードは比べない。
 * - 同じ worldCardId（同じカード）は 1 枚として数える。
 */
export interface SameNameGroup {
  name: string;
  worldCardIds: string[];
}

const norm = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function sameNameGroups(candidates: readonly Pick<BestXiCandidate, "worldCardId" | "nameEn" | "nameJa">[]): SameNameGroup[] {
  const by = new Map<string, { name: string; ids: Set<string> }>();
  for (const c of candidates) {
    const raw = (c.nameEn ?? "").trim() || (c.nameJa ?? "").trim();
    if (!raw) continue;
    const k = norm(raw);
    const g = by.get(k) ?? { name: raw, ids: new Set<string>() };
    g.ids.add(c.worldCardId);
    by.set(k, g);
  }
  return [...by.values()]
    .filter((g) => g.ids.size >= 2)
    .map((g) => ({ name: g.name, worldCardIds: [...g.ids].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
