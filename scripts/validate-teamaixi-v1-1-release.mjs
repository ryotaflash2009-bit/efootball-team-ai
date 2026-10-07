/**
 * TeamAIXI v1.1 Release Validator（CLI・2026-10-07）。リポジトリ・運用の状態・品質ゲート・本人の確認・公開サイトの読み取り（GET）。
 * 何も公開しない。
 *
 *   node scripts/validate-teamaixi-v1-1-release.mjs
 *   BASE_URL=https://efootball-team-ai.vercel.app node scripts/validate-teamaixi-v1-1-release.mjs
 *
 * 品質ゲート・本人の確認・運用の状態は docs/release/teamaixi-v1-1-gates.json（true/false と状態の名前だけ）。
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLive } from "./lib/teamaixi-v1-release.mjs";
import { checkRepoV1_1, checkOperations, decideV1_1, V1_1_REPO_FILES } from "./lib/teamaixi-v1-1-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p), "utf8") : undefined);
const files = Object.fromEntries(Object.entries(V1_1_REPO_FILES).map(([k, path]) => [k, read(path)]));
const g = JSON.parse(read("docs/release/teamaixi-v1-1-gates.json") ?? "{}");
const repoProblems = checkRepoV1_1(files);
const operationProblems = checkOperations(g.operations ?? {});
let liveProblems = ["live_check_not_run"];
const base = (process.env.BASE_URL ?? "").replace(/\/+$/, "");
if (/^https:\/\/[a-z0-9.-]+$/.test(base)) {
  const applied = JSON.parse(read("docs/production-readiness/reference-data-applied-state.json"));
  const fetchText = async (p) => {
    const res = await fetch(`${base}${p}`, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    return { status: res.status, headers: Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])), body: await res.text() };
  };
  liveProblems = (await checkLive(fetchText, { world: applied.datasets.world_player_cards.recordCount, managers: applied.datasets.managers.recordCount })).problems;
}
const r = decideV1_1({ repoProblems, liveProblems, operationProblems, gates: g.gates ?? {}, ownerConfirmations: g.ownerConfirmations ?? {} });
console.log(JSON.stringify(r, null, 2));
process.exit(r.verdict === "TEAMAIXI_V1_1_BLOCKED" ? 1 : 0);
