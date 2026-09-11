import type {
  WorldAppearance,
  WorldMetricRank,
  WorldPlayerListItem,
  WorldStatGroup,
  WorldStatValue,
} from "./types";
import { WORLD_STAT_DEFS } from "./stats";
import { isDisplayableWorldImageUrl } from "./image";

/**
 * SQLite の行（snake_case・SqlValue）を画面用の型へ変換する。
 * 個人情報・パス・SQL 文などは元々列に無いが、ここで返す形も列の写しに限定する。
 */

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

const EFHUB_ID_RE = /^[0-9]{1,20}$/;

export function rowToListItem(row: Row): WorldPlayerListItem {
  const efhubRaw = str(row.efhub_card_id);
  const efhubCardId = efhubRaw && EFHUB_ID_RE.test(efhubRaw) ? efhubRaw : null;
  const imageUrl = str(row.image_url);
  const mobileImageUrl = str(row.mobile_image_url);

  return {
    worldCardId: String(row.world_card_id),
    nameEn: str(row.name_en),
    nameJa: str(row.name_ja),
    cardType: str(row.card_type),
    registeredPosition: str(row.registered_position),
    ovrBase: num(row.ovr_base),
    ovrMax: num(row.ovr_max),
    maximumLevel: num(row.maximum_level),
    cardRating: str(row.card_rating),
    playingStyle: str(row.playing_style),
    playingStyleDefensive: str(row.playing_style_def),
    nationality: str(row.nationality),
    region: str(row.region),
    league: str(row.league),
    team: str(row.team),
    preferredFoot: str(row.preferred_foot),
    age: num(row.age),
    height: num(row.height),
    weight: num(row.weight),
    boost1: num(row.boost1),
    boost2: num(row.boost2),
    appearanceUpdatedAt: str(row.appearance_updated_at),
    // 表示可能なホストのときだけ候補として返す（<img> には渡さない運用）
    imageUrlCandidate: isDisplayableWorldImageUrl(imageUrl) ? imageUrl : null,
    mobileImageUrlCandidate: isDisplayableWorldImageUrl(mobileImageUrl) ? mobileImageUrl : null,
    hasEfhubLink: efhubCardId != null,
    efhubCardId,
  };
}

/** world_player_stats の行配列 → 26 項目そろえた能力値（欠損は value: null） */
export function rowsToStats(rows: Row[]): WorldStatValue[] {
  const byKey = new Map<string, number | null>();
  for (const r of rows) {
    const key = str(r.stat_key);
    if (key) byKey.set(key, num(r.value));
  }
  return WORLD_STAT_DEFS.map((def) => ({
    key: def.key,
    nameEn: def.nameEn,
    group: def.group as WorldStatGroup,
    value: byKey.has(def.key) ? byKey.get(def.key)! : null,
  }));
}

function toMetricRank(v: unknown): WorldMetricRank | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const rank = num(o.rank);
  const total = num(o.total);
  if (rank == null || total == null || total <= 0) return null;
  return { rank, total, topPercent: num(o.topPercent) ?? 0 };
}

/** world_player_appearances.ranks_json（文字列）→ メトリクスごとの overall / position 順位。壊れていれば null。 */
function parseRanks(v: unknown): WorldAppearance["ranks"] {
  if (typeof v !== "string" || v === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const out: NonNullable<WorldAppearance["ranks"]> = {};
  for (const [key, side] of Object.entries(parsed as Record<string, unknown>)) {
    if (!side || typeof side !== "object") continue;
    const s = side as Record<string, unknown>;
    out[key] = { overall: toMetricRank(s.overall), position: toMetricRank(s.position) };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function rowToAppearance(row: Row | null | undefined): WorldAppearance | null {
  if (!row) return null;
  return {
    position: str(row.position),
    legCoverageRadius: num(row.leg_coverage_radius),
    armCoverageRadius: num(row.arm_coverage_radius),
    torsoCollision: num(row.torso_collision),
    jumpingHeight: num(row.jumping_height),
    dribbleHeight: num(row.dribble_height),
    legLength: num(row.leg_length),
    ranks: parseRanks(row.ranks_json),
    updatedAt: str(row.updated_at),
  };
}
