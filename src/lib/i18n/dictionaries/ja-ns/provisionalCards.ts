import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 provisionalCards（暫定のカード・2026-10-15）。 */
const provisionalCards: Dictionary["provisionalCards"] = {
  badge: "暫定",
  badgeTitle: "新しいカード（正式なデータの反映前の暫定の値）",
  noticeTitle: "新しいカード（暫定のデータ）",
  noticeBody: "主の取得元にまだ載っていないため、別のデータベースの値で先に表示しています。能力値・スキル・基本の OVR は確認済みの方法で取り込んでいますが、日本語名・画像・ブースター・一部の新しいスキルは欠けることがあります。正式なデータが届くと自動で置き換わります。",
  maxLevelUnknown: "最大レベルは確認中のため、育成の計算はまだ使えません。",
  maxLevelFromUsers: "最大レベルは取得元の利用者の投稿による値です（正式なデータが届くと置き換わります）。",
  sourceLabel: "データの取得元:",
  newCardsPageTitle: "新しいカード（暫定）",
  newCardsIntro: "主の取得元にまだ載っていない新しいカードです。正式なデータが届くと通常の選手一覧へ移ります。",
  newCardsEmpty: "いまは暫定のカードはありません（すべて正式なデータです）。",
  newCardsLinkTemplate: "新しいカード（暫定）{count} 枚を見る",
};

registerJaNamespace("provisionalCards", provisionalCards);
export default provisionalCards;
