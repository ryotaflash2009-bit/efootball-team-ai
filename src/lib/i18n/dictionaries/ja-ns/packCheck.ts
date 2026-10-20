import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 packCheck（パック診断・2026-10-17）。 */
const packCheck: Dictionary["packCheck"] = {
  heading: "パック診断（あなたの My Team と比べる）",
  intro: "引くか迷っているパックのカードを選ぶと、同じポジションで持っている最高のカードと OVR を比べます。パックの中身はあなたが選びます（排出率・コインの効率は公式のデータが無いため出しません）。",
  privacyNote: "比べるのはこの端末の My Team の「所持」だけです。選んだカードはこのページの URL に入り、送信はしません。",
  searchLabel: "パックのカードを検索して追加",
  searchPlaceholder: "選手名（2 文字以上）",
  searchNoResults: "見つかりませんでした。",
  searchError: "検索できませんでした。時間をおいてもう一度お試しください。",
  addButton: "追加",
  removeButton: "外す",
  clearButton: "すべて外す",
  addNewCards: "最近追加されたカード・暫定のカードから選ぶ",
  limitTemplate: "選べるのは {max} 枚までです。",
  emptyPack: "まだカードを選んでいません。",
  summaryTemplate: "{total} 枚のうち、強化 {upgrades} 枚・持っていないポジション {newPositions} 枚・所持済み {alreadyOwned} 枚",
  bestDeltaTemplate: "最も大きい強化: OVR +{delta}",
  verdictUpgrade: "強化",
  verdictNewPosition: "持っていないポジション",
  verdictNoUpgrade: "強化にならない",
  verdictAlreadyOwned: "所持済み",
  verdictUnknown: "比べられない",
  rowUpgradeTemplate: "{basis} {newOvr}（あなたの {ownedName} {ownedOvr} より +{delta}）",
  rowNoUpgradeTemplate: "{basis} {newOvr}（あなたの {ownedName} {ownedOvr} 以下）",
  rowNewPositionTemplate: "{basis} {newOvr}（このポジションのカードをまだ持っていません）",
  samePlayerTemplate: "同じ選手の別のカード（{name}）を所持しています。同じスカッドには 1 枚しか入れられません。",
  noTeam: "My Team に「所持」のカードがまだありません。すべて「持っていないポジション」として出ます。My Team に登録すると、持っているカードと比べられます。",
  openMyTeam: "My Team を開く",
  loading: "読み込み中…",
  fitHeading: "あなたの My Team と比べる",
  fitAlreadyOwned: "このカードは My Team で「所持」になっています。",
  fitOpenPackCheck: "パック診断で他のカードと一緒に見る",
  compareAbilities: "能力を比べる",
};

registerJaNamespace("packCheck", packCheck);
export default packCheck;
