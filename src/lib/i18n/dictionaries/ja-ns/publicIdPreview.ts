import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 publicIdPreview（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const publicIdPreview: Dictionary["publicIdPreview"] = {
  pageTitle: "公開 ID の設定（試作）",
  pageDescription: "公開 ID と表示名の規則を確かめる試作です。保存・送信はしません。",
  localOnlyBanner: "試作: この画面の入力はどこにも保存・送信されません。公開プロフィールは安全機能の確認と本人の承認の後に提供します。",
  publicIdLabel: "公開 ID",
  publicIdHint: "英小文字で始まる、英小文字・数字・_ の 3〜20 文字。URL に使います。メールアドレスや本名は使わないでください。",
  displayNameLabel: "表示名",
  displayNameHint: "1〜20 文字。本名・学校名・連絡先は書かないでください。",
  previewUrl: "URL の例",
  ok: "形式は使えます（ほかの人との重複は公開時に確認）",
  visibilityLabel: "公開範囲",
  visibilityPrivateOnly: "非公開（現在はこれだけ選べます）",
  changeRule: "公開 ID の変更は 30 日に 1 回です。",
  rulesVersion: "規則の版",
  problem_empty: "入力してください",
  problem_too_short: "3 文字以上にしてください",
  problem_too_long: "20 文字以内にしてください",
  problem_invalid_chars: "英小文字・数字・_ だけを使ってください",
  problem_must_start_with_letter: "英小文字で始めてください",
  problem_consecutive_underscores: "_ を続けて使えません",
  problem_edge_underscore: "_ で終われません",
  problem_reserved: "この ID は予約されています",
  problem_banned: "運営・公式を連想させる語や不適切な語は使えません",
  problem_personal_info: "メールアドレス・電話番号・URL は使えません",
  problem_control_chars: "見えない文字や制御文字は使えません",
  };

registerJaNamespace("publicIdPreview", publicIdPreview);

export default publicIdPreview;
