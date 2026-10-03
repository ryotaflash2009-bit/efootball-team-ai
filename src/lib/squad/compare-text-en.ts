import type { Locale } from "@/lib/i18n/locale";

/**
 * スカッド比較ライブラリ（compare-squads.ts）が返す日本語の文（指標名・注記・配置の表記）の英語表示（2026-10-04）。
 * ライブラリの返す値（契約）は変えず、表示するときだけ英語にする。漏れは compare-text-en.test.ts が検出する。
 */
const FIXED_EN: Record<string, string> = {
  "同名の別カード": "Same name, different card",
  // 適性の表記（position.ts）・選手データの取得失敗（useSquadCompareData.ts）。比較画面で表示する。
  "登録ポジションと一致": "Matches registered position",
  "不適性の可能性": "Possibly unsuited",
  "適性未確認（近いポジション）": "Suitability unconfirmed (nearby position)",
  "適性未確認": "Suitability unconfirmed",
  "未配置": "Not placed",
  "一部の選手情報を取得できませんでした。": "Some player data could not be retrieved.",
  "なし": "None",
  "監督ブースターの適用順序（育成前 / 育成後）は未確認です。": "Whether manager boosters apply before or after progression is unconfirmed.",
  "先発人数": "Starters",
  "ベンチ人数": "Bench players",
  "平均基礎OVR": "Average base OVR",
  "平均表示OVR": "Average displayed OVR",
  "共通スキル数": "Shared skills",
  "監督補正が乗る先発数": "Starters boosted by the manager",
  "適性未確認の先発数": "Starters with unconfirmed suitability",
  "不適性の可能性がある先発数": "Starters possibly unsuited",
  "警告数": "Warnings",
  "カテゴリ平均・平均OVR は単純平均です（加重平均ではありません）。": "Category averages and average OVR are simple averages (not weighted).",
  "eFootball の公式チームパワー・カテゴリ重みとは異なります。": "They differ from eFootball's official team strength and category weights.",
  "ポジション別 OVR ではありません（配置ロールを変えても表示OVRは変わりません）。":
    "This is not a position-specific OVR (changing the placement role does not change the displayed OVR).",
  "Power of Many（金色）のユーザー指定値は標準平均に含めていません（別枠表示のみ）。":
    "User-selected Power of Many (gold) values are not included in the standard averages (shown separately only).",
  "外部照合済み・固定型推定のブースターは「固定型と推定して」標準値へ暫定適用しています（確認済み固定型ではありません）。":
    "Boosters verified against external sources and estimated to be fixed are provisionally applied to standard values as fixed (not confirmed fixed boosters).",
  "未解決ブースター（対応表に無い ID）は能力値へ加算していません。": "Unresolved boosters (IDs not in the table) are not added to abilities.",
  "選手情報を取得できなかったカードは平均・スキル集計から除外されます。": "Cards whose player data could not be retrieved are excluded from averages and skill counts.",
};

type Rule = [RegExp, (m: RegExpMatchArray) => string];
const PATTERNS: Rule[] = [
  [/^カード (.+)$/, (m) => `Card ${m[1]}`],
  [/^先発 (.+)$/, (m) => `Starter ${m[1]}`],
  [/^ベンチ (\d+)番$/, (m) => `Bench #${m[1]}`],
];

const JP = /[぀-ヿ一-龯]/;

/** 表示用: 日本語画面ではそのまま、英語画面では英語（未知の日本語は出さずに汎用の英語）。 */
export function localizeSquadCompareText(text: string, locale: Locale): string {
  if (locale === "ja" || !JP.test(text)) return text;
  const fixed = FIXED_EN[text];
  if (fixed) return fixed;
  for (const [re, f] of PATTERNS) {
    const m = text.match(re);
    if (m) return f(m);
  }
  return "(Details are available in Japanese only.)";
}
