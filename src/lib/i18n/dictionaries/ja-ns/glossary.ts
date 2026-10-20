import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 glossary（用語集・2026-10-20）。 */
const glossary: Dictionary["glossary"] = {
  pageTitle: "用語集",
  heading: "用語集（TeamAIXI での意味）",
  intro: "TeamAIXI の画面に出てくる言葉を、このサイトでの使い方に沿って説明します。ゲーム内の仕様の公式な説明ではありません。",
  tocLabel: "用語の一覧",
  linkLabel: "用語の説明",
  ovrBaseTerm: "基礎 OVR",
  ovrBaseBody: "カードを手に入れたとき（育成の前）の総合値です。取得元（eFootball World）の値をそのまま表示します。",
  ovrMaxTerm: "最大 OVR",
  ovrMaxBody: "レベルを上限まで上げたときの総合値として、取得元が示す値です。新しいカードの比較・パック診断・Tier は、両方のカードにあるときはこの値で比べます。",
  levelCapTerm: "Lv 上限",
  levelCapBody: "そのカードを上げられるレベルの上限です。育成の計算では、この上限までのレベルで振れる育成ポイントを使います。",
  positionTerm: "登録ポジション",
  positionBody: "カードに登録されているポジション（CF・CB など）です。新しいカードの比較・パック診断・Tier は、同じ登録ポジションのカードどうしで比べます。",
  suitabilityTerm: "ポジション適性",
  suitabilityBody: "その枠で使えるかどうかの目安です。AI ベスト11 やスカッドの診断は、本職のポジションを優先し、確かめられない場合はそのことを表示します。",
  styleTerm: "プレースタイル",
  styleBody: "選手の動き方の型（例: Fox in the Box）です。選手の一覧で絞り込みに使え、Link-Up Play の条件の照合にも使います。",
  boosterTerm: "ブースター",
  boosterBody: "能力値を上げる付加効果です。TeamAIXI は、効果をどこまで確かめられているかを分けて表示し、確かめられた効果だけを計算に入れます。",
  managerBoostTerm: "監督の補正",
  managerBoostBody: "選んだ監督のブースターのうち、確かめられた効果だけを能力値に加えたものです。監督を選んでいなければ 0 です。",
  linkUpTerm: "Link-Up Play",
  linkUpBody: "監督ごとの連係の仕組みです。TeamAIXI は先発が発動条件に合うかの照合だけを行い、ゲーム内の効果は未確認のため能力値には反映しません。",
  provisionalTerm: "暫定のカード",
  provisionalBody: "主の取得元にまだ載っていない新しいカードを、ほかの公開情報から作った仮のデータです。正式なデータが届くと自動で置き換わります。最大のレベルが分からないときは推測しません。",
  samePlayerTerm: "同じ選手の別のカード",
  samePlayerBody: "同じ選手でも、時期や種類ごとに別のカードがあります。同じスカッドには 1 枚しか入れられないため、AI ベスト11 やスカッドの提案は同じ選手を 2 枚選びません。",
  tierTerm: "Tier（TeamAIXI の区分）",
  tierBody: "登録ポジションの中での最大 OVR の順位から S・A・B・C に分けた、TeamAIXI の目安です。ゲーム内の強さの評価ではありません。",
};

registerJaNamespace("glossary", glossary);
export default glossary;
