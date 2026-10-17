/**
 * すべてのブラックボックスを 1 本ずつ順番に実行し、結果を 1 つの一覧（docs/black-box-tests/README.md）にまとめる（2026-10-17）。
 *
 *   node scripts/black-box-all.mjs                 （すべて・事前に npm run build・node scripts/local-server.mjs start）
 *   node scripts/black-box-all.mjs squads new-cards （名前の一部で絞る。実行しなかった行は前回の結果のまま残す）
 *
 * - 同時に 1 本だけ（ブラウザーを 1 つずつ・メモリに優しい）。
 * - 社内向けページが必要な rail は、ビルドで社内向けページが無効（/release-readiness が 404）なら「対象外」と記録する
 *   （失敗ではない。確かめるには NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled でビルドして実行する）。
 * - 結果の元: docs/black-box-tests/summary-all.json（行ごとに最後に実行した時刻・結果）。README.md はここから作る。
 */
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "black-box-tests");
const STORE = path.join(OUT_DIR, "summary-all.json");
const README = path.join(OUT_DIR, "README.md");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TIMEOUT_MS = 20 * 60 * 1000;

/** 社内向けページ（NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled のビルド）が必要な rail。 */
export const NEEDS_INTERNAL_PAGES = new Set(["public-preparation", "final-alpha-readiness-copy", "local-posts", "rls-test", "support-contact"]);
/** 一覧に入れないスクリプト（この一括実行そのもの）。 */
const EXCLUDE = new Set(["all"]);

export function railNameOf(file) {
  return file.replace(/^black-box-/, "").replace(/\.mjs$/, "");
}

/** 出力の最後の「n/m PASS」「PASS (a/b rails)」などから件数を読む。 */
export function parseSummary(stdout) {
  const lines = String(stdout ?? "").split(/\r?\n/).filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = /(\d+)\/(\d+)\s+(?:PASS|rails)/.exec(lines[i]) ?? /\((\d+)\/(\d+) rails\)/.exec(lines[i]);
    if (m) return { passed: Number(m[1]), total: Number(m[2]), line: lines[i].trim().slice(0, 200) };
  }
  return { passed: null, total: null, line: lines.at(-1)?.trim().slice(0, 200) ?? "" };
}

/** 失敗した項目の行（「FAIL  …」）を最大 5 件。 */
export function failLines(stdout) {
  return String(stdout ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^FAIL\s/.test(l))
    .slice(0, 5)
    .map((l) => l.slice(0, 200));
}

export function renderReadme(store) {
  const rows = Object.values(store.rails).sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  const count = (s) => rows.filter((r) => r.status === s).length;
  const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
  const L = [
    "# ブラックボックス 一覧",
    "",
    "`node scripts/black-box-all.mjs` が作る一覧です（手で編集しない）。各行の「報告」が詳しい結果です。",
    "",
    `- 合格 **${count("pass")}** ・ 失敗 **${count("fail")}** ・ 対象外 **${count("skip")}** ・ 全 ${rows.length} 本`,
    `- 対象外 = 社内向けページが必要な rail を、社内向けページが無効のビルドで実行した（失敗ではない。\`NEXT_PUBLIC_EFTA_INTERNAL_PAGES=enabled\` でビルドすると実行できる）`,
    "",
    "| 結果 | rail | 件数 | 秒 | 最後に実行 | 報告 |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => {
      const mark = r.status === "pass" ? "✅ 合格" : r.status === "fail" ? "❌ 失敗" : "⏭ 対象外";
      const n = r.total != null ? `${r.passed}/${r.total}` : "—";
      const report = r.report ? `[${r.report}](./${r.report})` : "—";
      return `| ${mark} | ${esc(r.name)}${NEEDS_INTERNAL_PAGES.has(r.name) ? "（社内向けページ）" : ""} | ${n} | ${r.seconds ?? "—"} | ${esc((r.ranAt ?? "").replace("T", " ").slice(0, 16))} | ${report} |`;
    }),
    "",
  ];
  const failed = rows.filter((r) => r.status === "fail");
  if (failed.length) {
    L.push("## 失敗の内容", "");
    for (const r of failed) {
      L.push(`### ${r.name}`, "");
      for (const f of r.fails?.length ? r.fails : [r.line || "（出力なし）"]) L.push(`- ${esc(f)}`);
      L.push("");
    }
  }
  return L.join("\n");
}

function order(r) {
  return r.status === "fail" ? 0 : r.status === "skip" ? 2 : 1;
}

async function reportFileOf(name) {
  for (const f of [`${name}.md`]) {
    try {
      await fs.access(path.join(OUT_DIR, f));
      return f;
    } catch {
      /* 無い */
    }
  }
  return null;
}

async function main() {
  const filters = process.argv.slice(2);
  const files = (await fs.readdir(path.join(ROOT, "scripts")))
    .filter((f) => /^black-box-.+\.mjs$/.test(f))
    .filter((f) => !EXCLUDE.has(railNameOf(f)))
    .filter((f) => filters.length === 0 || filters.some((x) => railNameOf(f).includes(x)))
    .sort();
  let store = { rails: {} };
  try {
    store = JSON.parse(await fs.readFile(STORE, "utf8"));
  } catch {
    /* 初回 */
  }
  let internal = null;
  try {
    internal = (await fetch(`${BASE}/release-readiness`, { redirect: "manual" })).status === 200;
  } catch {
    console.error(`[black-box-all] ${BASE} に接続できません（node scripts/local-server.mjs start）`);
    process.exit(2);
  }
  console.log(`[black-box-all] ${files.length} 本・社内向けページ: ${internal ? "有効" : "無効"}`);
  for (const f of files) {
    const name = railNameOf(f);
    const ranAt = new Date().toISOString();
    if (NEEDS_INTERNAL_PAGES.has(name) && !internal) {
      store.rails[name] = { name, status: "skip", passed: null, total: null, seconds: 0, ranAt, line: "社内向けページが無効のビルド", fails: [], report: await reportFileOf(name) };
      console.log(`SKIP  ${name}（社内向けページが無効）`);
      continue;
    }
    const started = Date.now();
    const p = spawnSync(process.execPath, [path.join(ROOT, "scripts", f)], { cwd: ROOT, env: { ...process.env, BASE_URL: BASE }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: TIMEOUT_MS });
    const seconds = Math.round((Date.now() - started) / 1000);
    const out = `${p.stdout ?? ""}\n${p.stderr ?? ""}`;
    const s = parseSummary(p.stdout);
    const status = p.status === 0 ? "pass" : "fail";
    const fails = status === "fail" ? (failLines(p.stdout).length ? failLines(p.stdout) : [p.error ? `起動できません: ${p.error.message}` : s.line || out.trim().split(/\r?\n/).at(-1) || "（出力なし）"]) : [];
    store.rails[name] = { name, status, passed: s.passed, total: s.total, seconds, ranAt, line: s.line, fails, report: await reportFileOf(name) };
    console.log(`${status === "pass" ? "PASS" : "FAIL"}  ${name}  ${s.passed ?? "?"}/${s.total ?? "?"}  (${seconds} s)`);
  }
  store.updatedAt = new Date().toISOString();
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(STORE, JSON.stringify(store, null, 2) + "\n", "utf8");
  await fs.writeFile(README, renderReadme(store) + "\n", "utf8");
  const ran = files.map((f) => store.rails[railNameOf(f)]);
  const failed = ran.filter((r) => r.status === "fail").length;
  console.log(`\n[black-box-all] 合格 ${ran.filter((r) => r.status === "pass").length}・失敗 ${failed}・対象外 ${ran.filter((r) => r.status === "skip").length}（一覧: docs/black-box-tests/README.md）`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
