import type { WorldPlayerListItem } from "./types";

/**
 * 選手の検索の応答（/api/world/players）から、正式なカードの後に検索に合う暫定のカードを足した一覧を作る（2026-11-01）。
 * 正式なデータの取り込みが止まっている間（2026-10-20〜）の新しいカードも、スカッド・比較・My Team・パック診断の検索で選べるようにする。
 * 同じ ID は正式なカードだけ。応答の形が違えば空。
 */
export function playersWithProvisional(json: unknown): WorldPlayerListItem[] {
  if (!json || typeof json !== "object") return [];
  const j = json as { players?: unknown; provisionalMatches?: unknown };
  const players = Array.isArray(j.players) ? (j.players as WorldPlayerListItem[]) : [];
  const provisional = Array.isArray(j.provisionalMatches) ? (j.provisionalMatches as WorldPlayerListItem[]) : [];
  const ids = new Set(players.map((p) => p.worldCardId));
  return [...players, ...provisional.filter((p) => p && typeof p.worldCardId === "string" && !ids.has(p.worldCardId))];
}
