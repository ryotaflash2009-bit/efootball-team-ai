import { z } from "zod";
import { STAT_LABEL_JA } from "@/lib/world/stat-labels";
import { personKeyOf } from "@/lib/world/person-identity";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";

/**
 * 開発用: 外部ソース（このPCのクローラーが集めた攻略サイトのデータ）の読み込みと、World カードとの対応づけ（2026-11-04）。
 *
 * - 受け渡しファイルは data/external/crawler/latest_ratings.json（/data は Git の対象外 → 本番には存在しない）。
 * - 画面ではサイト名を出さず「ソースA / B / C」とだけ表記する。対応表はクローラー側にだけ置く。
 * - 有効なのは next dev のときだけ（{@link isSourceRatingsEnabled}）。診断・Tier などの計算には使わない。
 */

export const SOURCE_RATINGS_API = "/api/dev/source-ratings";

/**
 * 外部ソースの表示を有効にするか。`next dev`（NODE_ENV=development）のときだけ true。
 * 内部ページの `NEXT_PUBLIC_EFTA_INTERNAL_PAGES` による上書きは受け付けない（Production・Preview・test は常に false）。
 */
export function isSourceRatingsEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development";
}

/**
 * ブラウザーが開いたホスト名が localhost 等か（Host ヘッダーで判定する）。
 * `next dev` では `request.url` のホスト名が実際のホスト名を表さない（LAN の IP で開いても localhost になる）ため使わない。
 * トンネル・プロキシ経由（X-Forwarded-Host がローカル以外）も拒否する。
 */
export function isLocalRequest(headers: Headers): boolean {
  const hostnameOf = (hostHeader: string) => hostHeader.trim().replace(/:\d+$/, "");
  const host = headers.get("host");
  if (!host || !isLocalDevHostname(hostnameOf(host))) return false;
  const forwarded = headers.get("x-forwarded-host");
  return !forwarded || forwarded.split(",").every((h) => isLocalDevHostname(hostnameOf(h)));
}

export const SOURCE_IDS = ["A", "B", "C"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/** クローラーの PlayerData 1 件（URL だけを除き、全項目をそのまま持つ）。想定外の項目も捨てずに残す。 */
const sourceRecordSchema = z.looseObject({
  source: z.enum(SOURCE_IDS),
  card_id: z.string().nullable().default(null),
  player_name: z.string(),
  position: z.string().default(""),
  sub_positions: z.array(z.string()).default([]),
  rating_or_tier: z.string().default(""),
  team_and_nationality: z.string().default(""),
  play_style: z.string().default(""),
  skills: z.array(z.string()).default([]),
  stats_and_boosters: z.record(z.string(), z.string()).default({}),
  source_table_type: z.string().default(""),
  fetched_at: z.string().default(""),
  /** API がローカルの World データと突き合わせた結果（ファイルには無い）。{@link resolveRecordCards} */
  resolved_by: z.enum(["stats", "statsNear", "typeLevelOvr", "crossSource", "skills", "styleSkills"]).nullable().default(null),
  resolved_card_ids: z.array(z.string()).default([]),
  /** 同名のカードのどれも記録のスキルをすべては持たない（アプリのデータにまだ無い新しいカードの可能性）。{@link resolveRecordCards} */
  card_not_in_data: z.boolean().default(false),
});

export const sourceRatingsFileSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string(),
  sources: z.record(z.string(), z.object({ fetched_at: z.string(), count: z.number() })),
  players: z.array(z.object({ name_key: z.string(), records: z.array(sourceRecordSchema) })),
  /** API がカード番号で確定した記録から作るスキル名の対応（ソースの名前のキー → カードの名前）。{@link buildSkillNameMap} */
  skill_name_map: z.record(z.string(), z.string()).default({}),
});

export type SourceRecord = z.infer<typeof sourceRecordSchema>;
export type SourceRatingsFile = z.infer<typeof sourceRatingsFileSchema>;

/** 対応づけに使うカードの情報（一覧のカード・詳細のどちらからでも作れる最小の形）。 */
export interface SourceCardRef {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  registeredPosition: string | null;
  ovrBase?: number | null;
  ovrMax: number | null;
  maximumLevel?: number | null;
}

/**
 * 名前の比較用キー。全角/半角・空白・中黒・ピリオド・ダッシュの違いと、ラテン文字のアクセント（Mbappé → mbappe）を吸収する。
 * 日本語の濁点は消さない（バ と ハ を区別する）。
 */
export function nameKey(name: string): string {
  return name
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s・･.\-‐‑–—－_'’]/g, "");
}

/** 攻略サイトのポジション表記 → World の登録ポジション（候補）。同じ表記はそのまま一致とみなす。 */
const POSITION_ALIASES: Record<string, readonly string[]> = {
  ST: ["SS"],
  OMF: ["AMF"],
  LWG: ["LWF"],
  RWG: ["RWF"],
  WG: ["LWF", "RWF"],
  SH: ["LMF", "RMF"],
  LSB: ["LB"],
  RSB: ["RB"],
  SB: ["LB", "RB"],
};

export function positionsCompatible(sourcePosition: string, cardPosition: string | null): boolean {
  const s = sourcePosition.trim().toUpperCase();
  const c = (cardPosition ?? "").trim().toUpperCase();
  if (!s || !c || s === "不明") return true;
  return s === c || (POSITION_ALIASES[s] ?? []).includes(c);
}

const OVERALL_RE = /総合値:\s*(\d{2,3})/;
const RANK_RE = /(\d+)位/;

export function parseOverall(ratingOrTier: string): number | null {
  const m = OVERALL_RE.exec(ratingOrTier);
  return m ? Number(m[1]) : null;
}

export function parseRank(ratingOrTier: string): number | null {
  const m = RANK_RE.exec(ratingOrTier);
  return m ? Number(m[1]) : null;
}

/** その記録が指している総合値の候補（表記の総合値と、個別ページの「最大総合値」）。 */
export function recordOveralls(record: SourceRecord): number[] {
  const values = [parseOverall(record.rating_or_tier), Number.parseInt(record.stats_and_boosters["最大総合値"] ?? "", 10)];
  return [...new Set(values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)))];
}

/** バッジの表記。順位はポジション別のことがあるため、ポジションを添える。 */
export function recordBadgeRating(record: SourceRecord): string {
  const position = record.position.trim();
  const rating = record.rating_or_tier.trim() || "—";
  return position && position !== "不明" ? `${position} ${rating}` : rating;
}

/** 26 能力値がすべてそろっていれば key → 値。1 つでも欠ければ null（一部だけの一致でカードを特定しない）。 */
function recordCoreStats(record: SourceRecord): Record<string, number> | null {
  const stats: Record<string, number> = {};
  for (const [key, label] of Object.entries(STAT_LABEL_JA)) {
    const value = Number.parseInt(record.stats_and_boosters[label] ?? "", 10);
    if (!Number.isFinite(value)) return null;
    stats[key] = value;
  }
  return stats;
}

/** ソースのカード種別 → World の card_type。POTW などの表記は種別を決められないので null。 */
function recordCardType(record: SourceRecord): string | null {
  const raw = (record.stats_and_boosters["カード種別"] ?? record.stats_and_boosters["選手タイプ"] ?? "").toLowerCase();
  if (raw.includes("エピック") || raw.includes("epic")) return "EPIC";
  if (raw.includes("ビッグタイム") || raw.includes("big time") || raw.includes("bigtime")) return "BIGTIME";
  if (raw.includes("ショータイム") || raw.includes("show time") || raw.includes("showtime")) return "SHOWTIME";
  if (raw.includes("ハイライト") || raw.includes("highlight")) return "HIGHLIGHT";
  if (raw.includes("トレンド") || raw.includes("trending")) return "TRENDING";
  return null;
}

/** 突き合わせに使う World カードの情報。 */
export interface ResolverCard {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  cardType: string | null;
  maximumLevel: number | null;
  ovrBase: number | null;
  ovrMax: number | null;
  stats: Readonly<Record<string, number>>;
  /** カードのスキル（World は英語名）。無ければスキルでは絞らない。 */
  skills?: readonly string[];
  /** 攻撃のプレースタイル（World は英語名）。 */
  playStyle?: string | null;
}

/** 個別ページの Lv 上限（「Lv上限: 35」または「最大Lv/ポイント: Lv.33 / 64」。「育成不可」などは null）。 */
function recordMaxLevel(record: SourceRecord): number | null {
  const sb = record.stats_and_boosters;
  const raw = sb["Lv上限"] ?? /^Lv\.?\s*(\d+)/.exec(sb["最大Lv/ポイント"] ?? "")?.[1] ?? "";
  const level = Number.parseInt(raw, 10);
  return Number.isFinite(level) ? level : null;
}

/** ほぼ一致とみなす能力値の数（26 項目中）と、2 番目に近いカードとの差の最小値。 */
const NEAR_STATS_MIN_EQUAL = 22;
const NEAR_STATS_MIN_GAP = 4;

/** カードデータに無いカード番号の記録を、照合の候補として扱う形にする。 */
function recordAsCard(record: SourceRecord, id: string): ResolverCard {
  const [ovrBase = null, ovrMax = ovrBase] = recordOveralls(record);
  return {
    worldCardId: id,
    nameJa: record.player_name,
    nameEn: null,
    cardType: recordCardType(record),
    maximumLevel: recordMaxLevel(record),
    ovrBase,
    ovrMax,
    stats: recordCoreStats(record) ?? {},
  };
}

const SKILL_MAP_MIN_SHARE = 0.9;
const SKILL_MAP_MIN_SUPPORT = 2;
/** スキルで 1 枚に絞るときに、対応の分かるスキルがこれ以上ある記録だけを使う。 */
const SKILL_NARROW_MIN_KNOWN = 5;

/**
 * カード番号（または 26 能力値の完全一致）で確定した記録（ソースのスキル名）とそのカード（World のスキル名）を突き合わせ、
 * ソースのスキル名 → カードのスキル名 の対応を作る。
 * 1 つのスキル名について、それを持つ記録のカードの 9 割以上に共通する名前を候補にし、
 * 候補が 1 つに決まったものから順に、他のスキル名の候補から取り除いていく。2 件以上の記録で裏付けられたものだけを使う。
 */
export function buildSkillNameMap(file: SourceRatingsFile, cards: readonly ResolverCard[]): Map<string, string> {
  const skillsById = new Map(cards.filter((c) => c.skills?.length).map((c) => [c.worldCardId, c.skills!]));
  const support = new Map<string, number>();
  const together = new Map<string, Map<string, number>>();
  const pairs: { keys: string[]; cardSkills: readonly string[]; sameName: Set<string>; complete: boolean }[] = [];
  for (const record of file.players.flatMap((p) => p.records)) {
    const id = confirmedCardId(record);
    const cardSkills = id ? skillsById.get(id) : undefined;
    if (!cardSkills || record.skills.length === 0) continue;
    // カードと同じ名前（英語のソース）は対応を作るまでもない。混ぜると、同じ英語名の取り合いで別の名前に押し出される
    const sameName = new Set(cardSkills.map(nameKey));
    const keys = [...new Set(record.skills.map(nameKey).filter((k) => !sameName.has(k)))];
    pairs.push({ keys, cardSkills, sameName: new Set(record.skills.map(nameKey).filter((k) => sameName.has(k))), complete: record.skills.length === cardSkills.length });
    for (const key of keys) {
      support.set(key, (support.get(key) ?? 0) + 1);
      const counts = together.get(key) ?? new Map<string, number>();
      for (const name of new Set(cardSkills)) counts.set(name, (counts.get(name) ?? 0) + 1);
      together.set(key, counts);
    }
  }

  const candidates = new Map<string, Set<string>>();
  for (const [key, counts] of together) {
    const n = support.get(key) ?? 0;
    if (n < SKILL_MAP_MIN_SUPPORT) continue;
    candidates.set(key, new Set([...counts].filter(([, count]) => count >= n * SKILL_MAP_MIN_SHARE).map(([name]) => name)));
  }
  const map = new Map<string, string>();
  // 取り合いは同じ文字の種類の名前どうしだけ（英語の別名 "Heading Skill" と日本語の「ヘッダー」は両方 Heading になれる）
  const ascii = (key: string) => /^[ -~]+$/.test(key);
  const takenBy = (key: string) => new Set([...map].filter(([k]) => ascii(k) === ascii(key)).map(([, name]) => name));
  for (let changed = true; changed; ) {
    changed = false;
    for (const [key, names] of candidates) {
      if (map.has(key)) continue;
      for (const name of takenBy(key)) names.delete(name);
      if (names.size === 1) {
        map.set(key, [...names][0]);
        changed = true;
      }
    }
  }
  // 記録とカードのスキルの数が同じ組で、対応の分からない名前が 1 つだけ残れば、残ったカードのスキルがそれ（新しいスキルは裏付けが 1 件しかないため）
  for (let changed = true; changed; ) {
    changed = false;
    for (const { keys, cardSkills, sameName, complete } of pairs) {
      const open = keys.filter((k) => !map.has(k));
      if (!complete || open.length !== 1) continue;
      const used = new Set(keys.map((k) => map.get(k)).filter((n): n is string => !!n));
      const rest = cardSkills.filter((n) => !used.has(n) && !sameName.has(nameKey(n)));
      if (rest.length === 1 && !takenBy(open[0]).has(rest[0])) {
        map.set(open[0], rest[0]);
        changed = true;
      }
    }
  }
  return map;
}

/** 確定した記録のカード（カード番号か、26 能力値がすべて同じで 1 枚に決まったもの）。対応表を作るのに使う。 */
function confirmedCardId(record: SourceRecord): string | null {
  return recordCardId(record) ?? (record.resolved_by === "stats" && record.resolved_card_ids.length === 1 ? record.resolved_card_ids[0] : null);
}

/** 記録の攻撃のプレースタイル（「攻撃: X / 守備: Y」の X。そうでなければ表記そのもの）。 */
export function recordAttackStyle(record: SourceRecord): string | null {
  const text = record.play_style.trim();
  const style = (/攻撃\s*[:：]\s*([^/]+)/.exec(text)?.[1] ?? text.split("/")[0]).trim();
  return style || null;
}

const STYLE_MAP_MIN_SUPPORT = 2;

/** 確定した記録の攻撃のプレースタイルと、そのカードのプレースタイルの対応（9 割以上が同じで、2 件以上で裏付けられたもの）。 */
export function buildStyleNameMap(file: SourceRatingsFile, cards: readonly ResolverCard[]): Map<string, string> {
  const styleById = new Map(cards.filter((c) => c.playStyle).map((c) => [c.worldCardId, c.playStyle!]));
  const counts = new Map<string, Map<string, number>>();
  for (const record of file.players.flatMap((p) => p.records)) {
    const id = confirmedCardId(record);
    const cardStyle = id ? styleById.get(id) : undefined;
    const style = recordAttackStyle(record);
    if (!cardStyle || !style || nameKey(style) === nameKey(cardStyle)) continue;
    const own = counts.get(nameKey(style)) ?? new Map<string, number>();
    own.set(cardStyle, (own.get(cardStyle) ?? 0) + 1);
    counts.set(nameKey(style), own);
  }
  const map = new Map<string, string>();
  for (const [key, own] of counts) {
    const total = [...own.values()].reduce((a, b) => a + b, 0);
    const [best, n] = [...own].sort((a, b) => b[1] - a[1])[0];
    if (total >= STYLE_MAP_MIN_SUPPORT && n >= total * SKILL_MAP_MIN_SHARE) map.set(key, best);
  }
  return map;
}

/** 記録のスキルをカードの言語に直したもの（対応の分からないスキルは除く）。 */
export function translatedSkills(record: SourceRecord, skillNameMap: Readonly<Record<string, string>>, cardSkillNames: Iterable<string> = []): string[] {
  const byKey = new Map([...Object.values(skillNameMap), ...cardSkillNames].map((name) => [nameKey(name), name]));
  return record.skills.map((s) => skillNameMap[nameKey(s)] ?? byKey.get(nameKey(s)) ?? null).filter((s): s is string => s != null);
}

/**
 * カード番号の無い記録が、どのカードのものかをカードデータと他のソースの記録から特定する。
 * - stats: 同名のカードのうち、26 能力値がすべて基本値と同じ（ソース A は順位用の総合値がカードの総合値と基準が違うため）
 * - typeLevelOvr: 同名のカードのうち、種別・Lv 上限・総合値（初期または最大）が同じ
 * - crossSource: 上のどちらかで候補が複数あり、他のソースが特定したカードがその中の 1 枚だけ
 * - skills: それでも候補が複数あり、記録のスキル（カードの言語に直せたもの 5 つ以上）をすべて持つカードがその中の 1 枚だけ
 *
 * カードデータに無くても、他の記録のカード番号が指すカードは候補に入れる（新しいカードと取り違えて確定にしない）。
 * 種別・Lv 上限が分からない候補は「同じかもしれない」として残す。
 * ポジションでは絞らない（順位の表は登録ポジション以外の順位も載せる）。候補が複数なら全部残し、画面では確定扱いにしない。
 */
export function resolveRecordCards(file: SourceRatingsFile, cards: readonly ResolverCard[]): SourceRatingsFile {
  const known = new Set(cards.map((c) => c.worldCardId));
  const allCards = [...cards];
  for (const record of file.players.flatMap((p) => p.records)) {
    const id = recordCardId(record);
    if (id && !known.has(id)) {
      known.add(id);
      allCards.push(recordAsCard(record, id));
    }
  }

  const byName = new Map<string, ResolverCard[]>();
  for (const card of allCards) {
    for (const key of new Set([card.nameJa, card.nameEn].filter((n): n is string => !!n?.trim()).map(nameKey))) {
      const list = byName.get(key);
      if (list) list.push(card);
      else byName.set(key, [card]);
    }
  }

  const resolve = (record: SourceRecord): SourceRecord => {
    const candidates = byName.get(nameKey(record.player_name));
    if (recordCardId(record) || !candidates) return record;
    const stats = recordCoreStats(record);
    if (stats) {
      const same = candidates.filter((c) => Object.entries(stats).every(([key, value]) => c.stats[key] === value));
      if (same.length > 0) return { ...record, resolved_by: "stats", resolved_card_ids: same.map((c) => c.worldCardId) };
    }
    const type = recordCardType(record);
    const level = recordMaxLevel(record);
    if (stats && type && level != null) {
      // 抽出の誤りで数項目だけずれることがある。種別・Lv 上限が同じカードの中で、ほぼ一致が 1 枚だけなら有力とする
      const scored = candidates
        .filter((c) => c.cardType === type && c.maximumLevel === level)
        .map((c) => ({ c, equal: Object.entries(stats).filter(([key, value]) => c.stats[key] === value).length }))
        .sort((a, b) => b.equal - a.equal);
      const [best, second] = scored;
      if (best && best.equal >= NEAR_STATS_MIN_EQUAL && best.equal - (second?.equal ?? 0) >= NEAR_STATS_MIN_GAP) {
        return { ...record, resolved_by: "statsNear", resolved_card_ids: [best.c.worldCardId] };
      }
    }
    const overalls = recordOveralls(record);
    if (!type || overalls.length === 0) return record;
    const same = candidates.filter(
      (c) =>
        (c.cardType == null || c.cardType === type) &&
        (level == null || c.maximumLevel == null || c.maximumLevel === level) &&
        overalls.some((v) => v === c.ovrBase || v === c.ovrMax),
    );
    return same.length > 0 ? { ...record, resolved_by: "typeLevelOvr", resolved_card_ids: same.map((c) => c.worldCardId) } : record;
  };
  const resolved = file.players.map((p) => ({ ...p, records: p.records.map(resolve) }));

  // カードごとに、特定できたソース（カード番号・1 枚に絞れた記録）を集める
  const sourcesByCard = new Map<string, Set<SourceId>>();
  const addSource = (id: string, source: SourceId) => {
    const sources = sourcesByCard.get(id);
    if (sources) sources.add(source);
    else sourcesByCard.set(id, new Set([source]));
  };
  for (const record of resolved.flatMap((p) => p.records)) {
    const id = recordCardId(record) ?? (record.resolved_card_ids.length === 1 ? record.resolved_card_ids[0] : null);
    if (id) addSource(id, record.source);
  }
  const skillNameMap = Object.fromEntries(buildSkillNameMap({ ...file, players: resolved }, cards));
  const cardById = new Map(allCards.map((c) => [c.worldCardId, c]));
  // カードデータに無いカード（他の記録のカード番号だけで分かるもの）には、スキルをすべてカードの言語に直せた記録のスキルを持たせる
  const vocabulary = [...new Set(cards.flatMap((c) => c.skills ?? []))];
  for (const record of file.players.flatMap((p) => p.records)) {
    const id = recordCardId(record);
    const ghost = id && !cards.some((c) => c.worldCardId === id) ? cardById.get(id) : undefined;
    if (!ghost || ghost.skills?.length || record.skills.length === 0) continue;
    // 英語のソースのスキルは、まだどのカードにも無い新しいスキルでもそのまま使う
    const skills = record.skills.map((s) => translatedSkills({ ...record, skills: [s] }, skillNameMap, vocabulary)[0] ?? (/^[ -~]+$/.test(s) ? s : null));
    if (skills.every((s) => s != null)) ghost.skills = skills as string[];
  }
  const styleNameMap = buildStyleNameMap({ ...file, players: resolved }, cards);
  const styleByKey = new Map(cards.filter((c) => c.playStyle).map((c) => [nameKey(c.playStyle!), c.playStyle!]));
  const cardStyleOf = (record: SourceRecord): string | null => {
    const style = recordAttackStyle(record);
    return style ? (styleNameMap.get(nameKey(style)) ?? styleByKey.get(nameKey(style)) ?? null) : null;
  };
  for (const record of file.players.flatMap((p) => p.records)) {
    const id = recordCardId(record);
    const ghost = id && !cards.some((c) => c.worldCardId === id) ? cardById.get(id) : undefined;
    if (ghost && !ghost.playStyle) ghost.playStyle = cardStyleOf(record);
  }
  const narrow = (record: SourceRecord): SourceRecord => {
    if (record.resolved_card_ids.length === 0 && !recordCardId(record)) return bySkillsAlone(record);
    if (record.resolved_card_ids.length < 2) return record;
    const others = record.resolved_card_ids.filter((id) => [...(sourcesByCard.get(id) ?? [])].some((s) => s !== record.source));
    if (others.length === 1) return { ...record, resolved_by: "crossSource", resolved_card_ids: others };
    // 候補のうち、記録のスキルをすべて持つカードが 1 枚だけなら有力とする（スキルの分からない候補があれば絞らない）
    const cardsWithSkills = record.resolved_card_ids.map((id) => cardById.get(id)).filter((c) => c?.skills?.length);
    const known = translatedSkills(record, skillNameMap, cardsWithSkills.flatMap((c) => c!.skills!));
    if (known.length < SKILL_NARROW_MIN_KNOWN || cardsWithSkills.length !== record.resolved_card_ids.length) return record;
    const fit = cardsWithSkills.filter((c) => known.every((s) => c!.skills!.includes(s)));
    return fit.length === 1 ? { ...record, resolved_by: "skills", resolved_card_ids: [fit[0]!.worldCardId] } : record;
  };

  // 特定できなかった記録を、同名のカードのスキルと比べる。
  // スキルをすべてカードの言語に直せて、それをすべて持つカードが 1 枚だけなら有力。どのカードも持たないなら、まだデータに無いカードとみる
  function bySkillsAlone(record: SourceRecord): SourceRecord {
    const named = byName.get(nameKey(record.player_name)) ?? [];
    if (named.length === 0 || named.some((c) => !c.skills?.length)) return record;
    const known = translatedSkills(record, skillNameMap, named.flatMap((c) => c.skills!));
    const style = cardStyleOf(record);
    const sameStyle = (c: ResolverCard) => !!style && !!c.playStyle && nameKey(c.playStyle) === nameKey(style);
    const holds = (c: ResolverCard) => known.every((s) => c.skills!.includes(s));
    if (known.length >= SKILL_NARROW_MIN_KNOWN) {
      const holders = named.filter(holds);
      if (holders.length === 0) return { ...record, card_not_in_data: true };
      // プレースタイルが分かっていて違うカードは除く
      const fit = holders.filter((c) => !style || !c.playStyle || sameStyle(c));
      return known.length === record.skills.length ? withCandidates(record, "skills", fit) : record;
    }
    // スキルが少ない記録（順位表だけの記録）は、攻撃のプレースタイルが同じで、スキルもすべて持つカードが 1 枚だけなら有力
    if (!style || known.length === 0 || known.length !== record.skills.length || named.some((c) => !c.playStyle)) return record;
    return withCandidates(record, "styleSkills", named.filter((c) => sameStyle(c) && holds(c)));
  }

  // 合うカードが 1 枚ならそれ。複数なら、他のソースが特定したカードが 1 枚だけのときはそれ、そうでなければ候補として全部残す（確定にしない）
  function withCandidates(record: SourceRecord, by: "skills" | "styleSkills", fit: readonly ResolverCard[]): SourceRecord {
    if (fit.length === 0) return record;
    const ids = fit.map((c) => c.worldCardId);
    if (ids.length === 1) return { ...record, resolved_by: by, resolved_card_ids: ids };
    const others = ids.filter((id) => [...(sourcesByCard.get(id) ?? [])].some((s) => s !== record.source));
    return others.length === 1 ? { ...record, resolved_by: "crossSource", resolved_card_ids: others } : { ...record, resolved_by: by, resolved_card_ids: ids };
  }

  return { ...file, skill_name_map: skillNameMap, players: resolved.map((p) => ({ ...p, records: p.records.map(narrow) })) };
}

export interface SourceRatingsIndex {
  byCardId: Map<string, SourceRecord[]>;
  /** 人物のキー（カード番号の下位 20 ビット・person-identity.ts）→ その選手の記録（カード番号を持つ記録だけ）。 */
  byPerson: Map<string, SourceRecord[]>;
  /** 名前 → カード番号を持たない記録（カード番号を持つ記録は番号で判定する）。 */
  byName: Map<string, SourceRecord[]>;
  generatedAt: string;
  /** ソースのスキル名のキー → カードのスキル名（API が作る。{@link buildSkillNameMap}） */
  skillNameMap: Readonly<Record<string, string>>;
}

/** 記録のカード番号（ソース B・C の個別ページの URL の末尾の数字＝World のカード ID）。形が違えば null。 */
function recordCardId(record: SourceRecord): string | null {
  return record.card_id && /^\d{1,20}$/.test(record.card_id) ? record.card_id : null;
}

export function buildSourceRatingsIndex(file: SourceRatingsFile): SourceRatingsIndex {
  const byCardId = new Map<string, SourceRecord[]>();
  const byPerson = new Map<string, SourceRecord[]>();
  const byName = new Map<string, SourceRecord[]>();
  const push = (map: Map<string, SourceRecord[]>, key: string, r: SourceRecord) => {
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  };
  for (const player of file.players) {
    for (const r of player.records) {
      const id = recordCardId(r);
      const person = personKeyOf(id);
      if (id && person) {
        push(byCardId, id, r);
        push(byPerson, person, r);
      } else {
        // クローラーの name_key ではなく、この側の nameKey で引き直す（比較の規則をこの側で一つにする）
        push(byName, nameKey(r.player_name), r);
      }
    }
  }
  return { byCardId, byPerson, byName, generatedAt: file.generated_at, skillNameMap: file.skill_name_map };
}

/**
 * 対応づけの確からしさ。
 * - cardId: 記録のカード番号がこのカードと同じ（確定）
 * - stats: カード番号の無い記録で、26 能力値が同じカードがこの 1 枚だけ（確定）
 * - typeLevelOvr: カード番号の無い記録で、種別・Lv 上限・総合値が同じカードがこの 1 枚だけ（手元のカードデータの中で確定）
 * - statsNear: 種別・Lv 上限が同じカードの中で、26 能力値のほとんどが一致するカードがこの 1 枚だけ（有力）
 * - crossSource: 同じ条件のカードが複数ある中で、他のソースが特定したカードがこの 1 枚だけ（有力）
 * - skills: 同じ条件のカードが複数ある中で、記録のスキルをすべて持つカードがこの 1 枚だけ（有力）
 * - styleSkills: 攻撃のプレースタイルが同じで、記録の（少ない）スキルをすべて持つカードがこの 1 枚だけ（有力）
 * - nameOvr: 上の 2 つで特定できない記録で、名前・総合値（とポジション）が同じ。同名・同総合値の別カードがあり得るので、画面で確定できたときだけ結び付ける
 * - candidate: 能力値または種別などが同じカードが複数あり、このカードはその 1 枚（未確定）
 * - cardIdConflict: カード番号は同じだが、総合値か Lv 上限がこのカードと食い違う（誤った番号の可能性。確定として出さない）
 * - samePerson: カード番号の人物のキーが同じ＝同じ選手の別のカード向け（選手は確定・カードは別。参考表示）
 * - nameOnly: カード番号の無い記録で、名前だけが同じ（同じ選手の別のカード向けの可能性が高い。参考表示）
 *
 * カード番号を持つ記録は名前では結び付けない（同名の別人を混ぜない）。
 */
export type SourceMatchKind = "cardId" | "stats" | "typeLevelOvr" | "statsNear" | "crossSource" | "skills" | "styleSkills" | "nameOvr" | "candidate" | "cardIdConflict" | "samePerson" | "nameOnly";

export interface SourceMatch {
  kind: SourceMatchKind;
  record: SourceRecord;
}

const MATCH_ORDER: Record<SourceMatchKind, number> = { cardId: 0, stats: 1, typeLevelOvr: 2, statsNear: 3, crossSource: 4, skills: 5, styleSkills: 6, nameOvr: 7, candidate: 8, cardIdConflict: 9, samePerson: 10, nameOnly: 11 };

/** このカードのものとして結び付けてよい（バッジ・タブの本体に出す）種類。 */
export function isCardLevelMatch(kind: SourceMatchKind): boolean {
  return kind !== "cardIdConflict" && kind !== "samePerson" && kind !== "nameOnly";
}

/** 記録の総合値がこのカードの初期・最大のどちらとも違う、または Lv 上限が違う。 */
function recordConflicts(record: SourceRecord, card: SourceCardRef): boolean {
  // 最大総合値が不明なカード（暫定）は、初期の総合値がソースと 1 ずれることがあるので比べない
  const own = card.ovrMax == null ? [] : [card.ovrBase, card.ovrMax].filter((v): v is number => v != null);
  const overalls = recordOveralls(record);
  if (own.length > 0 && overalls.length > 0 && !overalls.some((v) => own.includes(v))) return true;
  const level = recordMaxLevel(record);
  return level != null && card.maximumLevel != null && level !== card.maximumLevel;
}

/** カード番号の無い記録の、このカードに対する種類。 */
function nameRecordKind(record: SourceRecord, card: SourceCardRef): SourceMatchKind {
  if (record.card_not_in_data) return "nameOnly";
  if (record.resolved_by) {
    if (!record.resolved_card_ids.includes(card.worldCardId)) return "nameOnly";
    return record.resolved_card_ids.length > 1 ? "candidate" : record.resolved_by;
  }
  const sameOvr = card.ovrMax != null && recordOveralls(record).includes(card.ovrMax);
  return sameOvr && positionsCompatible(record.position, card.registeredPosition) ? "nameOvr" : "nameOnly";
}

export function matchCard(index: SourceRatingsIndex, card: SourceCardRef): SourceMatch[] {
  const out: SourceMatch[] = [];
  const exact = new Set(index.byCardId.get(card.worldCardId) ?? []);
  for (const record of exact) out.push({ kind: recordConflicts(record, card) ? "cardIdConflict" : "cardId", record });
  const person = personKeyOf(card.worldCardId);
  for (const record of person ? (index.byPerson.get(person) ?? []) : []) {
    if (!exact.has(record)) out.push({ kind: "samePerson", record });
  }
  const seen = new Set<SourceRecord>();
  const keys = new Set([card.nameJa, card.nameEn].filter((n): n is string => !!n?.trim()).map(nameKey));
  for (const key of keys) {
    for (const record of index.byName.get(key) ?? []) {
      if (seen.has(record)) continue;
      seen.add(record);
      out.push({ kind: nameRecordKind(record, card), record });
    }
  }
  return out.sort((a, b) => MATCH_ORDER[a.kind] - MATCH_ORDER[b.kind] || a.record.source.localeCompare(b.record.source));
}

/** 同名・同総合値の World カードの枚数（このカードを含む）。2 枚以上なら nameOvr は確定できない。 */
export function countSameNameOvrCards(
  cards: readonly { nameJa?: string | null; nameEn?: string | null; ovrMax?: number | null }[],
  card: SourceCardRef,
): number {
  const keys = new Set([card.nameJa, card.nameEn].filter((n): n is string => !!n?.trim()).map(nameKey));
  return cards.filter(
    (c) => c.ovrMax === card.ovrMax && [c.nameJa, c.nameEn].some((n) => !!n && keys.has(nameKey(n))),
  ).length;
}

export interface StatComparisonRow {
  key: string;
  labelJa: string;
  source: number | null;
  card: number | null;
  diff: number | null;
}

/** 26 能力値をソースとこのカードで並べる（ソースの能力値は日本語名がキー）。 */
export function compareStats(record: SourceRecord, cardStats: readonly { key: string; value: number | null }[]): StatComparisonRow[] {
  const cardByKey = new Map(cardStats.map((s) => [s.key, s.value]));
  return Object.entries(STAT_LABEL_JA).map(([key, labelJa]) => {
    const raw = Number.parseInt(record.stats_and_boosters[labelJa] ?? "", 10);
    const source = Number.isFinite(raw) ? raw : null;
    const card = cardByKey.get(key) ?? null;
    return { key, labelJa, source, card, diff: source != null && card != null ? source - card : null };
  });
}

const CORE_STAT_LABELS = new Set(Object.values(STAT_LABEL_JA));

/** 26 能力値以外の項目（ブースター・利き足・身長・COMスキルなど）を、記録の順のまま返す。 */
export function extraStatEntries(record: SourceRecord): [string, string][] {
  return Object.entries(record.stats_and_boosters).filter(([k]) => !CORE_STAT_LABELS.has(k));
}

const KNOWN_RECORD_KEYS = new Set(Object.keys(sourceRecordSchema.shape));

/** スキーマに無い項目（クローラー側で増えた項目）。捨てずに画面の「その他」に出す。 */
export function unknownRecordEntries(record: SourceRecord): [string, string][] {
  return Object.entries(record)
    .filter(([k]) => !KNOWN_RECORD_KEYS.has(k))
    .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]);
}
