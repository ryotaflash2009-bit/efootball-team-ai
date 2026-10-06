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
