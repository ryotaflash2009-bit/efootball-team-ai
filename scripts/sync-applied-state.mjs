/**
 * 適用済みの記録の自動の更新（2026-10-11）。workflow `reference-data-applied-state-sync.yml` から呼ぶ（ローカルでも同じ入力で動く）。
 *
 *   CANDIDATE_DIR=<dir>  各 Apply の run ごとの子ディレクトリに evidence.json と applied-state.candidate.json（無ければ対象外）
 *   DETECTION_DIR=<dir>  検出の要約（reference-data-detection-summary.json）を子ディレクトリごとに
 *   node scripts/sync-applied-state.mjs
 *
 * 書くのはワークスペースの中の 2 種類だけ: reference-data-applied-state.json と docs/production-readiness/evidence/<dataset>-auto-apply-<日付>-<run>.json。
 * 標準出力の最後の行に {"changed":…} を出す。秘密情報は扱わない。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAppliedStateUpdate } from "./lib/applied-state-sync.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE = path.join(ROOT, "docs", "production-readiness", "reference-data-applied-state.json");
const readJson = (p) => {
  try {
    return statSync(p).size <= 8 * 1024 * 1024 ? JSON.parse(readFileSync(p, "utf8")) : undefined;
  } catch {
    return undefined;
  }
};
const subdirs = (dir) => (dir && existsSync(dir) ? readdirSync(dir).map((n) => path.join(dir, n)).filter((p) => statSync(p).isDirectory()) : []);

const runs = subdirs(process.env.CANDIDATE_DIR ?? "").map((d) => ({ dir: d, candidate: readJson(path.join(d, "applied-state.candidate.json")), evidence: readJson(path.join(d, "evidence.json")) }));
const detections = subdirs(process.env.DETECTION_DIR ?? "").map((d) => readJson(path.join(d, "reference-data-detection-summary.json"))).filter(Boolean);
const appliedState = readJson(STATE);
const result = buildAppliedStateUpdate({ appliedState, candidates: runs.map((r) => r.candidate).filter(Boolean), detections });

if (result.changed) {
  writeFileSync(STATE, JSON.stringify(result.appliedState, null, 2) + "\n");
  for (const u of result.updates) {
    const run = runs.find((r) => String(r.candidate?.entry?.applyRunId) === u.applyRunId);
    const out = path.resolve(ROOT, u.evidencePath);
    if (!out.startsWith(path.join(ROOT, "docs", "production-readiness", "evidence") + path.sep)) throw new Error("evidence_path_outside");
    writeFileSync(out, JSON.stringify(run?.evidence ?? { note: "evidence.json was not available in the artifact" }, null, 2) + "\n");
  }
}
console.log(JSON.stringify({ changed: result.changed, updates: result.updates, skipped: result.skipped }));
