/**
 * 暫定のカードの同期（2026-10-15）。PES Master の注目カードのうち、TeamAIXI（eFootball World）にまだ無いカードを
 * src/lib/reference-data/provisional/data/provisional-cards.json に入れる。World に載ったカードは外す。
 *
 *   node scripts/provisional-cards-sync.mjs [--dry-run] [--site https://efootball-team-ai.vercel.app]
 *
 * - 外部: PES Master の注目カードのページ 1 回 + 取り直しが要るカードのページ（1 枚ごとに 2 秒あける・1 回 80 枚まで）。
 * - 既にあるかの確認・リーグと地域の引き当ては TeamAIXI の公開 API（読み取りだけ）。Secret・Production の DB には触れない。
 * - 書くのは上の JSON だけ。変更が無ければ書かない。
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import {
  PESMASTER_FEATURED_URL,
  PESMASTER_ORIGIN,
  PROVISIONAL_SCHEMA,
  PROVISIONAL_SOURCE,
  parseFeaturedIds,
  extractPesMasterPlayer,
  mapPesMasterPlayer,
  nextProvisionalCards,
  idsToFetch,
  personKey,
  learnAliases,
} from "./lib/pesmaster-provisional.mjs";

const FILE = "src/lib/reference-data/provisional/data/provisional-cards.json";
const UA = "TeamAIXI-provisional-sync/1.0 (+https://efootball-team-ai.vercel.app)";
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const site = argv.includes("--site") ? argv[argv.indexOf("--site") + 1] : "https://efootball-team-ai.vercel.app";
const now = new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 一時的な失敗（429・5xx・通信の失敗）は 2 回まで待って読み直す（2026-10-18: 本番 API の一時的な 500 で同期全体が失敗した）。4xx は読み直さない。 */
async function fetchWithRetry(url, init) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(attempt * 3_000);
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
      if (res.ok) return res;
      lastError = new Error(`http_${res.status}`);
      if (res.status < 500 && res.status !== 429) break; // 429（混雑）と 5xx だけ読み直す
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
async function getText(url) {
  return (await fetchWithRetry(url, { headers: { "user-agent": UA } })).text();
}
async function getJson(url) {
  return (await fetchWithRetry(url, {})).json();
}

const previousFile = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { cards: [] };
const previous = Array.isArray(previousFile.cards) ? previousFile.cards : [];

// 1. 注目カード
const featuredIds = parseFeaturedIds(await getText(PESMASTER_FEATURED_URL));
if (featuredIds.length === 0) {
  console.log(JSON.stringify({ status: "stopped", reason: "featured_page_unparsable" }));
  process.exit(1);
}

// 2. TeamAIXI に既にある ID（World）
const candidates = [...new Set([...featuredIds, ...previous.map((r) => r.world_card_id)])];
const worldIds = new Set();
const officialById = new Map();
for (let i = 0; i < candidates.length; i += 100) {
  const j = await getJson(`${site}/api/world/players/by-ids?ids=${candidates.slice(i, i + 100).join(",")}`);
  // by-ids は暫定のカードも返すため、World の行（provisional でない）だけを数える
  for (const p of j.players ?? []) {
    if (p.provisional) continue;
    worldIds.add(p.worldCardId);
    officialById.set(p.worldCardId, p);
  }
}

// 2b. 正式なデータに置き換わったカードから、表記の対応（国籍・リーグ）を学ぶ
const aliases = learnAliases({
  aliases: previousFile.aliases,
  graduated: previous.filter((r) => officialById.has(r.world_card_id)).map((r) => ({ row: r, official: officialById.get(r.world_card_id) })),
});

/** 同じ人物の別のカード（World）: 日本語名・国籍・地域は人物ごとに同じ（人物のキー＝カード ID の下位 20 ビット・食い違い 0 件）。 */
async function samePersonCard(id, nameEn) {
  if (!nameEn) return null;
  try {
    const j = await getJson(`${site}/api/world/players?pageSize=100&q=${encodeURIComponent(nameEn)}`);
    return (j.players ?? []).find((p) => !p.provisional && p.worldCardId !== id && personKey(p.worldCardId) === personKey(id)) ?? null;
  } catch {
    return null;
  }
}

// 3. 取り直しが要るカードを PES Master から読む
const toFetch = idsToFetch({ featuredIds, previous, worldIds, now });
const leagueByTeam = new Map();
const regionByNat = new Map();
const leagueByName = new Map();
async function lookup(map, key, param, field) {
  if (!key) return null;
  if (map.has(key)) return map.get(key);
  let v = null;
  try {
    const j = await getJson(`${site}/api/world/players?pageSize=1&${param}=${encodeURIComponent(key)}`);
    const p = (j.players ?? [])[0];
    v = p && !p.provisional ? (p[field] ?? null) : null;
  } catch {
    v = null;
  }
  map.set(key, v);
  return v;
}
const fetched = [];
const rejected = [];
for (const id of toFetch) {
  try {
    const pm = extractPesMasterPlayer(await getText(`${PESMASTER_ORIGIN}/x/efootball-2022/player/${id}/`));
    const team = typeof pm?.team_name === "string" ? pm.team_name : null;
    const pmNat = typeof pm?.nat_name === "string" ? pm.nat_name : null;
    const pmLeague = typeof pm?.league_name === "string" ? pm.league_name : null;
    const same = await samePersonCard(id, typeof pm?.name === "string" ? pm.name : null);
    const nat = same?.nationality ?? (pmNat ? (aliases.nationality[pmNat] ?? pmNat) : null);
    const league = (await lookup(leagueByTeam, team, "team", "league")) ?? (pmLeague ? (aliases.league[pmLeague] ?? (await lookup(leagueByName, pmLeague, "league", "league"))) : null);
    const r = mapPesMasterPlayer(pm, {
      fetchedAt: now,
      league,
      region: same?.region ?? (await lookup(regionByNat, nat, "nationality", "region")),
      nationality: nat,
      nameJa: same?.nameJa ?? null,
    });
    if (r.ok) fetched.push(r.row);
    else rejected.push({ id, reason: r.reason });
  } catch (e) {
    rejected.push({ id, reason: e?.message ?? "error" });
  }
  await sleep(2000);
}

// 4. 次の一覧
const cards = nextProvisionalCards({ previous, fetched, worldIds, now });
const strip = (list) => JSON.stringify(list.map(({ fetched_at, ...r }) => r));
const changed = strip(cards) !== strip(previous) || fetched.length > 0 || JSON.stringify(aliases) !== JSON.stringify(previousFile.aliases ?? null);
const summary = {
  status: "ok",
  featured: featuredIds.length,
  alreadyInWorld: featuredIds.filter((id) => worldIds.has(id)).length,
  fetched: fetched.length,
  rejected,
  provisional: cards.length,
  removedBecauseInWorld: previous.filter((r) => worldIds.has(r.world_card_id)).length,
  withMaxLevel: cards.filter((r) => r.maximum_level != null).length,
  unknownCardType: cards.filter((r) => r.card_type == null).length,
  withNameJa: cards.filter((r) => r.name_ja).length,
  learnedAliases: Object.keys(aliases.nationality).length + Object.keys(aliases.league).length,
  changed,
};
console.log(JSON.stringify(summary));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `provisional cards: ${JSON.stringify(summary)}\n`);
if (!dryRun && changed) {
  writeFileSync(FILE, JSON.stringify({ schema: PROVISIONAL_SCHEMA, source: PROVISIONAL_SOURCE, updatedAt: now, aliases, cards }, null, 1) + "\n");
  console.log(`wrote ${FILE}`);
}
