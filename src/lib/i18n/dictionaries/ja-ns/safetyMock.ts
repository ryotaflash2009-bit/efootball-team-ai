import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 safetyMock（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const safetyMock: Dictionary["safetyMock"] = {
  heading: "安全機能の試作（架空のサンプル）",
  fictionalNote: "下のユーザーと投稿は架空のサンプルです。通報・ブロック・ミュートはこの端末の中だけで動き、誰にも送られません。",
  ownLabel: "あなた（この端末）",
  sampleUser: "サンプルユーザー",
  sample1: "4-2-1-3 で守備が安定しました。",
  sample2: "今週のガチャの結果です。",
  sample3: "（管理者が非表示にした投稿）",
  sample4: "自分のサンプル投稿です。",
  hidden_hidden_deleted: "削除された投稿です。",
  hidden_hidden_by_admin: "運営により非表示になっています。",
  hidden_hidden_blocked: "ブロック中のユーザーの投稿は表示しません。",
  hidden_hidden_muted: "ミュート中のユーザーの投稿は表示しません。",
  reportButton: "通報",
  block: "ブロック",
  unblock: "ブロックを解除",
  mute: "ミュート",
  unmute: "ミュートを解除",
  reasonLabel: "理由",
  reason_spam: "スパム・宣伝",
  reason_harassment: "嫌がらせ・攻撃",
  reason_personal_info: "個人情報",
  reason_impersonation: "なりすまし",
  reason_inappropriate_image: "不適切な画像",
  reason_rights_violation: "権利の侵害",
  reason_minor_safety: "未成年の安全",
  reason_other: "その他",
  noteLabel: "補足（任意・500 文字まで）",
  submitReport: "通報する",
  cancel: "キャンセル",
  myReports: "自分の通報",
  status_open: "受付",
  status_reviewing: "確認中",
  status_actioned: "対応済み",
  status_dismissed: "対応なし",
  status_withdrawn: "取り下げ",
  withdraw: "取り下げる",
  reportDone: "通報を受け付けました（試作のため、この端末にだけ記録しています）。",
  reportOwn: "自分の投稿は通報できません。消したいときは削除してください。",
  reportDuplicate: "この投稿は通報済みです。",
  reportRateLimited: "今日はこれ以上通報できません。",
  reportFailed: "通報できませんでした。",
  relationFailed: "変更できませんでした。",
  };

registerJaNamespace("safetyMock", safetyMock);

export default safetyMock;
