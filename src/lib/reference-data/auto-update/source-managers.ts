import { createHash } from "node:crypto";
import { computeNameSortKey } from "../name-sort-key";
import { buildSourceRequest, type SourceRequest } from "./source-transport";
import { managerIdentity, normalizeTimestamp } from "./update-contract";

/**
 * 自動更新 Phase B: 公開managers.jsonの parser・normalizer。
 *
 * 変換規則は既存 scripts/sync-managers.mjs と同じ(id形式・名前必須・戦術適性はtrunc・ブースター
 * 対象能力名→Worldキー・deltaの抽出・Link-up Playの既定名/confirmation)。結果は
 * reference_data.managers のupstream由来列(boosters/link_up_playsはdetail extensionと同じ形)。
 *
 * internal_manager_id(Productionの主キー)と、既存syncが更新しない列(name_ja・team_name・
 * nationality・age・manager_rating・coaching_affinity・formation)はsource rowに含めない
 * (Production側の既存値を保持する。Phase Cで結合する)。
 * このmoduleはネットワークへアクセスしない。
 */

export const MANAGER_SOURCE_LABEL = "amine250";
export const MANAGERS_URL = "https://raw.githubusercontent.com/amine250/efootball-managers/main/data/managers.json";

const SOURCE_MANAGER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** World能力値キー ↔ 英語表示名(scripts/sqlite/world.mjs STAT_KEY_MAP の [worldKey, nameEn])。 */
const STAT_NAME_EN: ReadonlyArray<readonly [string, string]> = [
  ["offensiveAwareness", "Offensive Awareness"], ["ballControl", "Ball Control"], ["dribbling", "Dribbling"],
  ["tightPossession", "Tight Possession"], ["lowPass", "Low Pass"], ["loftedPass", "Lofted Pass"],
  ["finishing", "Finishing"], ["heading", "Heading"], ["setPieceTaking", "Set Piece Taking"], ["curl", "Curl"],
  ["defensiveAwareness", "Defensive Awareness"], ["tackling", "Tackling"], ["aggression", "Aggression"],
  ["defensiveEngagement", "Defensive Engagement"], ["gkAwareness", "GK Awareness"], ["gkCatching", "GK Catching"],
  ["gkParrying", "GK Parrying"], ["gkReflexes", "GK Reflexes"], ["gkReach", "GK Reach"], ["speed", "Speed"],
  ["acceleration", "Acceleration"], ["kickingPower", "Kicking Power"], ["jumping", "Jumping"],
  ["physicalContact", "Physical Contact"], ["balance", "Balance"], ["stamina", "Stamina"],
];
const NAME_TO_KEY = new Map(STAT_NAME_EN.map(([wk, nameEn]) => [nameEn.toLowerCase(), wk]));
const STAT_NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "attacking awareness": "offensiveAwareness",
  "ball winning": "tackling",
  "aerial reach": "gkReach",
  "gk high reach": "gkReach",
});

export function managerStatNameToKey(name: unknown): string | null {
  const k = String(name ?? "").trim().toLowerCase();
  return NAME_TO_KEY.get(k) ?? STAT_NAME_ALIASES[k] ?? null;
}

export function parseBoosterDelta(value: unknown): number {
  const m = String(value ?? "").match(/([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export const MANAGER_PROFICIENCY_COLUMNS = Object.freeze([
  ["possessionGame", "possession_game"],
  ["quickCounter", "quick_counter"],
  ["longBallCounter", "long_ball_counter"],
  ["outWide", "out_wide"],
  ["longBall", "long_ball"],
  ["overload", "overload"],
] as const);

export class ManagersSourceParseError extends Error {
  readonly reason: "parse_error" | "schema_drift";
  constructor(reason: "parse_error" | "schema_drift", detail: string) {
    super(`managers.jsonの解析失敗: ${reason}: ${detail}`);
    this.name = "ManagersSourceParseError";
    this.reason = reason;
  }
}

export function buildManagersRequest(): SourceRequest {
  return buildSourceRequest("managers-json", null);
}

export interface ManagersDocument {
  readonly managers: readonly unknown[];
  readonly contentHash: string;
  readonly bodyBytes: number;
}

/** 本文を解析する。配列でなければ schema_drift(既存syncと同じ停止条件)。 */
export function parseManagersDocument(bodyText: string): ManagersDocument {
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new ManagersSourceParseError("parse_error", "JSONとして解析できない");
  }
  if (!Array.isArray(json)) throw new ManagersSourceParseError("schema_drift", "配列ではない");
  return Object.freeze({
    managers: Object.freeze([...json]),
    contentHash: createHash("sha256").update(bodyText).digest("hex"),
    bodyBytes: Buffer.byteLength(bodyText, "utf8"),
  });
}

export interface ManagerBoosterSourceValue {
  statNameEn: string;
  statKey: string | null;
  delta: number;
  rawValue: string;
  applicationCondition: string | null;
  confirmationStatus: string;
}

export interface ManagerLinkUpConditionSourceValue {
  role: "centerPiece" | "keyMan";
  playingStyle: string | null;
  positions: string[];
}

export interface ManagerLinkUpPlaySourceValue {
  name: string;
  centerPiece: ManagerLinkUpConditionSourceValue | null;
  keyMan: ManagerLinkUpConditionSourceValue | null;
  confirmationStatus: string;
}

export const MANAGER_SOURCE_COLUMNS = Object.freeze([
  "source", "source_manager_id", "name_en", "released_at", "possession_game", "quick_counter",
  "long_ball_counter", "out_wide", "long_ball", "overload", "has_booster", "has_link_up_play",
  "booster_confirmation", "boosters", "link_up_plays", "name_sort_key", "source_url",
] as const);

export type ManagerSourceColumn = (typeof MANAGER_SOURCE_COLUMNS)[number];
export type ManagerSourceRow = Record<ManagerSourceColumn, unknown> & { fetched_at: string };

export interface ManagerRowRejection {
  readonly identity: string | null;
  readonly reasons: readonly string[];
}

export type ManagerRowResult = { readonly ok: true; readonly row: ManagerSourceRow } | { readonly ok: false; readonly rejection: ManagerRowRejection };

const truncOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** managers.jsonの1件をsource rowへ変換する。 */
export function toManagerSourceRow(raw: unknown, fetchedAt: string): ManagerRowResult {
  const m: Record<string, unknown> = isObj(raw) ? raw : {};
  const reasons: string[] = [];
  const srcId = String(m.id ?? "").trim();
  let identity: string | null = null;
  if (!srcId || !SOURCE_MANAGER_ID_RE.test(srcId)) reasons.push("idの形式が不正");
  else identity = managerIdentity(MANAGER_SOURCE_LABEL, srcId);
  const name = String(m.name ?? "").trim();
  if (!name) reasons.push("nameが空");
  let fetched: string | null = null;
  try {
    fetched = normalizeTimestamp(fetchedAt, "fetched_at");
  } catch {
    reasons.push("fetched_atが不正");
  }
  if (reasons.length > 0 || fetched == null) return { ok: false, rejection: { identity, reasons } };

  const p = isObj(m.teamPlaystyleProficiency) ? m.teamPlaystyleProficiency : {};
  const boosters = Array.isArray(m.boosterEffects) ? m.boosterEffects : [];
  const lups: unknown[] = Array.isArray(m.linkUpPlays) ? m.linkUpPlays : m.linkUpPlay ? [m.linkUpPlay] : [];

  const boosterValues: ManagerBoosterSourceValue[] = boosters.map((b) => {
    const bo = isObj(b) ? b : {};
    const nameEn = String(bo.stat ?? "").trim();
    return {
      statNameEn: nameEn,
      statKey: managerStatNameToKey(nameEn),
      delta: parseBoosterDelta(bo.value),
      rawValue: String(bo.value ?? ""),
      applicationCondition: null,
      confirmationStatus: "confirmed",
    };
  });
  const linkUpValues: ManagerLinkUpPlaySourceValue[] = lups.map((lu, i) => {
    const l = isObj(lu) ? lu : {};
    const cond = (role: "centerPiece" | "keyMan"): ManagerLinkUpConditionSourceValue | null => {
      const c = l[role];
      if (!c || typeof c !== "object") return null;
      const co = c as Record<string, unknown>;
      return {
        role,
        playingStyle: co.playingStyle ? String(co.playingStyle) : null,
        positions: Array.isArray(co.positions) ? co.positions.map(String) : [],
      };
    };
    return {
      name: String(l.name ?? "").trim() || `Link-Up ${i + 1}`,
      centerPiece: cond("centerPiece"),
      keyMan: cond("keyMan"),
      confirmationStatus: "provisional",
    };
  });

  const row: ManagerSourceRow = {
    source: MANAGER_SOURCE_LABEL,
    source_manager_id: srcId,
    name_en: name,
    released_at: m.releaseDate ? String(m.releaseDate) : null,
    possession_game: null,
    quick_counter: null,
    long_ball_counter: null,
    out_wide: null,
    long_ball: null,
    overload: null,
    has_booster: boosterValues.length > 0,
    has_link_up_play: linkUpValues.length > 0,
    booster_confirmation: boosterValues.length > 0 ? "confirmed" : "unresolved",
    boosters: boosterValues,
    link_up_plays: linkUpValues,
    name_sort_key: computeNameSortKey(name),
    source_url: MANAGERS_URL,
    fetched_at: fetched,
  };
  for (const [jsonKey, col] of MANAGER_PROFICIENCY_COLUMNS) row[col] = truncOrNull(p[jsonKey]);
  return { ok: true, row };
}

/** 対象能力名がWorldキーへ対応しなかったブースター名(報告用、重複なし・ソート済み)。 */
export function collectUnmappedBoosterStats(rows: readonly ManagerSourceRow[]): string[] {
  const out = new Set<string>();
  for (const r of rows) for (const b of r.boosters as ManagerBoosterSourceValue[]) if (!b.statKey && b.statNameEn) out.add(b.statNameEn);
  return [...out].sort();
}
