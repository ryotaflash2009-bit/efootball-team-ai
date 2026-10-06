/**
 * メタ分析（選手・監督・フォーメーション・ビルドの傾向）の契約（2026-10-07）。
 * 初期版は合成のデータ・参照データだけ。実際の利用の統計を使う場合は、オプトイン・匿名化・最小の母数・同意の撤回を必須にする
 * （本人の判断の後・別の実装）。この契約は Production の利用者のデータを読まない。
 */
export const META_CONTRACT_VERSION = "meta/2026-10-07.contract.v1";

export type MetaSubject = "player" | "manager" | "formation" | "build";
export type MetaSource = "synthetic" | "reference" | "opt-in-usage";

export interface MetaSnapshot {
  subject: MetaSubject;
  source: MetaSource;
  /** 集計の時刻と、元のデータの時刻。 */
  generatedAt: string;
  dataAsOf: string;
  /** 母数（opt-in-usage では同意した利用者の数）。 */
  sampleSize: number;
  /** 項目 → 割合（0〜1）。 */
  shares: Record<string, number>;
  /** 削除の依頼などで外した項目の数。 */
  removedCount: number;
}

export const MIN_SAMPLE_FOR_USAGE = 50;
export const MAX_AGE_DAYS = 14;

export type MetaWarning = "synthetic_data" | "small_sample" | "stale" | "opt_in_bias" | "shares_not_normalized";

export interface MetaView {
  publishable: boolean;
  warnings: MetaWarning[];
  /** 表示してよい項目（割合の大きい順・同点は名前の順）。母数が小さい opt-in の統計は空。 */
  rows: { key: string; share: number }[];
  confidence: "none" | "low" | "medium" | "high";
}

/** スナップショットを表示用にする（警告・信頼度・公開の可否）。 */
export function viewMetaSnapshot(s: MetaSnapshot, now: string): MetaView {
  const warnings: MetaWarning[] = [];
  if (s.source === "synthetic") warnings.push("synthetic_data");
  const ageDays = (Date.parse(now) - Date.parse(s.dataAsOf)) / 86_400_000;
  if (!(ageDays <= MAX_AGE_DAYS)) warnings.push("stale");
  const total = Object.values(s.shares).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 0.01) warnings.push("shares_not_normalized");
  let publishable = true;
  if (s.source === "opt-in-usage") {
    warnings.push("opt_in_bias");
    if (s.sampleSize < MIN_SAMPLE_FOR_USAGE) {
      warnings.push("small_sample");
      publishable = false;
    }
  }
  const rows = publishable ? Object.entries(s.shares).map(([key, share]) => ({ key, share })).sort((a, b) => b.share - a.share || a.key.localeCompare(b.key)) : [];
  const confidence: MetaView["confidence"] = !publishable ? "none" : s.source === "synthetic" ? "low" : warnings.includes("stale") ? "low" : s.source === "reference" ? "medium" : s.sampleSize >= 500 ? "high" : "medium";
  return { publishable, warnings: warnings.sort(), rows, confidence };
}

/** 同意の撤回・削除の依頼: その利用者の寄与を外した新しいスナップショットを作る前提で、外した数を記録する。 */
export function applyRemoval(s: MetaSnapshot, removedContributors: number): MetaSnapshot {
  return { ...s, sampleSize: Math.max(0, s.sampleSize - removedContributors), removedCount: s.removedCount + removedContributors };
}

/** 2 つのスナップショットの時系列の差（同じ対象・同じ出典だけ）。 */
export function trendBetween(a: MetaSnapshot, b: MetaSnapshot): { key: string; delta: number }[] | null {
  if (a.subject !== b.subject || a.source !== b.source) return null;
  const keys = [...new Set([...Object.keys(a.shares), ...Object.keys(b.shares)])].sort();
  return keys.map((k) => ({ key: k, delta: Math.round(((b.shares[k] ?? 0) - (a.shares[k] ?? 0)) * 1000) / 1000 }));
}
