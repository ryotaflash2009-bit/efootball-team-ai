/**
 * ネイティブのゲーム利用者のレビュー用パッケージを作る（2026-10-06・v2 2026-10-07）。
 *
 *   node scripts/i18n-review-package.mjs <locale>      例: es / pt-BR / zh-TW
 *
 * 出力: docs/i18n/review/<locale>/
 *   - review.csv       … 1 行 1 文言。表計算ソフトで開く（UTF-8・BOM 付き）。
 *   - terminology.csv  … 核の用語（能力名・育成グループ・戦術・機能名・固有の用語の契約）。先にこれを確認する。
 *   - README.md        … 手順・優先度・用語の確認点。
 * review.csv の列:
 *   priority (P0/P1/P2), key, feature, screen, screenshot_reference, surface, source_en, draft, suggested_alternative,
 *   max_length, decision (Accept/Edit/Reject), reviewer_comment, reviewed_date, source_version, terminology_version
 * - P0: 誤訳で操作を誤るもの（保存・削除・復元・Import・Export・エラー・警告・プライバシー・サポート・ログイン）。
 *   P1: 診断・改善・弱点・育成・能力・戦術・共有カード・計算ライブラリの文。P2: 説明・装飾・任意の Tooltip。
 * - レビュー担当の氏名は書かない（公開しない）。Secret・内部 URL・利用者のデータは含めない（辞書の文言だけ）。
 *   内部ページ・法務文書（English のまま）は含めない。
 */
import { register } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("./lib/ts-extension-resolve.mjs", import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const locale = process.argv[2];
if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale ?? "")) throw new Error("usage: node scripts/i18n-review-package.mjs <locale>");

const { default: en } = await import("../src/lib/i18n/dictionaries/en.ts");
const { default: tr } = await import(`../src/lib/i18n/dictionaries/locales/${locale}.ts`);
let generated = null;
try {
  generated = (await import(`../src/lib/i18n/dictionaries/locales/${locale}/generated.ts`)).default;
} catch {
  generated = null;
}
const gameTerms = await import("../src/lib/i18n/game-terms.ts");
await import(`../src/lib/i18n/dictionaries/locales/${locale}/game-terms.ts`).catch(() => undefined);
const status = JSON.parse(readFileSync(path.join(ROOT, "docs/i18n/locale-status.json"), "utf8"));
const SOURCE_VERSION = status.locales?.[locale]?.sourceLocaleVersion ?? "unknown";
const TERMINOLOGY_VERSION = status.terminologyVersion ?? "unknown";

const CORE = new Set(["common", "pageError", "notFoundPage", "nav", "header", "language", "footer", "category"]);
const SHARE = new Set(["shareCard", "diagnosisShare", "titles", "yourBest", "growthProfile", "basePercentile"]);
const SKIP = new Set(["publicIdPreview", "tierPackPreview", "releaseReadiness", "rlsTest", "myTeamCloud", "localDataMigration", "localPosts", "safetyMock", "terms", "privacy", "disclaimer"]);
const P0_NS = new Set(["support", "auth", "dataManagement", "localBackup", "buildImportModal", "buildExportModal", "pageError", "notFoundPage", "localStorageNotice"]);
const P0_KEY = /error|Error|fail|Fail|delete|Delete|remove|Remove|reset|Reset|restore|Restore|import|Import|export|Export|backup|Backup|overwrite|Overwrite|discard|Discard|confirm|Confirm|warning|Warning|privacy|Privacy|unsaved|Unsaved|lost|Lost|cannot|Cannot/;
const P1_NS = /diagnos|Diagnos|progression|Progression|abilityEditor|buildAnalysis|tactical|manager|Manager|compare|Compare|bestXi|titles|yourBest|growthProfile|basePercentile|squad|Squad|teamSummary|linkUp|bench/;

// 名前空間 → 画面（レビュー担当が内部の確認用の build で開く場所）
const SCREEN = [
  [/^(nav|header|footer|language|common|category)$/, "all pages (navigation, header, footer)"],
  [/^homePage$/, "/"],
  [/^(playersPage|worldFilters|worldPagination|worldPlayerCard|worldPlayerSearchCard|playerSearchPanel|searchInput)$/, "/players"],
  [/^(playerDetailPage|worldPlayerHero|basePercentile|radarAxis|radarMode|legacyPlayerDetail)$/, "/players/world/[id]"],
  [/^(progressionTab|abilityEditor|bench)$/, "/players/world/[id]?tab=progression"],
  [/^(compare|comparison|playerControlColumn|radar)/i, "/compare"],
  [/^(squadList|squadTemplatesBoard)$/, "/squads"],
  [/^(squadEditor|squadPitch|slotPlayerPanel|squadBuildPanel|formationSelect|linkUp|teamSummary|tactical|diagnosis|diagnosisPerspectives|titles|yourBest|growthProfile|shareCard)$/, "/squads/[id] (editor, diagnosis, share image)"],
  [/^squadCompareBoard$/, "/squads/compare"],
  [/^(managersPage|managerCard|managerPicker|managerControls|manager)$/, "/managers"],
  [/^managerDetail$/, "/managers/[id]"],
  [/^(myBuildsView|myBuildCard|buildUsage|tagEditor|duplicateReview)/, "/my-builds"],
  [/^(buildInventoryView|buildAnalysis|buildImportModal|buildExportModal|duplicateReviewTeaser)$/, "/build-inventory"],
  [/^(myTeam|myTeamButton|myTeamAddDialog|myTeamBuildPanel|userCardTile|userCardFilters)$/, "/my-team"],
  [/^(favoritesView|favoriteButton)$/, "/favorites"],
  [/^diagnosisHistory$/, "/diagnosis-history"],
  [/^diagnosisCompare$/, "/diagnosis-history (before / after)"],
  [/^diagnosisShare$/, "/share/diagnosis"],
  [/^(dataManagement|localBackup|localStorageNotice)$/, "/data-management"],
  [/^support$/, "/support"],
  [/^about$/, "/about"],
  [/^bestXi$/, "/best-xi"],
  [/^auth$/, "/auth/sign-in"],
  [/^(pageError|notFoundPage)$/, "error and 404 pages"],
];
const screenOf = (ns) => SCREEN.find(([re]) => re.test(ns))?.[1] ?? "(various)";
const screenshotRef = (screen) => (screen.startsWith("/") ? `internal build: open ${screen.split(" ")[0]} at 390x844 and 1280x720` : "internal build: any page");

const isShort = (k, v) => /(Label|Button|Tab|Title|Heading|Badge|Chip|aria|Aria|Placeholder)$/.test(k) || v.length <= 24;
function priority(ns, k) {
  if (P0_NS.has(ns) || P0_KEY.test(k)) return "P0";
  if (CORE.has(ns) || SHARE.has(ns) || P1_NS.test(ns) || /aria|Aria/.test(k)) return "P1";
  return "P2";
}
function surface(ns, k) {
  if (CORE.has(ns)) return "core";
  if (SHARE.has(ns)) return "share";
  if (/aria|Aria|Alt$/.test(k)) return "accessibility";
  if (/^(pageTitle|pageDescription|pageDescriptionMeta)$/.test(k)) return "metadata";
  return "ui";
}
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const HEAD = ["priority", "key", "feature", "screen", "screenshot_reference", "surface", "source_en", "draft", "suggested_alternative", "max_length", "decision", "reviewer_comment", "reviewed_date", "source_version", "terminology_version"];
const rows = [];
for (const [ns, keys] of Object.entries(en)) {
  if (SKIP.has(ns)) continue;
  const screen = screenOf(ns);
  for (const [k, v] of Object.entries(keys)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const d = tr[ns]?.[k] ?? "";
    rows.push([priority(ns, k), `${ns}.${k}`, ns, screen, screenshotRef(screen), surface(ns, k), v, d, "", isShort(k, v) ? Math.max(12, Math.ceil(v.length * 1.3)) : "", "", "", "", SOURCE_VERSION, TERMINOLOGY_VERSION]);
  }
}
let genCount = 0;
if (generated) {
  for (const [mod, cat] of Object.entries(generated)) {
    for (const [ja, t] of Object.entries(cat.fixed ?? {})) {
      rows.push(["P1", `generated.${mod}.fixed`, `generated:${mod}`, "diagnosis / comparison / progression text", "internal build: squad diagnosis, compare, progression", "generated", `(source: ${ja})`, t, "", "", "", "", "", SOURCE_VERSION, TERMINOLOGY_VERSION]);
      genCount++;
    }
    for (const [id, t] of Object.entries(cat.patterns ?? {})) {
      rows.push(["P1", `generated.${id}`, `generated:${mod}`, "diagnosis / comparison / progression text", "internal build: squad diagnosis, compare, progression", "generated", "(template; tokens {N} etc. must stay)", t, "", "", "", "", "", SOURCE_VERSION, TERMINOLOGY_VERSION]);
      genCount++;
    }
  }
}
const order = { P0: 0, P1: 1, P2: 2 };
rows.sort((a, b) => order[a[0]] - order[b[0]]);
const counts = rows.reduce((m, r) => ((m[r[0]] = (m[r[0]] ?? 0) + 1), m), {});

// terminology.csv
const TERM_HEAD = ["category", "key", "source_en", "draft", "decision", "suggested_alternative", "official_in_game_term", "source_of_official_term", "reviewer_comment", "reviewed_date"];
const termRows = [];
const enTerms = { abilities: {}, groups: {}, tactics: {} };
for (const line of readFileSync(path.join(ROOT, "src/lib/world/stats.ts"), "utf8").matchAll(/key:\s*"(\w+)"[^}]*?nameEn:\s*"([^"]+)"/g)) enTerms.abilities[line[1]] = line[2];
const termApi = gameTerms;
const ABILITY_KEYS = Object.keys(enTerms.abilities).length ? Object.keys(enTerms.abilities) : [];
for (const k of ABILITY_KEYS) termRows.push(["ability", k, enTerms.abilities[k], termApi.localizedAbilityName(k, locale) ?? "", "", "", "", "", "", ""]);
const GROUPS = { shooting: "Shooting", passing: "Passing", dribbling: "Dribbling", dexterity: "Dexterity", lowerBodyStrength: "Lower Body Strength", aerialStrength: "Aerial Strength", defending: "Defending", goalkeeping1: "GK 1", goalkeeping2: "GK 2", goalkeeping3: "GK 3" };
for (const [k, v] of Object.entries(GROUPS)) termRows.push(["progression group", k, v, termApi.localizedGroupName(k, locale) ?? "", "", "", "", "", "", ""]);
const TACTICS = { possessionGame: "Possession Game", quickCounter: "Quick Counter", longBallCounter: "Long Ball Counter", outWide: "Out Wide", longBall: "Long Ball", overload: "Overload" };
for (const [k, v] of Object.entries(TACTICS)) termRows.push(["tactic", k, v, termApi.localizedTacticName(k, locale) ?? "", "", "", "", "", "", ""]);
for (const [k, v] of Object.entries(en.nav)) if (typeof v === "string" && !/^group|aria/i.test(k)) termRows.push(["feature name (navigation)", `nav.${k}`, v, tr.nav?.[k] ?? "", "", "", "", "", "", ""]);
termRows.push(["fixed term (contract)", "Link-Up Play", "Link-Up Play", "Link-Up Play (kept by contract)", "", "", "", "", "Keep unless the data source confirms an official local term (docs/i18n/translation-management.md §5)", ""]);
termRows.push(["fixed term (contract)", "OVR", "OVR", "OVR (kept by contract)", "", "", "", "", "Keep unless the data source confirms an official local term", ""]);

const out = path.join(ROOT, "docs/i18n/review", locale);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "review.csv"), "﻿" + [HEAD, ...rows].map((r) => r.map(csv).join(",")).join("\r\n") + "\r\n");
writeFileSync(path.join(out, "terminology.csv"), "﻿" + [TERM_HEAD, ...termRows].map((r) => r.map(csv).join(",")).join("\r\n") + "\r\n");
writeFileSync(
  path.join(out, "README.md"),
  `# ${locale} — ネイティブのレビュー用パッケージ（Native review package）

生成: \`node scripts/i18n-review-package.mjs ${locale}\`（辞書から自動生成。手で編集しない）。
文言 ${rows.length} 行（P0 ${counts.P0 ?? 0}・P1 ${counts.P1 ?? 0}・P2 ${counts.P2 ?? 0}。うち計算ライブラリの文 ${genCount}）・用語 ${termRows.length} 行。
元の版: \`${SOURCE_VERSION}\`・用語集の版: \`${TERMINOLOGY_VERSION}\`。状態: RELEASE_CANDIDATE（AI 翻訳・ネイティブのレビュー前・本番の言語の選択には出していない）。

## 手順（for the reviewer）

1. **terminology.csv を先に**確認する（能力名・育成グループ・戦術・機能名）。ここが決まると本文の多くが決まる。
   ゲーム内の公式の表記が分かる場合は \`official_in_game_term\` と、その確認元（画面・日付）を \`source_of_official_term\` に書く。
2. **review.csv を priority の順に**（P0 → P1 → P2）。
   - **P0**: 誤訳で操作を誤るもの（保存・削除・復元・Import・Export・エラー・警告・プライバシー・サポート・ログイン）。必ず全件。
   - **P1**: 診断・改善・弱点・育成・能力・戦術・共有カード・計算ライブラリの文。
   - **P2**: 説明・装飾・任意の Tooltip。時間があれば。
3. 各行の \`decision\` に **Accept**（そのまま）/ **Edit**（\`suggested_alternative\` に案）/ **Reject**（理由を \`reviewer_comment\`）。
4. \`max_length\` がある行は、ボタン・タブ・見出しなどの短い表示。それを超えないこと。
5. \`screen\`・\`screenshot_reference\` は、その文言が出る画面（内部の確認用の build で開く）。
6. \`{name}\`・\`{count}\`・\`{1}\`・\`{cat:1}\` などの差し込みは変えない（順序は自然な語順に変えてよい）。
7. 選手名・監督名・カード種別・プレースタイル名・スキル名・TeamAIXI・eFootball™・KONAMI・World は訳さない。
   **Link-Up Play・OVR は契約で原語のまま**（データ元で正式な現地語の表記を確認できた場合だけ変える。短い補足は原語と並べて Tooltip・初回の説明だけ）。
8. 終わったら \`reviewed_date\`（YYYY-MM-DD）を記入して返す。レビュー担当の氏名は書かない。

## 含めないもの

内部ページ（公開しない機能）・法務文書（利用規約・プライバシー・免責事項。English で表示し、専門家のレビューの無い訳は出さない）・
Secret・内部 URL・利用者のデータ。

## レビューの後（運営者）

1. Edit の行を辞書（\`src/lib/i18n/dictionaries/locales/${locale}/\`）へ反映し、\`node scripts/audit-locale-coverage.mjs --record ${locale}\`。
2. \`docs/i18n/locale-status.json\` の \`quality\` を \`VERIFIED_REVIEWED\`・\`reviewedBy\` を記録（氏名ではなく役割・依頼の記録）。
3. 公開（\`PUBLISHED\`）は本人の判断。
`,
);
console.log(`review package: docs/i18n/review/${locale}/ (${rows.length} rows: P0 ${counts.P0 ?? 0}, P1 ${counts.P1 ?? 0}, P2 ${counts.P2 ?? 0}; generated ${genCount}; terms ${termRows.length})`);
