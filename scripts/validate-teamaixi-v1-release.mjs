/**
 * TeamAIXI v1.0 Release Validator（CLI）。リポジトリの確認と、公開サイトの読み取りだけの確認（GET）。何も公開しない。
 *
 *   node scripts/validate-teamaixi-v1-release.mjs                       （リポジトリだけ）
 *   BASE_URL=https://efootball-team-ai.vercel.app node scripts/validate-teamaixi-v1-release.mjs
 *
 * 品質ゲートの結果と本人の確認は docs/release/teamaixi-v1-gates.json（true/false だけ）。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRepo, checkLive, decideRelease } from "./lib/teamaixi-v1-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p), "utf8") : undefined);
const files = {
  layout: read("src/app/layout.tsx"),
  // 日本語の辞書は核（ja.ts）と分割した名前空間（ja-ns/*.ts）。すべてを合わせて確認する。
  dict_ja: [read("src/lib/i18n/dictionaries/ja.ts"), ...readdirSync(path.join(ROOT, "src/lib/i18n/dictionaries/ja-ns")).map((f) => read(`src/lib/i18n/dictionaries/ja-ns/${f}`))].join("\n"),
  dict_en: read("src/lib/i18n/dictionaries/en.ts"),
  accountAvailability: read("src/lib/supabase/account-availability.ts"),
  sidebar: read("src/components/Sidebar.tsx"),
  internalPages: read("src/lib/public-info/internal-pages.ts"),
  packageJson: read("package.json"),
  changelog: read("CHANGELOG.md"),
  releaseNotes: read("RELEASE_NOTES.md"),
  releaseDoc: read("docs/release/teamaixi-v1.md"),
  legalChecklist: read("docs/release/legal-review-checklist.md"),
};
const repoProblems = checkRepo(files);
let liveProblems = ["live_check_not_run"];
let counts = null;
const base = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
if (/^https:\/\/[a-z0-9.-]+$/.test(base)) {
  const applied = JSON.parse(read("docs/production-readiness/reference-data-applied-state.json"));
  const fetchText = async (p) => {
    const res = await fetch(`${base}${p}`, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    return { status: res.status, headers: Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])), body: await res.text() };
  };
  const live = await checkLive(fetchText, { world: applied.datasets.world_player_cards.recordCount, managers: applied.datasets.managers.recordCount });
  liveProblems = live.problems;
  counts = live.counts;
}
const gatesFile = read("docs/release/teamaixi-v1-gates.json");
const g = gatesFile ? JSON.parse(gatesFile) : {};
const r = decideRelease({ repoProblems, liveProblems, gates: g.gates ?? {}, ownerConfirmations: g.ownerConfirmations ?? {} });
console.log(JSON.stringify({ ...r, counts }, null, 2));
process.exit(r.verdict === "TEAMAIXI_V1_RELEASE_BLOCKED" ? 1 : 0);
