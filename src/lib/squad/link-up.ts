import type { LinkUpPlay } from "@/lib/managers/types";
import type { LinkUpEvaluation, LinkUpRoleEval, LinkUpStatus, StoredLinkUp } from "./types";
import { normalizePlayingStyle, arePlayingStylesEquivalent } from "@/lib/world/playing-style";

/**
 * Link-Up Play の **発動条件の照合のみ**。
 * ゲーム内の能力値上昇・効果は未確認のため、能力値へは一切適用しない。
 */

export const LINK_UP_NOTICE = "発動条件の照合のみ対応。ゲーム内効果は追加検証中です。";

export interface LinkUpPlayer {
  slotId: string;
  assignedPosition: string;
  registeredPosition: string | null;
  playingStyle: string | null;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * プレースタイルの一致判定。`docs/playing-style-ledger.md`で確認済みの表記揺れ（別名）が原因で
 * 本来一致すべき組み合わせが不一致になることを防ぐため、`normalizePlayingStyle`（攻撃属性・
 * Link-Up Playの条件は選手自身の攻撃`playingStyle`と比較する既存仕様）で先に正規化する。
 * どちらか一方でも確認済みの正規表記・別名に一致しない場合は、既存の大小無視・trim完全一致比較へ
 * フォールバックする（未確認の値どうしを新たに一致させたり、既存の一致/不一致を変えたりしない）。
 */
function playingStyleMatches(playerStyle: string | null, conditionStyle: string): boolean {
  const playerNormalized = normalizePlayingStyle(playerStyle, "offensive", "world");
  const conditionNormalized = normalizePlayingStyle(conditionStyle, "offensive", "linkUp");
  if (playerNormalized.canonicalId != null && conditionNormalized.canonicalId != null) {
    return arePlayingStylesEquivalent(playerNormalized, conditionNormalized);
  }
  return norm(playerStyle) === norm(conditionStyle);
}

function conditionHasConstraint(cond: { playingStyle: string | null; positions: string[] } | null): boolean {
  return !!cond && (cond.playingStyle != null || (Array.isArray(cond.positions) && cond.positions.length > 0));
}

function playerMatches(
  player: LinkUpPlayer,
  cond: { playingStyle: string | null; positions: string[] },
): boolean {
  if (cond.playingStyle != null) {
    if (!playingStyleMatches(player.playingStyle, cond.playingStyle)) return false;
  }
  if (Array.isArray(cond.positions) && cond.positions.length > 0) {
    const set = new Set(cond.positions.map(norm));
    const hit = set.has(norm(player.assignedPosition)) || set.has(norm(player.registeredPosition));
    if (!hit) return false;
  }
  return true;
}

function evalRole(
  role: "centerPiece" | "keyMan",
  cond: { playingStyle: string | null; positions: string[] } | null,
  players: LinkUpPlayer[],
  selectedSlotId: string | null,
): LinkUpRoleEval {
  const hasCondition = conditionHasConstraint(cond);
  const matchingSlotIds = hasCondition && cond
    ? players.filter((p) => playerMatches(p, cond)).map((p) => p.slotId)
    : [];
  const selected = selectedSlotId
    ? players.find((p) => p.slotId === selectedSlotId) ?? null
    : null;
  const selectedSatisfies = !!selected && hasCondition && !!cond && playerMatches(selected, cond);
  return {
    role,
    playingStyle: cond?.playingStyle ?? null,
    positions: cond?.positions ?? [],
    matchingSlotIds,
    selectedSlotId: selected ? selectedSlotId : null,
    selectedSatisfies,
    hasCondition,
  };
}

function statusFrom(cp: LinkUpRoleEval, km: LinkUpRoleEval): LinkUpStatus {
  if (!cp.hasCondition && !km.hasCondition) return "indeterminate";
  const cpOk = !cp.hasCondition || cp.matchingSlotIds.length > 0;
  const kmOk = !km.hasCondition || km.matchingSlotIds.length > 0;
  if (cpOk && kmOk) return "met";
  if (cpOk || kmOk) return "partial";
  return "unmet";
}

export function evaluateLinkUpPlay(
  play: LinkUpPlay,
  players: LinkUpPlayer[],
  selection: StoredLinkUp,
): LinkUpEvaluation {
  const centerPiece = evalRole("centerPiece", play.centerPiece, players, selection.centerPieceSlotId);
  const keyMan = evalRole("keyMan", play.keyMan, players, selection.keyManSlotId);
  return {
    name: play.name,
    status: statusFrom(centerPiece, keyMan),
    confirmationStatus: play.confirmationStatus,
    centerPiece,
    keyMan,
  };
}

export function evaluateLinkUpPlays(
  plays: LinkUpPlay[] | null | undefined,
  players: LinkUpPlayer[],
  selection: StoredLinkUp,
): LinkUpEvaluation[] {
  if (!Array.isArray(plays) || plays.length === 0) return [];
  return plays.map((p) => evaluateLinkUpPlay(p, players, selection));
}
