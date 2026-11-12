import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 sourceRatings（開発用の外部ソース・next dev だけで読み込む・2026-11-04）。 */
const sourceRatings: Dictionary["sourceRatings"] = {
  tab: "外部ソース（開発用）",
  heading: "外部ソースのデータ（開発用・このPCだけ）",
  noteTemplate: "このPCのクローラーが集めた参考データです（生成: {time}）。公開のビルドには含まれず、診断・Tier などの計算にも使いません。",
  loading: "外部ソースのデータを読み込み中…",
  off: "外部ソースのデータは、このPCで localhost から開いたときだけ表示します。",
  missing: "受け渡しファイルがありません。クローラーの書き出しを確認してください。",
  invalid: "受け渡しファイルの形が想定と違うため表示できません。クローラーと画面の版をそろえてください。",
  noMatch: "このカードに対応する外部ソースのデータは見つかりませんでした。",
  badgeTemplate: "ソース{source}: {rating}",
  badgeUncertainTitle: "名前・総合値での対応づけです（同名・同総合値の別のカードの可能性があります）",
  sourceLabelTemplate: "ソース{source}",
  matchCardId: "カード番号で一致",
  matchStats: "26 能力値がすべて一致（同じ名前のカードの中でこの 1 枚だけ）",
  matchTypeLevelOvr: "カード種別・Lv 上限・総合値が一致（手元のカードデータの中でこの 1 枚だけ）",
  matchStatsNear: "カード種別・Lv 上限が同じカードの中で、26 能力値のほとんどが一致するのはこの 1 枚だけ（有力）",
  matchCrossSource: "同じ条件のカードが複数ある中で、他のソースが特定したカードと一致（有力）",
  matchSkills: "同じ条件のカードが複数ある中で、ソースのスキルをすべて持つのはこの 1 枚だけ（有力）",
  matchCandidateTemplate: "同じ条件のカードが {count} 枚あり、どのカードのデータかは確定できません。",
  matchCardIdConflict: "カード番号は同じですが、総合値か Lv 上限がこのカードと違います（番号の誤りや、データの時期の違いの可能性があります）",
  matchNameOvrConfirmed: "名前・総合値で一致（同名・同総合値のカードはこの 1 枚だけ）",
  matchNameOvrAmbiguousTemplate: "名前・総合値で一致。ただし同名・同総合値のカードが {count} 枚あるため、どのカードのデータかは確定できません。",
  matchNameOvrUnknown: "名前・総合値で一致（同名・同総合値のカードの枚数を確かめられなかったため、確定していません）",
  matchSamePerson: "カード番号から同じ選手の別のカードと判定",
  matchNameOnly: "名前だけが一致（別のカード向けの可能性があります）",
  otherCardsHeadingTemplate: "同じ選手の別のカード向けのデータ（参考・{count}）",
  tierLabel: "Tier・順位",
  tableLabel: "掲載表",
  positionLabel: "ポジション",
  subPositionsLabel: "サブポジション",
  teamLabel: "所属・国籍",
  playStyleLabel: "プレースタイル",
  cardIdLabel: "カード番号",
  fetchedLabel: "取得",
  skillsHeadingTemplate: "スキル（{count}）",
  skillNotOnCard: "このカードに無い",
  statsHeading: "能力値（26 項目）",
  statMatchTemplate: "このカードと一致 {matched} / {total}",
  statDiffNote: "差がある項目を強調しています。ソースの能力値はカードの基本値と基準が違うことがあり、レベル・版・取得時期の違いでも差が出ます。",
  statSourceColumn: "ソース",
  statCardColumn: "このカード",
  extraHeading: "ブースター・その他の項目",
};

registerJaNamespace("sourceRatings", sourceRatings);

export default sourceRatings;
