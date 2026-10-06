/**
 * ネイティブのゲーム利用者のレビュー用パッケージを作る（2026-10-06）。
 *
 *   node scripts/i18n-review-package.mjs <locale>      例: es / pt-BR
 *
 * 出力: docs/i18n/review/<locale>/review.csv（表計算ソフトで開く）・README.md（手順と用語の確認点）。
 * 列: key, feature, surface, source_en, draft, suggested_alternative, max_length, severity, decision, reviewer_comment, reviewed_date
 *   - decision は Accept / Edit / Reject のどれかを記入。レビュー担当の氏名は書かない（公開しない）。
 *   - Secret・内部 URL・利用者のデータは含めない（辞書の文言だけ）。内部ページ・法務文書（English のまま）は含めない。
 * 計算ライブラリの文（generated）と、ゲームの用語（game-terms）も含める。
 */
import { register } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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

const CORE = new Set(["common", "pageError", "notFoundPage", "nav", "header", "language", "footer", "category"]);
const SHARE = new Set(["shareCard", "diagnosisShare", "titles", "yourBest", "growthProfile", "basePercentile"]);
const SKIP = new Set(["publicIdPreview", "tierPackPreview", "releaseReadiness", "rlsTest", "myTeamCloud", "localDataMigration", "localPosts", "safetyMock", "terms", "privacy", "disclaimer"]);
const isShort = (k, v) => /(Label|Button|Tab|Title|Heading|Badge|Chip|aria|Aria|Placeholder)$/.test(k) || v.length <= 24;

function severity(ns, k) {
  if (CORE.has(ns) || /error|Error|failed|Failed|confirm|Confirm|delete|Delete|warning|Warning/.test(k)) return "high";
  if (SHARE.has(ns) || ns === "support" || ns === "auth" || /aria|Aria/.test(k)) return "high";
  return "medium";
}
function surface(ns, k) {
  if (CORE.has(ns)) return "core";
  if (SHARE.has(ns)) return "share";
  if (/aria|Aria|Alt$/.test(k)) return "accessibility";
  if (/^(pageTitle|pageDescription|pageDescriptionMeta)$/.test(k)) return "metadata";
  return "ui";
}
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const rows = [["key", "feature", "surface", "source_en", "draft", "suggested_alternative", "max_length", "severity", "decision", "reviewer_comment", "reviewed_date"]];
for (const [ns, keys] of Object.entries(en)) {
  if (SKIP.has(ns)) continue;
  for (const [k, v] of Object.entries(keys)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const d = tr[ns]?.[k] ?? "";
    rows.push([`${ns}.${k}`, ns, surface(ns, k), v, d, "", isShort(k, v) ? Math.max(12, Math.ceil(v.length * 1.3)) : "", severity(ns, k), "", "", ""]);
  }
}
let genCount = 0;
if (generated) {
  for (const [mod, cat] of Object.entries(generated)) {
    for (const [ja, t] of Object.entries(cat.fixed ?? {})) {
      rows.push([`generated.${mod}.fixed`, `generated:${mod}`, "generated", `(source: ${ja})`, t, "", "", "high", "", "", ""]);
      genCount++;
    }
    for (const [id, t] of Object.entries(cat.patterns ?? {})) {
      rows.push([`generated.${id}`, `generated:${mod}`, "generated", "(template; tokens {N} etc. must stay)", t, "", "", "high", "", "", ""]);
      genCount++;
    }
  }
}
const out = path.join(ROOT, "docs/i18n/review", locale);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "review.csv"), "﻿" + rows.map((r) => r.map(csv).join(",")).join("\r\n") + "\r\n");
writeFileSync(
  path.join(out, "README.md"),
  `# ${locale} — ネイティブのレビュー用パッケージ（Native review package）

生成: \`node scripts/i18n-review-package.mjs ${locale}\`（辞書から自動生成。手で編集しない）。行数: ${rows.length - 1}（うち計算ライブラリの文 ${genCount}）。

## レビューの手順（for the reviewer）

1. \`review.csv\` を表計算ソフトで開く（UTF-8）。
2. \`severity = high\`（核の UI・エラー・アクセシビリティ・共有カード・サポート・ログイン・計算ライブラリの文）から確認する。
3. 各行の \`decision\` に **Accept**（そのまま）/ **Edit**（\`suggested_alternative\` に案）/ **Reject**（理由を \`reviewer_comment\`）を記入。
4. \`max_length\` がある行は、ボタン・タブ・見出しなどの短い表示。それを超えないこと。
5. \`{name}\`・\`{count}\`・\`{1}\`・\`{cat:1}\` などの差し込みは変えない（順序は自然な語順に変えてよい）。
6. 選手名・監督名・カード種別・プレースタイル名・スキル名・TeamAIXI・eFootball™・KONAMI・World・OVR・Link-Up Play は訳さない。
7. 終わったら \`reviewed_date\`（YYYY-MM-DD）を記入して返す。レビュー担当の氏名は書かない。

## 特に確認してほしい用語（game terms）

ゲーム内の ${locale} の公式の表記と照合していない。照合できた語は用語集（\`docs/i18n/terminology-glossary.md\`）を \`approved\` にする。

- 26 の能力名・10 の育成カテゴリ・6 の戦術名（\`src/lib/i18n/game-terms.ts\`）
- 能力 = atributo(s)、スキル = habilidad(es) / habilidade(s)、辛口の評価 = directo / direto、スカッド = plantilla / elenco、枠 = puesto / vaga
- Power of Many・Game Plan・Team Power・Coaching Affinity・Center Piece・Key Man（English のまま残した。ゲーム内の訳があれば合わせる）
- ブースター名（Ball-carrying・Attacking Hub 等）・「rank」の訳・セットプレーの役割

## 含めないもの

内部ページ（公開しない機能）・法務文書（利用規約・プライバシー・免責事項。English で表示し、専門家のレビューの無い訳は出さない）。
`,
);
console.log(`review package: docs/i18n/review/${locale}/review.csv (${rows.length - 1} rows, generated ${genCount})`);
