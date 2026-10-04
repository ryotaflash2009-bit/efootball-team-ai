import type { Locale } from "@/lib/i18n/locale";
import { STAT_LABEL_JA } from "@/lib/world/stat-labels";
import { STAT_DEFINITIONS } from "@/lib/efhub/masters";

/**
 * スカッド診断ライブラリ（squad-diagnosis.ts）が返す日本語の文（カテゴリの注記・根拠・長所/弱点・改善候補）の英語表示（2026-10-04）。
 * 診断の計算・返す値（契約）は変えず、表示するときだけ英語にする。選手名（元データの固有名詞）はそのまま残す。
 * 漏れは squad-diagnosis-text-en.test.ts が squad-diagnosis.ts の日本語リテラルを読み取って検出する。
 */
const CATEGORY_EN: Record<string, string> = {
  攻撃: "Attack",
  守備: "Defense",
  空中戦: "Aerial",
  スピード: "Speed",
  "パス・ビルドアップ": "Pass & Build-up",
  "ドリブル・ボール保持": "Dribbling & Possession",
  プレス適性: "Pressing",
  カウンター適性: "Counter-attack",
  選手配置の充足状況: "Squad completeness",
};

const FIXED_EN: Record<string, string> = {
  ...CATEGORY_EN,
  "この評価は、登録された選手能力・育成・配置にもとづくスカッド構成評価です。試合結果やプレイヤースキル、全国順位・勝率を保証するものではありません。":
    "This is a squad composition rating based on the registered player abilities, progression and placement. It does not guarantee match results, player skill, rankings or win rates.",
  "既存の比較カテゴリ定義（COMPARE_CATEGORIES.attack）と同一の能力集合を採用": "Same ability set as the existing comparison category (COMPARE_CATEGORIES.attack)",
  "既存の比較カテゴリ定義（COMPARE_CATEGORIES.defense）と同一の能力集合を採用": "Same ability set as the existing comparison category (COMPARE_CATEGORIES.defense)",
  "既存の育成カテゴリ定義（stat-groups.ts の aerialStrength）と同一の能力集合を採用": "Same ability set as the existing progression category (aerialStrength in stat-groups.ts)",
  "既存の比較カテゴリ定義（COMPARE_CATEGORIES.speed）と同一の能力集合を採用": "Same ability set as the existing comparison category (COMPARE_CATEGORIES.speed)",
  "グラウンダーパス・フライパスに、パス精度を支えるボールコントロールを加えた集合": "Low Pass and Lofted Pass plus Ball Control, which supports passing accuracy",
  "既存の比較カテゴリ定義（COMPARE_CATEGORIES.dribble）と同一の能力集合を採用": "Same ability set as the existing comparison category (COMPARE_CATEGORIES.dribble)",
  "プレッシングに関与する運動量・寄せの速さに関する能力の集合": "Abilities related to work rate and closing-down speed in pressing",
  "速攻の推進力（スピード）と飛び出しの判断（オフェンスセンス）に関する能力の集合": "Abilities related to counter-attack drive (Speed) and timing of runs (Offensive Awareness)",
  "判定対象外（対象となるフィールドプレイヤーが先発にいません）": "Not rated (no eligible outfield players in the starting XI)",
  対象能力: "Target abilities",
  採用理由: "Why this set",
  対象選手数: "Players counted",
  使用した能力: "Abilities used",
  平均値: "Average",
  最高: "Highest",
  最低: "Lowest",
  "先発の配置人数・適性・ベンチ人数から減点方式で算出（能力値は使用しない）": "Calculated by deductions from starting placement, suitability and bench size (abilities are not used)",
  先発配置: "Starters placed",
  ベンチ人数: "Bench players",
  適性未確認: "Suitability unconfirmed",
  不適性の可能性: "Possibly unsuited",
  減点重み: "Deduction weights",
  不明: "Unknown",
  保存ビルド参照の見直し: "Review saved build references",
  保存ビルドの設定: "Set saved builds",
  配置の見直し: "Review placement",
  先発の空き枠: "Empty starting slots",
  ベンチ入れ替え候補: "Bench swap candidate",
  "判定対象外（有効な評価項目がありません。先発にフィールドプレイヤーを配置してください）": "Not rated (no valid categories; place outfield players in the starting XI)",
};

/** 能力名の日本語 → 英語（STAT_LABEL_JA と STAT_DEFINITIONS の key で対応づける）。 */
const STAT_EN_BY_JA: Record<string, string> = Object.fromEntries(
  STAT_DEFINITIONS.map((d) => [STAT_LABEL_JA[d.statKey], d.nameEn] as const).filter(([ja]) => typeof ja === "string"),
);

const cat = (ja: string) => CATEGORY_EN[ja] ?? ja;
const pos = (v: string) => (v === "不明" ? "Unknown" : v);

type Rule = [RegExp, (m: RegExpMatchArray) => string];
const PATTERNS: Rule[] = [
  [/^先発の対象フィールドプレイヤー (\d+) 人（GK除く）の対象能力平均（標準最終値）$/, (m) => `Average of the target abilities (standard final values) for ${m[1]} outfield starters (excluding GK)`],
  [/^(\d+)人$/, (m) => m[1]],
  [/^(\d+) \/ (\d+) 人$/, (m) => `${m[1]} / ${m[2]}`],
  [/^(\d+) 人$/, (m) => m[1]],
  [/^(\d+) 件$/, (m) => m[1]],
  [/^未配置×(.+) \/ 適性未確認×(.+) \/ 不適性×(.+) \/ ベンチ0人×(.+)$/, (m) => `Empty slot ×${m[1]} / Unconfirmed suitability ×${m[2]} / Unsuited ×${m[3]} / Empty bench ×${m[4]}`],
  [/^(.+)の評価が高水準です（ランク(.+)・(.+)点）。$/, (m) => `${cat(m[1])} is rated high (rank ${m[2]}, ${m[3]} points).`],
  [/^(.+)の評価が低水準です（ランク(.+)・(.+)点）。$/, (m) => `${cat(m[1])} is rated low (rank ${m[2]}, ${m[3]} points).`],
  [/^(.+)の保存ビルド参照$/, (m) => `Saved build reference for ${m[1]}`],
  [/^保存ビルドの参照が解決できません（状態: (.+)）。データの誤りではなく、削除・付け替え等により参照が古くなっている可能性があります。$/, (m) => `The saved build reference cannot be resolved (status: ${m[1]}). This is not a data error; the reference may be outdated after a deletion or reassignment.`],
  [/^(.+)の配置適性$/, (m) => `Placement suitability of ${m[1]}`],
  [/^登録ポジション（(.+)）と配置（(.+)）が大きく異なる可能性があります（能力値は変更していません）。$/, (m) => `The registered position (${pos(m[1])}) and the placement (${m[2]}) may differ greatly (abilities are not changed).`],
  [/^先発の配置・適性に改善余地があります（(.+)点）。詳細は根拠を参照してください。$/, (m) => `Starting placement and suitability can be improved (${m[1]} points). See the evidence for details.`],
  [/^(.+) の保存ビルド参照が解決できません。保存ビルドを選び直してください（自動修復はしません）。$/, (m) => `The saved build references of ${m[1]} cannot be resolved. Choose the saved builds again (they are not repaired automatically).`],
  [/^(.+) は保存ビルド未設定のため、育成後の完成状態を十分に反映していません。育成・ブースターを反映した保存ビルドを設定すると、より実態に近い評価になります。$/, (m) => `${m[1]} have no saved build, so their completed progression is not fully reflected. Setting saved builds with progression and boosters gives a more realistic rating.`],
  [/^(.+) の配置適性を確認してください。$/, (m) => `Check the placement suitability of ${m[1]}.`],
  [/^先発が (\d+)\/(\d+) 人です。空き枠へ選手を配置すると評価の精度が上がります。$/, (m) => `${m[1]}/${m[2]} starters. Filling empty slots makes the rating more accurate.`],
  [/^(.+)について、ベンチの(.+)（(\d+)）は先発の(.+)（(\d+)）より高い値です。入れ替えを検討できます（自動適用はしません）。$/, (m) => `For ${cat(m[1])}, ${m[2]} on the bench (${m[3]}) is higher than starter ${m[4]} (${m[5]}). You can consider swapping them (not applied automatically).`],
  [/^判定可能な (\d+)\/(\d+) 項目の単純平均$/, (m) => `Simple average of ${m[1]}/${m[2]} rateable categories`],
];

const JP = /[぀-ヿ一-龯]/;
const GENERIC = "(Details are available in Japanese only.)";

/** 能力名の並び（「オフェンスセンス / 決定力」）なら英語に。1 つでも能力名でなければ null。 */
function statList(text: string): string | null {
  const parts = text.split(" / ");
  const out = parts.map((p) => STAT_EN_BY_JA[p.trim()]);
  return out.every(Boolean) ? out.join(" / ") : null;
}

/**
 * 表示用: 日本語画面ではそのまま、英語画面では英語（選手名など元データの固有名詞は残る）。
 * 対応表にない日本語の文は汎用の英語にする（混在した表示にしない）。ただし「選手名（数値）」のような
 * 元データだけの値（文の構造を持たない）は、そのまま返す。
 */
export function localizeSquadDiagnosisText(text: string, locale: Locale): string {
  if (locale === "ja" || !JP.test(text)) return text;
  const fixed = FIXED_EN[text];
  if (fixed) return fixed;
  const stats = statList(text);
  if (stats) return stats;
  for (const [re, f] of PATTERNS) {
    const m = text.match(re);
    if (m) return f(m);
  }
  // 選手名と数値だけの値（例: 「選手名（75.6）」）は元データとして残す。
  if (/^[^。、:：]+（[\d.]+）$/.test(text)) return text;
  return GENERIC;
}

/**
 * 英語の画面: 診断の文に入っている選手の日本語名を、同じスカッドの英語名に置き換える（元データの名前の言語をそろえるだけ）。
 * pairs は [日本語名, 英語名]。長い名前から置き換える（部分一致の取り違えを避ける）。日本語の画面・英語名が無い選手はそのまま。
 */
export function swapPlayerNames(text: string, locale: Locale, pairs: readonly (readonly [string, string])[]): string {
  if (locale === "ja" || pairs.length === 0) return text;
  let out = text;
  for (const [ja, en] of [...pairs].sort((a, b) => b[0].length - a[0].length)) if (ja && en && ja !== en) out = out.split(ja).join(en);
  return out;
}
