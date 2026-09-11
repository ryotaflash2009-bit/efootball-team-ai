/**
 * お気に入り / My Team の共通型。
 *
 * **お気に入りと My Team は別概念**:
 *  - お気に入り = 気になるカード（所有していなくても登録可能）。最小データのみ。
 *  - My Team    = 実際に保有しているカード。所有/使用状態・保存ビルドの関連付けを管理。
 *
 * 初期版はローカル保存のみ（ログイン・クラウド同期なし）。
 * ただし将来アカウント同期へ移行できるよう、ローカル ID・保存バージョン・更新日時・同期状態を持つ。
 * **クラウド同期で worldCardId を主キーにしない**ため、レコードには localRecordId / teamCardId を持たせる。
 */

export const FAVORITES_STORAGE_VERSION = "favorites-storage/2026-08-30.v1";
export const MY_TEAM_STORAGE_VERSION = "my-team-storage/2026-08-30.v1";

export const FAVORITES_STORAGE_KEY = "efootball-team-ai:favorites:v1";
export const MY_TEAM_STORAGE_KEY = "efootball-team-ai:my-team:v1";

export type OwnershipStatus = "owned" | "wanted" | "released" | "unknown";
export type UsageStatus = "main" | "rotation" | "reserve" | "unused" | "unknown";

export const OWNERSHIP_STATUSES: readonly OwnershipStatus[] = ["owned", "wanted", "released", "unknown"];
export const USAGE_STATUSES: readonly UsageStatus[] = ["main", "rotation", "reserve", "unused", "unknown"];

export const OWNERSHIP_LABELS: Record<OwnershipStatus, string> = {
  owned: "所有済み",
  wanted: "欲しい",
  released: "手放した",
  unknown: "未設定",
};
export const USAGE_LABELS: Record<UsageStatus, string> = {
  main: "主力",
  rotation: "ローテーション",
  reserve: "控え",
  unused: "未使用",
  unknown: "未設定",
};

/** お気に入り 1 件。 */
export interface FavoriteRecord {
  /** ローカル保存レコードの内部 ID。 */
  localRecordId: string;
  worldCardId: string;
  note: string;
  tags: string[];
  addedAt: string;
  updatedAt: string;
  /** 将来のクラウド同期用（初期版は固定）。 */
  source: "local";
  syncStatus: "local_only";
}

/** My Team 1 件。 */
export interface MyTeamRecord {
  localRecordId: string;
  /** カード単位の安定 ID（将来、同一カードを複数所持できる可能性に備える）。 */
  teamCardId: string;
  worldCardId: string;
  ownershipStatus: OwnershipStatus;
  usageStatus: UsageStatus;
  /** 現在この My Team カードで開く保存ビルド（`build-storage` の buildId 参照）。 */
  selectedBuildId: string | null;
  /** お気に入り扱いの保存ビルド（任意）。 */
  favoriteBuildId: string | null;
  note: string;
  tags: string[];
  addedAt: string;
  updatedAt: string;
  /** ソフト削除用（将来の同期でトゥームストーンに使う）。初期版は常に null。 */
  deletedAt: string | null;
  source: "local";
  syncStatus: "local_only";
}

export interface FavoritesStore {
  storageVersion: string;
  updatedAt: string;
  records: FavoriteRecord[];
}
export interface MyTeamStore {
  storageVersion: string;
  updatedAt: string;
  records: MyTeamRecord[];
}
