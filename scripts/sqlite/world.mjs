/**
 * eFootball World 同期の共有ロジック（node:sqlite・Node標準のみ）。
 */

import { createHash } from "node:crypto";

export const WORLD_HOST = "efootball-world.com";
export const WORLD_SEARCH_URL = `https://${WORLD_HOST}/api/proxy/v1/api/players/search`;
export const WORLD_PLAYER_PAGE = (id) => `https://${WORLD_HOST}/player/${id}`;
export const WORLD_UA =
  "eFootball-Team-AI-dev/0.1 (project data sync; single-threaded; contact: project owner)";
export const WORLD_PAGE_SIZE = 500;
export const WORLD_TIMEOUT_MS = 20_000;

/** players/search レスポンスの26能力値キー（World は表示名をキーにしている） */
export const WORLD_STAT_KEYS = [
  "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
  "finishing", "heading", "setPieceTaking", "curl", "defensiveAwareness", "tackling", "aggression",
  "defensiveEngagement", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach",
  "speed", "acceleration", "kickingPower", "jumping", "physicalContact", "balance", "stamina",
];

/** World の能力値キー ↔ eFHUB の内部キー（22は同一、4だけ異なる） */
export const STAT_KEY_MAP = [
  ["offensiveAwareness", "offensiveAwareness", "Offensive Awareness"],
  ["ballControl", "ballControl", "Ball Control"],
  ["dribbling", "dribbling", "Dribbling"],
  ["tightPossession", "tightPossession", "Tight Possession"],
  ["lowPass", "lowPass", "Low Pass"],
  ["loftedPass", "loftedPass", "Lofted Pass"],
  ["finishing", "finishing", "Finishing"],
  ["heading", "heading", "Heading"],
  ["setPieceTaking", "setPieceTaking", "Set Piece Taking"],
  ["curl", "curl", "Curl"],
  ["defensiveAwareness", "defensiveAwareness", "Defensive Awareness"],
  ["tackling", "ballWinning", "Tackling"],
  ["aggression", "aggression", "Aggression"],
  ["defensiveEngagement", "trackingBack", "Defensive Engagement"],
  ["gkAwareness", "gkAwareness", "GK Awareness"],
  ["gkCatching", "gkCatching", "GK Catching"],
  ["gkParrying", "gkClearing", "GK Parrying"],
  ["gkReflexes", "gkReflexes", "GK Reflexes"],
  ["gkReach", "gkReach", "GK Reach"],
  ["speed", "speed", "Speed"],
  ["acceleration", "acceleration", "Acceleration"],
  ["kickingPower", "kickingPower", "Kicking Power"],
  ["jumping", "jump", "Jumping"],
  ["physicalContact", "physicalContact", "Physical Contact"],
  ["balance", "balance", "Balance"],
  ["stamina", "stamina", "Stamina"],
];

export const SOURCE_PRIORITIES_SEED = [
  ["image_url", "efhub", "eFHUB の画像URL規則が単純（efimg.com/.../{id}_l.png）"],
  ["ovr_max", "world", "World は maxOverall を明示。eFHUB は index の o から推定"],
  ["nationality", "world", "World は名称を直接返す。eFHUB は countryId のみ"],
  ["region", "world", "同上"],
  ["league", "world", "同上"],
  ["team", "world", "同上"],
  ["playing_style_def", "world", "World は常に守備プレースタイルを返す"],
  ["base_stats", "unresolved", "両ソースを保存し要確認"],
  ["registered_position", "unresolved", "両ソースを保存し要確認"],
];

export function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

/** 応答テキストに個人情報/認証情報の兆候がないか */
export function looksSensitive(text) {
  const t = text.toLowerCase();
  const hits = [];
  if (/"(access_?token|refresh_?token|id_?token|session_?token|jwt)"\s*:/.test(t)) hits.push("token field");
  if (/"(password|passwd|secret|api_?key|private_?key)"\s*:/.test(t)) hits.push("credential field");
  if (/"(email|phone_?number|credit_?card|card_?number|cvv|ssn)"\s*:/.test(t)) hits.push("PII field");
  if (/set-cookie/i.test(t)) hits.push("set-cookie");
  return hits;
}

/** players/search の1件を DB 行へ正規化 */
export function normalizeWorldPlayer(p) {
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  const str = (v) => (typeof v === "string" ? v : v == null ? null : String(v));
  const ap = p.appearance && typeof p.appearance === "object" ? p.appearance : null;
  const apVal = (k) => (ap && ap[k] && typeof ap[k] === "object" && "value" in ap[k] ? num(ap[k].value) : ap ? num(ap[k]) : null);
  const apRanks = ap
    ? Object.fromEntries(
        ["legCoverageRadius", "armCoverageRadius", "torsoCollision", "jumpingHeight", "dribbleHeight", "legLength"]
          .filter((k) => ap[k] && typeof ap[k] === "object" && (ap[k].overall || ap[k].position))
          .map((k) => [k, { overall: ap[k].overall ?? null, position: ap[k].position ?? null }]),
      )
    : {};

  return {
    world_card_id: str(p.id ?? p.playerId),
    name_en: str(p.name),
    name_ja: str(p.nameJp),
    card_type: str(p.type),
    registered_position: str(p.position),
    nationality: str(p.nationality),
    region: str(p.region),
    league: str(p.league),
    team: str(p.team),
    ovr_base: num(p.overallRating),
    ovr_max: num(p.maxOverall),
    maximum_level: num(p.maximumLevel),
    card_rating: str(p.rating),
    playing_style: str(p.playingStyle),
    playing_style_def: str(p.playingStyleDef),
    preferred_foot: str(p.foot),
    age: num(p.age),
    height: num(p.height),
    weight: num(p.weight),
    image_url: str(p.imageUrl),
    mobile_image_url: str(p.mobileImageUrl),
    boost1: num(p.boost1),
    boost2: num(p.boost2),
    likes_count: num(p.likesCount),
    view_count: num(p.viewCount),
    average_rating: num(p.averageRating),
    total_ratings: num(p.totalRatings),
    appearance_updated_at: ap ? str(ap.updatedAt) : null,
    stats: Object.fromEntries(WORLD_STAT_KEYS.map((k) => [k, num(p[k])])),
    skills: Array.isArray(p.skills) ? p.skills.filter((x) => typeof x === "string") : [],
    aiStyles: Array.isArray(p.aiStyles) ? p.aiStyles.filter((x) => typeof x === "string") : [],
    appearance: ap
      ? {
          position: str(ap.position),
          leg_coverage_radius: apVal("legCoverageRadius"),
          arm_coverage_radius: apVal("armCoverageRadius"),
          torso_collision: apVal("torsoCollision"),
          jumping_height: apVal("jumpingHeight"),
          dribble_height: apVal("dribbleHeight"),
          leg_length: apVal("legLength"),
          ranks_json: JSON.stringify(apRanks),
          updated_at: str(ap.updatedAt),
        }
      : null,
  };
}

export function seedWorldReference(db) {
  const now = new Date().toISOString();
  const s = db.prepare("INSERT OR IGNORE INTO stat_key_map (world_key, efhub_key, name_en) VALUES (?, ?, ?)");
  for (const [w, e, n] of STAT_KEY_MAP) s.run(w, e, n);
  const p = db.prepare("INSERT OR IGNORE INTO source_priorities (field_name, primary_source, note) VALUES (?, ?, ?)");
  for (const [f, src, note] of SOURCE_PRIORITIES_SEED) p.run(f, src, note);
  void now;
}
