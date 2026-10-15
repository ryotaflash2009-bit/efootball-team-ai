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
} from "./lib/pesmaster-provisional.mjs";

const FILE = "src/lib/reference-data/provisional/data/provisional-cards.json";
const UA = "TeamAIXI-provisional-sync/1.0 (+https://efootball-team-ai.vercel.app)";
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const site = argv.includes("--site") ? argv[argv.indexOf("--site") + 1] : "https://efootball-team-ai.vercel.app";
const now = new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.text();
}
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
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
for (let i = 0; i < candidates.length; i += 100) {
  const j = await getJson(`${site}/api/world/players/by-ids?ids=${candidates.slice(i, i + 100).join(",")}`);
  // by-ids は暫定のカードも返すため、World の行（provisional でない）だけを数える
  for (const p of j.players ?? []) if (!p.provisional) worldIds.add(p.worldCardId);
}

// 3. 取り直しが要るカードを PES Master から読む
const toFetch = idsToFetch({ featuredIds, previous, worldIds, now });
const leagueByTeam = new Map();
const regionByNat = new Map();
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
    const nat = typeof pm?.nat_name === "string" ? pm.nat_name : null;
    const r = mapPesMasterPlayer(pm, { fetchedAt: now, league: await lookup(leagueByTeam, team, "team", "league"), region: await lookup(regionByNat, nat, "nationality", "region") });
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
const changed = strip(cards) !== strip(previous) || fetched.length > 0;
const summary = {
  status: "ok",
  featured: featuredIds.length,
  alreadyInWorld: featuredIds.filter((id) => worldIds.has(id)).length,
  fetched: fetched.length,
  rejected,
  provisional: cards.length,
  removedBecauseInWorld: previous.filter((r) => worldIds.has(r.world_card_id)).length,
  withMaxLevel: cards.filter((r) => r.maximum_level != null).length,
  changed,
};
console.log(JSON.stringify(summary));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `provisional cards: ${JSON.stringify(summary)}\n`);
if (!dryRun && changed) {
  writeFileSync(FILE, JSON.stringify({ schema: PROVISIONAL_SCHEMA, source: PROVISIONAL_SOURCE, updatedAt: now, cards }, null, 1) + "\n");
  console.log(`wrote ${FILE}`);
}
