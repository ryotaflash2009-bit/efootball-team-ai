/**
 * 検索語の正規化（2026-10-06・多言語）。DB のスキーマ・拡張（unaccent 等）は変えず、検索語の側だけで扱う。
 *
 * - Unicode NFKC（全角英数 → 半角・半角カナ → 全角カナ）と前後の空白の除去。
 * - アクセント・記号を区別しない一致: ラテン文字を含む検索語から、PostgreSQL の正規表現（`~*`、PostgREST の `imatch`）の
 *   文字クラスを作る（例: "muller" → "m[uüúùûūů]ll[eéèêëēė]r"）。DB の名前が "Müller" でも一致する。
 * - ドイツ語の ß は "ss" と同じに扱う（"strasse" でも "Straße" に一致）。トルコ語の ı / İ は i と同じに扱う。
 * - 大文字・小文字は `~*`（imatch）で区別しない。
 * - 根拠のない別名・翻訳名は作らない（元の名前の綴りの揺れだけ）。
 * - 既存の部分一致（ilike）・完全一致（ID）はそのまま残す（この正規表現は追加の条件）。
 * - 短すぎる検索語（ラテン文字 2 文字未満）・記号だけの検索語では正規表現を作らない（誤一致の増加を防ぐ・ilike だけ）。
 * - ひらがな・カタカナを区別しない一致（2026-10-07）: 日本語の名前の列に、かなの文字クラスの正規表現を追加する
 *   （例: "めっし" → "[めメ][っッ][しシ]"）。韓国語・中国語（漢字）は従来どおり部分一致（簡体字と繁体字は自動で同一視しない）。
 */

/** NFKC と空白の正規化（表示はしない。検索だけ）。 */
export function normalizeSearchQuery(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** 基本の文字 → アクセントつきの変種（小文字）。 */
const VARIANTS: Readonly<Record<string, string>> = {
  a: "aáàâäãåāăą",
  c: "cçćčĉ",
  d: "dďđ",
  e: "eéèêëēėęě",
  g: "gğĝģ",
  i: "iíìîïīįıİ",
  l: "lłľĺļ",
  n: "nñńňņ",
  o: "oóòôöõøōő",
  r: "rřŕ",
  s: "sśšşș",
  t: "tťţț",
  u: "uúùûüūůűų",
  y: "yýÿ",
  z: "zźžż",
};

/** 文字列からアクセントを除いた形（基本の文字の判定用）。ß → ss、ı → i。 */
export function foldAccents(s: string): string {
  return s
    .replace(/ß/g, "ss")
    .replace(/[ıİ]/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

const REGEX_META = /[\\^$.*+?()[\]{}|]/g;

/**
 * アクセントを区別しない正規表現の文字列を作る。ラテン文字が 1 文字も無い（日本語だけ等）、または
 * 長すぎる検索語では null（従来の部分一致だけを使う）。
 */
export function accentInsensitivePattern(query: string): string | null {
  const folded = foldAccents(normalizeSearchQuery(query));
  if ((folded.match(/[a-z]/g) ?? []).length < 2 || folded.length > 80) return null;
  let out = "";
  for (let i = 0; i < folded.length; i++) {
    const ch = folded[i];
    if (ch === "s" && folded[i + 1] === "s") {
      out += "(ss|ß|[sśšşș]{2})";
      i++;
      continue;
    }
    const v = VARIANTS[ch];
    if (v) out += `[${v}${v.toUpperCase()}]`;
    else out += ch.replace(REGEX_META, (m) => `\\${m}`);
  }
  return out;
}

/** ひらがな（U+3041〜U+3096）とカタカナ（U+30A1〜U+30F6）の対応（コードの差 0x60）。 */
function kanaPair(ch: string): string | null {
  const c = ch.codePointAt(0) ?? 0;
  if (c >= 0x3041 && c <= 0x3096) return ch + String.fromCodePoint(c + 0x60);
  if (c >= 0x30a1 && c <= 0x30f6) return String.fromCodePoint(c - 0x60) + ch;
  return null;
}

/**
 * ひらがな・カタカナを区別しない正規表現の文字列（2026-10-07）。かなを含まない・短すぎる（2 文字未満）・長すぎる検索語では null。
 * 漢字・長音（ー）・英数はそのまま（記号はエスケープ）。
 */
export function kanaInsensitivePattern(query: string): string | null {
  const q = normalizeSearchQuery(query);
  const chars = [...q];
  if (chars.length < 2 || chars.length > 80 || !chars.some((ch) => kanaPair(ch) !== null)) return null;
  let out = "";
  for (const ch of chars) {
    const pair = kanaPair(ch);
    out += pair ? `[${pair}]` : ch.replace(REGEX_META, (m) => `\\${m}`);
  }
  return out;
}
