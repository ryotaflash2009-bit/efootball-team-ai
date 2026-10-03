# 自動更新の Secret 登録（本人の操作・1 画面）— 2026-10-03

Secret の名前は、workflow の参照（`reference-data-production-apply.yml` の plan mode と、
`reference-data-production-backup.yml` の `execution: automation`）と `automated-update-pipeline.md` §2・§5 から確定した。
3 つの間で名前の食い違いは無い。**値は Claude Code に渡さない・表示しない。**

## 監査の結果（2026-10-03・読み取り専用）

| 項目 | 結果 |
|---|---|
| Environment `reference-data-automation` | 存在（綴りは workflow の参照と完全一致） |
| Deployment branches | custom policy・`main` だけ（`branch` 型 1 件） |
| Required reviewers / Wait timer | なし / なし |
| Administrator bypass | **無効**（`can_admins_bypass: false`）。保護規則は main 限定だけなので、bypass の実質の意味は「main 以外から使えるか」で、無効のため管理者でも main 以外からは使えない |
| Environment の Secret | **0 件**（不足 9 件） |
| Environment の Variable | 0 件（不要） |
| Repository variable `REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED` | **`true` を設定済み**（Claude Code が 2026-10-03 に設定。秘密情報ではない） |
| Repository variable `REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED` | `true`（既存） |
| Repository の Secret | 0 件（Secret はすべて Environment 単位） |
| 既存の `production-backup-approval` | Secret 7 件（Backup 用・同じ名前）・レビュー 1 名・main だけ |
| 既存の `reference-data-production-apply` | Secret 2 件（Apply 用）・レビュー 1 名・main だけ。**この 2 件は自動進行の Environment へ入れない** |

GitHub は Secret の値を誰にも読み出させない（コピーの機能も無い）。既存の Environment に同じ値があっても、
**自動ではコピーできない**。本人が元の安全な保管元から値をコピーして、新しい Secret の Value 欄へ直接貼り付ける。

## 登録する 9 件

入力先（9 件とも同じ）:
1. GitHub → リポジトリの **Settings → Environments → `reference-data-automation`**
2. **Environment secrets → Add environment secret**
3. Name に下の名前、Value に値を貼り付けて **Add secret**

| # | Secret 名 | 用途（どの既存設定と同じ値か） | 値の取得元 | 新規 / 再利用 |
|---|---|---|---|---|
| 1 | `REFERENCE_DATA_PLAN_READ_DB_URL` | Plan の読み取り専用の接続。**`REFERENCE_DATA_BACKUP_DB_URL` と同じ値**（read-only の `reference_data_backup_reader` の接続文字列） | Backup の Secret を登録したときの保管元（本人のパスワードマネージャー等）。無ければ Supabase Dashboard → Project Settings → Database → Connection string を、`reference_data_backup_reader` のユーザー名・パスワードで組み立てる | 再利用 |
| 2 | `REFERENCE_DATA_PLAN_READ_DB_CA_CERT` | Plan の接続の CA 証明書。**`REFERENCE_DATA_BACKUP_DB_CA_CERT` と同じ値**（PEM 全体。`-----BEGIN CERTIFICATE-----` から `-----END CERTIFICATE-----` まで） | 保管元、または Supabase Dashboard → Project Settings → Database → SSL Configuration → Download certificate | 再利用 |
| 3 | `REFERENCE_DATA_BACKUP_DB_URL` | Backup の読み取り専用の接続（`production-backup-approval` と同じ値） | #1 と同じ | 再利用 |
| 4 | `REFERENCE_DATA_BACKUP_DB_CA_CERT` | Backup の接続の CA 証明書（同上） | #2 と同じ | 再利用 |
| 5 | `REFERENCE_DATA_BACKUP_AGE_RECIPIENT` | Backup を暗号化する **age の公開鍵**（`age1…`）。**秘密鍵（`AGE-SECRET-KEY-…`）は絶対に入れない** | 本人が鍵ペアを作ったときに保存した公開鍵（秘密鍵ファイルの `# public key:` 行） | 再利用 |
| 6 | `REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID` | R2 API Token の Access Key ID（対象 Bucket の Object Read & Write だけ） | Token を作ったときの保管元。Cloudflare では Secret Access Key を後から表示できないため、保管が無ければ Cloudflare Dashboard → R2 → Manage R2 API Tokens で同じ権限の Token を新規作成し、#6・#7 を対で使う | 再利用（保管が無ければ新規） |
| 7 | `REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY` | 同じ Token の Secret Access Key（**最も機微**） | #6 と同じ | #6 と同じ |
| 8 | `REFERENCE_DATA_BACKUP_R2_ENDPOINT` | R2 の S3 互換エンドポイント（`https://<Account ID>.r2.cloudflarestorage.com`） | 保管元、または Cloudflare Dashboard → R2 → 対象 Bucket → Settings | 再利用 |
| 9 | `REFERENCE_DATA_BACKUP_R2_BUCKET` | Backup を置く Bucket 名 | 保管元、または Cloudflare Dashboard → R2 の Bucket 一覧 | 再利用 |

注意:
- 値をチャット・Issue・PR・スクリーンショット・メモアプリに貼らない。前後の空白・改行を入れない（CA 証明書は PEM 全体）。
- Apply 用の `REFERENCE_DATA_APPLY_DB_URL` / `REFERENCE_DATA_APPLY_DB_CA_CERT` は**入れない**。
- 新しく R2 Token を作った場合、`production-backup-approval` の #6・#7 は古い Token のまま動く（そのままでよい）。

登録後、Environment secrets の一覧に**次の 9 個の名前だけ**が並ぶ（値は表示されない）:

```
REFERENCE_DATA_BACKUP_AGE_RECIPIENT
REFERENCE_DATA_BACKUP_DB_CA_CERT
REFERENCE_DATA_BACKUP_DB_URL
REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID
REFERENCE_DATA_BACKUP_R2_BUCKET
REFERENCE_DATA_BACKUP_R2_ENDPOINT
REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY
REFERENCE_DATA_PLAN_READ_DB_CA_CERT
REFERENCE_DATA_PLAN_READ_DB_URL
```

登録が終わったら、Claude Code へ **「設定完了」** とだけ送る。

## Secret 未登録の間の動き（2026-10-03 に実際に確認）

orchestrator run 37107900931（手動の `orchestrate`・detection run 36901363553）:
- Plan run 37107931538 が `reference-data-automation`（main）で起動し、**「Check required secrets are configured」で停止**。
  Checkout・DB 接続・R2 接続の前。表示は Secret の名前だけ。
- orchestrator は Backup・Dry run・Apply を起動せずに `stopped`（stage plan）。Issue #112 に停止の通知。
- Production write 0・R2 write 0・Backup 0・Apply 0。
- この run で見つけた 2 件を修正（PR: 停止の通知に起動した run を残す・Checkout の前に止まっても Evidence を作る）。

変数を `true` にしたため、毎週の定期検出（日曜 18:17 UTC）で update_available が出ると、Secret 登録までは同じく Plan の
secret 確認で止まり、Issue に通知が来る（安全に止まる・書き込みなし）。

## 「設定完了」を受け取った後に Claude Code が行うこと

1. 読み取り専用の確認:
   - Environment の存在・main だけ・レビューなし
   - Secret の**名前** 9 件（値は見ない）
   - 変数 `true`
   - workflow の参照が一致していること
2. 手動の `orchestrate` を起動する（`detection_run_id` は最新の成功した main の検出 run。無ければ手動の検出を先に起動）。
   自動で次へ進む:
   1. Plan（読み取り専用・差分の分類・removed 0・schema drift 0・hard block 0）
   2. Backup v2（暗号化・restore と storage の検証・Plan の件数と照合）
   3. Dry run（使い捨て PostgreSQL・re-diff 0・checksum の束縛・対象の表）
3. 関門をすべて満たしたときだけ Apply run を作り、**Environment の承認待ちで止まる**（Claude Code は承認しない）。
4. Apply 承認待ちの 1 画面（Run URL・件数・差分・Backup の期限・承認コメント・押すボタン・承認対象と対象外）を報告する。

関門を 1 つでも満たさなければ、Apply run は作らずに停止し、理由を報告する。

## Backup DB URL（`REFERENCE_DATA_BACKUP_DB_URL`）の取得元（2026-10-03 追記）

登録スクリプトの 1 件目で止まったときの案内。**値は Claude Code・チャット・Issue に貼らない。**

### 正式な契約（runbook・コードから確認）

| 項目 | 内容 | 根拠 |
|---|---|---|
| ロール | `reference_data_backup_reader`（読み取り専用・LOGIN・superuser 等なし・4 表の SELECT だけ） | `sql/create-reference-data-backup-role.sql`・`reference-data-production-backup-role-runbook.md` |
| パスワード | 本人が作成時に生成し、本人が直接 GitHub に登録（Claude Code はどこにも保存していない） | runbook §3 |
| 接続方式 | Supabase の **Session pooler**（GitHub の runner は IPv4。Direct connection は IPv6 のため使わない） | runbook §9（pooler 経由で接続）・Backup Run #8 で成功 |
| URL の形 | `postgresql://reference_data_backup_reader.<project ref>:<パスワード>@<region>.pooler.supabase.com:5432/postgres` | Supabase の Session pooler の形式 |
| 受け付ける形 | `postgresql://` と `postgres://` の両方。ユーザー名・パスワードは percent-encode 可（`@` → `%40` など） | `backup-db-connection.ts` |
| 拒否される形 | `sslmode` などの TLS の query parameter（TLS は CA 証明書の Secret だけで決める）・管理者 `postgres` ユーザー | 同上・Backup の preflight は接続後に `current_user = reference_data_backup_reader` も確認する |

### 取得の手順

1. **まず保管元を探す**（2026-09 の Backup の設定のとき）: パスワードマネージャーで
   `reference_data_backup_reader` / `Supabase backup` / `REFERENCE_DATA_BACKUP_DB_URL` を検索する。
   URL 全体か、パスワードだけが保存されているはず。
2. **パスワードが見つかった場合**: Supabase Dashboard → 対象のプロジェクト → 上部の **Connect** →
   **Session pooler** の URI をコピーし、次の 2 か所を置き換える（メモ帳などに貼らず、置き換えは入力の直前に行う）:
   - ユーザー名 `postgres.<project ref>` → `reference_data_backup_reader.<project ref>`（`.<project ref>` は残す）
   - `[YOUR-PASSWORD]` → そのパスワード（`@ : / ? # %` を含むなら percent-encode）
3. **パスワードが見つからない場合**（パスワードの再設定・本人の操作）:
   - Supabase Dashboard → **SQL Editor** で、次の 1 文だけを実行する（ロールの権限・RLS・スキーマは変わらない）:
     `alter role reference_data_backup_reader with password '<新しいパスワード>';`
     新しいパスワードはパスワードマネージャーで生成（英数字 32 文字以上にすると encode が不要）。
     この文をチャット・コミット・ファイルに残さない。成功条件: `Success. No rows returned`。
   - **影響**: 古いパスワードは使えなくなる。使っているのは GitHub の
     `production-backup-approval` の `REFERENCE_DATA_BACKUP_DB_URL`（手動の Backup）だけ
     （Vercel・アプリ・他の workflow は使っていない）。Apply 用の資格情報は別のロールで、影響なし。
   - そのため、登録スクリプトを `-AlsoUpdateManualBackupUrl` 付きで実行し、同じ新しい URL を手動の Backup 用にも
     1 回の入力で登録する（下のコマンド）。
   - 作り直し・削除・権限の変更はしない（`drop role` は不要）。

### 確認だけしたいとき（何も登録しない）

```
cd C:\Development\eFootball-Team-AI; powershell -NoProfile -ExecutionPolicy Bypass -File .\data\work\set-automation-secrets.ps1 -CheckUrlOnly
```

URL を貼ると `OK` か、理由の種類だけが表示される（例: 管理者ユーザー・`[YOUR-PASSWORD]` が残っている・TLS の parameter）。
値は表示されない。パスワードが正しいかは、workflow が接続したときに分かる。

### 登録

- 通常: `... -File .\data\work\set-automation-secrets.ps1`
- パスワードを再設定した場合: `... -File .\data\work\set-automation-secrets.ps1 -AlsoUpdateManualBackupUrl`
