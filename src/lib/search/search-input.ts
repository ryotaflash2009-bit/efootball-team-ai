import { detectLocaleFromBrowserLanguage, type Locale } from "@/lib/i18n/locale";

/**
 * 検索語の入力境界(選手・監督の検索で共通)。
 *
 * - 正当な検索語は過剰に拒否しない: 記号・引用符・アポストロフィ・セミコロン・日本語等のUnicodeは受け付ける
 *   (値はPostgREST側で引用・LIKEエスケープ済み。postgrest-filter.ts)。
 * - 拒否するのは、表示できない制御文字(NUL・C0/C1制御文字・DEL。タブ/改行は既存どおり空白へ正規化)と、
 *   明らかに異常な長さの生入力だけ。通常の長さ超過は既存どおり上限まで切り詰めて検索する。
 * - 上流(Supabase手前の防御)が検索リクエストを拒否した場合も、同じ安全な入力エラーとして扱う。
 * - 利用者へは定型文だけを返し、SQL・filter構文・上流の本文・内部情報は含めない。
 */

export const SEARCH_INPUT_REJECTED_CODE = "SEARCH_INPUT_REJECTED" as const;

/** 生の検索パラメーターの上限(文字数)。これを超える入力は切り詰めずに拒否する。 */
export const MAX_RAW_SEARCH_INPUT_LENGTH = 1000;

export type SearchInputRejectionReason = "invalid_characters" | "too_long" | "rejected_by_upstream";

export class SearchInputRejectedError extends Error {
  readonly code = SEARCH_INPUT_REJECTED_CODE;
  readonly reason: SearchInputRejectionReason;
  constructor(reason: SearchInputRejectionReason) {
    super("検索語を処理できない");
    this.name = "SearchInputRejectedError";
    this.reason = reason;
  }
}

// タブ(\t)・改行(\n・\r)・改ページ(\f)・垂直タブ(\v)は既存の正規化で空白になるため許可し、それ以外の制御文字を拒否する。
// eslint-disable-next-line no-control-regex
const DISALLOWED_CONTROL_RE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/;

export type SearchInputCheck = { readonly ok: true } | { readonly ok: false; readonly reason: Exclude<SearchInputRejectionReason, "rejected_by_upstream"> };

/** 生の検索パラメーターを検査する(null・空・空白だけは既存どおり「検索語なし」として通す)。 */
export function checkSearchInput(raw: string | null | undefined): SearchInputCheck {
  if (raw == null || raw === "") return { ok: true };
  if (raw.length > MAX_RAW_SEARCH_INPUT_LENGTH) return { ok: false, reason: "too_long" };
  if (DISALLOWED_CONTROL_RE.test(raw)) return { ok: false, reason: "invalid_characters" };
  return { ok: true };
}

export function assertSearchInput(raw: string | null | undefined): void {
  const r = checkSearchInput(raw);
  if (!r.ok) throw new SearchInputRejectedError(r.reason);
}

const MESSAGES: Readonly<Record<Locale, string>> = Object.freeze({
  ja: "この検索語では検索できません。記号や特殊な文字を減らして、もう一度お試しください。",
  en: "This search term cannot be used. Please remove unusual symbols or characters and try again.",
});

/** `Accept-Language`の先頭の言語から応答言語を決める(日本語系はja、それ以外はen、無ければja)。 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header || header.trim() === "") return "ja";
  const first = header.split(",")[0]?.split(";")[0]?.trim();
  return detectLocaleFromBrowserLanguage(first || null);
}

export interface SearchInputRejectedBody {
  readonly error: { readonly code: typeof SEARCH_INPUT_REJECTED_CODE; readonly reason: SearchInputRejectionReason; readonly message: string };
}

export function searchInputRejectedBody(err: SearchInputRejectedError, acceptLanguage: string | null | undefined): SearchInputRejectedBody {
  return { error: { code: SEARCH_INPUT_REJECTED_CODE, reason: err.reason, message: MESSAGES[localeFromAcceptLanguage(acceptLanguage)] } };
}

/** 検索入力エラーのHTTP status(クライアント入力の問題として400)。 */
export const SEARCH_INPUT_REJECTED_STATUS = 400;

/** APIの応答がこの入力エラーかどうか(クライアント側の表示切替用)。 */
export function isSearchInputRejectedResponse(status: number, body: unknown): boolean {
  if (status !== SEARCH_INPUT_REJECTED_STATUS || !body || typeof body !== "object") return false;
  const err = (body as { error?: { code?: unknown } }).error;
  return !!err && err.code === SEARCH_INPUT_REJECTED_CODE;
}
