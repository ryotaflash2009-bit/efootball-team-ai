/**
 * アカウント別localStorage名前空間の基盤(Stage 1)。
 *
 * 重要な位置づけ: これはセキュリティ境界ではない。localStorageは同一オリジンの
 * JavaScriptから常に読めるため、認可の代替にはならない。ここでの「アカウント別領域」は、
 * 同じブラウザーで複数アカウントを切り替えたときに、前のアカウントのローカルデータが
 * そのまま次のアカウントへ表示されてしまう誤表示を防ぐための、UX上の名前空間分離に過ぎない。
 * 認可・所有者判定は引き続きSupabase Row Level Securityだけが行う(My Teamクラウド保存PoCと同じ方針)。
 */

/** アカウント別対応の対象となる5種類のローカルデータ。 */
export type DataKind = "myTeam" | "myBuilds" | "favorites" | "squads" | "squadTemplates";

export const DATA_KINDS: readonly DataKind[] = ["myTeam", "myBuilds", "favorites", "squads", "squadTemplates"];

/** 現在の保存領域。未ログインの共通領域か、認証済みアカウント別領域か。 */
export type StorageScope = { kind: "guest" } | { kind: "account"; scopeId: string };

/** 表示用ラベル(日本語キー名相当)。UI側はこれを介してのみdataKindを扱う。 */
export const DATA_KIND_LABEL_KEY: Record<DataKind, string> = {
  myTeam: "myTeam",
  myBuilds: "myBuilds",
  favorites: "favorites",
  squads: "squads",
  squadTemplates: "squadTemplates",
};

export function isDataKind(value: unknown): value is DataKind {
  return typeof value === "string" && (DATA_KINDS as readonly string[]).includes(value);
}
