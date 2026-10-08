/**
 * Indexing Release Validator（CLI・2026-10-09）。公開サイトの読み取り（GET だけ・1 本ずつ）とリポジトリの確認。何も変えない。
 *
 *   BASE_URL=https://efootball-team-ai.vercel.app node scripts/validate-search-indexing.mjs
 *   BASE_URL=http://localhost:3000 ORIGIN=https://efootball-team-ai.vercel.app node scripts/validate-search-indexing.mjs   （手元の確認）
 *
 * ORIGIN は canonical・sitemap に出るはずの正式な URL（既定は BASE_URL）。
 * 判定: SEARCH_INDEXING_ENABLED / SEARCH_INDEXING_READY / SEARCH_INDEXING_BLOCKED（scripts/lib/search-indexing-release.mjs）。
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkIndexingLive, checkIndexingRepo, decideIndexing } from "./lib/search-indexing-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p), "utf8") : undefined);
const base = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
if (!/^(https:\/\/[a-z0-9.-]+|http:\/\/localhost:\d+)$/.test(base)) {
  console.error("BASE_URL を https://… または http://localhost:PORT で指定してください");
  process.exit(2);
}
const origin = (process.env.ORIGIN ?? base).replace(/\/+$/, "");
const guides = read("src/content/player-guides.json");
const draftGuideSlugs = (JSON.parse(guides ?? '{"guides":[]}').guides ?? []).filter((g) => !g.published).map((g) => g.slug);

let requests = 0;
const fetchText = async (p) => {
  requests++;
  const res = await fetch(`${base}${p}`, { redirect: "manual", signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "TeamAIXI-indexing-validator/1.0" } });
  return { status: res.status, headers: Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])), body: await res.text() };
};

const live = await checkIndexingLive(fetchText, { origin, draftGuideSlugs, sampleDetailCount: Number(process.env.SAMPLE_DETAILS ?? 3) });
let analytics = null;
if (base.startsWith("https://")) {
  const a = await fetchText("/_vercel/insights/script.js");
  analytics = a.status === 200;
}
const repoProblems = checkIndexingRepo({
  searchConsolePackage: read("docs/production-readiness/search-console-package.md"),
  indexingDoc: read("docs/production-readiness/seo-indexing.md"),
  guides,
});
const r = decideIndexing({ live, repoProblems, analytics });
console.log(JSON.stringify({ ...r, base, origin, analytics, requests, checkedAt: new Date().toISOString() }, null, 2));
process.exit(r.verdict === "SEARCH_INDEXING_BLOCKED" ? 1 : 0);
