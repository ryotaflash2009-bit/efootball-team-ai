/**
 * 「ローカルデータをすべて削除」機能の対象キー定義と削除処理。
 *
 * - 削除対象は、本アプリが実際に使用しているlocalStorageキーのうち、
 *   利用者の保存データ(My Team・お気に入り・保存ビルド・保存スカッド・スカッドテンプレート・
 *   スカッド編集設定・スカッド比較の一時状態)だけに限定する。
 * - 表示言語設定(`efootball-team-ai:locale:v1`)とサイドバー開閉状態(`efb:sidebar-collapsed`)は
 *   「保存データ」ではなく単なるUI表示設定のため、意図的に対象外とする
 *   (削除後に表示言語が意図せず変わる、という利用者にとって予期しない副作用を避けるため)。
 * - SQLite・本アプリの参照データ・他サイトのデータには一切触れない
 *   (localStorageはブラウザーによってオリジン単位で分離されており、そもそも他サイトのキーへは
 *   アクセスできない)。
 * - `localStorage.clear()` は使用しない(このオリジンの他の未知のキーを巻き込まないため)。
 *   必ずこのファイルが列挙する既知のキーだけを個別に `removeItem` する。
 */

export interface ManagedLocalDataKey {
  /** localStorageの実際のキー文字列。 */
  key: string;
  /** データ管理ページの「削除される対象」欄に表示するラベルの辞書キー名。 */
  labelKey:
    | "deleteAllTargetFavorites"
    | "deleteAllTargetMyTeam"
    | "deleteAllTargetBuilds"
    | "deleteAllTargetSquads"
    | "deleteAllTargetTemplates"
    | "deleteAllTargetEditorPrefs"
    | "deleteAllTargetComparisonState";
}

/**
 * 「ローカルデータをすべて削除」の対象となる、確認済みのlocalStorageキー一覧。
 * 新しい保存データを追加する場合は、ここへも明示的に追加すること
 * (このリストに無いキーは削除対象にならない=安全側のデフォルト)。
 */
export const MANAGED_LOCAL_DATA_KEYS: readonly ManagedLocalDataKey[] = [
  { key: "efootball-team-ai:favorites:v1", labelKey: "deleteAllTargetFavorites" },
  { key: "efootball-team-ai:my-team:v1", labelKey: "deleteAllTargetMyTeam" },
  { key: "efootball-team-ai:progression-builds:v1", labelKey: "deleteAllTargetBuilds" },
  { key: "efb:squads:v1", labelKey: "deleteAllTargetSquads" },
  { key: "efootball-team-ai:squad-templates:v1", labelKey: "deleteAllTargetTemplates" },
  { key: "efootball-team-ai:squad-editor-preferences:v1", labelKey: "deleteAllTargetEditorPrefs" },
  { key: "efootball-team-ai:squad-comparison:v1", labelKey: "deleteAllTargetComparisonState" },
];

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__efb_delete_all_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isLocalDataStorageAvailable(): boolean {
  return getStorage() != null;
}

/** 実際にデータが存在する管理対象キーだけを返す(「削除される対象」の事前表示・空状態判定に使う)。 */
export function getManagedKeysWithData(): ManagedLocalDataKey[] {
  const ls = getStorage();
  if (!ls) return [];
  return MANAGED_LOCAL_DATA_KEYS.filter((entry) => {
    try {
      return ls.getItem(entry.key) != null;
    } catch {
      return false;
    }
  });
}

export interface DeleteAllLocalDataResult {
  ok: boolean;
  /** 実際に削除を試みたキー(データが存在しなかったキーは含まない)。 */
  attemptedKeys: string[];
  /** 削除に失敗したキー(空なら全件成功)。 */
  failedKeys: string[];
}

/**
 * 管理対象キーだけを個別に削除する。`localStorage.clear()` は使用しない。
 * 各キーの削除を独立して試み、一部が失敗しても残りの削除は継続する(部分失敗を報告できるように)。
 */
export function deleteAllManagedLocalData(): DeleteAllLocalDataResult {
  const ls = getStorage();
  if (!ls) {
    return { ok: false, attemptedKeys: [], failedKeys: [] };
  }
  const targets = getManagedKeysWithData();
  const attemptedKeys: string[] = [];
  const failedKeys: string[] = [];
  for (const entry of targets) {
    attemptedKeys.push(entry.key);
    try {
      ls.removeItem(entry.key);
      // 削除できたことを読み戻して確認する(確認できなければ失敗扱い=成功と誤表示しない)。
      if (ls.getItem(entry.key) != null) failedKeys.push(entry.key);
    } catch {
      failedKeys.push(entry.key);
    }
  }
  return { ok: failedKeys.length === 0, attemptedKeys, failedKeys };
}
