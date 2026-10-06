import type { Locale } from "@/lib/i18n/locale";
import { localizeLibText } from "@/lib/progression/lib-text-en";
import { localizeSquadCompareText } from "./compare-text-en";
import { generatedOverlay } from "@/lib/i18n/generated-catalog";
import type { DisplayLocale } from "@/lib/i18n/locale-registry";

/**
 * スカッド計算ライブラリ（build-squad.ts・position.ts・link-up.ts・moves.ts）が返す日本語の文（警告・適性・操作の結果）の
 * 英語表示（2026-10-04）。ライブラリの返す値（契約）は変えず、表示するときだけ英語にする。
 * 選手名など元データの固有名詞はそのまま残す（UI の文だけを訳す）。漏れは squad-text-en.test.ts が検出する。
 */
const FIXED_EN: Record<string, string> = {
  // build-squad.ts
  "このスカッドは旧い規則バージョンで保存されています。現行規則で再計算して表示しています。":
    "This squad was saved with an older rules version. It is recalculated and shown with the current rules.",
  "カテゴリ平均・チーム評価は単純計算です（eFootball の公式チームパワー・カテゴリ重みとは異なります）。":
    "Category averages and team ratings are simple calculations (they differ from eFootball's official team strength and category weights).",
  "監督ブースターの適用順序（育成前 / 育成後）は未確認です。": "Whether manager boosters apply before or after progression is unconfirmed.",
  "監督は未選択（managerBoosterDelta = 0）。": "No manager selected (managerBoosterDelta = 0).",
  // position.ts
  "適性未確認": "Suitability unconfirmed",
  "登録ポジションのデータがありません。": "No registered position data.",
  "登録ポジションと一致": "Matches registered position",
  "不適性の可能性": "Possibly unsuited",
  "GK とフィールドプレーヤーの組み合わせです。": "A goalkeeper/outfield mismatch.",
  "適性未確認（近いポジション）": "Suitability unconfirmed (nearby position)",
  "同じ系統のポジションですが、副ポジション適性は未確認です。": "Same position group, but secondary-position suitability is unconfirmed.",
  "副ポジション適性のデータがありません。能力値は下げていません。": "No secondary-position suitability data. Abilities are not reduced.",
  "未配置": "Not placed",
  // link-up.ts
  "発動条件の照合のみ対応。ゲーム内効果は追加検証中です。": "Only activation conditions are checked. In-game effects are still being verified.",
  // moves.ts（操作の結果・解除した役割）
  "キャプテン": "captain",
  "左右CK担当": "corner taker",
  "FK担当": "free-kick taker",
  "PK担当": "penalty taker",
  "Link-Up 中心選手": "Link-Up centerpiece",
  "Link-Up キーマン": "Link-Up key man",
  "先発を入れ替えました": "Swapped starters",
  "選手を移動しました": "Moved the player",
  "先発をベンチへ移動しました": "Moved a starter to the bench",
  "先発とベンチを交代しました": "Swapped a starter with a bench player",
  "ベンチと先発を交代しました": "Swapped a bench player with a starter",
  "ベンチ選手を先発へ移動しました": "Moved a bench player into the starting XI",
  "ベンチの順番を変更しました": "Reordered the bench",
  "配置を左右反転しました": "Mirrored the placement",
  "先発から外しました": "Removed from the starting XI",
  "ベンチから外しました": "Removed from the bench",
  // squad-storage.ts・templates.ts（保存・更新のエラー。既定の名前は保存後は利用者のデータなので表示時には訳さない）
  "新しいスカッド": "New squad",
  "スカッド名を入力してください（1〜50文字）": "Enter a squad name (1–50 characters).",
  "スカッドIDが不正です": "Invalid squad ID.",
  "スカッドの形式が不正です": "Invalid squad format.",
  "この環境ではスカッドを保存できません（localStorage 不可）": "Squads cannot be saved in this environment (localStorage unavailable).",
  "対象のスカッドが見つかりません": "The squad was not found.",
  "この環境ではスカッドを更新できません（localStorage 不可）": "Squads cannot be updated in this environment (localStorage unavailable).",
  "この環境ではスカッドを更新できません": "Squads cannot be updated in this environment.",
  "テンプレートの保存データが壊れていたため空にしました。": "Saved template data was corrupted, so it was cleared.",
  "テンプレート名を入力してください": "Enter a template name.",
  "この環境ではテンプレートを保存できません": "Templates cannot be saved in this environment.",
  "テンプレートが見つかりません": "The template was not found.",
  "この環境ではテンプレートを更新できません": "Templates cannot be updated in this environment.",
};

/** 「キャプテン / FK担当」のような役割の並びを英語にする。 */
function roles(list: string): string {
  return list
    .split(" / ")
    .map((r) => FIXED_EN[r] ?? r)
    .join(" / ");
}

type Rule = [RegExp, (m: RegExpMatchArray) => string];
const PATTERNS: Rule[] = [
  [/^(.+): 保存ビルドが旧規則で作成されています（現行規則で再計算しています。配分の解釈が変わる場合があります）。$/, (m) => `${m[1]}: the saved build uses older rules (recalculated with the current rules; the allocation may be interpreted differently).`],
  [/^(.+): (.+) は不適性の可能性があります（能力値は下げていません）。$/, (m) => `${m[1]}: ${m[2]} may be unsuited (abilities are not reduced).`],
  [/^先発が (.+)\/11 人です。$/, (m) => `${m[1]}/11 starters.`],
  [/^監督「(.*)」の確認済みブースターを全選手へ適用しています。$/, (m) => `Confirmed boosters of manager "${m[1]}" are applied to all players.`],
  [/^監督「(.*)」のブースター効果は未確認のため適用していません（表示のみ）。$/, (m) => `Manager "${m[1]}" booster effects are unconfirmed, so they are not applied (display only).`],
  [/^先発から外れたため (.+) を解除しました。$/, (m) => `Cleared ${roles(m[1])} because the player left the starting XI.`],
  [/^(.+) を解除しました。$/, (m) => `Cleared ${roles(m[1])}.`],
  [/^保存できるスカッドは最大 (.+) 件です$/, (m) => `You can save up to ${m[1]} squads.`],
  [/^(.+) のコピー$/, (m) => `Copy of ${m[1]}`],
  [/^未知の保存バージョン（(.*)）のため空にしました。$/, (m) => `Cleared because of an unknown storage version (${m[1]}).`],
  [/^テンプレートは最大 (.+) 件です$/, (m) => `You can save up to ${m[1]} templates.`],
];

const JP = /[぀-ヿ一-龯]/;
const GENERIC = "(Details are available in Japanese only.)";

/**
 * 表示用: 日本語画面ではそのまま、英語画面では英語。スカッド計算 → スカッド比較 → 育成計算の対応表の順に探し、
 * どれにも無い日本語は出さずに汎用の英語にする。
 */
export function localizeSquadText(text: string, locale: Locale | DisplayLocale): string {
  if (locale === "ja" || !JP.test(text)) return text;
  // ja・en 以外の表示言語: メッセージ ID と言語ごとの書式（generated-catalog.ts）。訳が無ければ文ごと English（入れ子の文も English）。
  // English と同じく、この表に無い文は比較（compare-text-en）・計算ライブラリ（lib-text-en）の表へ回す。
  if (locale !== "en") {
    const own = generatedOverlay("squadText", text, PATTERNS, locale);
    if (own !== null) return own;
    if (FIXED_EN[text] || PATTERNS.some(([re]) => re.test(text))) return localizeSquadText(text, "en");
    const cmpLocal = localizeSquadCompareText(text, locale);
    if (cmpLocal !== GENERIC) return cmpLocal;
    return localizeLibText(text, locale);
  }
  const fixed = FIXED_EN[text];
  if (fixed) return fixed;
  for (const [re, f] of PATTERNS) {
    const m = text.match(re);
    if (m) return f(m);
  }
  const cmp = localizeSquadCompareText(text, locale);
  if (cmp !== GENERIC) return cmp;
  return localizeLibText(text, locale);
}

/** 翻訳の元（scripts の generated の雛形・テストが使う。表示には使わない）。 */
export const GENERATED_SOURCE = { module: "squadText", fixed: FIXED_EN as Record<string, string>, terms: {} as Record<string, Record<string, string>>, patterns: PATTERNS };
