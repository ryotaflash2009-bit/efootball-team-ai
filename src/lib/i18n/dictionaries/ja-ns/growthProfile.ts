import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 growthProfile（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const growthProfile: Dictionary["growthProfile"] = {
  heading: "成長プロフィール",
  explanation: "この端末に保存した診断履歴から、スカッドごとの総合点の推移を表示します（同じ診断規則の履歴どうしだけを比べます。外部へは送信しません）。",
  empty: "同じスカッドの診断を2回以上保存すると、推移が表示されます。",
  trendTemplate: "{count}回の診断: 総合 {first} → {latest}（{delta}）",
  mostImprovedTemplate: "最も伸びたカテゴリ: {category} {from} → {to}",
  overcameTemplate: "弱点から A 以上になったカテゴリ: {categories}",
  excludedRulesTemplate: "診断規則が違う {count} 件は比べていません。",
  peakTemplate: "最高: {overall}（{date}）",
  mostDeclinedTemplate: "最も下がった: {category} {from} → {to}",
  newWeaknessesTemplate: "新しい弱点（A 以上から C 以下）: {categories}",
  streakTemplate: "{count} 回続けて上がっています",
  };

registerJaNamespace("growthProfile", growthProfile);

export default growthProfile;
