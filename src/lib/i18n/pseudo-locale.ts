import type { Dictionary } from "./dictionaries/ja";
import type { PartialDictionary } from "./translate";

/**
 * 疑似ローカライズ（2026-10-06・開発・CI・内部の確認だけ。利用者の言語の選択には出さない）。
 *
 * - en-XA: 英語の文字にアクセントを付け、約 40% 長くし、前後に ⟦ ⟧ を付ける。
 *   切れた文字・固定の幅・連結・ハードコードされた文字（変換されずに残る）を画面で見つける。
 * - ar-XB: 英語の文字列を右から左の表示（U+202E RLO … U+202C PDF）で囲む。`dir="rtl"` と合わせて、
 *   左右を固定した配置（margin-left 等）を画面で見つける。
 * - `{name}` の差し込み・URL・メールアドレスは変えない（差し込みの順・数が保たれることをテストで確認）。
 */

const ACCENTED: Readonly<Record<string, string>> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ğ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ô", p: "ƥ", q: "ʠ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ğ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Ƥ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

/** 変えない部分（差し込み・URL・メールアドレス）。 */
const PROTECTED = /(\{[A-Za-z0-9_]+\}|https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.-]+)/g;

export type PseudoLocale = "en-XA" | "ar-XB";

export function pseudoString(value: string, mode: PseudoLocale): string {
  if (value.length === 0) return value;
  if (mode === "ar-XB") return `‮${value}‬`;
  let letters = 0;
  const body = value
    .split(PROTECTED)
    .map((part, i) => {
      if (i % 2 === 1) return part; // 保護する部分
      return part.replace(/[A-Za-z]/g, (ch) => {
        letters++;
        return ACCENTED[ch] ?? ch;
      });
    })
    .join("");
  // 約 40% 長くする（短い文字列ほど長くなりやすい言語を想定して最低 2 文字）
  const pad = Math.max(2, Math.round(letters * 0.4));
  return `⟦${body}${" ·".repeat(Math.ceil(pad / 2)).slice(0, pad)}⟧`;
}

function mapStrings(value: unknown, mode: PseudoLocale): unknown {
  if (typeof value === "string") return pseudoString(value, mode);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, mode));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, mode);
    return out;
  }
  return value;
}

export function pseudoDictionary(en: Dictionary, mode: PseudoLocale): PartialDictionary {
  return mapStrings(en, mode) as PartialDictionary;
}
