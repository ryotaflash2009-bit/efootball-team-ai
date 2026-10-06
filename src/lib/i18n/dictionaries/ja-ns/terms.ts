import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 terms（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const terms: Dictionary["terms"] = {
  pageTitle: "利用規約 | TeamAIXI",
  pageDescriptionMeta: "非公式の eFootball™ スカッド分析ツール TeamAIXI v1.0 の利用条件です。",
  heading: "利用規約",
  intro: "TeamAIXI v1.0（以下「本サービス」）の利用条件です。最終更新日: 2026年10月4日。本規約は運営者が作成した版で、法律の専門家による確認は完了していません（確認を推奨しています）。",
  draftNotice: "本サービスは無料・ログイン不要で利用できます。投稿・コメント・公開プロフィール・課金の機能は v1.0 では提供していません。",
  section1Heading: "1. 適用",
  section1Body: "本規約は、本サービスの利用に関する条件を定めます。本サービスを利用した時点で、本規約に同意したものとして扱います。",
  section2Heading: "2. サービス内容",
  section2Body: "本サービスは、選手・監督データの閲覧、育成計算、選手比較、スカッド診断、結果の共有などを支援する非公式ツールです。KONAMI および eFootball™ の公式サービスではなく、KONAMI による公認・提携・運営を受けていません。提供する機能は「サービス概要」ページに記載する範囲です。",
  section3Heading: "3. 料金・利用条件",
  section3Body: "本サービスは無料です。課金・広告はありません。アカウント登録は不要で、アカウント機能は v1.0 では一般に提供していません（今後のアップデートで提供予定です）。未成年の方は、保護者の方と一緒にご確認のうえご利用ください。利用者は自己の判断と責任で本サービスを利用するものとします。",
  section4Heading: "4. 禁止事項",
  section4Intro: "本サービスの利用にあたり、次の行為を禁止します。",
  section4ProhibitUnauthorizedAccess: "本サービスへの不正アクセス、またはその試み",
  section4ProhibitVulnerabilityAbuse: "脆弱性を悪用する行為",
  section4ProhibitDataTheft: "他者のデータを不正に取得する行為",
  section4ProhibitRightsInfringement: "他者の知的財産権その他の権利を侵害する行為",
  section4ProhibitExcessiveLoad: "自動化された大量アクセスなど、システムへ過度な負荷を与える行為",
  section4ProhibitMaliciousJsonOrScript: "不正なファイル・データ・スクリプトを読み込ませて本サービスを妨害する行為",
  section4ProhibitMisrepresentAsOfficial: "本サービスを公式・公認のサービスであるかのように誤認させる行為",
  section4ProhibitUrlRedistribution: "本サービスの内容を、運営者の許可なく自らのサービスとして再配布・販売する行為",
  section4ProhibitUnlawfulUse: "法令または公序良俗に反する利用",
  section5Heading: "5. 利用者が保存するデータ",
  section5Body: "My Team・保存ビルド・保存スカッド・診断履歴などのデータは、原則として利用者のブラウザー内に保存されます。データの書き出し・読み込み・削除は「データ管理」ページから行えます。詳細は「プライバシーポリシー」をご確認ください。",
  section6Heading: "6. 分析結果の性質",
  section6Body: "育成計算・Build Analysis・スカッド診断・AIベスト11・パーセンタイル・称号などの結果は、確認できたデータと決定的なルールに基づく参考情報です。ゲーム公式の評価ではなく、絶対的な事実として扱わないでください。誤りや更新の遅れを含む可能性があり、ゲーム内の最終判断や試合結果を保証しません。",
  section7Heading: "7. 知的財産",
  section7Body: "本サービスの実装・デザイン・独自の分析ルールに関する権利は運営者に帰属します。eFootball™ その他の商標・製品名、選手名・カード名・クラブ名などの名称に関する権利は、それぞれの権利者に帰属します。",
  section8Heading: "8. 外部サービス・外部データ",
  section8Body: "本サービスは、第三者が提供する情報をもとにした参照データを表示します。外部のデータ・サイトの正確性・最新性・可用性について、本サービスは保証しません。外部サイトへのリンク先の内容について責任を負いません。利用状況の把握のため、Cookie を使わない Vercel Web Analytics を使用します（詳細はプライバシーポリシー）。",
  section9Heading: "9. サービスの変更・停止",
  section9Body: "運営上・技術上の理由により、予告なく本サービスの内容を変更し、または提供を停止・終了する場合があります。",
  section10Heading: "10. 免責",
  section10Body: "本サービスは現状有姿で提供され、特定の目的への適合性・正確性・継続性を保証しません。本サービスの利用により生じた損害について、運営者は法令上許容される範囲で責任を負いません。",
  section11Heading: "11. 利用の制限",
  section11Body: "禁止事項に該当する行為を確認した場合、本サービスへのアクセスを技術的に制限する場合があります。v1.0 には投稿機能がないため、投稿に関する規定は投稿機能の提供時に追加します。",
  section12Heading: "12. 規約の変更",
  section12Body: "本規約は必要に応じて変更します。重要な変更は本サービス内で分かる形で告知し、最終更新日を更新します。",
  section13Heading: "13. 問い合わせ・準拠法",
  section13Body: "問い合わせは「問い合わせ」ページをご確認ください。準拠法・裁判管轄・正式な事業者名・所在地は、運営者による確認が完了していないため記載していません。確認と専門家レビューの後に追記します。",
  ownerConfirmationNotice: "準拠法・裁判管轄・正式な事業者名・所在地の記載は、運営者による最終確認と専門家レビューの後に追記します。",
  };

registerJaNamespace("terms", terms);

export default terms;
