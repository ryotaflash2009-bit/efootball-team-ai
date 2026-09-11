# Phase: お気に入り / My Team 基盤（/favorites・/my-team）

作成日: 2026-08-30 / 外部アクセス: **0 リクエスト**（既存 SQLite の読み取りのみ・新規 npm パッケージなし）

## 目的

- **お気に入り**: 気になるカードを保存して、あとで育成・比較・スカッドを確認する。所有していないカードも登録できる。
- **My Team**: 実際に保有しているカードを管理し、所有状態・起用状態・育成ビルド参照を持つ。

お気に入りと My Team は**別概念・別ストア**。同じ配列・同じ状態として扱わない。

- My Team へ追加してもお気に入りへ自動追加はしない（初期版）。
- 片方から削除しても、もう片方・保存ビルド・保存スカッド・比較には影響しない。

## 保存（localStorage のみ）

SQLite にはユーザー個人データを保存しない（ログインが無くローカルユーザーを識別できず、
共有サーバー DB では複数ユーザーのデータが混ざるため）。ログイン・認証・クラウド同期は導入しない。

| ストア | キー | storageVersion |
|---|---|---|
| お気に入り | `efootball-team-ai:favorites:v1` | `favorites-storage/2026-08-30.v1` |
| My Team | `efootball-team-ai:my-team:v1` | `my-team-storage/2026-08-30.v1` |

### 将来のクラウド同期に備えたフィールド

- `localRecordId`（`fav_…` / `myt_…`）: ローカルレコードの内部 ID。**`worldCardId` を主キーにしない**。
- My Team の `teamCardId`（`tc_…`）: 将来「同じカードを複数所持」を表す器。現状は 1 worldCardId につき 1 件。
- `source: "local"` / `syncStatus: "local_only"`: 偽の userId を作らない・「認証済み」「クラウド同期済み」と表示しない。
- `createdAt` = `addedAt` / `updatedAt`: ISO 文字列。
- My Team の `deletedAt`: 将来の同期用トゥームストーン（現状は削除で物理削除、読み込み時に `deletedAt != null` は除外）。

### レコード形

```
FavoriteRecord {
  localRecordId, worldCardId,
  note: string,          // 最大 500 文字・プレーンテキスト・改行維持
  tags: string[],        // 各 24 文字・最大 10・trim・重複/空/制御文字除去
  addedAt, updatedAt, source: "local", syncStatus: "local_only"
}

MyTeamRecord {
  localRecordId, teamCardId, worldCardId,
  ownershipStatus: "owned" | "wanted" | "released" | "unknown",   // 既定 owned
  usageStatus: "main" | "rotation" | "reserve" | "unused" | "unknown",  // 既定 unknown
  selectedBuildId: string | null,   // build-storage の buildId 参照のみ（本体は複製しない）
  favoriteBuildId: string | null,
  note, tags, addedAt, updatedAt, deletedAt: string | null,
  source: "local", syncStatus: "local_only"
}
```

- `usageStatus: "main"` は「主力」の記録であって、スカッドへの自動配置ではない。
- 保存ビルドは **`buildId` 参照のみ**。ビルド本体（`calculatedStats` 等）は複製しない。
  参照先が削除されていたら「ビルドが見つかりません（削除済み）」と表示し、選択を保持したまま安全に扱う。

## ファイル

### lib（`src/lib/user-cards/`）

| ファイル | 役割 |
|---|---|
| `validation.ts` | 純関数の入力検証。`WORLD_CARD_ID_RE`（数字 1–20 桁）、`sanitizeTag` / `sanitizeTags` / `sanitizeNote`（制御文字は文字コードで除去）、`isIsoDate`、`sanitizeBuildId`、`newLocalRecordId(prefix)` |
| `types.ts` | 定数（キー・バージョン）、`OwnershipStatus` / `UsageStatus` と JP ラベル、レコード型・ストア型 |
| `store-events.ts` | `subscribeUserCards(channel, cb)` / `notifyUserCards(channel)` — モジュールレベルの pub-sub |
| `favorites-storage.ts` | お気に入りの読み書き。`parseFavoritesStorage`（要素ごとに Zod 検証し壊れたレコードだけ捨てる）、`addFavorite` / `removeFavorite` / `toggleFavorite` / `updateFavorite` / `getFavorites`（安定スナップショット）|
| `my-team-storage.ts` | My Team の読み書き。`addToMyTeam`（同一 worldCardId は拒否・既存を返す）、`updateMyTeamRecord` / `removeFromMyTeam`（My Team からのみ削除）/ `getMyTeam` / `getMyTeamByWorldId` |
| `hooks.ts` | `useFavorites()` / `useMyTeam()` — `useSyncExternalStore`。SSR / hydration 前は空スナップショット |
| `use-resolved-cards.ts` | `useResolvedCards(ids)` — 未取得 ID だけ `/api/world/players/by-ids` でまとめて解決。13,009 件を走査しない |
| `filter.ts` | 純関数 `filterAndSortUserCards` / `facetsFromRows` / `cardHasPowerOfMany` / `cardHasBooster` |

### API / repository

- `GET /api/world/players/by-ids?ids=a,b,c` — 保存済み SQLite のみ。数字 ID のみ通す。最大 500。外部アクセスなし。
- `getPlayersByWorldIds(ids)`（`src/lib/world/repository.ts`）— `IN (…)` の一括取得。入力順を保持。

### components（`src/components/user-cards/`）

`FavoriteButton`（`detail` / `card` / `compact`・`aria-pressed`・色以外にテキストでも状態表示）、
`MyTeamButton`、`MyTeamAddDialog`、`TagEditor`、`UserCardTile`、`UserCardFilters`、
`FavoritesView`、`MyTeamView`、`LocalStorageNotice`、`ConfirmDialog`。
お気に入りボタンのロジックは 1 か所（`FavoriteButton`）。画面ごとに複製しない。

### pages / 導線

| ルート | 種別 |
|---|---|
| `/favorites` | force-static shell + `FavoritesView`（"use client"）|
| `/my-team` | force-static shell + `MyTeamView`（"use client"）|
| サイドメニュー「マイデータ」グループ | `お気に入り` / `My Team`（`status: "ready"`）|

お気に入りボタン設置箇所: 選手一覧カード / 選手詳細ヒーロー / 育成画面の選手概要 / My Team 一覧 / お気に入り一覧。
My Team ボタン設置箇所: 選手詳細ヒーロー / 育成画面の選手概要 / お気に入り一覧（`compact`）。
連携: 比較へ追加（`addCompareId`）、スカッド（`/squads?card={id}` バナー）、育成（`/players/world/{id}?tab=progression`）。

## 配色

お気に入り = ライム／白。**Power of Many（金）・固定ブースター（青）と混同しない**。
状態は色だけで区別せず、テキスト（「お気に入り済み」/「お気に入り」）と `aria-pressed` で判別可能。

## 堅牢性

- localStorage 不可 / 壊れた JSON / 破損レコード / SSR / hydration 前でも画面全体は壊れない。
- 保存失敗を成功として表示しない（`available === false` は警告表示）。
- 読み込み時に Zod 検証。**不正なレコードだけ**捨て、ストア全体は捨てない。
  NaN / Infinity / 負数 / 小数 / 過長 / 不正日付は弾く。未知の `storageVersion` は空フォールバック＋警告。
- タグ・メモはプレーンテキストのみ。`dangerouslySetInnerHTML` なし・HTML 描画なし・スクリプト実行なし・`eval` / `Function` なし・URL 自動実行なし。

## データ移行関数

`parseFavoritesStorage` / `parseMyTeamStorage` が現状の入口。将来 `v2` が来たら
`migrateFavoritesStorage` / `migrateMyTeamStorage` をバージョン分岐に追加する（現状は v1 のみ）。

## テスト

- `src/lib/user-cards/user-cards.test.ts`（vitest 28件）: 検証・お気に入り・My Team・独立性・フィルター・ビルド関連付け。
- `scripts/black-box-favorites.mjs`（33件・localhost のみ・外部アクセス 0）: SSR 空状態シェル・by-ids API・ボタン設置・導線・回帰。

## 確定データ件数（この Phase で不変）

World 選手 13,009 / eFHUB 索引 47,479 / 監督 66 / ブースター定義 44 / SQLite integrity: ok。
SQLite への書き込みは 0（ユーザー個人データは localStorage のみ）。
