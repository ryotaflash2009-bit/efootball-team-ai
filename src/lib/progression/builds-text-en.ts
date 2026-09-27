import type { Locale } from "@/lib/i18n/locale";
import { BUILD_STORAGE_ERROR_EN } from "./build-storage-errors";
import { categoryName } from "./ability-editor-labels";
import { GROUP_LABEL_JA } from "@/lib/world/stat-labels";

/**
 * My Builds・ビルド分析（/build-inventory）の各ライブラリが返す日本語（エラー・規則ラベル・重複の説明・参照の説明・
 * インポートのエラー）の英語表示。ライブラリの返す値（契約）は変えず、表示するときだけ英語にする。
 * 漏れは builds-text-en.test.ts が対象ファイルの日本語リテラルを読み取って検出する。
 */
const FIXED_EN: Record<string, string> = {
  // my-builds.ts
  "現行規則": "Current rules",
  "旧規則": "Old rules",
  "規則不明": "Unknown rules",
  "指定あり": "Set",
  "名前が不正です": "The name is invalid",
  "改行は使えません": "Line breaks are not allowed",
  "ビルド名を入力してください（1〜60文字）": "Enter a build name (1–60 characters)",
  "ビルド名は60文字までです": "Build names can be up to 60 characters",
  "ベンチ": "Bench",
  "先発": "Starter",
  "このブラウザでは保存できません（localStorage 不可）": "This browser cannot save (localStorage unavailable)",
  "カード ID が不正です": "The card ID is invalid",
  "ビルド ID が不正です": "The build ID is invalid",
  "このカードは My Team に登録されていません": "This card is not in My Team",
  "別のタブでデータが変更されました。再読込してください。": "The data was changed in another tab. Please reload.",
  "対象の保存ビルドが見つかりません（削除された可能性があります）": "The saved build could not be found (it may have been deleted)",
  "お気に入りビルドの状態が変更されています。再読込してください。": "The favourite build has changed. Please reload.",
  "保存ビルドが別のタブで削除されました。再読込してください。": "The saved build was deleted in another tab. Please reload.",
  "このカードは既に My Team へ登録されています。再読込してください。": "This card is already in My Team. Please reload.",
  "所有状態が不正です": "The ownership status is invalid",
  "使用状態が不正です": "The usage status is invalid",
  "既に解除されています。再読込してください。": "It has already been cleared. Please reload.",
  "設定が別のタブで変更されています。再読込してください。": "The setting was changed in another tab. Please reload.",
  "対象の枠が見つかりません（別のタブで変更された可能性があります）。再読込してください。": "The slot could not be found (it may have been changed in another tab). Please reload.",
  "枠のカードが別のタブで変更されています。パネルを開き直してください。": "The card in this slot was changed in another tab. Please reopen the panel.",
  "対象の保存ビルドが見つかりません（削除された可能性があります）。再読込してください。": "The saved build could not be found (it may have been deleted). Please reload.",
  // build-duplicate-review.ts
  "保存データの検証に失敗（スキーマ不一致）": "Saved data failed validation (schema mismatch)",
  "規則バージョンが不明（rulesVersion が空）で同一性を安全に判定できません": "The rules version is unknown (empty rulesVersion), so sameness cannot be judged safely",
  "配分が 1 カテゴリだけ異なる": "Allocation differs in one category only",
  "選手ブースター試算 / Power of Many 指定だけが異なる": "Only the player booster trial / Power of Many setting differs",
  "育成配分": "Progression allocation",
  "選手ブースター試算": "Player booster trial",
  "Power of Many 指定": "Power of Many setting",
  "ビルド名": "Build name",
  "作成日時": "Created",
  "更新日時": "Updated",
  "保存時の推定OVR": "Est. OVR when saved",
  "計算モード": "Calculation mode",
  "未指定": "Not set",
  "未配分": "Not allocated",
  // build-inventory.ts
  "My Team の選択中ビルド": "My Team selected build",
  "My Team のお気に入りビルド": "My Team favourite build",
  "スカッド（先発）": "Squad (starter)",
  "スカッド（ベンチ）": "Squad (bench)",
  // build-import.ts
  "ファイルが空です。": "The file is empty.",
  "JSON として読み取れません。正式なエクスポートファイルを選んでください。": "It cannot be read as JSON. Please choose an official export file.",
  "エクスポートファイルの形式ではありません（トップレベルがオブジェクトではありません）。": "This is not an export file (the top level is not an object).",
  "安全でないキーを含むため読み込めません。": "It cannot be imported because it contains unsafe keys.",
  "未知の項目を含むため読み込めません。正式なエクスポートファイルを選んでください。": "It cannot be imported because it contains unknown fields. Please choose an official export file.",
  "このアプリの保存ビルドエクスポートファイルではありません。": "This is not a saved-build export file from this app.",
  "formatVersion の形式が不正です。": "The formatVersion is invalid.",
  "exportedAt が妥当な ISO 8601 日時ではありません。": "exportedAt is not a valid ISO 8601 date-time.",
  "itemCount が非負整数ではありません。": "itemCount is not a non-negative integer.",
  "builds が配列ではありません。": "builds is not an array.",
  "itemCount と builds の件数が一致しません。": "itemCount does not match the number of builds.",
  "ファイルまたはビルド件数が大きすぎます。": "The file or the number of builds is too large.",
  "JSON として読み取れません。": "It cannot be read as JSON.",
  "エクスポートファイルの構造ではありません。": "This does not have the structure of an export file.",
  "未知または安全でない項目を含むため読み込めません。": "It cannot be imported because it contains unknown or unsafe fields.",
  "未対応の formatVersion です。アプリの更新が必要です。": "Unsupported formatVersion. The app needs an update.",
  "exportedAt の日時が不正です。": "The exportedAt date-time is invalid.",
  "itemCount が不正です。": "itemCount is invalid.",
  "itemCount と実際の件数が一致しません。": "itemCount does not match the actual count.",
  "ファイルを読み込めません。": "The file cannot be read.",
};

type Rule = [RegExp, (m: RegExpMatchArray, locale: Locale) => string];
const L = (t: string, l: Locale) => localizeBuildsText(t, l);
/** 日本語のカテゴリ表示名（GROUP_LABEL_JA）→ 英語名。 */
const GROUP_BY_JA = new Map(Object.entries(GROUP_LABEL_JA).map(([id, ja]) => [ja, id]));
const groupEn = (ja: string, l: Locale) => (GROUP_BY_JA.has(ja) ? categoryName(GROUP_BY_JA.get(ja)!, l) : L(ja, l));

const PATTERNS: Rule[] = [
  [/^(.*) のコピー$/, (m) => `${m[1]} copy`],
  [/^先発（(.*)）$/, (m) => `Starter (${m[1]})`],
  [/^ベンチ (\d+)$/, (m) => `Bench ${m[1]}`],
  [/^指定あり（(.*)）$/, (m) => `Set (${m[1]})`],
  [/^配分: (.*)（(.*) → (.*)）$/, (m, l) => `Allocation: ${groupEn(m[1], l)} (${L(m[2], l)} → ${L(m[3], l)})`],
  [/^選手ブースター試算: (.*) → (.*)$/, (m, l) => `Player booster trial: ${L(m[1], l)} → ${L(m[2], l)}`],
  [/^(.*) が、存在しない保存ビルド（buildId (.*)）を参照しています。$/, (m, l) => `${L(m[1], l)} refers to a saved build that does not exist (buildId ${m[2]}).`],
  [/^(.*) が参照する保存ビルドの worldCardId（(.*)）が、参照元カード（(.*)）と一致しません。$/, (m, l) => `The worldCardId (${m[2]}) of the saved build referenced by ${L(m[1], l)} does not match the referencing card (${m[3]}).`],
  [/^(.*) が保持する保存ビルド ID（(.*)）が不正な形式です。$/, (m, l) => `The saved build ID (${m[2]}) held by ${L(m[1], l)} is malformed.`],
  [/^(.*) の参照を安全に分類できません（参照元 worldCardId (.*)）。$/, (m, l) => `The reference from ${L(m[1], l)} cannot be classified safely (referencing worldCardId ${m[2]}).`],
  [/^(.*): 不正な状態のため既定\(通常\)へ戻す$/, (m) => `${m[1]}: invalid state, reset to the default (normal)`],
  [/^(.*): 未知の能力領域IDのため無視$/, (m) => `${m[1]}: unknown ability area ID, ignored`],
  [/^freeText: (\d+)文字を超えたため切り詰め$/, (m) => `freeText: truncated to ${m[1]} characters`],
  [/^ファイルが大きすぎます（上限 (\d+)MB）。$/, (m) => `The file is too large (limit ${m[1]} MB).`],
  [/^未対応の formatVersion（(.*)）です。アプリの更新が必要です。将来の形式を現在の形式として読み込むことはしません。$/, (m) => `Unsupported formatVersion (${m[1]}). The app needs an update; a future format is never read as the current one.`],
  [/^ビルド件数が多すぎます（上限 (\d+) 件）。$/, (m) => `Too many builds (limit ${m[1]}).`],
];

const JP = /[぀-ヿ一-龯]/;

/** 表示用: 日本語画面ではそのまま。英語画面では英語（未知の日本語は出さずに汎用の英語）。 */
export function localizeBuildsText(text: string, locale: Locale): string {
  if (locale === "ja" || !JP.test(text)) return text;
  const fixed = FIXED_EN[text] ?? BUILD_STORAGE_ERROR_EN[text];
  if (fixed) return fixed;
  if (GROUP_BY_JA.has(text)) return categoryName(GROUP_BY_JA.get(text)!, locale);
  for (const [re, f] of PATTERNS) {
    const m = text.match(re);
    if (m) return f(m, locale);
  }
  return "(Details are available in Japanese only.)";
}
