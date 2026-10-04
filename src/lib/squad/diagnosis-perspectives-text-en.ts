import type { Locale } from "@/lib/i18n/locale";
import { STAT_LABEL_JA } from "@/lib/world/stat-labels";
import { STAT_DEFINITIONS } from "@/lib/efhub/masters";

/**
 * F-045 診断の追加観点（diagnosis-perspectives.ts・暫定）が返す日本語の文の英語表示（2026-10-04）。
 * 計算・返す値は変えず、表示するときだけ英語にする。選手名・プレースタイル名など元データの値はそのまま残す。
 * 漏れは diagnosis-perspectives-text-en.test.ts が diagnosis-perspectives.ts の日本語リテラルを読み取って検出する。
 */
const SIDE: Record<string, string> = { 左: "left", 右: "right" };
const STAT_EN_BY_JA: Record<string, string> = Object.fromEntries(
  STAT_DEFINITIONS.map((d) => [STAT_LABEL_JA[d.statKey], d.nameEn] as const).filter(([ja]) => typeof ja === "string"),
);
const stat = (v: string) => STAT_EN_BY_JA[v] ?? v;

const FIXED_EN: Record<string, string> = {
  "控えの厚み": "Bench depth",
  "控えがいるライン数": "Lines with a substitute",
  "GK・DF・MF・FW のうち控えが 1 人以上いるライン数": "Number of lines (GK, DF, MF, FW) with at least one substitute",
  "控えと先発の能力差の平均": "Average ability gap between bench and starters",
  "ラインごとに（控えの全能力平均 − 先発の全能力平均）を出し、その平均。GK 能力も含むため値の意味は暫定":
    "Per line (bench all-ability average − starters all-ability average), then averaged. Includes GK abilities, so the meaning is provisional",
  "控えがいない": "No substitutes",
  "カードを解決できない控えがいる（能力差の計算から除外）": "Some substitutes' cards could not be resolved (excluded from the gap)",
  "左": "Left",
  "右": "Right",
  "左右バランス": "Left/right balance",
  "左右の人数の差": "Left/right player difference",
  "人": "",
  "左右の外側のレーンにいるフィールドプレーヤーの人数の差（評価しない）": "Difference in outfield players in the left and right outer lanes (not evaluated)",
  "左右の攻守能力の差": "Left/right attack-defense ability difference",
  "サイドごとの（攻撃平均と守備平均の平均）の差。重みは暫定。差が大きい＝弱いとは限らない":
    "Difference per side of (average of attack and defense averages). Weights are provisional. A bigger gap does not necessarily mean weaker",
  "外側のレーンに選手がいない": "No players in the outer lane",
  "配置座標が無い選手がいる": "Some players have no placement coordinates",
  "役割の重複（控えを含む）": "Role overlap (including substitutes)",
  "同じプレースタイルの選手は 2 人以上いない": "No playing style is shared by 2 or more players",
  "先発で重複するプレースタイル数": "Playing styles shared among starters",
  "種類": " types",
  "先発 11 人で 2 人以上いるプレースタイルの種類数（basic を除く）": "Number of playing styles held by 2 or more of the 11 starters (excluding basic)",
  "控えを含めた重複数": "Overlaps including substitutes",
  "先発と控えを合わせた重複の種類数。重複が悪いとは言えない（控えは同じ役割の交代要員でもある）":
    "Number of shared styles across starters and substitutes. Overlap is not necessarily bad (substitutes can cover the same role)",
  "プレースタイルが不明な選手がいる": "Some players' playing styles are unknown",
  "監督適合": "Manager fit",
  "監督が設定されていないか、戦術適性を読めない": "No manager is set, or the tactical proficiency cannot be read",
  "得意戦術と一致するプレースタイルの人数": "Players whose style matches the best tactic",
  "監督の最も高い戦術適性に対応するプレースタイルの先発人数（対応表は暫定）": "Starters with a playing style matching the manager's best tactic (provisional mapping)",
  "公式の補正量で補正": "Adjusted by the official bonus",
  "公式の補正量は未確認のため計算しない": "Not calculated because the official bonus is unconfirmed",
  "監督の戦術適性": "Manager's tactical proficiency",
  "戦術ごとの公式の補正量（未確認）": "Official bonus per tactic (unconfirmed)",
  "暫定の対応表（PROVISIONAL_TACTIC_STYLES）による一致数。公式の根拠はない": "Matches by the provisional mapping (PROVISIONAL_TACTIC_STYLES). No official basis",
  "プレースタイルが不明な先発がいる": "Some starters' playing styles are unknown",
  "フォーメーション適合": "Formation fit",
  "本職の人数": "Players in their natural position",
  "登録ポジションと配置ポジションが一致する先発の人数": "Starters whose placement matches their registered position",
  "適性の段階の重み付き": "Weighted by suitability level",
  "本職 1・近いポジション 0.5・適性外 0 の平均（重み 0.5 は暫定）": "Average of natural 1, nearby position 0.5, off-position 0 (the 0.5 weight is provisional)",
  "配置ポジションへの適性が確認できない": "Suitability for the placement cannot be confirmed",
  "副ポジションの適性の段階（一部しか無い）": "Secondary-position suitability levels (only partly available)",
  "先発 GK がいない": "No starting GK",
  "GK 能力の平均": "GK ability average",
  "GK 専用 5 能力の平均（フィールドの能力は含めない）": "Average of the 5 GK-only abilities (outfield abilities excluded)",
  "GK 能力の最小値": "Lowest GK ability",
  "最も低い GK 能力（弱点の大きさとして使えるかは比較で判断）": "Lowest GK ability (whether it indicates a weakness is judged by comparison)",
  "F-071 の GK 能力分布での位置（未接続）": "Position in the F-071 GK ability distribution (not connected)",
  "GK のカードを解決できない": "The GK's card could not be resolved",
  "空中戦（身長の補正）": "Aerial (height adjustment)",
  "補正なし（現状）": "No adjustment (current)",
  "ヘディング・ジャンプ・フィジカルコンタクトの平均（既存の空中戦と同じ能力集合）": "Average of Heading, Jumping and Physical Contact (same set as the existing Aerial)",
  "身長の段階で加点": "Height-based bonus",
  "190cm 以上 +3・185 以上 +2・180 以上 +1・175 未満 −1（公式の根拠なし）": "190 cm+ +3, 185+ +2, 180+ +1, under 175 −1 (no official basis)",
  "身長が空中戦に与える公式の影響（根拠なし）": "Official effect of height on aerial ability (no basis)",
  "身長が分からない選手がいる（B は計算しない）": "Some players' heights are unknown (B is not calculated)",
  "空中戦（ポジション・利き足の補正）": "Aerial (position and preferred-foot adjustment)",
  "先発フィールドプレーヤーの空中戦の能力の単純平均（空中戦（身長の補正）の A と同じ値）": "Simple average of starting outfield players' aerial abilities (same value as A in Aerial (height adjustment))",
  "ポジションの重み付き": "Position-weighted",
  "CB・CF の重み 1、その他 0.5 の加重平均（重みは暫定）": "Weighted average with CB and CF at 1 and others at 0.5 (provisional weights)",
  "利き足の補正": "Preferred-foot adjustment",
  "利き足と空中戦の関係に公式の根拠が無いため計算しない": "Not calculated because there is no official basis for preferred foot and aerial ability",
  "空中戦の比重が大きい配置で空中戦の能力が 70 未満": "Aerial ability under 70 in an aerial-heavy placement",
  "利き足と空中戦の公式の関係（根拠なし）": "Official relation between preferred foot and aerial ability (no basis)",
  "利き足が分からない選手がいる": "Some players' preferred feet are unknown",
  "なし": "None",
};

type Rule = [RegExp, (m: RegExpMatchArray) => string];
const PATTERNS: Rule[] = [
  [/^ベンチ (\d+) 人$/, (m) => `Bench ${m[1]}`],
  [/^(.+): 先発 (\d+) 人・控え (\d+) 人$/, (m) => `${m[1]}: ${m[2]} starters, ${m[3]} substitutes`],
  [/^(.+) の控えを 1 人加えると、A は (.+) になる$/, (m) => `Adding one ${m[1]} substitute makes A ${m[2]}`],
  [/^左サイド (\d+) 人・右サイド (\d+) 人（中央 (\d+) 人）$/, (m) => `Left ${m[1]}, right ${m[2]} (center ${m[3]})`],
  [/^(左|右)サイド$/, (m) => `${SIDE[m[1]][0].toUpperCase()}${SIDE[m[1]].slice(1)} side`],
  [/^(左|右)サイドの選手$/, (m) => `Players on the ${SIDE[m[1]]} side`],
  [/^(左|右)サイドに 1 人寄せると A は (\d+) 人になる（戦術上の意図があれば変える必要はない）$/, (m) => `Moving one player to the ${SIDE[m[1]]} side makes A ${m[2]} (no need to change if it is a tactical choice)`],
  [/^(.+): (\d+) 人（先発 (\d+)）$/, (m) => `${m[1]}: ${m[2]} (starters ${m[3]})`],
  [/^プレースタイル (.+) が重複$/, (m) => `Playing style ${m[1]} is shared`],
  [/^監督の最も高い戦術適性: (.+)（(.+)）$/, (m) => `Manager's best tactic: ${m[1]} (${m[2]})`],
  [/^対応するとみなすプレースタイル（暫定）: (.+)$/, (m) => `Playing styles treated as matching (provisional): ${m[1] === "なし" ? "None" : m[1]}`],
  [/^(.+) が (.+) と一致（暫定）$/, (m) => `${m[1]} matches ${m[2]} (provisional)`],
  [/^本職 (\d+) 人・近いポジション (\d+) 人・適性外 (\d+) 人（配置 (\d+)\/(\d+)）$/, (m) => `Natural ${m[1]}, nearby ${m[2]}, off-position ${m[3]} (placed ${m[4]}/${m[5]})`],
  [/^適性外の (\d+) 人を本職の選手に替えると A は (\d+) 人になる$/, (m) => `Replacing the ${m[1]} off-position players with natural players makes A ${m[2]}`],
  [/^先発 GK: (.+)$/, (m) => `Starting GK: ${m[1]}`],
  [/^最も低い GK 能力: (.+)$/, (m) => `Lowest GK ability: ${stat(m[1])}`],
  [/^身長が分かる先発 (\d+)\/(\d+) 人$/, (m) => `Starters with known height: ${m[1]}/${m[2]}`],
  [/^(.+) で身長 (\d+)cm$/, (m) => `${m[1]}, height ${m[2]} cm`],
  [/^空中戦の比重が大きいとみなす配置（CB・CF）: (\d+) 人$/, (m) => `Aerial-heavy placements (CB, CF): ${m[1]}`],
  [/^利き足が分かる先発 (\d+)\/(\d+) 人$/, (m) => `Starters with known preferred foot: ${m[1]}/${m[2]}`],
];

const JP = /[぀-ヿ一-龯]/;

/** 表示用: 日本語画面ではそのまま、英語画面では英語。対応表にない文は汎用の英語（元データの値だけなら、そのまま）。 */
export function localizePerspectiveText(text: string, locale: Locale): string {
  if (locale === "ja" || !JP.test(text)) return text;
  if (text in FIXED_EN) return FIXED_EN[text];
  if (STAT_EN_BY_JA[text]) return STAT_EN_BY_JA[text];
  for (const [re, f] of PATTERNS) {
    const m = text.match(re);
    if (m) return f(m);
  }
  // 選手名だけ（元データの固有名詞）は残す。文（句読点・空白を含む）は汎用の英語。
  if (!/[。、：:（）]/.test(text)) return text;
  return "(Details are available in Japanese only.)";
}
