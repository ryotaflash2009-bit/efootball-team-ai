/**
 * Link-Up Play・OVR の契約の監査（scripts/lib/fixed-terms.mjs）。辞書・生成文の表・ゲームの用語のすべての言語を確認する。
 *   node scripts/audit-fixed-terms.mjs          … 違反を表示（違反があれば終了コード 1）
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
register("./lib/ts-extension-resolve.mjs", import.meta.url);
const { checkFixedTerms } = await import("./lib/fixed-terms.mjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["es", "pt-BR", "fr", "de", "it", "ko", "zh-CN", "zh-TW", "id", "tr"];
const LEGAL = new Set(["terms", "privacy", "disclaimer"]);
const { default: en } = await import(pathToFileURL(path.join(ROOT, "src/lib/i18n/dictionaries/en.ts")).href);
const generatedSource = JSON.parse(readFileSync(path.join(ROOT, "data/work/generated-to-translate.json"), "utf8").replace(/^﻿/, "") || "{}");

export async function auditFixedTerms() {
  const violations = [];
  let checked = 0;
  for (const locale of LOCALES) {
    const { default: dict } = await import(pathToFileURL(path.join(ROOT, `src/lib/i18n/dictionaries/locales/${locale}.ts`)).href);
    for (const [ns, keys] of Object.entries(en)) {
      if (LEGAL.has(ns)) continue;
      for (const [k, v] of Object.entries(keys)) {
        const t = dict[ns]?.[k];
        if (typeof t !== "string") continue;
        checked++;
        for (const p of checkFixedTerms(v, t)) violations.push(`${locale} ${ns}.${k}: ${p} — ${t.slice(0, 90)}`);
      }
    }
    // generated catalog (fixed sentences and pattern templates)
    const { default: cat } = await import(pathToFileURL(path.join(ROOT, `src/lib/i18n/dictionaries/locales/${locale}/generated.ts`)).href);
    for (const [mod, src] of Object.entries(generatedSource)) {
      const c = cat[mod];
      if (!c) continue;
      for (const f of src.fixed ?? []) {
        const t = c.fixed?.[f.ja];
        if (typeof t !== "string") continue;
        checked++;
        for (const p of checkFixedTerms(f.en, t)) violations.push(`${locale} generated ${mod}.fixed[${f.i}]: ${p} — ${t.slice(0, 90)}`);
      }
      for (const pt of src.patterns ?? []) {
        const t = c.patterns?.[pt.id];
        if (typeof t !== "string") continue;
        checked++;
        for (const p of checkFixedTerms(pt.en, t)) violations.push(`${locale} generated ${mod}.patterns[${pt.id}]: ${p} — ${t.slice(0, 90)}`);
      }
    }
  }
  return { checked, violations };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { checked, violations } = await auditFixedTerms();
  console.log(`[audit-fixed-terms] ${checked} strings checked, ${violations.length} violations`);
  for (const v of violations.slice(0, 200)) console.log("  " + v);
  process.exit(violations.length ? 1 : 0);
}
