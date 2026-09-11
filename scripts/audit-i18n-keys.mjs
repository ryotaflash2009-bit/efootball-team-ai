/**
 * 翻訳キー監査（読み取り専用・外部アクセスなし）。
 *
 * ja/en 両辞書（src/lib/i18n/dictionaries/*.ts）のキー構造が完全に一致すること、
 * 値が空文字列でないことを検証する。SQLite・localStorage へは一切アクセスしない。
 *
 *   node scripts/audit-i18n-keys.mjs
 *
 * 終了コード: 0 = 問題なし / 1 = キー不一致・空値あり
 */
import ja from "../src/lib/i18n/dictionaries/ja.ts";
import en from "../src/lib/i18n/dictionaries/en.ts";

let ok = true;
const namespaces = new Set([...Object.keys(ja), ...Object.keys(en)]);

console.log(`辞書の名前空間: ${namespaces.size}件`);

for (const ns of namespaces) {
  const jaKeys = new Set(Object.keys(ja[ns] ?? {}));
  const enKeys = new Set(Object.keys(en[ns] ?? {}));
  const missingInEn = [...jaKeys].filter((k) => !enKeys.has(k));
  const missingInJa = [...enKeys].filter((k) => !jaKeys.has(k));

  if (missingInEn.length > 0) {
    ok = false;
    console.log(`NG  [${ns}] enに無いキー: ${missingInEn.join(", ")}`);
  }
  if (missingInJa.length > 0) {
    ok = false;
    console.log(`NG  [${ns}] jaに無いキー: ${missingInJa.join(", ")}`);
  }

  for (const k of jaKeys) {
    if (enKeys.has(k)) {
      const jv = ja[ns][k];
      const ev = en[ns][k];
      if (typeof jv !== "string" || jv.trim() === "") {
        ok = false;
        console.log(`NG  [${ns}.${k}] ja値が空または文字列でない`);
      }
      // "placementCountUnit" のように英語では意図的に空文字を許容するキーもあるため、
      // en側の空値はエラーにしない（構造一致だけを厳密に見る）。
      if (typeof ev !== "string") {
        ok = false;
        console.log(`NG  [${ns}.${k}] en値が文字列でない`);
      }
    }
  }
  if (missingInEn.length === 0 && missingInJa.length === 0) {
    console.log(`OK  [${ns}] ${jaKeys.size}キー一致`);
  }
}

console.log(ok ? "\n結果: PASS" : "\n結果: FAIL");
process.exit(ok ? 0 : 1);
