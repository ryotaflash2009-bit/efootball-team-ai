import {
  ABILITY_CATEGORIES,
  DIAGNOSIS_TIER_THRESHOLDS,
  SQUAD_DIAGNOSIS_RULES_VERSION,
  type FindingKind,
  type SquadDiagnosisCategoryId,
  type SquadDiagnosisResult,
  type SquadDiagnosisTier,
} from "./squad-diagnosis";

/**
 * スカッド診断の共有URL（F-042）。サーバーへ何も保存しない。
 *
 * - 共有データは URL の fragment（`#` 以降）に載せる。fragment はブラウザーからサーバーへ送られないため、
 *   サーバーのログにも残らない。表示ページはクライアント側で復元するだけ（Production write 0）。
 * - 載せるのは、言語に依存しない診断の要約だけ（規則版・診断日・総合/カテゴリの点数とランク・
 *   強み/弱点の種別とカテゴリID）。選手名・内部ID・保存ビルドID・スカッドID・根拠データ・
 *   文章（名前を含み得る）・スカッド名・利用者を特定し得る情報は一切載せない（自由記述のフィールドを持たない）。
 * - 形式: `sd1.<base64url(JSON)>.<checksum>`。checksum は FNV-1a 32bit で、**破損の検出**用
 *   （秘密鍵が無いため改ざんの証明にはならない）。改ざんは厳格な検証（未知フィールド拒否・値域・
 *   点数とランクの整合）で安全に拒否する。表示側は「共有者の端末で計算された結果」と明示する。
 * - 互換性: `v` が payload の版。未知の版は「対応していない共有URL」として安全に拒否する。
 *   将来 v2 を導入する場合も、v1 の復元は維持する（`docs/product/share-url-contract.md`）。
 */

export const SHARE_PAYLOAD_VERSION = 1 as const;
export const SHARE_TOKEN_PREFIX = "sd1";
export const SHARE_PATH = "/share/diagnosis";
/** JSON（UTF-8）の上限。v1 の最大でも約0.4KBに収まり、十分な余裕がある。 */
export const SHARE_MAX_JSON_BYTES = 1024;
/** fragment 全体の上限（base64url で約4/3倍 + 接頭辞・checksum）。 */
export const SHARE_MAX_TOKEN_LENGTH = 1500;

type AbilityCategoryId = Exclude<SquadDiagnosisCategoryId, "squadCompleteness">;
export const SHARE_CATEGORY_IDS: readonly AbilityCategoryId[] = Object.freeze(ABILITY_CATEGORIES.map((c) => c.id));
const TIERS: readonly SquadDiagnosisTier[] = ["S", "A", "B", "C", "D"];
const FINDING_KINDS: readonly FindingKind[] = ["ability", "compatibility", "referenceError", "config"];
/** 診断規則の版（例: squad-diagnosis/2026-09-06.v1）。これ以外の文字列は載せない。 */
const RULES_VERSION_RE = /^squad-diagnosis\/\d{4}-\d{2}-\d{2}\.v\d{1,3}$/;
/** フォーメーション（例: 4-3-3, 4-2-1-3）。数字1桁をハイフンでつないだ形だけ。 */
const FORMATION_RE = /^\d(?:-\d){2,4}$/;

export type ScoreTier = readonly [number | null, SquadDiagnosisTier | null];
export type ShareFinding = readonly [FindingKind, SquadDiagnosisCategoryId | null];

export interface SquadDiagnosisSharePayloadV1 {
  v: 1;
  /** 種別（squad diagnosis）。 */
  k: "sd";
  /** 診断規則の版（比較可能性の判定に使う）。 */
  r: string;
  /** 診断日（YYYY-MM-DD。時刻は載せない）。 */
  d: string;
  /** フォーメーション表示（例: 4-3-3）。 */
  f?: string;
  o: ScoreTier;
  c: Record<AbilityCategoryId, ScoreTier>;
  s: ShareFinding | null;
  w: ShareFinding | null;
}

export type ShareDecodeFailure =
  | "empty"
  | "too_long"
  | "bad_format"
  | "unsupported_version"
  | "bad_encoding"
  | "checksum_mismatch"
  | "too_large"
  | "bad_json"
  | "invalid_payload";

export type ShareDecodeResult = { ok: true; payload: SquadDiagnosisSharePayloadV1 } | { ok: false; reason: ShareDecodeFailure };

// ---------------------------------------------------------------------------
// 診断結果 → payload
// ---------------------------------------------------------------------------

function toScoreTier(score: number | null, tier: SquadDiagnosisTier | null): ScoreTier {
  return [score, tier];
}

function toFinding(f: { kind: FindingKind; categoryId: SquadDiagnosisCategoryId | null } | undefined): ShareFinding | null {
  return f ? [f.kind, f.kind === "ability" || f.kind === "config" ? f.categoryId : null] : null;
}

/** 診断日を YYYY-MM-DD（利用者の端末のローカル日付）にする。 */
export function toShareDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildSharePayload(
  result: SquadDiagnosisResult,
  opts: { date: Date; formationLabel?: string | null },
): SquadDiagnosisSharePayloadV1 {
  const byId = new Map(result.categories.map((c) => [c.id, c] as const));
  const c = Object.fromEntries(SHARE_CATEGORY_IDS.map((id) => {
    const cat = byId.get(id);
    return [id, toScoreTier(cat?.score ?? null, cat?.tier ?? null)];
  })) as Record<AbilityCategoryId, ScoreTier>;
  const payload: SquadDiagnosisSharePayloadV1 = {
    v: SHARE_PAYLOAD_VERSION,
    k: "sd",
    r: result.rulesVersion,
    d: toShareDate(opts.date),
    o: toScoreTier(result.overall.score, result.overall.tier),
    c,
    s: toFinding(result.strengths[0]),
    w: toFinding(result.weaknesses[0]),
  };
  const formation = opts.formationLabel?.trim();
  if (formation && FORMATION_RE.test(formation)) payload.f = formation;
  return payload;
}

// ---------------------------------------------------------------------------
// 符号化・復元
// ---------------------------------------------------------------------------

/** FNV-1a 32bit（破損の検出用。認証ではない）。 */
export function fnv1a32(text: string): string {
  let h = 0x811c9dc5;
  const bytes = new TextEncoder().encode(text);
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeSharePayload(payload: SquadDiagnosisSharePayloadV1): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > SHARE_MAX_JSON_BYTES) throw new Error("share_payload_too_large");
  const body = toBase64Url(bytes);
  return `${SHARE_TOKEN_PREFIX}.${body}.${fnv1a32(body)}`;
}

export function buildShareUrl(origin: string, payload: SquadDiagnosisSharePayloadV1): string {
  return `${origin.replace(/\/+$/, "")}${SHARE_PATH}#${encodeSharePayload(payload)}`;
}

const isScore = (v: unknown): v is number | null => v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100);
const isTier = (v: unknown): v is SquadDiagnosisTier | null => v === null || TIERS.includes(v as SquadDiagnosisTier);

function tierForScore(score: number): SquadDiagnosisTier {
  for (const t of DIAGNOSIS_TIER_THRESHOLDS) if (score >= t.min) return t.tier;
  return "D";
}

/** 点数とランクの組が整合しているか（null同士、または点数から決まるランクと一致）。 */
function validScoreTier(v: unknown): boolean {
  if (!Array.isArray(v) || v.length !== 2 || !isScore(v[0]) || !isTier(v[1])) return false;
  if (v[0] === null || v[1] === null) return v[0] === null && v[1] === null;
  return tierForScore(v[0]) === v[1];
}

function validFinding(v: unknown): boolean {
  if (v === null) return true;
  if (!Array.isArray(v) || v.length !== 2 || !FINDING_KINDS.includes(v[0] as FindingKind)) return false;
  const [kind, cat] = v as [FindingKind, unknown];
  if (kind === "ability") return SHARE_CATEGORY_IDS.includes(cat as AbilityCategoryId);
  if (kind === "config") return cat === "squadCompleteness";
  return cat === null;
}

const ALLOWED_KEYS = new Set(["v", "k", "r", "d", "f", "o", "c", "s", "w"]);

/** 厳格な検証（未知フィールド・型・値域・整合）。問題があれば理由を返す。 */
export function validateSharePayload(value: unknown): ShareDecodeFailure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "invalid_payload";
  const p = value as Record<string, unknown>;
  if (p.v !== SHARE_PAYLOAD_VERSION) return typeof p.v === "number" ? "unsupported_version" : "invalid_payload";
  for (const k of Object.keys(p)) if (!ALLOWED_KEYS.has(k)) return "invalid_payload";
  if (p.k !== "sd") return "invalid_payload";
  if (typeof p.r !== "string" || !RULES_VERSION_RE.test(p.r)) return "invalid_payload";
  if (typeof p.d !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(p.d)) return "invalid_payload";
  if (p.f !== undefined && (typeof p.f !== "string" || !FORMATION_RE.test(p.f))) return "invalid_payload";
  if (!validScoreTier(p.o)) return "invalid_payload";
  const c = p.c;
  if (!c || typeof c !== "object" || Array.isArray(c)) return "invalid_payload";
  const keys = Object.keys(c);
  if (keys.length !== SHARE_CATEGORY_IDS.length || !SHARE_CATEGORY_IDS.every((id) => keys.includes(id))) return "invalid_payload";
  for (const id of SHARE_CATEGORY_IDS) if (!validScoreTier((c as Record<string, unknown>)[id])) return "invalid_payload";
  if (!("s" in p) || !("w" in p) || !validFinding(p.s) || !validFinding(p.w)) return "invalid_payload";
  return null;
}

/** fragment（先頭の `#` は有っても無くてもよい）から payload を復元する。失敗理由だけを返し、入力は反映しない。 */
export function decodeShareToken(fragment: string): ShareDecodeResult {
  const token = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (token.length === 0) return { ok: false, reason: "empty" };
  if (token.length > SHARE_MAX_TOKEN_LENGTH) return { ok: false, reason: "too_long" };
  const m = /^sd(\d{1,3})\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(token);
  if (!m) return { ok: false, reason: "bad_format" };
  if (m[1] !== String(SHARE_PAYLOAD_VERSION)) return { ok: false, reason: "unsupported_version" };
  if (fnv1a32(m[2]) !== m[3]) return { ok: false, reason: "checksum_mismatch" };
  const bytes = fromBase64Url(m[2]);
  if (!bytes) return { ok: false, reason: "bad_encoding" };
  if (bytes.length > SHARE_MAX_JSON_BYTES) return { ok: false, reason: "too_large" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: "bad_encoding" };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "bad_json" };
  }
  const problem = validateSharePayload(value);
  if (problem) return { ok: false, reason: problem };
  return { ok: true, payload: value as SquadDiagnosisSharePayloadV1 };
}

/** 共有されたものが、現在のアプリの診断規則と同じ版か（異なる場合は表示で明示する）。 */
export function isCurrentRulesVersion(payload: SquadDiagnosisSharePayloadV1): boolean {
  return payload.r === SQUAD_DIAGNOSIS_RULES_VERSION;
}
