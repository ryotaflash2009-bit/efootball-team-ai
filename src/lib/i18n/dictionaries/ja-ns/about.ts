import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 about（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const about: Dictionary["about"] = {
  pageTitle: "サービス概要 | TeamAIXI",
  pageDescriptionMeta: "TeamAIXI v1.0 で利用できる機能と、v1.0 では提供していない機能の説明です。",
  heading: "サービス概要",
  intro: "TeamAIXI は、選手データの閲覧・育成計算・選手比較・スカッド診断・結果の共有を支援する、非公式の eFootball™ スカッド分析ツールです。TeamAIXI v1.0 は無料・ログイン不要で利用できます。アカウント機能は今後のアップデートで提供予定です。",
  ruleBasedNotice: "「AIベスト11」など「AI」という名称を含む機能も、生成AIではなく、確認可能な能力値と決定的なルールに基づくルールベースの分析です。",
  externalAiNotice: "分析内容を外部AIサービスへ送信することはありません。",
  scopeNotice: "分析は、あなたが保存した候補(My Team・保存ビルド)の中だけで行われます。",
  availableHeading: "利用可能な機能",
  availablePlayerBrowsing: "選手・カード情報の閲覧",
  availableProgressionCalc: "育成計算(26能力値・通常OVR・ポジション別評価)",
  availableMyTeam: "My Team(所有選手の管理)",
  availableSavedBuilds: "保存ビルド(育成配分の保存)",
  availableBuildAnalysis: "Build Analysis(育成方針の分析)",
  availablePresets: "育成目的プリセット(45件・9カテゴリ)",
  availableNormalHarshMode: "通常評価・辛口評価(表現の違いのみで計算結果は同じです)",
  availableCardCompare: "同一カードの複数ビルド比較",
  availableDiagnosisCard: "診断結果カード",
  availablePngExport: "PNG画像として保存",
  availableSavedSquads: "保存スカッド(編成の保存)",
  availableSquadDiagnosis: "スカッド診断",
  availableBestXi: "AIベスト11(保存済み候補からのルールベース選出)",
  availableJsonBackup: "JSONによる保存ビルドのバックアップ(エクスポート・インポート)",
  availableAccountAuth: "ログイン不要ですべての機能を利用可能（アカウント機能は今後のアップデートで提供予定）",
  availableReferenceDataSupabase: "選手・監督データは定期的に自動で更新（安全条件を満たす更新だけを自動で適用し、それ以外は運営者が確認）",
  betaHeading: "既知の制約",
  betaBestXiIntro: "AIベスト11は動作しますが、次の既知の制約があります。",
  betaBestXiDedupLimit: "同一の実在選手が複数の異なるカードにまたがる場合の重複判定は行っていません。",
  betaBestXiSubPositionLimit: "副ポジション適性のデータは一部のカードでしか確認できません。",
  betaBestXiPoolScopeLimit: "選出は、あなたが保存した候補の中だけで行われます(全カードから自動で探すものではありません)。",
  betaMyTeamCloudSave: "データはお使いのブラウザー内に保存されます。別の端末へは「データ管理」の書き出し・読み込みで移せます",
  betaReferenceDataAutoUpdateDryRun: "参照データの更新は 1 時間おきの自動検出に基づくため、ゲーム内の最新の内容より遅れる場合があります",
  notProvidedHeading: "未提供の機能",
  notProvidedSync: "端末間の自動同期",
  notProvidedCloudBackup: "全データの自動クラウドバックアップ(My Team以外のデータの自動保存)",
  notProvidedFriends: "フレンド・ライバル・公開プロフィール",
  notProvidedRanking: "ランキング・利用統計",
  notProvidedBilling: "決済・課金",
  notProvidedPro: "Pro(有料)プラン",
  notProvidedNativeApp: "ネイティブアプリ",
  notProvidedVoiceChat: "投稿・コメント・写真投稿・コミュニティ",
  notProvidedGenerativeAi: "生成AI・外部AI APIとの連携",
  notOfficialNotice: "本サービスは KONAMI および eFootball™ の公式サービスではなく、KONAMI による公認・提携・運営を受けていません。",
  winRateNotice: "分析結果は勝率や試合結果を保証するものではありません。",
  draftNotice: "このページは TeamAIXI v1.0（2026年10月4日）の内容です。機能は今後のアップデートで変わる場合があります。",
  };

registerJaNamespace("about", about);

export default about;
