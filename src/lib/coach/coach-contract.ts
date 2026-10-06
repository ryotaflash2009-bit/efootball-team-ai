/**
 * AI コーチの、提供元に依存しない契約（2026-10-07）。生成 AI の API は使わない・API key を追加しない。
 * まず決定的な規則（rule-based）の提供元だけで動く。将来の提供元（例: Claude）は同じ型で差し替える（本人の判断・契約の後）。
 *
 * - 送る文脈は最小（`minimizeContext`）: 選手名・スカッド名・利用者の ID・メール・URL・自由記述は送らない。
 * - 回答は「確定した事実」「推測」「提案」を分けて返し、事実には出典（診断のカテゴリ・規則の版）を付ける。
 * - 上限: 文脈の大きさ・1 日の回数・時間切れ・再試行の回数。費用の上限を超える呼び出しはしない。
 * - 生成 AI の主観を診断の点数に混ぜない（回答は表示だけ）。
 */
export const COACH_CONTRACT_VERSION = "coach/2026-10-07.v1";

export interface CoachContext {
  /** 診断の規則の版。 */
  rulesVersion: string;
  overall: number | null;
  categories: Record<string, number | null>;
  weaknesses: string[];
  formationId: string | null;
  /** 監督の戦術の適性（名前は送らない）。 */
  managerTactics: Record<string, number | null> | null;
  locale: string;
}

export type CoachStatementKind = "fact" | "inference" | "suggestion";
export interface CoachStatement {
  kind: CoachStatementKind;
  text: string;
  /** 事実の出典（カテゴリの ID・規則の版）。推測・提案は根拠にした事実の出典。 */
  sources: string[];
}
export interface CoachAnswer {
  provider: string;
  statements: CoachStatement[];
}

export interface CoachLimits {
  maxContextBytes: number;
  dailyRequests: number;
  timeoutMs: number;
  maxRetries: number;
  /** 1 回の推定の費用の上限（円）。rule-based は 0。 */
  maxCostYenPerRequest: number;
}
export const DEFAULT_COACH_LIMITS: CoachLimits = { maxContextBytes: 4096, dailyRequests: 20, timeoutMs: 15_000, maxRetries: 1, maxCostYenPerRequest: 0 };

export interface CoachProvider {
  id: string;
  /** 推定の費用（円）。上限を超える場合は呼ばない。 */
  estimateCostYen(context: CoachContext): number;
  answer(context: CoachContext, question: CoachQuestion): Promise<CoachAnswer>;
}
export type CoachQuestion = "top_priority" | "why_weak" | "next_step";

const FORBIDDEN_KEYS = /name|player|squadLabel|email|userId|url|note|memo|free/i;

/** 送る文脈を最小にする（許可した項目だけ・数値と ID だけ）。大きすぎれば null。 */
export function minimizeContext(raw: Record<string, unknown>, limits: CoachLimits = DEFAULT_COACH_LIMITS): CoachContext | null {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const cats: Record<string, number | null> = {};
  for (const [k, v] of Object.entries((raw.categories as Record<string, unknown>) ?? {})) if (/^[a-zA-Z]+$/.test(k) && !FORBIDDEN_KEYS.test(k)) cats[k] = num(v);
  const tactics = raw.managerTactics && typeof raw.managerTactics === "object" ? Object.fromEntries(Object.entries(raw.managerTactics as Record<string, unknown>).filter(([k]) => /^[a-zA-Z]+$/.test(k)).map(([k, v]) => [k, num(v)])) : null;
  const ctx: CoachContext = {
    rulesVersion: typeof raw.rulesVersion === "string" ? raw.rulesVersion.slice(0, 80) : "unknown",
    overall: num(raw.overall),
    categories: cats,
    weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses.filter((w): w is string => typeof w === "string" && /^[a-zA-Z-]+$/.test(w)).slice(0, 10) : [],
    formationId: typeof raw.formationId === "string" && /^[0-9-]+$/.test(raw.formationId) ? raw.formationId : null,
    managerTactics: tactics,
    locale: typeof raw.locale === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(raw.locale) ? raw.locale : "en",
  };
  return new TextEncoder().encode(JSON.stringify(ctx)).length <= limits.maxContextBytes ? ctx : null;
}

/** 決定的な規則の提供元（生成 AI なし・費用 0）。返すのは言語に依存しない短い文（表示側で訳す前提の ID 風の文）。 */
export const ruleBasedCoach: CoachProvider = {
  id: "rule-based",
  estimateCostYen: () => 0,
  async answer(ctx, question) {
    const rated = Object.entries(ctx.categories).filter(([, v]) => v !== null) as [string, number][];
    rated.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const src = (k: string) => [`category:${k}`, `rules:${ctx.rulesVersion}`];
    const statements: CoachStatement[] = [];
    if (!rated.length) return { provider: "rule-based", statements: [{ kind: "fact", text: "no_rated_categories", sources: [`rules:${ctx.rulesVersion}`] }] };
    const [weakest, weakVal] = rated[0];
    const [strongest, strongVal] = rated[rated.length - 1];
    statements.push({ kind: "fact", text: `weakest:${weakest}=${weakVal}`, sources: src(weakest) });
    if (question === "top_priority" || question === "next_step") statements.push({ kind: "suggestion", text: `improve:${weakest}`, sources: src(weakest) });
    if (question === "why_weak") statements.push({ kind: "inference", text: `gap_to_strongest:${strongest}=${strongVal - weakVal}`, sources: [...src(weakest), ...src(strongest)] });
    return { provider: "rule-based", statements };
  },
};

/** 上限・時間切れ・再試行を守って呼ぶ。費用の上限を超える・回数の上限に達したら呼ばない。 */
export async function askCoach(
  provider: CoachProvider,
  context: CoachContext,
  question: CoachQuestion,
  state: { requestsToday: number },
  limits: CoachLimits = DEFAULT_COACH_LIMITS,
): Promise<{ ok: true; answer: CoachAnswer } | { ok: false; problem: "daily_limit" | "cost_limit" | "timeout" | "provider_error" }> {
  if (state.requestsToday >= limits.dailyRequests) return { ok: false, problem: "daily_limit" };
  if (provider.estimateCostYen(context) > limits.maxCostYenPerRequest) return { ok: false, problem: "cost_limit" };
  for (let attempt = 0; attempt <= limits.maxRetries; attempt++) {
    try {
      const answer = await Promise.race([
        provider.answer(context, question),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), limits.timeoutMs)),
      ]);
      return { ok: true, answer };
    } catch (e) {
      if (attempt === limits.maxRetries) return { ok: false, problem: (e as Error).message === "timeout" ? "timeout" : "provider_error" };
    }
  }
  return { ok: false, problem: "provider_error" };
}
