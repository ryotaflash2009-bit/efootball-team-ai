/**
 * 多言語の辞書の完全性・品質の監査（2026-10-06）。
 *
 *   node scripts/audit-locale-coverage.mjs                 監査（報告を docs/i18n/coverage.{json,md} へ書く）
 *   node scripts/audit-locale-coverage.mjs --check         監査だけ（ファイルを書かない。CI・verify 用）
 *   node scripts/audit-locale-coverage.mjs --record <code> その言語の今の翻訳の元（英語）の hash を記録する（翻訳・レビューの後）
 *
 * 元の言語は English（en.ts。ja.ts とのキーの一致は audit-i18n-keys.mjs）。言語ごとの辞書は
 * src/lib/i18n/dictionaries/locales/<code>.ts（一部のキーだけを持つ PartialDictionary）。
 *
 * 失敗（exit 1）にするもの（どの言語でも）: 元に無いキー・差し込み（{name}）の不一致・制御文字・日本語の混入・
 * 危険なリンク・秘密らしい値・HTML のタグの数の不一致・状態の記録（docs/i18n/locale-status.json）と registry の不一致・
 * 公開（PUBLISHED）の言語の公開画面の coverage が 100% 未満。
 * 報告だけのもの: 確認中の言語の coverage・英語と同じ値・元の変更による stale・長すぎる訳。
 */
import { register } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./lib/ts-extension-resolve.mjs", import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { default: en } = await import("../src/lib/i18n/dictionaries/en.ts");
const { LOCALES } = await import("../src/lib/i18n/locale-registry.ts");
const STATUS_PATH = path.join(ROOT, "docs/i18n/locale-status.json");
const status = existsSync(STATUS_PATH) ? JSON.parse(readFileSync(STATUS_PATH, "utf8")) : { locales: {} };
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");
const RECORD = args.includes("--record") ? args[args.indexOf("--record") + 1] : null;

/** 画面の面ごとの分類（coverage の計算）。 */
const CORE = new Set(["common", "pageError", "notFoundPage", "nav", "header", "language", "footer", "category"]);
const LEGAL = new Set(["about", "disclaimer", "privacy", "terms", "support"]);
/** 法務文書（本人の決定 2026-10-06: 追加の言語では専門家のレビューの無い翻訳を出さず English で表示する）。coverage の不足に数えない。 */
const LEGAL_ENGLISH_FALLBACK = new Set(["terms", "privacy", "disclaimer"]);
const SHARE = new Set(["shareCard", "diagnosisShare", "titles", "yourBest", "growthProfile", "basePercentile"]);
/** 内部・将来の機能（Production では表示しない画面）。coverage の不足を許容する。 */
const INTERNAL = new Set(["publicIdPreview", "tierPackPreview", "releaseReadiness", "rlsTest", "myTeamCloud", "localDataMigration", "localPosts", "safetyMock"]);
const isA11y = (k) => /aria|Aria|srOnly|altText|Alt$/.test(k);
const isMeta = (k) => /^(pageTitle|pageDescription|pageDescriptionMeta|metaTitle|metaDescription|metaTitleTemplate)$/.test(k);
const isState = (k) => /(error|Error|failed|Failed|empty|Empty|loading|Loading|retry|Retry|unavailable|Unavailable|notFound|NotFound|noResults|NoResults)/.test(k);

const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/g;
const JA_KANA = /[぀-ヿｦ-ﾟ]/;
const CJK_IDEO = /[一-鿿]/;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const SECRET = /(postgres(ql)?:\/\/[^ ]*:[^ ]*@|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sk_(live|test)_)/;
const UNSAFE_LINK = /(javascript:|data:text\/html|http:\/\/(?!localhost))/i;
const tags = (s) => (s.match(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi) ?? []).length;
// ICU の複数形 `{n, plural, one {…} other {…}}` は、差し込みの名前 `{n}` として数える（2026-10-08）。
const PLURAL_BLOCK = /\{([A-Za-z0-9_]+),\s*plural\s*,(?:[^{}]|\{[^{}]*\})*\}/g;
const ph = (s) => (s.replace(PLURAL_BLOCK, "{$1}").match(PLACEHOLDER) ?? []).sort().join(",");
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);

function flatten(dict) {
  const out = new Map();
  for (const [ns, keys] of Object.entries(dict ?? {})) {
    if (!keys || typeof keys !== "object") continue;
    for (const [k, v] of Object.entries(keys)) if (typeof v === "string") out.set(`${ns}.${k}`, v);
  }
  return out;
}
const SOURCE = flatten(en);

function surfaceOf(id) {
  const [ns, key] = id.split(".");
  const s = [];
  if (INTERNAL.has(ns)) return ["internal"];
  if (LEGAL_ENGLISH_FALLBACK.has(ns)) return ["legalEnglishFallback"];
  s.push("publicUi");
  if (CORE.has(ns)) s.push("core");
  if (LEGAL.has(ns)) s.push("legal");
  if (SHARE.has(ns)) s.push("shareCards");
  if (isA11y(key)) s.push("accessibility");
  if (isMeta(key)) s.push("metadata");
  if (isState(key)) s.push("errorEmptyLoading");
  return s;
}
const SURFACES = ["core", "publicUi", "accessibility", "errorEmptyLoading", "metadata", "shareCards", "legal", "legalEnglishFallback", "internal"];
const totals = Object.fromEntries(SURFACES.map((s) => [s, 0]));
for (const id of SOURCE.keys()) for (const s of surfaceOf(id)) totals[s]++;

const report = { schema: "efta-i18n-coverage/v1", source: "en", sourceKeys: SOURCE.size, sourceVersion: hash([...SOURCE.entries()].map(([k, v]) => `${k}=${v}`).join("\n")), totals, locales: {}, failures: [] };

for (const info of LOCALES) {
  const code = info.code;
  let dict = null;
  if (code === "ja" || code === "en" || info.pseudo) {
    // ja・en は audit-i18n-keys.mjs で完全一致を確認済み（100%）。疑似は英語から機械的に作る（100%）。
    report.locales[code] = { state: info.state, complete: true, note: code === "ja" ? "full dictionary (ja.ts + ja-ns)" : code === "en" ? "source" : "generated from en" };
    continue;
  }
  const file = path.join(ROOT, "src/lib/i18n/dictionaries/locales", `${code}.ts`);
  if (existsSync(file)) dict = (await import(`../src/lib/i18n/dictionaries/locales/${code}.ts`)).default;
  const values = flatten(dict);
  const hashesPath = path.join(ROOT, "src/lib/i18n/dictionaries/locales", `${code}.source.json`);
  const recorded = existsSync(hashesPath) ? JSON.parse(readFileSync(hashesPath, "utf8")) : {};
  const r = { state: info.state, file: existsSync(file), translated: 0, coverage: {}, missing: 0, extra: [], empty: [], sameAsEnglish: 0, placeholderMismatch: [], control: [], leakage: [], unsafe: [], secretLike: [], tagMismatch: [], tooLong: 0, stale: [], unrecorded: 0 };
  const done = Object.fromEntries(SURFACES.map((s) => [s, 0]));
  for (const [id, v] of values) {
    if (!SOURCE.has(id)) { r.extra.push(id); continue; }
    const src = SOURCE.get(id);
    // 元（English）が空の値（単位の接尾辞など、English では何も付けない）は、訳も空が正しい
    if (v.trim().length === 0 && src.trim().length > 0) { r.empty.push(id); continue; }
    r.translated++;
    for (const s of surfaceOf(id)) done[s]++;
    if (v === src) r.sameAsEnglish++;
    if (ph(v) !== ph(src)) r.placeholderMismatch.push(id);
    if (CONTROL.test(v)) r.control.push(id);
    const cjk = code === "zh-CN" || code === "zh-TW";
    // language.japanese は言語の名前（「日本語」）そのもの（どの言語でも日本語の表記で出す）
    if (id !== "language.japanese" && (JA_KANA.test(v) || (!cjk && CJK_IDEO.test(v)))) r.leakage.push(id);
    if (UNSAFE_LINK.test(v) && !UNSAFE_LINK.test(src)) r.unsafe.push(id);
    if (SECRET.test(v)) r.secretLike.push(id);
    if (tags(v) !== tags(src)) r.tagMismatch.push(id);
    if (v.length > 40 && v.length > src.length * 3) r.tooLong++;
    if (recorded[id] === undefined) r.unrecorded++;
    else if (recorded[id] !== hash(src)) r.stale.push(id);
  }
  r.missing = SOURCE.size - r.translated;
  for (const s of SURFACES) r.coverage[s] = totals[s] ? Number(((done[s] / totals[s]) * 100).toFixed(1)) : 100;
  r.coverage.overall = Number(((r.translated / SOURCE.size) * 100).toFixed(1));
  r.engineText = "English (display-layer engine text is localized for en only; see docs/i18n/architecture.md §6)";
  const gate = ["core", "publicUi", "accessibility", "errorEmptyLoading", "metadata", "shareCards"].every((s) => r.coverage[s] === 100);
  const st = status.locales?.[code];
  r.quality = st?.quality ?? "INCOMPLETE";
  r.productionGate = gate && ["VERIFIED_REVIEWED", "VERIFIED_NATIVE_QUALITY"].includes(r.quality) && r.stale.length === 0 ? "PASS" : "NOT_MET";
  // Release Candidate: 公開の面の coverage 100%・stale 0（品質は機械支援で可。公開にはレビューが必要）
  r.releaseCandidateGate = gate && r.stale.length === 0 && ["MACHINE_ASSISTED_COMPLETE", "VERIFIED_REVIEWED", "VERIFIED_NATIVE_QUALITY"].includes(r.quality) ? "PASS" : "NOT_MET";
  if (info.state === "RELEASE_CANDIDATE" && r.releaseCandidateGate !== "PASS") report.failures.push(`${code}: RELEASE_CANDIDATE but the release-candidate gate is not met`);
  for (const k of ["extra", "placeholderMismatch", "control", "leakage", "unsafe", "secretLike", "tagMismatch"]) {
    if (r[k].length) report.failures.push(`${code}: ${k} ${r[k].length} (${r[k].slice(0, 3).join(", ")})`);
  }
  if (info.state === "PUBLISHED" && r.productionGate !== "PASS") report.failures.push(`${code}: PUBLISHED but the production gate is not met`);
  // 状態の記録と registry の一致
  if (!st) report.failures.push(`${code}: missing in docs/i18n/locale-status.json`);
  else if (st.state !== info.state) report.failures.push(`${code}: state ${st.state} in locale-status.json != ${info.state} in locale-registry.ts`);
  if (st && (st.quality === "VERIFIED_NATIVE_QUALITY" || st.quality === "VERIFIED_REVIEWED") && !st.reviewedBy) report.failures.push(`${code}: ${st.quality} without reviewedBy`);
  if (st && st.machineAssisted && st.quality === "VERIFIED_NATIVE_QUALITY" && !st.nativeReview) report.failures.push(`${code}: machine-assisted translation marked native quality without a native review`);
  if (RECORD === code) {
    const next = {};
    for (const [id] of values) if (SOURCE.has(id)) next[id] = hash(SOURCE.get(id));
    writeFileSync(hashesPath, JSON.stringify(next, null, 1) + "\n");
    console.log(`recorded ${Object.keys(next).length} source hashes for ${code}`);
  }
  // 報告には id の一覧を最初の 20 件だけ
  for (const k of ["extra", "empty", "placeholderMismatch", "control", "leakage", "unsafe", "secretLike", "tagMismatch", "stale"]) r[k] = { count: r[k].length, sample: r[k].slice(0, 20) };
  report.locales[code] = r;
}

if (!CHECK_ONLY && !RECORD) {
  mkdirSync(path.join(ROOT, "docs/i18n"), { recursive: true });
  const { sourceVersion, ...stable } = report;
  writeFileSync(path.join(ROOT, "docs/i18n/coverage.json"), JSON.stringify({ ...stable, sourceVersion }, null, 2) + "\n");
  const rows = Object.entries(report.locales).map(([code, r]) =>
    r.complete
      ? `| ${code} | ${r.state} | 100 | 100 | 100 | 100 | 100 | 100 | 100 | — | ${r.note} |`
      : `| ${code} | ${r.state} | ${r.coverage.overall} | ${r.coverage.core} | ${r.coverage.publicUi} | ${r.coverage.accessibility} | ${r.coverage.errorEmptyLoading} | ${r.coverage.metadata} | ${r.coverage.shareCards} | ${r.quality} | production gate ${r.productionGate}; RC gate ${r.releaseCandidateGate}; stale ${r.stale.count}; same-as-en ${r.sameAsEnglish} |`,
  );
  writeFileSync(
    path.join(ROOT, "docs/i18n/coverage.md"),
    [
      "# 多言語の coverage（自動生成: `node scripts/audit-locale-coverage.mjs`）",
      "",
      `元の言語: English（${report.sourceKeys} キー・version ${report.sourceVersion}）。面ごとのキー数: ${SURFACES.map((s) => `${s} ${totals[s]}`).join("・")}。`,
      "計算ライブラリ・表示層の文章（診断・比較・スカッド・育成の説明）は、ja・en 以外の言語では English で表示する。",
      "",
      "| locale | state | overall % | core | public UI | a11y | error/empty/loading | metadata | share | quality | notes |",
      "|---|---|---|---|---|---|---|---|---|---|---|",
      ...rows,
      "",
      `失敗: ${report.failures.length === 0 ? "なし" : report.failures.join(" / ")}`,
      "",
    ].join("\n"),
  );
}
console.log(`[audit-locale-coverage] source ${report.sourceKeys} keys; ${Object.entries(report.locales).map(([c, r]) => `${c} ${r.complete ? 100 : r.coverage.overall}%`).join(", ")}`);
if (report.failures.length) {
  console.error(`[audit-locale-coverage] FAIL\n- ${report.failures.join("\n- ")}`);
  process.exit(1);
}
console.log("[audit-locale-coverage] PASS");
