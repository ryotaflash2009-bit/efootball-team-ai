/**
 * eFHUB 個別選手ページ パーサのバージョン。
 * RSC 構造や抽出ロジックを変えたら必ずここを上げる。
 * 全カードレコードにこの値を保存し、再取得・差分判定の基準にする。
 */
export const PARSER_VERSION = "efhub-player-page/2026-08-28.2";

/**
 * これまでに存在したパーサバージョン（互換用）。
 * - .1 : 初版（Phase A / Phase B で取得した17カード）
 * - .2 : playingStyleDefensive（守備プレースタイル）を任意フィールドとして追加
 */
export const KNOWN_PARSER_VERSIONS = [
  "efhub-player-page/2026-08-28.1",
  "efhub-player-page/2026-08-28.2",
] as const;

export type KnownParserVersion = (typeof KNOWN_PARSER_VERSIONS)[number];
