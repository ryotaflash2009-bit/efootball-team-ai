import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * 現行実装で確認した機能一覧(公開向けページ表示用)。
 *
 * - ここに載せるのは「実際に動作することを確認した機能」だけ。未実装の機能を
 *   利用可能であるかのように書かない(タスクの明示的な要求)。
 * - 表示名はすべて ja/en 辞書キー経由で解決する(このファイルへ日本語・英語の生文字列を書かない)。
 * - `/about` と `/release-readiness` の両方から再利用し、二重管理を避ける。
 */

type AboutKey = keyof Dictionary["about"];

export const AVAILABLE_FEATURE_KEYS: AboutKey[] = [
  "availablePlayerBrowsing",
  "availableProgressionCalc",
  "availableMyTeam",
  "availableSavedBuilds",
  "availableBuildAnalysis",
  "availablePresets",
  "availableNormalHarshMode",
  "availableCardCompare",
  "availableDiagnosisCard",
  "availablePngExport",
  "availableSavedSquads",
  "availableSquadDiagnosis",
  "availableBestXi",
  "availableJsonBackup",
];

export const BETA_FEATURE_KEYS: AboutKey[] = [
  "betaBestXiDedupLimit",
  "betaBestXiSubPositionLimit",
  "betaBestXiPoolScopeLimit",
];

export const NOT_PROVIDED_FEATURE_KEYS: AboutKey[] = [
  "notProvidedAccount",
  "notProvidedSync",
  "notProvidedCloudBackup",
  "notProvidedFriends",
  "notProvidedRanking",
  "notProvidedBilling",
  "notProvidedPro",
  "notProvidedNativeApp",
  "notProvidedVoiceChat",
  "notProvidedGenerativeAi",
];
