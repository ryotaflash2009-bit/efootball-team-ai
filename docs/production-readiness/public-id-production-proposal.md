# F-053 公開 ID・プロフィール — Production の適用の直前までの提案（2026-10-07）

**未適用**。Production の schema・RLS の変更のため、適用は本人の承認の後。公開の登録（Signup）・ドメイン・SMTP の再開にも依存する。

| 項目 | 内容 |
|---|---|
| migration | `docs/production-readiness/sql/create-public-profiles-schema.sql`（表 `public_profiles`・`public_id_history`・`user_blocks`・検索の関数） |
| 戻し | `rollback-public-profiles-schema.sql`（作ったものだけを消す・利用者の行も消えるため先に Backup） |
| 規則 | `src/lib/profile/public-id.ts`（版 `public-id/2026-10-02.v1`）。予約語と形式は SQL と TS の同期をテスト（`public-profiles-sql-sync.test.ts`） |
| 使い捨ての PostgreSQL の検証 | `public-profiles.postgres.test.ts`（CI の PostgreSQL の job）: 形式・予約語・同時の登録（一意）・anon の拒否（列挙の防止）・他人の UUID の非公開（列の権限）・非公開とブロック（両方向）・検索（3 文字以上・前方一致・20 件・ワイルドカードの無効化）・30 日の変更の間隔・90 日の再利用の禁止・退会・他人の更新の拒否・戻しと再適用 |

## 適用の前のチェック（本人の承認の後に行う）

1. Production の Backup（v2）と restore の確認。
2. 使い捨ての PostgreSQL の job が成功していること（この PR の CI）。
3. Supabase の SQL Editor ではなく、承認つきの workflow から適用（既存の reference-data の適用と同じ方式を別の workflow で）。
4. 適用の後: 表・policy・関数の存在、anon の拒否、本人の行の作成・更新、他人の行が見えないことを読み取りで確認。
5. 画面の公開（`/u/<公開ID>`）は別の判断（noindex のまま・招待制の間は公開しない）。

## アプリの側で残る作業（本番の DB が無くても進められる）

- 公開 ID の設定の画面（`/account/public-id-preview` は内部の確認だけ・Production は 404 のまま）。
- 検索の rate limit（API の層。DB の関数は件数と最小の長さだけを制限）。
- 表示名の禁止語・個人情報の判定はアプリ（`validateDisplayName`）。DB は長さと制御文字だけ。
