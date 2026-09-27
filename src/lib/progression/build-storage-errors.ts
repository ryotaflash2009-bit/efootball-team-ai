import type { Locale } from "@/lib/i18n/locale";

/**
 * build-storage.ts が返す固定のエラー文（日本語）を表示言語に合わせる。
 * エラー文そのもの（保存の契約）は変えず、表示だけを英語にする。未知の文は英語画面では汎用文にする（日本語を出さない）。
 * 対応表の漏れは build-storage-errors.test.ts が build-storage.ts の `error: "…"` を読んで検出する。
 */
export const BUILD_STORAGE_ERROR_EN: Record<string, string> = {
  "worldCardId が不正です": "The card ID is invalid",
  "ビルド名を入力してください": "Please enter a build name",
  "対象のビルドが見つかりません": "The build could not be found",
  "保存データの形式が不正です": "The saved data is not in a valid format",
  "この環境ではビルドを保存できません（localStorage 不可）": "Builds cannot be saved here (localStorage unavailable)",
  "この環境ではビルドを更新できません（localStorage 不可）": "Builds cannot be updated here (localStorage unavailable)",
  "この環境ではビルドを更新できません": "Builds cannot be updated here",
  "buildId が衝突しています": "The build ID conflicts with an existing build",
  "インポートデータの形式が不正です": "The import data is not in a valid format",
  "この環境では保存できません（localStorage 不可）": "Cannot save here (localStorage unavailable)",
  "この環境では更新できません": "Cannot update here",
  "この環境では更新できません（localStorage 不可）": "Cannot update here (localStorage unavailable)",
  "保存できませんでした（保存容量が不足している可能性があります）": "Could not save (storage may be full)",
  "既存の保存ビルドが変更されています。再読込してください。": "The saved builds have changed. Please reload.",
  "未対応のスキーマバージョンです": "Unsupported schema version",
  "追加するビルドがありません": "There are no builds to add",
};

export function localizeBuildStorageError(message: string, locale: Locale): string {
  if (locale === "ja") return message;
  return BUILD_STORAGE_ERROR_EN[message] ?? "The action could not be completed";
}
