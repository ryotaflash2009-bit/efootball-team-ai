import { z } from "zod";

/**
 * お気に入り / My Team の共通入力検証（純関数）。
 * タグ・メモはプレーンテキストとして扱う（HTML として解釈しない・スクリプト実行しない）。
 */

/** World カード ID: 数字のみ 1〜20 桁。 */
export const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;

/** ローカル保存レコードの内部 ID（将来のクラウド同期でカードキーに使わない）。 */
export const LOCAL_RECORD_ID_RE = /^[a-z]{1,4}_[A-Za-z0-9_-]{4,40}$/;

export const TAG_MAX_LEN = 24;
export const MAX_TAGS = 10;
export const NOTE_MAX_LEN = 500;

/**
 * 制御文字を除去。keepWhitespace=true のときは改行(0x0A)・タブ(0x09)を残す。
 * C0(0x00-0x1F) + DEL(0x7F) + C1(0x80-0x9F) を対象。文字コードで判定（リテラル制御文字を書かない）。
 */
function stripControlChars(s: string, keepWhitespace: boolean): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const isControl = c <= 0x1f || c === 0x7f || (c >= 0x80 && c <= 0x9f);
    if (!isControl) out += ch;
    else if (keepWhitespace && (c === 0x09 || c === 0x0a)) out += ch;
  }
  return out;
}

export function isValidWorldCardId(v: unknown): v is string {
  return typeof v === "string" && WORLD_CARD_ID_RE.test(v);
}

/** 単一タグを正規化。無効なら null。 */
export function sanitizeTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = stripControlChars(raw, false).trim();
  if (t === "") return null;
  return t.length > TAG_MAX_LEN ? t.slice(0, TAG_MAX_LEN) : t;
}

/** タグ配列を正規化（重複除去・最大数・各タグ検証）。 */
export function sanitizeTags(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of arr) {
    const t = sanitizeTag(item);
    if (t != null && !out.includes(t) && out.length < MAX_TAGS) out.push(t);
  }
  return out;
}

/** メモを正規化（改行維持・制御文字除去・最大長）。 */
export function sanitizeNote(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const n = stripControlChars(raw.replace(/\r\n?/g, "\n"), true);
  return n.length > NOTE_MAX_LEN ? n.slice(0, NOTE_MAX_LEN) : n;
}

/** ISO 日時文字列か（NaN / Infinity / 空 を拒否）。 */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || v === "") return false;
  return Number.isFinite(Date.parse(v));
}

/** 保存ビルド ID（`build-storage` の `BUILD_ID_RE` と同じ）。null / 未指定は許容。 */
export const BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export function sanitizeBuildId(v: unknown): string | null {
  return typeof v === "string" && BUILD_ID_RE.test(v) ? v : null;
}

/** Zod: タグ配列。 */
export const tagsSchema = z
  .array(z.unknown())
  .transform(sanitizeTags)
  .catch([] as string[]);

/** Zod: メモ。 */
export const noteSchema = z.unknown().transform(sanitizeNote).catch("");

/** ランダムなローカルレコード ID を生成（`prefix_xxxx`）。 */
export function newLocalRecordId(prefix: string): string {
  const p = prefix.replace(/[^a-z]/g, "").slice(0, 4) || "rec";
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return `${p}_${rnd}`;
}
