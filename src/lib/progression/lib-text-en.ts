import type { Locale } from "@/lib/i18n/locale";
import { UNSUPPORTED_RULES_EN } from "./rule-registry-en";

/**
 * 育成計算ライブラリが返す日本語の説明文（注記・理由・警告）の英語表示。
 * ライブラリの返す値（契約）は変えず、表示するときだけ英語にする。
 * 漏れは lib-text-en.test.ts が対象ファイルの日本語リテラルを読み取って検出する。
 */
const FIXED_EN: Record<string, string> = {
  // calculate-player-booster.ts
  "このカードの数値IDは付属ブースター対応表（eFootball World の個別選手ページ由来）に含まれていません。名称を解決できないため能力値へは適用していません。":
    "This card's numeric ID is not in the attached-booster table (from eFootball World player pages). The name cannot be resolved, so it is not applied to abilities.",
  "発動条件付き（内容未確認）": "Conditional (conditions unconfirmed)",
  "B2 ブースターは指定されていません。": "No B2 booster selected.",
  "選択した B2 ブースターは、対象能力の通常の最終値・比較の順位・チーム集計に反映します。":
    "The selected B2 booster is applied to the normal final values of its target abilities, comparison rankings and team totals.",
  "手動試算ブースターは「試算最終値」にのみ反映します（通常の最終値・比較の順位・チーム集計には含めません）。":
    "Manual trial boosters only affect the trial final values (not normal final values, comparison rankings or team totals).",
  "選択した B2 ブースターのうち確認済みの分は通常の最終値へ反映し、未確認の分は「試算最終値」にのみ反映します（通常の最終値・比較の順位・チーム集計には含めません）。":
    "Confirmed parts of the selected B2 boosters are applied to the normal final values; unconfirmed parts only affect the trial final values (not normal final values, comparison rankings or team totals).",
  "このカードに付属する選手ブースターはありません。": "This card has no attached player booster.",
  "スクリーンショットで実測済みの付属ブースターを通常の最終値へ適用しています（厳密モード）。適用の基準は効果内容の証拠で、発動方式（固定型 / Power of Many）は問いません。":
    "Attached boosters measured on screenshots are applied to the normal final values (strict mode). Application is based on evidence of the effect, regardless of activation type (fixed / Power of Many).",
  "効果内容を外部2ソースで照合した付属ブースターを通常の最終値へ適用しています（標準モード）。KONAMI 公式の確定値ではありません。発動方式の証拠が不足するものは、Power of Many（条件型）である具体的証拠がないため固定型と推定して暫定適用しています。":
    "Attached boosters whose effects match in two external sources are applied to the normal final values (standard mode). These are not official KONAMI values. Where the activation type lacks evidence, there is no concrete evidence of Power of Many (conditional), so they are assumed fixed and applied provisionally.",
  "編成条件付き付属ブースターの段階をユーザーが手動指定しています。標準最終値は変えず「条件反映後値」にのみ反映します。アプリが編成人数を自動検証した値ではありません。":
    "You have set the tier of a squad-conditional attached booster manually. It only affects the conditional final values, not the standard final values. The app has not verified your squad count.",
  "付属ブースターの名称は確認できましたが、現在のモードでは通常の最終値へ適用していません（実験モードで試算できます）。":
    "The attached booster's name is confirmed, but it is not applied to the normal final values in the current mode (you can try it in experimental mode).",
  "付属ブースターの数値IDを対応表で解決できませんでした。能力値へは適用していません。":
    "The attached booster's numeric ID could not be resolved from the table. It is not applied to abilities.",
  // conditional-boosters.ts
  "未指定": "Not set",
  "適用なし（+0）": "Not applied (+0)",
  "対象リーグ 1〜13 人": "1–13 players from the league",
  "対象リーグ 1〜13 人相当、対象能力 +1": "1–13 players from the league, target abilities +1",
  "対象リーグ 14〜19 人": "14–19 players from the league",
  "対象リーグ 14〜19 人相当、対象能力 +2": "14–19 players from the league, target abilities +2",
  "対象リーグ 20 人以上": "20+ players from the league",
  "対象リーグ 20 人以上相当、対象能力 +3": "20+ players from the league, target abilities +3",
  "この値はユーザーが自身の Game Plan を確認して指定したものです。アプリが編成人数を自動検証した値ではありません。":
    "You set this value after checking your own Game Plan. The app has not verified your squad count.",
  "Game Plan 依存の可変ブースター（金色）です。現在のアプリでは対象リーグ人数を自動判定できないため、能力値へ未適用です。":
    "A variable booster (gold) that depends on your Game Plan. The app cannot detect the number of players from the league yet, so it is not applied to abilities.",
  // calculate-manager-booster.ts
  "監督は未選択。": "No manager selected.",
  // engine.ts
  "このビルドは旧規則で作成されています。現行規則で再計算すると配分の解釈が変わります。":
    "This build was made with old rules. Recalculating with the current rules changes how the allocation is interpreted.",
  "Total Package の条件段階はユーザーが手動指定した試算値です（アプリが Game Plan の対象リーグ人数を自動検証した値ではありません）。標準最終値・比較の順位・チーム集計には含めていません。":
    "The Total Package tier is a trial value you set manually (the app has not verified the number of league players in your Game Plan). It is not included in standard final values, comparison rankings or team totals.",
  "一部の能力値が99上限に達しています（超過分は無効）。ただし育成・ブースター・監督補正込みの最終上限が99である確証はまだありません（暫定処理）。":
    "Some abilities reached the 99 cap (any excess is ignored). It is not yet confirmed that 99 is the final cap including progression, boosters and manager corrections (provisional handling).",
  "厳密モード: ユーザー保存済みスクリーンショットで実測できた付属ブースターだけを通常の最終値へ適用しています。適用の基準は効果内容の証拠で、発動方式（固定型 / Power of Many）は問いません。":
    "Strict mode: only attached boosters measured on user-saved screenshots are applied to the normal final values. Application is based on evidence of the effect, regardless of activation type (fixed / Power of Many).",
  "標準モード: 効果内容を外部データベース間で照合した高信頼値を含みます。KONAMI 公式の計算結果として確認された値ではありません。発動方式の証拠が不足するブースターは、Power of Many（条件型）である具体的証拠がないため固定型と推定して暫定適用しています（「外部照合済み・固定型推定を含む」）。":
    "Standard mode: includes high-confidence values cross-checked between external databases. These are not confirmed KONAMI calculation results. Boosters lacking activation-type evidence have no concrete evidence of Power of Many (conditional), so they are assumed fixed and applied provisionally (\"cross-checked externally, includes assumed fixed\").",
  "通常の最終値には外部2ソース照合済み（KONAMI 公式未確認）のブースター効果が含まれています。発動方式が固定型と推定されたもの（Power of Many である具体的証拠がないため暫定適用）を含みます。":
    "Normal final values include booster effects cross-checked in two external sources (not confirmed by KONAMI), including ones assumed fixed (applied provisionally because there is no concrete evidence of Power of Many).",
  // card-eligibility.ts
  "TRENDING カード（POTW 等）は育成できません。": "TRENDING cards (POTW etc.) cannot be progressed.",
  "最大レベルが1のため育成ポイントがありません。": "This card has no progression points because its maximum level is 1.",
  // booster-catalog.ts（情報源・証拠・条件の説明）
  "EFScout（外部コミュニティDB）boot.json referenceData.allBoosters の定義のみ":
    "EFScout (external community DB) boot.json referenceData.allBoosters definition only",
  "発動条件付き（KONAMI 公式「The Power of Many」）: このカードの対象リーグ（例: MEIJI YASUDA J1 LEAGUE / Trendyol Süper Lig / Brasileirão など、カードのリーグに対応）の選手を Game Plan に登録した人数で効果が変化する。1〜13 人で全対象能力 +1、14〜19 人で +2、20 人以上で +3。eFootball World の ScoreBar は条件を無視して最大（+3）を表示している。試合／Game Plan 構成に依存する効果のため、静的な育成画面や現状のスカッド機能では評価せず、通常の最終値へは加算しない。":
    "Conditional (KONAMI's \"The Power of Many\"): the effect depends on how many players from this card's league (e.g. MEIJI YASUDA J1 LEAGUE / Trendyol Süper Lig / Brasileirão, matching the card's league) are registered in your Game Plan: 1–13 players give +1 to all target abilities, 14–19 give +2 and 20+ give +3. eFootball World's ScoreBar ignores the condition and shows the maximum (+3). Because the effect depends on the match / Game Plan setup, it is not evaluated on the static progression screen or the current squad features, and it is not added to the normal final values.",
  "eFootball World（外部コミュニティDB）の個別選手ページ: ScoreBar(ブースターON) − RSC baseAbilities(OFF) の差分 と EFScout（外部DB）の定義が一致（別カード2枚以上・delta==level・デュアル加算一致・反例0）。外部2ソースで整合。KONAMI のゲームクライアント画面での確認ではない。":
    "eFootball World (external community DB) player pages: the ScoreBar (booster on) − RSC baseAbilities (off) difference matches the EFScout (external DB) definition (2+ different cards, delta == level, dual additions match, 0 counterexamples). Consistent across two external sources. Not confirmed on the KONAMI game client.",
  "screenshots/スクリーンショット 2026-08-28 020026.png（eFHUB ビルドツール・ユーザー保存）で「ボールキャリー +5」選択時に ドリブル/ボールキープ/スピード/ボディバランス へ緑の +5 を確認。KONAMI のゲームクライアント画面での確認ではない。+ eFootball World ScoreBar 差分 と EFScout 定義も一致。":
    "A user-saved screenshot (eFHUB build tool, 2026-08-28) shows a green +5 on Dribbling / Tight Possession / Speed / Balance when \"Ball-carrying +5\" is selected. Not confirmed on the KONAMI game client. The eFootball World ScoreBar difference and the EFScout definition also match.",
  "screenshots/image.png・image (1).png（eFHUB ビルドツール・ユーザー保存）で「攻撃の起点 +4」選択時に オフェンスセンス/ボールコントロール/グラウンダーパス/キック力 へ緑の +4 を確認。KONAMI のゲームクライアント画面での確認ではない。+ eFootball World ScoreBar 差分 と EFScout 定義も一致。":
    "User-saved screenshots (eFHUB build tool) show a green +4 on Offensive Awareness / Ball Control / Low Pass / Kicking Power when \"Attacking Hub +4\" is selected. Not confirmed on the KONAMI game client. The eFootball World ScoreBar difference and the EFScout definition also match.",
  " ＋ デュアルカード1枚の ScoreBar 差分（検証例が不足）": " + ScoreBar difference on one dual card (not enough verified examples)",
  "効果候補（全26能力へ +level）は eFootball World の ScoreBar 差分 と EFScout 定義で整合。発動条件の内容は KONAMI 公式「The Power of Many」で判明（Game Plan の同一リーグ登録人数で +1/+2/+3）。ただし条件を静的データ・現状のスカッドでは評価できないため通常の最終値へは未適用。":
    "The candidate effect (+level to all 26 abilities) matches the eFootball World ScoreBar difference and the EFScout definition. The condition is known from KONAMI's \"The Power of Many\" (+1/+2/+3 by the number of same-league players in your Game Plan). The condition cannot be evaluated from static data or the current squad, so it is not applied to the normal final values.",
  "（カード付属として未観測）": "(not observed as an attached booster)",
  "ボールキャリー": "Ball-carrying",
  "攻撃の起点": "Attacking Hub",
  "ファンタジスタ": "Fantasista",
};

type Rule = [RegExp, (m: RegExpMatchArray, locale: Locale) => string];

const PATTERNS: Rule[] = [
  [/^監督「(.*)」のブースターを適用しました（対象能力へ \+N・複数ソースで確認済み）。$/, (m) => `Applied manager "${m[1]}" boosters (+N to target abilities, confirmed in multiple sources).`],
  [/^監督「(.*)」の一部ブースターのみ適用（未確認の効果は適用していません）。$/, (m) => `Applied only some of manager "${m[1]}" boosters (unconfirmed effects are not applied).`],
  [/^監督「(.*)」のブースター効果は未確認のため適用していません。$/, (m) => `Manager "${m[1]}" booster effects are unconfirmed, so they are not applied.`],
  [/^ユーザー指定条件: (.*)$/, (m, l) => `User-specified condition: ${localizeLibText(m[1], l)}`],
  [/^配分の補正: (.*)$/, (m, l) => `Allocation adjusted: ${localizeLibText(m[1], l)}`],
  [/^育成ポイントの使いすぎ: (\d+) \/ (\d+)$/, (m) => `Too many progression points used: ${m[1]} / ${m[2]}`],
  [/^(.+): 未知のグループID$/, (m) => `${m[1]}: unknown group ID`],
  [/^(.+): 数値でない \((.*)\)$/, (m) => `${m[1]}: not a number (${m[2]})`],
  [/^(.+): 負数 \((.*)\)$/, (m) => `${m[1]}: negative (${m[2]})`],
  [/^(.+): 小数 \((.*)\)$/, (m) => `${m[1]}: not an integer (${m[2]})`],
  [/^(.+): 異常に大きい \((.*)\)$/, (m) => `${m[1]}: abnormally large (${m[2]})`],
  [/^(.+): 上限まで丸め \((.*) → (.*)\)$/, (m) => `${m[1]}: capped (${m[2]} → ${m[3]})`],
];

const JP = /[぀-ヿ一-龯]/;

/** 表示用: 日本語画面ではそのまま、英語画面では英語（未知の日本語は出さずに汎用の英語）。 */
export function localizeLibText(text: string, locale: Locale): string {
  if (locale === "ja" || !JP.test(text)) return text;
  const fixed = FIXED_EN[text] ?? UNSUPPORTED_RULES_EN[text];
  if (fixed) return fixed;
  for (const [re, f] of PATTERNS) {
    const m = text.match(re);
    if (m) return f(m, locale);
  }
  return "(Details are available in Japanese only.)";
}

export const __FIXED_EN_FOR_TESTS = FIXED_EN;
