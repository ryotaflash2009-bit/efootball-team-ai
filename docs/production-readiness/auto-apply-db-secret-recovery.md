# 自動 Apply の DB 接続 Secret の復旧（2026-10-06）

## 1. 状態

| 項目 | 内容 |
|---|---|
| 事象 | 2026-10-05 の自動 Apply（run 37280705852）が Production の DB への接続で `connect_failed:sqlstate_28P01`（パスワード認証の失敗） |
| 書き込み | 0（接続の前後の認証で停止。Rollback・Restore は不要・未実施） |
| 対象 | Environment `reference-data-production-apply-automatic`（main だけ・レビューなし・admin bypass 無効）の Secret `REFERENCE_DATA_APPLY_DB_URL`（2026-10-03T16:22:04Z 登録） |
| 正常な参照 | 手動用の `reference-data-production-apply` の同名の Secret は 2026-10-03 の適用で接続できた（値は読み戻さない。GitHub は読み戻せない） |
| CA 証明書 | `REFERENCE_DATA_APPLY_DB_CA_CERT` は問題なし（28P01 は TLS の後の認証の段階で出る） |

## 2. 接続の契約（コードで確認）

- workflow: `reference-data-production-apply.yml` は `mode == apply` かつ確認入力が `auto-apply-` で始まるときだけ自動用の Environment を使い、
  `secrets.REFERENCE_DATA_APPLY_DB_URL` / `_CA_CERT` を渡す。
- 解析: `backup-db-connection.ts` の `parseBackupDbUrl`（`new URL()`）。`postgres://` / `postgresql://`。user・password は percent-decode。
  TLS を変える query parameter（`sslmode` 等）は拒否。TLS は CA 証明書の Secret だけで決める。
- 形: `postgresql://reference_data_updater.<project ref>:<percent-encode した password>@<region>.pooler.supabase.com:5432/postgres`
  （Session pooler。GitHub の runner は IPv4 のため Direct connection は使わない。Transaction pooler（6543）は使わない）。
- 28P01 の意味: URL の解析・TLS・pooler の project の判定は通り、user と password の組が拒否された。考えられる原因: password の違い
  （コピーの誤り・古い値・前後の空白・引用符）・percent-encode されていない記号・ユーザー名が `postgres.<project ref>`（管理者）。

## 3. 本人の操作（1 回）

一度限りのスクリプト `data/work/set-auto-apply-db-secret.ps1`（Git 管理外）を Windows Terminal で実行する:

```
cd C:\Development\eFootball-Team-AI; powershell -NoProfile -ExecutionPolicy Bypass -File .\data\work\set-auto-apply-db-secret.ps1
```

入力は 2 つ: (1) Supabase の Connect 画面の Session pooler の接続文字列（`[YOUR-PASSWORD]` を含むまま）、(2) `reference_data_updater` のパスワード（画面に出ない）。
スクリプトは Session pooler・5432・`postgres`・project ref を確認し、ユーザー名を `reference_data_updater.<project ref>` に固定し、
password を percent-encode して、URL をメモリの中だけで作り `gh secret set` へ標準入力で渡す（引数・ファイル・履歴・画面に出さない）。
登録後は Secret の名前と更新日時だけを確認し、自分自身を削除する。`-SelfTest`（ダミーの値・22 項目）・`-DryRun`（登録しない）あり。

## 4. 登録の後（Claude Code が行う）

古い Candidate・Backup・Dry run は再利用しない。最新の状態から:

1. 読み取りの確認: Secret の名前と更新日時（値は見ない）・Environment が main だけ・Kill switch 3 つが `true`・open の halt Issue なし・applied-state。
2. 手動の検出（`workflow_dispatch`・`detect`）→ orchestrator が Plan → Backup v2（restore・storage の検証）→ Dry run（re-diff 0・checksum の束縛）→
   Auto Apply policy → `AUTO_APPLY_ELIGIBLE` の場合だけ自動 Apply → Post-verify → 公開の件数の確認 → applied-state の候補 → Evidence → 通知。
3. Post-verify の失敗では Rollback・Restore をしない（halt Issue で新しい自動 Apply を止め、本人の判断を待つ）。

## 5. 上流の rate limit（2026-10-06 に確認）

2026-10-06T10:13Z の定期の検出（完全な回・約 448 request）の直後に orchestrator が Plan を起動し、Plan が上流から
`source_http_429`（rate limit）で停止した（run 37451238141。Backup・Production への接続・書き込みは無し）。
検出と Plan が続けて World の全件を取得すると上流が制限する場合がある。復旧の確認の run では、手動の検出の後に Plan が 429 で止まった場合、
時間を空けてもう一度 orchestrate する（同じ取得を短い間隔で繰り返さない）。恒久の対策（Plan が検出の取得結果を再利用する・待ち時間）は別途検討。

## 6. 認証の失敗の繰り返しの抑制

- 同じ Candidate は 24 時間に 1 回だけ Pipeline へ渡る（`markRepeatCandidate`）。Secret が直るまでは 1 日 1 回 Plan〜Apply が動き、Apply の接続で止まる（書き込みなし）。
- 停止の通知は Issue #112 へのコメント（同じ通知は 6 時間に 1 回まで）。Apply run を作った後の停止は「作成されましたが、適用は完了していません」と書く（2026-10-06 修正）。
- Candidate は失われない（毎回 applied-state と比較）。Secret の修正の後は §4 の手動の検出で最新の状態から評価する。

## 7. 状態の記録

| 日時 | 状態 | 確認 |
|---|---|---|
| 2026-10-07 | `VERIFIED_BLOCKED_OWNER_ACTION`（本人の Secret 入力待ち） | self-test 22/22 PASS（ダミーの値・gh 未実行）。workflow の Environment 名・Secret 名・CA の契約が §2 と一致。自動用 Secret の更新日時は 2026-10-03T16:22:04Z のまま（値は見ていない）。Kill switch 5 つ `true`・open の halt Issue なし・applied-state World 13,372 / Managers 69 |
| 2026-10-07 | `AUTO_APPLY_BLOCKED_DB_AUTH`（本人の Secret の再入力待ち） | 本人が 13:07:32Z に `REFERENCE_DATA_APPLY_DB_URL` を更新（値は見ていない）。最新の状態から再検証: 検出 37626220256（World `079f9eaf92a0`・update_available・repeat ではない／Managers no_change）→ Plan 37629701068（main 98ac4a8・追加 0・変更 16（`ovr_max`・`maximum_level` のみ）・削除 0・重複 0・不正 0）→ Backup v2 37633398038（restore・storage 検証済み・World 13,372／Managers 69）→ Dry run 37633643554（re-diff 0・after checksum 一致・隔離での apply / 監査 / undo 検証済み）→ policy 適格で自動 Apply 37633894541（Environment `reference-data-production-apply-automatic`）→ **接続で `connect_failed:sqlstate_28P01`**。書き込み 0・Rollback / Restore なし・halt Issue なし・Issue #112 に停止の通知。Candidate は失われない |

## 8. 2 回目の 28P01 の後（2026-10-07）

更新した値でも認証が拒否された。値は読み戻せないため、原因は本人の入力（パスワードの違い・別のロールのパスワード）と考えられる。
同じ失敗を繰り返さないよう、一度限りのスクリプトを **v2** にした（`data/work/set-auto-apply-db-secret.ps1`・Git 管理外・self-test 24/24）。

- v2 は登録の**前に**、本人の端末から実際にログインできるかを確かめる（`data/work/check-db-login.mjs`・TLS は CA 証明書で検証・読み取りの 1 文だけ・URL とパスワードは表示しない）。
  ログインできない・ユーザーが `reference_data_updater` でない・World の更新権限が無い場合は**登録しない**で理由を示す（28P01 = パスワード違い 等）。
- 入力: Session pooler の接続文字列・`reference_data_updater` のパスワード・Supabase の SSL 証明書のファイル（Database Settings の Download certificate）。
- パスワードが分からない場合: Supabase の SQL Editor で `reference_data_updater` のパスワードを新しくする（本人の操作）。
  その場合は手動用の Environment `reference-data-production-apply` の同名の Secret も古くなるため、同じ値で登録し直す必要がある（別途）。
- 実行: `powershell -NoProfile -ExecutionPolicy Bypass -File .\data\work\set-auto-apply-db-secret.ps1`（`-DryRun` で確認だけ）。
- 「設定完了」の後は §4 と同じく最新の状態から検出をやり直す（今回の Candidate は次の検出でも同じ checksum なら 24 時間以内は repeat になるため、
  2026-10-08T13:34Z 以降の検出、または checksum が変わった検出で Pipeline へ渡る）。

## 9. v2 の確認の誤り（42P01）と v3（2026-10-07）

本人の v2 の実行: 1 回目 `28P01`（パスワードの誤り・未登録）、2 回目 `42P01`（v2 は LOGIN_FAILED と表示・未登録・書き込み 0）。

- **原因**: v2 の確認の SQL が `has_table_privilege(current_user, 'public.world_player_cards', 'UPDATE')` だった。
  表は `reference_data.world_player_cards`（`public` ではない）。`has_table_privilege` は名前の関係が無いと 42P01 を出す。
  42P01 はログインの**後**に出るため、2 回目は認証に成功していた（パスワードは正しかった可能性が高い。v3 の `select 1` で確定する）。
- **もう一つの誤り**: `reference_data_updater` の UPDATE・INSERT は列単位の grant（`grant update (...)`）。
  `has_table_privilege(..., 'UPDATE')` は列単位の grant では false になるため、schema を直しても v2 は「権限なし」で止まっていた。
- **v3**（`scripts/check-apply-db-login.mjs`・`scripts/lib/db-login-probe.mjs`・`scripts/lib/updater-probe-spec.mjs`）:
  1. 接続して `select 1` だけ（表に依存しない）。
  2. 成功した後だけ、schema 付きの名前を `to_regclass` で引き、`pg_attribute` と `has_table_privilege`（SELECT）・
     `has_column_privilege`（列ごとの UPDATE / INSERT）で確かめる（無い表・列は NULL になりエラーにならない）。対象の列は
     `UPDATER_COLUMN_GRANTS` と同じ（テストで一致を確認）。INSERT・UPDATE・DELETE は実行しない。
  3. 分類: `INVALID_PASSWORD`（28P01）・`AUTHENTICATED_BUT_PROBE_RELATION_MISSING`（42P01・関係の名前だけ表示）・
     `AUTHENTICATED_BUT_INSUFFICIENT_PRIVILEGE`（42501・不足の列）・`AUTHENTICATED_AS_UNEXPECTED_ROLE`・`CONNECTION_FAILURE`（08 系・ネットワーク）・
     `TLS_FAILURE`・`PROBE_FAILED_WITH_SQLSTATE`。出力にエラー文・接続情報・パスワードを含めない。
- 試験: 単体 13 件・使い捨て PostgreSQL（CI）で、間違ったパスワード・正しいパスワード + select 1・関係が無い・権限が無い（列単位）・
  TLS の失敗・ネットワークの失敗・確認の前後で行が変わらないこと。Windows PowerShell 5.1 の self-test 34/34。
- 一度限りのスクリプトは v3（`data/work/set-auto-apply-db-secret.ps1`・Git 管理外）。`LOGIN_OK_AND_PRIVILEGES_OK` の場合だけ Secret を登録する。

## 10. 復旧（2026-10-07）

本人が v3 で確認の成功（`LOGIN_OK_AND_PRIVILEGES_OK`）の後に `REFERENCE_DATA_APPLY_DB_URL` を登録（14:52:44Z・値は見ていない）。
最新の検出 37626220256（repeat ではない・World `079f9eaf92a0`）から orchestrator 37640530762 を手動で再開し、新しい Plan 37640607117（main 3c21ba9）→
Backup v2 37643213528（restore・storage 検証済み）→ Dry run 37643461489（re-diff 0）→ policy 適格 → **無人の Apply 37643713008 = `applied_verified`**
（更新 16・追加 0・削除 0・post-verify OK・監査の batch verified）。公開サイトで 16 件すべてが新しい値・件数 13,372 一致。
状態: **`FULLY_AUTOMATED_UPDATE_RESTORED`**（Evidence `evidence/world-auto-apply-2026-10-07.json`）。

