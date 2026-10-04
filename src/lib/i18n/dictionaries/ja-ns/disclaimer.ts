import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 disclaimer（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const disclaimer: Dictionary["disclaimer"] = {
  pageTitle: "免責事項 | TeamAIXI",
  pageDescriptionMeta: "TeamAIXI が非公式サービスであること、データと分析結果の性質についての免責事項です。",
  heading: "免責事項",
  intro: "本サービスをご利用いただく前に、以下の内容をご確認ください。",
  unofficialHeading: "非公式サービスについて",
  unofficialBody: "TeamAIXI は非公式の eFootball™ スカッド分析ツールです。KONAMI および eFootball™ の公式サービスではなく、KONAMI による公認・提携・運営を受けていません。eFootball™ その他の商標・製品名は、それぞれの権利者に帰属します。",
  unofficialBody2: "本サービスは、公式の評価・公式のデータ・ライセンス製品であることや、権利者との提携を名乗りません。",
  rightsHeading: "選手名・カード・クラブ名・データ・画像について",
  rightsBody: "本サービスが表示する選手名・カード情報・監督情報・画像は、第三者が提供する情報源(選手データベースサイト等)を参照しています。これらは本サービスの運営者が作成したものではありません。",
  rightsBody2: "これらのデータ・画像について、再配布を明示的に許諾する契約書やライセンス文書は、正本内で確認できていません(公開前確認事項)。選手名・カード名・クラブ名・リーグ名等に関する権利は、それぞれの権利者に帰属します。",
  rightsContactPointer: "掲載内容の削除・修正等をご希望の権利者の方は、「問い合わせ」ページの権利者向け窓口からご連絡ください。",
  analysisHeading: "分析結果について",
  analysisRuleBased: "現在のBuild Analysis、スカッド診断、AIベスト11は、確認可能な能力値と決定的なルールを使用します。生成AIサービスや外部AI APIへデータを送信しません。",
  analysisNotOfficial: "ゲーム公式の評価・能力値ではありません。",
  analysisNoWinGuarantee: "勝率を保証しません。",
  analysisNoUsageGuarantee: "選手の実際の使用感を保証しません。試合結果を保証しません。",
  analysisMayBeOutdated: "ゲームの更新により、分析結果が古くなる場合があります。",
  analysisDataLimits: "能力値データが不足しているカードや、旧規則で保存されたビルドでは、分析に制限があります。",
  analysisUserDecision: "最終的な育成・編成の判断は、利用者ご自身で行ってください。",
  analysisModeNote: "通常評価と辛口評価は表現の違いであり、計算結果そのものは変えません。",
  bestXiNote: "AIベスト11は、あなたの保存済み候補の中から決定的なルールで選出するものです。",
  bestXiPersonDedup: "同一の実在選手が複数の異なるカードにまたがる場合の重複判定は行っていません(既知の制約)。",
  bestXiPositionData: "副ポジション適性のデータは一部のカードでしか確認できません(既知の制約)。",
  draftNotice: "この免責事項は運営者が作成した版で、法的助言や権利許諾の保証を行うものではありません。専門家によるレビューを推奨しています。データの更新には遅れが生じる場合があり、本サービスの停止によって生じた損失について、運営者は法令上許容される範囲で責任を負いません。",
  };

registerJaNamespace("disclaimer", disclaimer);

export default disclaimer;
