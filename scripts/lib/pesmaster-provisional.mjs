/**
 * PES Master（pesmaster.com）から「eFootball World にまだ無い新しいカード」を暫定のカードとして作る（2026-10-15・本人の承認）。
 *
 * - robots.txt は全ページ許可・自動の取得を禁じる利用規約は無い（docs/production-readiness/provisional-cards.md）。
 * - 対応表は両方にある 66 枚で確かめた: 能力値 26 項目は 1,716 / 1,716 が一致、カードの種類・ポジション・利き足・国籍・チームは 66 / 66、
 *   プレースタイル（攻撃）は 65 / 66、スキル（名前の集合）は 62 / 66（残りは PES Master に無い新しいスキル・表記の違い）。
 * - 最大レベルは PES Master では利用者の投稿で、新しいカードは 0（不明）。0 のときは null（推測しない）。
 * - 行の形は reference_data.world_player_cards と同じ（snake_case）。アプリの既存の変換をそのまま使う。
 */

export const PESMASTER_ORIGIN = "https://www.pesmaster.com";
export const PESMASTER_FEATURED_URL = `${PESMASTER_ORIGIN}/efootball-2022/player/featured/`;
export const PROVISIONAL_SOURCE = "pesmaster.com";
export const PROVISIONAL_SCHEMA = "provisional-world-cards/v1";

/** PES Master の card_type / card_type_2 → World の card_type（66 枚で確認）。知らない組は null（推測しない）。 */
export const CARD_TYPE_MAP = { "6/1": "SHOWTIME", "6/0": "HIGHLIGHT", "5/0": "EPIC", "3/0": "TRENDING", "5/1": "BIGTIME" };
/** PES Master の position → World の registered_position（66 枚で確認）。 */
export const POSITION_MAP = ["GK", "CB", "LB", "RB", "DMF", "CMF", "LMF", "RMF", "AMF", "LWF", "RWF", "SS", "CF"];
export const FOOT_MAP = { 0: "Right foot", 1: "Left foot" };
/** World が「守備のプレースタイル」にも同じ名前を入れる型（両方に入れる）と、GK の型（攻撃は Basic・守備に入れる）。 */
const DUAL_STYLES = new Set(["Anchor Man", "Box-to-Box"]);
const GK_STYLES = new Set(["Attacking GK", "Defensive GK"]);

/** 能力値: World のキー（camelCase）→ PES Master のキー（snake_case）。 */
export const STAT_KEYS = [
  "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass", "finishing", "heading", "setPieceTaking", "curl",
  "defensiveAwareness", "tackling", "aggression", "defensiveEngagement", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach",
  "speed", "acceleration", "kickingPower", "jumping", "physicalContact", "balance", "stamina",
];
const snake = (k) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());

/**
 * スキル: PES Master の旗 → World の名前。66 枚から求め、出てこなかった 4 つ（*）は公式の英語の名前。
 * PES Master の選手のデータに無い新しいスキル（例: Shadow Hunt・Snap Strike）は暫定のカードでは欠ける（画面で注記する）。
 */
export const SKILL_MAP = {
  s_scissors_feint: "Scissors Feint", s_double_touch: "Double Touch", s_flip_flap: "Flip Flap", s_marseille_turn: "Marseille Turn",
  s_sombrero: "Sombrero" /* * */, s_chop_turn: "Chop Turn", s_cut_behind_and_turn: "Cut Behind & Turn", s_scotch_move: "Scotch Move",
  s_sole_control: "Sole Control", s_heading: "Heading", s_bullet_header: "Bullet Header", s_long_range_curler: "Long-Range Curler",
  s_blitz_curler: "Blitz Curler", s_chip_shot_control: "Chip Shot Control", s_long_range_shooting: "Long Range Shooting", low_screamer: "LowScreamer",
  s_knuckle_shot: "Knuckle Shot" /* * */, s_dipping_shot: "Dipping Shot", s_rising_shot: "Rising Shot", s_acrobatic_finishing: "Acrobatic Finishing",
  s_heel_trick: "Heel Trick", s_first_time_shot: "First-time Shot", s_one_touch_pass: "One-touch Pass", s_through_passing: "Through Passing",
  s_weighted_pass: "Weighted Pass", s_pinpoint_crossing: "Pinpoint Crossing", s_outside_curler: "Outside Curler", s_rabona: "Rabona",
  s_no_look_pass: "No Look Pass", s_low_lofted_pass: "Low Lofted Pass", s_gk_low_punt: "GK Low Punt", s_gk_high_punt: "GK High Punt",
  s_long_throw: "Long Throw", s_gk_long_throw: "GK Long Throw", s_penalty_specialist: "Penalty Specialist", s_gk_penalty_saver: "GK Penalty Saver",
  s_gk_directing_defence: "GK Direct Defending", s_gk_spirit_roar: "GK Spirit Roar", s_gamesmanship: "Gamesmanship", s_man_marking: "Man Marking",
  s_track_back: "Track Back", s_interception: "Interception", s_blocker: "Blocker", s_aerial_superiority: "Aerial Superiority",
  s_sliding_tackle: "Sliding Tackle", s_long_reach_tackle: "Long Reach Tackle", s_acrobatic_clearance: "Acrobatic Clearance", s_aerial_fort: "Aerial Fort",
  s_captaincy: "Captaincy", s_attack_trigger: "Attack Trigger" /* * */, s_super_sub: "Super-sub", s_fighting_spirit: "Fighting Spirit",
  s_phenomenal_finishing: "Phenomenal Finishing", s_willpower: "Will Power", s_fortress: "Fortress", s_momentum_dribbling: "Momentum Dribbling",
  s_acceleration_burst: "Acceleration Burst", s_magnetic_feet: "Magnetic Feet", s_game_changing_pass: "Game-changing Pass" /* * */, s_edged_crossing: "Edged Crossing",
  s_visionary_pass: "Visionary Pass", s_phenomenal_pass: "Phenomenal Pass",
};
/** AI のプレースタイル（World の ai_styles）。 */
export const AI_STYLE_MAP = {
  trickster: "Trickster", mazing_run: "Mazing Run", speeding_bullet: "Speeding Bullet", incisive_run: "Incisive Run",
  long_ball_expert: "Long Ball Expert", early_crosser: "Early Cross", long_ranger: "Long Ranger",
};

/** HTML の `const player = {...}` を取り出す（文字列の中の括弧に惑わされない）。形が違えば null。 */
export function extractPesMasterPlayer(html) {
  if (typeof html !== "string") return null;
  const k = html.indexOf("const player = {");
  if (k < 0) return null;
  const s = html.indexOf("{", k);
  let d = 0;
  let inStr = false;
  let esc = false;
  for (let i = s; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") d++;
    else if (c === "}" && --d === 0) {
      try {
        return JSON.parse(html.slice(s, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** 注目カードのページから、カードの ID（14〜20 桁）を出てきた順に取り出す。 */
export function parseFeaturedIds(html) {
  if (typeof html !== "string") return [];
  const ids = [];
  const seen = new Set();
  for (const m of html.matchAll(/\/efootball-2022\/player\/(\d{10,20})\//g)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ids.push(m[1]);
    }
  }
  return ids;
}

const int = (v) => (Number.isInteger(v) ? v : null);
const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** 並べ替えのキー（アプリの computeNameSortKey と同じ: ASCII の大文字だけを小文字にする）。 */
export function nameSortKey(name) {
  let out = "";
  for (const ch of name) {
    const c = ch.charCodeAt(0);
    out += ch.length === 1 && c >= 0x41 && c <= 0x5a ? String.fromCharCode(c + 0x20) : ch;
  }
  return out;
}

/**
 * PES Master の選手 → World の行の形（暫定）。必須の値（ID・名前・ポジション・カードの種類・能力値 26）が揃わなければ null（入れない）。
 * @param {any} pm
 * @param {{ fetchedAt: string; league?: string | null; region?: string | null; nationality?: string | null; nameJa?: string | null }} ctx
 *   league・region・nationality・nameJa はアプリの既存のカード（同じ人物の別のカード・同じチーム・学んだ表記の対応）から引いた値
 */
export function mapPesMasterPlayer(pm, ctx) {
  if (!pm || typeof pm !== "object") return { ok: false, reason: "no_player" };
  const id = String(pm.id ?? "");
  if (!/^\d{10,20}$/.test(id)) return { ok: false, reason: "bad_id" };
  const name = text(pm.name);
  if (!name) return { ok: false, reason: "no_name" };
  if (pm.fake) return { ok: false, reason: "fake" };
  // 知らない組（2026-10-22 の「3/1」など）はカードを外さず、種類だけ「未確認（null）」にする（推測しない・2026-10-24）
  const cardType = CARD_TYPE_MAP[`${pm.card_type}/${pm.card_type_2}`] ?? null;
  const position = POSITION_MAP[pm.position] ?? null;
  if (!position) return { ok: false, reason: `unknown_position:${pm.position}` };
  const stats = {};
  for (const k of STAT_KEYS) {
    const v = pm[snake(k)];
    if (!Number.isInteger(v) || v < 0 || v > 130) return { ok: false, reason: `bad_stat:${k}` };
    stats[k] = v;
  }
  const attack = text(pm.attacking_playing_style);
  const defence = text(pm.defensive_playing_style);
  let playingStyle = attack;
  let playingStyleDef = defence;
  if (attack && GK_STYLES.has(attack)) {
    playingStyle = "Basic";
    playingStyleDef = attack;
  } else if (attack && DUAL_STYLES.has(attack)) {
    playingStyleDef = attack;
  }
  const skills = Object.keys(SKILL_MAP).filter((k) => pm[k]).map((k) => SKILL_MAP[k]);
  const aiStyles = Object.keys(AI_STYLE_MAP).filter((k) => pm[k]).map((k) => AI_STYLE_MAP[k]);
  const maxLevel = int(pm.max_level) && pm.max_level > 1 ? pm.max_level : null;
  return {
    ok: true,
    row: {
      world_card_id: id,
      name_en: name,
      name_ja: ctx.nameJa ?? null,
      card_type: cardType,
      registered_position: position,
      nationality: ctx.nationality ?? text(pm.nat_name),
      region: ctx.region ?? null,
      league: ctx.league ?? null,
      team: text(pm.team_name),
      ovr_base: int(pm.ovr),
      ovr_max: null,
      maximum_level: maxLevel,
      card_rating: null,
      playing_style: playingStyle,
      playing_style_def: playingStyleDef,
      preferred_foot: FOOT_MAP[pm.foot] ?? null,
      age: int(pm.age),
      height: int(pm.height),
      weight: int(pm.weight),
      image_url: null,
      mobile_image_url: null,
      boost1: null,
      boost2: null,
      stats,
      skills,
      ai_styles: aiStyles,
      appearance: null,
      efhub_card_id: null,
      efhub_conflicts: [],
      name_sort_key: nameSortKey(name),
      source: PROVISIONAL_SOURCE,
      source_url: `${PESMASTER_ORIGIN}/x/efootball-2022/player/${id}/`,
      appearance_updated_at: null,
      fetched_at: ctx.fetchedAt,
      max_level_source: maxLevel ? "pesmaster_user_submitted" : null,
      // 表記の対応を学ぶための PES Master の元の値（正式なデータに置き換わったときに比べる）
      pm_nat_name: text(pm.nat_name),
      pm_league_name: text(pm.league_name),
    },
  };
}

/**
 * 次の暫定のカードの一覧を作る（純関数）。
 * - World に載った ID は外す（正式なデータに置き換わる）。
 * - 新しく取れたものは入れる・取り直したものは置き換える（first_seen_at は保つ）。
 * - 並びは ID の順（差分を小さく・決定的に）。
 * @param {{ previous: any[]; fetched: any[]; worldIds: Set<string>; now: string }} p
 */
export function nextProvisionalCards({ previous, fetched, worldIds, now }) {
  const byId = new Map();
  for (const r of previous ?? []) if (r && !worldIds.has(r.world_card_id)) byId.set(r.world_card_id, r);
  for (const r of fetched ?? []) {
    if (!r || worldIds.has(r.world_card_id)) continue;
    const prev = byId.get(r.world_card_id);
    byId.set(r.world_card_id, { ...r, first_seen_at: prev?.first_seen_at ?? now });
  }
  return [...byId.values()].sort((a, b) => a.world_card_id.localeCompare(b.world_card_id));
}

/** 取り直しが要る ID（新しい・最大レベルが不明で前回から 24 時間以上たった）。 */
export function idsToFetch({ featuredIds, previous, worldIds, now, maxPerRun = 80 }) {
  const prevById = new Map((previous ?? []).map((r) => [r.world_card_id, r]));
  const n = Date.parse(now);
  const out = [];
  const candidates = [...new Set([...(featuredIds ?? []), ...(previous ?? []).map((r) => r.world_card_id)])];
  for (const id of candidates) {
    if (worldIds.has(id)) continue;
    const prev = prevById.get(id);
    if (!prev) out.push(id);
    else if (prev.maximum_level == null && n - Date.parse(prev.fetched_at) >= 24 * 60 * 60 * 1000) out.push(id);
  }
  return out.slice(0, maxPerRun);
}

/** 人物のキー（アプリの personKeyOf と同じ: World のカード ID の下位 20 ビット）。 */
export function personKey(id) {
  return /^\d{1,20}$/.test(String(id)) ? (BigInt(id) & 0xfffffn).toString() : null;
}

/** PES Master と World の表記の違い（確認済み）。同期のたびに学んだ対応を足す。 */
export const SEED_ALIASES = { nationality: { Turkey: "Türkiye", "Czech Republic": "Czechia" }, league: {} };

/**
 * 正式なデータに置き換わったカードから、表記の対応を学ぶ（PES Master の元の値 → World の値）。
 * @param {{ aliases: { nationality: Record<string,string>; league: Record<string,string> }; graduated: { row: any; official: any }[] }} p
 */
export function learnAliases({ aliases, graduated }) {
  const next = { nationality: { ...SEED_ALIASES.nationality, ...(aliases?.nationality ?? {}) }, league: { ...SEED_ALIASES.league, ...(aliases?.league ?? {}) } };
  for (const { row, official } of graduated ?? []) {
    if (row?.pm_nat_name && typeof official?.nationality === "string" && official.nationality && row.pm_nat_name !== official.nationality) next.nationality[row.pm_nat_name] = official.nationality;
    if (row?.pm_league_name && typeof official?.league === "string" && official.league && row.pm_league_name !== official.league) next.league[row.pm_league_name] = official.league;
  }
  return next;
}
