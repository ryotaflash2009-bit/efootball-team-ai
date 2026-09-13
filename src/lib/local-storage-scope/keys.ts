import type { DataKind, StorageScope } from "./types";
import { DATA_KINDS } from "./types";

/**
 * localStorageキーの中央生成機構。各機能モジュールは文字列結合を直接書かず、
 * 必ずこのファイルの関数だけを経由してキー名を得る(重複ハードコード防止・
 * 将来の命名規則変更時の一元管理のため)。
 */

/** データ種別ごとの、キー内で使う短い識別子。既存キーの命名との整合を優先する。 */
const KIND_SEGMENT: Record<DataKind, string> = {
  myTeam: "my-team",
  myBuilds: "progression-builds",
  favorites: "favorites",
  squads: "squads",
  squadTemplates: "squad-templates",
};

/** 既存(アカウント分離前)のブラウザー共通キー。今回、自動移行・自動削除の対象にはしない。 */
export const LEGACY_KEYS: Record<DataKind, string> = {
  myTeam: "efootball-team-ai:my-team:v1",
  myBuilds: "efootball-team-ai:progression-builds:v1",
  favorites: "efootball-team-ai:favorites:v1",
  squads: "efb:squads:v1",
  squadTemplates: "efootball-team-ai:squad-templates:v1",
};

/** 新しいキー命名規則のスキーマバージョン。将来の形式変更はこの値の更新で表現する。 */
export const SCOPED_KEY_SCHEMA_VERSION = "v1";

function assertKnownDataKind(kind: DataKind): void {
  if (!DATA_KINDS.includes(kind)) {
    throw new Error(`unknown data kind: ${String(kind)}`);
  }
}

/**
 * 現在のスコープ(guest/account)におけるデータ種別のlocalStorageキーを生成する。
 * - guest: `efootball-team-ai:local:guest:<kind>:v1`
 * - account: `efootball-team-ai:local:account:<scopeId>:<kind>:v1`
 * `scopeId`は`computeAccountScopeId`が返すSHA-256ハッシュのみを想定する
 * (呼び出し側が生のユーザーIDやメールアドレスを直接渡さないこと)。
 */
export function buildScopedStorageKey(scope: StorageScope, kind: DataKind): string {
  assertKnownDataKind(kind);
  const segment = KIND_SEGMENT[kind];
  if (scope.kind === "guest") {
    return `efootball-team-ai:local:guest:${segment}:${SCOPED_KEY_SCHEMA_VERSION}`;
  }
  return `efootball-team-ai:local:account:${scope.scopeId}:${segment}:${SCOPED_KEY_SCHEMA_VERSION}`;
}

/** 指定スコープの5種類すべてのキーを列挙する(一覧化・一括削除の土台に使う)。 */
export function listScopedStorageKeys(scope: StorageScope): Record<DataKind, string> {
  const out = {} as Record<DataKind, string>;
  for (const kind of DATA_KINDS) {
    out[kind] = buildScopedStorageKey(scope, kind);
  }
  return out;
}

export function getLegacyStorageKey(kind: DataKind): string {
  assertKnownDataKind(kind);
  return LEGACY_KEYS[kind];
}
