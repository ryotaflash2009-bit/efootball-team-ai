/**
 * 診断結果カードのPNG画像化に使う、安全な最小データへの変換とファイル名生成。
 *
 * - BuildDiagnosisCardModel(既存の確定済み分析結果を合成した表示モデル)から、画像へ載せてよい
 *   情報だけを抽出した `BuildDiagnosisImageContent`(完成文字列のみ・内部IDなし)を保持する。
 *   実際の文字列解決(辞書・abilityLabel・groupDisplayName・intentFindingText等)は、既存の
 *   ja/en辞書とラベル関数を持つ呼び出し側(BuildAnalysisPanel.tsx)が行う(このファイルはDOM・
 *   canvas・辞書のいずれにも依存しない純関数層 = squad-diagnosis-share.ts と同じ分離方針)。
 * - worldCardId・buildId・presetId・abilityId・reasonCode等は一切保持しない。
 * - 同じ入力からは常に同じ結果を返す(Math.random・現在日時分岐なし。ファイル名も日時を含めない)。
 */

export const BUILD_DIAGNOSIS_SHARE_SERVICE_NAME = "eFootball Team AI";

export type ImageOrientation = "portrait" | "landscape";
export type ImageMode = "normal" | "harsh";

export interface ImageAchievementItem {
  /** 既存abilityLabelで解決済みの能力名。 */
  label: string;
  /** 符号付き上昇量の表示済み文字列(例: "+10")。 */
  valueText: string;
}

export interface ImageComparisonContent {
  targetName: string;
  purposeClosenessLabel: string;
  purposeClosenessValue: string;
  differentiationLabel: string;
  differentiationValue: string;
  /** 主な差(最大1件)。ない場合はnull。 */
  majorDiffText: string | null;
  /** 比較不能・データ不足時の理由文(この場合は上記の判定系フィールドは使わない)。 */
  notComparableText: string | null;
}

/**
 * PNGへ載せる、完成済み文字列だけの安全なデータ(内部ID・自由記述・未確定値を一切含まない)。
 * `BuildDiagnosisCardModel` と呼び出し時の言語・通常/辛口モードから、呼び出し側が組み立てる。
 */
export interface BuildDiagnosisImageContent {
  serviceName: string;
  modeLabel: string;
  /** 選手名を安全に解決できなかった場合はnull(その場合、選手名欄は省略する)。 */
  playerName: string | null;
  buildName: string;
  positionsText: string | null;
  primaryGoalLabel: string;
  subGoalLabels: string[];
  alignmentLabel: string;
  headlineText: string;
  achievementItems: ImageAchievementItem[];
  noAchievementsText: string | null;
  concernLabel: string;
  concernText: string;
  improvementLabel: string;
  improvementText: string;
  preserveLabel: string | null;
  preserveText: string | null;
  comparison: ImageComparisonContent | null;
  disclaimerTexts: string[];
  footerText: string;
}

/**
 * `resolvePlayerDisplayName` の既存フォールバック("カード {id}" / "Card {id}")に一致する場合、
 * PNGでは内部worldCardIdの数値表示を許可しないため null を返す(呼び出し側は選手名欄を省略するか、
 * 「選手名を確認できません」を表示する)。
 */
export function safePlayerNameForImage(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  if (/^カード\s/.test(trimmed) || /^Card\s/.test(trimmed)) return null;
  return trimmed;
}

/**
 * ファイル名に使えない文字(Windows/macOS/Linux共通)。squad-diagnosis-share.tsの文字集合に加え、
 * ピリオド(相対パス表記 "..") も常に置換対象へ含める(先頭・末尾に限らず、途中の "../" 的な
 * 並びも安全側で潰すため)。
 */
const UNSAFE_FILENAME_CHARS_RE = /[\\/:*?"<>| .-]/g;

/** 文字列をファイル名の1断片として安全化する(不明瞭な文字は`-`へ、連続ハイフン統合、長さ制限)。 */
export function sanitizeFileNameFragment(value: string, maxLength = 30): string {
  const replaced = value
    .replace(UNSAFE_FILENAME_CHARS_RE, "-")
    .replace(/[\s_]+/g, "-")
    .trim()
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-")
    .trim();
  const truncated = replaced.slice(0, maxLength).replace(/-+$/, "");
  return truncated.length > 0 ? truncated.toLowerCase() : "build";
}

/**
 * `efootball-team-ai-<選手>-<ビルド>-<目的>-<normal|harsh>-<portrait|landscape>.png` 形式の
 * ファイル名を組み立てる(内部ID・自由記述・生成日時は含めない=同じ入力から常に同じ名前)。
 */
export function buildDiagnosisImageFileName(opts: {
  playerName: string | null;
  buildName: string;
  goalLabel: string;
  mode: ImageMode;
  orientation: ImageOrientation;
}): string {
  const playerSlug = sanitizeFileNameFragment(opts.playerName ?? "player");
  const buildSlug = sanitizeFileNameFragment(opts.buildName);
  const goalSlug = sanitizeFileNameFragment(opts.goalLabel, 24);
  return `efootball-team-ai-${playerSlug}-${buildSlug}-${goalSlug}-${opts.mode}-${opts.orientation}.png`;
}
